"""AHOY — Discord bot entry point.

Startup sequence:
  1. Load environment configuration
  2. Connect to the database
  3. Load feature extensions
  4. Register slash commands
  5. Connect to Discord
  6. Handle graceful shutdown
"""

from __future__ import annotations

import asyncio
import signal
from datetime import datetime, timezone
from typing import Optional

import discord
from discord import app_commands
from discord.ext import commands

from .config import Config, ConfigError, load_config
from .database.client import Database, DatabaseError
from .database.repository import Repository
from .services.automod_service import AutoModService
from .services.level_service import LevelService
from .services.log_service import LogService
from .services.moderation_service import ModerationService
from .health import start_health_server
from .services.platform_service import AccessDenied, PlatformService
from .services.activity_service import ActivityService
from .services.starboard_service import StarboardService
from .services.feature_service import FeatureService

from .services.settings_service import SettingsService
from .utils import embeds
from .utils.checks import ActionRefused
from .utils.logger import get_logger, setup_logging

EXTENSIONS = (
    "bot.commands.general",
    "bot.commands.moderation",
    "bot.commands.levels",
    "bot.commands.economy",
    "bot.commands.tickets",
    "bot.commands.reminders",
    "bot.commands.reaction_roles",
    "bot.commands.giveaways",
    "bot.commands.polls",
    "bot.commands.profile",
    "bot.commands.stats",
    "bot.commands.calendar",
    "bot.commands.library",
    "bot.events.guild_events",
    "bot.events.member_events",
    "bot.events.message_events",
    "bot.events.reaction_events",
    "bot.events.activity_events",
    "bot.events.calendar_events",
    "bot.events.scheduler",
)

log = get_logger("core")


