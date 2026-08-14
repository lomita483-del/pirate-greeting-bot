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
    "bot.events.guild_events",
    "bot.events.member_events",
    "bot.events.message_events",
)

log = get_logger("core")


class AhoyBot(commands.Bot):
    def __init__(self, config: Config) -> None:
        intents = discord.Intents.default()
        intents.members = True
        intents.message_content = True
        intents.voice_states = True

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

    async def setup_hook(self) -> None:
        await self.db.connect()

        for extension in EXTENSIONS:
            try:
                await self.load_extension(extension)
                log.info("Loaded extension %s", extension)
            except Exception as exc:
                log.exception("Failed to load %s: %s", extension, exc)

        self.tree.on_error = self.on_app_command_error
        synced = await self.tree.sync()
        log.info("Registered %d slash commands with Discord.", len(synced))

    async def on_ready(self) -> None:
        log.info(
            "AHOY is online as %s (%s) across %d server(s).",
            self.user,
            getattr(self.user, "id", "?"),
            len(self.guilds),
        )
        for guild in self.guilds:
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
