"""Central error capture with actionable diagnostics for the !HOY BOT Error Center."""
from __future__ import annotations

import time
import traceback
from typing import Any

import discord
from discord import app_commands
from discord.ext import commands

from ..utils.checks import ActionRefused
from ..utils.logger import get_logger

log = get_logger("errors")

# Prevent one underlying failure from flooding the Error Center when Discord
# dispatches the same exception repeatedly in a short window.
_RECENT_ERRORS: dict[str, float] = {}
_DEDUPE_SECONDS = 15.0


def _diagnostics(
    error: BaseException,
    source: str,
    command: str | None,
    guild_id: str | None,
    channel_id: str | None,
    *,
    guild_name: str | None = None,
    channel_name: str | None = None,
    user_name: str | None = None,
    user_id: str | None = None,
) -> tuple[str, str, str]:
    error_type = type(error).__name__

    if isinstance(error, commands.CommandNotFound):
        command_name = getattr(error, "command", None) or (command or "unknown")
        cause = (
            f"Discord received a prefix command named '{command_name}', but no registered Discord command matched it. "
            "This is normally user input rather than a bot failure."
        )
        location = f"prefix command parser → {command_name}"
    elif isinstance(error, ActionRefused):
        cause = str(error) or "The bot intentionally refused the requested action because a prerequisite or configuration rule was not satisfied."
        location = f"command validation → {command or 'unknown'}"
    elif isinstance(error, commands.MissingPermissions):
        cause = "The member invoking the command does not have one or more Discord permissions required by the command."
        location = f"command permission check → {command or 'unknown'}"
    elif isinstance(error, commands.BotMissingPermissions):
        cause = "!HOY BOT does not have one or more Discord permissions required to complete the operation."
        location = f"bot permission check → {command or 'unknown'}"
    elif isinstance(error, discord.Forbidden):
        cause = "Discord rejected the operation because of permissions, role hierarchy, channel access, or another authorization rule."
        location = f"Discord API → {command or source}"
    elif isinstance(error, discord.NotFound):
        cause = "Discord could not find the target resource. It may have been deleted, moved, or the saved dashboard configuration may be stale."
        location = f"Discord API → {command or source}"
    elif isinstance(error, discord.HTTPException):
        cause = f"Discord returned an API failure while processing the operation (HTTP {getattr(error, 'status', 'unknown')})."
        location = f"Discord API → {command or source}"
    elif isinstance(error, (app_commands.CheckFailure, app_commands.MissingPermissions)):
        cause = "The slash-command check rejected the interaction before the command body completed."
        location = f"application command check → {command or 'unknown'}"
    else:
        cause = f"Unhandled {error_type} raised while processing the {source} path. The traceback identifies the exact Python call chain."
        location = f"{source} handler → {command or 'unknown'}"

    context = (
        f"Server: {guild_name or 'Direct Message / Unknown'} (ID: {guild_id or 'N/A'}); "
        f"Channel: {channel_name or 'Unknown'} (ID: {channel_id or 'N/A'}); "
        f"User: {user_name or 'Unknown'} (ID: {user_id or 'N/A'}); "
        f"Source: {source}; Command: {command or 'N/A'}"
    )
    return cause[:2000], location[:500], context[:2000]


def _dedupe_key(
    source: str,
    error: BaseException,
    command: str | None,
    guild_id: str | None,
    channel_id: str | None,
    user_id: str | None,
) -> str:
    return "|".join(
        [
            source,
            type(error).__name__,
            str(command or ""),
            str(guild_id or ""),
            str(channel_id or ""),
            str(user_id or ""),
            str(error),
        ]
    )[:3000]


class ErrorEvents(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        tree = bot.tree
        original_on_error = tree.on_error

        async def on_app_command_error(
            interaction: discord.Interaction,
            error: app_commands.AppCommandError,
        ) -> None:
            original = getattr(error, "original", error)
            await self._record(
                source="app_command",
                error=original,
                guild_id=str(interaction.guild_id) if interaction.guild_id else None,
                command=interaction.command.qualified_name if interaction.command else None,
                user_id=str(interaction.user.id) if interaction.user else None,
                channel_id=str(interaction.channel_id) if interaction.channel_id else None,
                guild_name=interaction.guild.name if interaction.guild else None,
                channel_name=getattr(interaction.channel, "name", None),
                user_name=str(interaction.user) if interaction.user else None,
            )
            await original_on_error(interaction, error)

        tree.on_error = on_app_command_error  # type: ignore[assignment]

    async def _record(
        self,
        *,
        source: str,
        error: BaseException,
        guild_id: str | None = None,
        command: str | None = None,
        user_id: str | None = None,
        channel_id: str | None = None,
        guild_name: str | None = None,
        channel_name: str | None = None,
        user_name: str | None = None,
    ) -> None:
        # Expected user/configuration refusals should not pollute the ERROR
        # center. They are still surfaced to the user by the command layer.
        if isinstance(error, (commands.CommandNotFound, ActionRefused)):
            return

        try:
            key = _dedupe_key(source, error, command, guild_id, channel_id, user_id)
            now = time.monotonic()
            last = _RECENT_ERRORS.get(key)
            if last is not None and now - last < _DEDUPE_SECONDS:
                return
            _RECENT_ERRORS[key] = now

            # Keep the in-memory cache bounded.
            if len(_RECENT_ERRORS) > 1000:
                cutoff = now - _DEDUPE_SECONDS
                for old_key, old_time in list(_RECENT_ERRORS.items()):
                    if old_time < cutoff:
                        _RECENT_ERRORS.pop(old_key, None)

            tb = "".join(traceback.format_exception(type(error), error, error.__traceback__))
            cause, location, context = _diagnostics(
                error,
                source,
                command,
                guild_id,
                channel_id,
                guild_name=guild_name,
                channel_name=channel_name,
                user_name=user_name,
                user_id=user_id,
            )
            message = str(error) or repr(error)
            await self.bot.repo.db.try_run(  # type: ignore[attr-defined]
                lambda c: c.table("bot_error_logs").insert({
                    "source": source,
                    "error_type": type(error).__name__,
                    "message": message[:2000],
                    "guild_id": guild_id,
                    "command": command,
                    "traceback": tb[:8000] or None,
                    "user_id": user_id,
                    "channel_id": channel_id,
                    "cause": cause,
                    "location": location,
                    "context": context,
                }).execute()
            )
        except Exception:
            # Error reporting must never recursively become another reported
            # application error.
            log.exception("Failed to record error log entry")

    @commands.Cog.listener()
    async def on_command_error(self, ctx: commands.Context, error: commands.CommandError) -> None:
        await self._record(
            source="command",
            error=error,
            guild_id=str(ctx.guild.id) if ctx.guild else None,
            command=ctx.command.qualified_name if ctx.command else getattr(error, "command", None),
            user_id=str(ctx.author.id) if ctx.author else None,
            channel_id=str(ctx.channel.id) if ctx.channel else None,
            guild_name=ctx.guild.name if ctx.guild else None,
            channel_name=getattr(ctx.channel, "name", None),
            user_name=str(ctx.author) if ctx.author else None,
        )

    @commands.Cog.listener()
    async def on_error(self, event_method: str, *args: Any, **kwargs: Any) -> None:
        import sys

        error = sys.exc_info()[1]
        if error is None:
            return
        await self._record(source="event", error=error, command=event_method)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(ErrorEvents(bot))