class AhoyBot(commands.Bot):
    def __init__(self, config: Config) -> None:
        intents = discord.Intents.default()
        intents.members = True
        intents.message_content = True
        intents.voice_states = True
        intents.reactions = True

        super().__init__(
            command_prefix=commands.when_mentioned,
            intents=intents,
            help_command=None,
            activity=discord.Activity(
                type=discord.ActivityType.watching, name="the horizon ⚓"
            ),
        )

        self.config = config
        self.started_at = datetime.now(timezone.utc)
        self.db = Database(config.supabase_url, config.supabase_key)
        self.repo = Repository(self.db)
        self.settings = SettingsService(self.repo)
        self.logs = LogService(self, self.settings)
        self.moderation = ModerationService(self.repo, self.logs)
        self.levels = LevelService(self.repo, self.settings)
        self.automod = AutoModService(self.settings, self.moderation)
        self.platform = PlatformService(self.repo)
        self.starboard = StarboardService(self, self.repo)
        self.activity_log = ActivityService(self.repo, self.logs)
        self.features = FeatureService(self.repo)
        self._notification_task: Optional[asyncio.Task[None]] = None
        self._health_runner = None
        self._synced_guild_ids: set[int] = set()

    async def setup_hook(self) -> None:
        await self.db.connect()

        for extension in EXTENSIONS:
            try:
                await self.load_extension(extension)
                log.info("Loaded extension %s", extension)
            except Exception as exc:
                log.exception("Failed to load %s: %s", extension, exc)

        self.tree.on_error = self.on_app_command_error
        self.tree.interaction_check = self._platform_gate

        # Commands are registered per-guild in on_ready (instant propagation —
        # Discord can take up to an hour to roll out global command changes).
        # An earlier deploy registered everything globally as well, which left
        # a duplicate copy of every command sitting in Discord's picker.
        #
        # To undo that we push an *empty* global command list to Discord once,
        # which clears those stale registrations. clear_commands() also empties
        # the tree's own in-memory global bucket though, and copy_global_to()
        # (used below in on_ready, and by any future guild-join sync) copies
        # FROM that same bucket — so we save the commands first and add them
        # straight back into the tree afterward, without re-syncing them to
        # Discord's global scope. This keeps them available locally for
        # per-guild copying while staying un-registered globally.
        global_commands = self.tree.get_commands(guild=None)
        if global_commands:
            self.tree.clear_commands(guild=None)
            await self.tree.sync()
            for command in global_commands:
                self.tree.add_command(command)
            log.info("Cleared %d stale global command registration(s).", len(global_commands))

        self._health_runner = await start_health_server(self)


    async def _platform_gate(self, interaction: discord.Interaction) -> bool:
        """Owner-level access control: runs before every slash command."""
        command_name = getattr(interaction.command, "name", "")
        try:
            await self.platform.ensure_allowed(str(interaction.user.id), command_name)
        except AccessDenied as exc:
            raise ActionRefused(str(exc)) from exc
        except DatabaseError:
            # Never lock the whole bot out because the database blipped.
            return True
        return True

    # -- owner notification delivery ------------------------------------
    async def _deliver_notifications(self) -> None:
        await self.wait_until_ready()
        while not self.is_closed():
            try:
                for item in await self.repo.pending_notifications():
                    await self._deliver_one(item)
            except Exception as exc:  # keep the loop alive
                log.warning("Notification delivery failed: %s", exc)
            await asyncio.sleep(30)

    async def _deliver_one(self, item: dict) -> None:
        title = item.get("title") or "Notice from AHOY"
        body = item.get("body") or ""
        embed = embeds.info(title, body)
        sent = False
        error = None

        if item.get("via_dm"):
            targets: list[int] = []
            if item.get("target_type") == "user" and item.get("target_user_id"):
                targets = [int(item["target_user_id"])]
            elif item.get("target_type") == "guild" and item.get("target_guild_id"):
                guild = self.get_guild(int(item["target_guild_id"]))
                targets = [m.id for m in (guild.members if guild else []) if not m.bot][:500]
            for user_id in targets:
                try:
                    user = self.get_user(user_id) or await self.fetch_user(user_id)
                    await user.send(embed=embed)
                    sent = True
                except discord.HTTPException:
                    continue

        if item.get("via_announcement"):
            guild_ids = (
                [item["target_guild_id"]]
                if item.get("target_guild_id")
                else [str(g.id) for g in self.guilds]
            )
            for guild_id in guild_ids:
                guild = self.get_guild(int(guild_id))
                if guild is None:
                    continue
                channel = None
                if item.get("announcement_channel_id"):
                    channel = guild.get_channel(int(item["announcement_channel_id"]))
                channel = channel or guild.system_channel
                if channel is None:
                    continue
                try:
                    await channel.send(embed=embed)
                    sent = True
                except discord.HTTPException as exc:
                    error = str(exc)

        await self.repo.mark_notification(
            item["id"], "sent" if sent else "failed", None if sent else (error or "No reachable target")
        )

    async def on_ready(self) -> None:
        log.info(
            "AHOY is online as %s (%s) across %d server(s).",
            self.user,
            getattr(self.user, "id", "?"),
            len(self.guilds),
        )
        if self._notification_task is None:
            self._notification_task = asyncio.create_task(self._deliver_notifications())

        for guild in self.guilds:
            # Guild-scoped sync makes commands appear instantly instead of
            # waiting on Discord's global command propagation. Skip guilds
            # we've already synced this session — re-copying and re-syncing
            # on every reconnect is unnecessary API traffic, not just a
            # cosmetic issue, since Discord rate-limits command syncs.
            if guild.id in self._synced_guild_ids:
                continue
            try:
                self.tree.copy_global_to(guild=guild)
                await self.tree.sync(guild=guild)
                self._synced_guild_ids.add(guild.id)
            except discord.HTTPException as exc:
                log.warning("Command sync failed for %s: %s", guild.id, exc)
            await self.repo.upsert_server(
                str(guild.id),
                guild.name,
                guild.icon.key if guild.icon else None,
                str(guild.owner_id) if guild.owner_id else None,
                guild.member_count or 0,
            )

    # -- global error handling ----------------------------------------
    async def on_app_command_error(
        self, interaction: discord.Interaction, error: app_commands.AppCommandError
    ) -> None:
        original = getattr(error, "original", error)

        if isinstance(original, ActionRefused):
            embed = embeds.warning("Action not allowed", str(original))
        elif isinstance(error, app_commands.CommandOnCooldown):
            embed = embeds.warning(
                "Slow down", f"Try again in {error.retry_after:.0f} seconds."
            )
        elif isinstance(error, (app_commands.MissingPermissions, app_commands.CheckFailure)):
            embed = embeds.warning(
                "Missing permissions", "You do not have permission to use that command."
            )
        elif isinstance(original, app_commands.BotMissingPermissions):
            embed = embeds.error(
                "AHOY is missing permissions",
                "Please grant AHOY the permissions needed for this action.",
            )
        elif isinstance(original, discord.Forbidden):
            embed = embeds.error(
                "Discord refused that action",
                "AHOY lacks permission or role position to complete it.",
            )
        elif isinstance(original, discord.RateLimited):
            embed = embeds.warning(
                "Rate limited", "Discord is throttling requests. Please retry shortly."
            )
        elif isinstance(original, DatabaseError):
            embed = embeds.error(
                "Storage unavailable",
                "AHOY could not reach its database. The action was not saved.",
            )
        elif isinstance(original, discord.HTTPException):
            embed = embeds.error(
                "Discord API error", "Discord returned an error. Please try again."
            )
        else:
            embed = embeds.error(
                "Something went wrong",
                "AHOY hit an unexpected problem. The crew has been notified.",
            )

        log.exception(
            "Command error in /%s: %s",
            getattr(interaction.command, "name", "unknown"),
            original,
        )

        try:
            if interaction.response.is_done():
                await interaction.followup.send(embed=embed, ephemeral=True)
            else:
                await interaction.response.send_message(embed=embed, ephemeral=True)
        except discord.HTTPException:
            pass

    async def close(self) -> None:
        log.info("AHOY is shutting down gracefully…")
        if self._health_runner is not None:
            try:
                await self._health_runner.cleanup()
            except Exception:  # pragma: no cover
                pass
        await super().close()


async def run() -> None:
    config = load_config()
    setup_logging(config.log_level)
    bot = AhoyBot(config)

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, lambda: asyncio.create_task(bot.close()))
        except NotImplementedError:  # Windows
            pass

    async with bot:
        await bot.start(config.discord_token)


def main() -> None:
    try:
        asyncio.run(run())
    except ConfigError as exc:
        print(f"Configuration error: {exc}")
    except KeyboardInterrupt:
        print("AHOY stopped.")


if __name__ == "__main__":
    main()
