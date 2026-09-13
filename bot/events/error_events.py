"""Central error capture with actionable diagnostics for the !HOY BOT Error Center."""
from __future__ import annotations
import traceback
import discord
from discord import app_commands
from discord.ext import commands
from ..utils.logger import get_logger
log = get_logger("errors")


def _diagnostics(error: BaseException, source: str, command: str | None, guild_id: str | None, channel_id: str | None) -> tuple[str, str, str]:
    error_type = type(error).__name__
    if isinstance(error, commands.CommandNotFound):
        command_name = getattr(error, "command", None) or (command or "unknown")
        cause = f"Discord.py received a prefix command that is not registered: '{command_name}'. This commonly happens when a user types normal text beginning with the bot prefix, or when a custom command/command registration is missing."
        location = f"prefix command handler / {command_name}"
    elif isinstance(error, commands.MissingPermissions):
        cause = "The member invoking the command does not have one or more required Discord permissions."
        location = f"command permission check / {command or 'unknown'}"
    elif isinstance(error, commands.BotMissingPermissions):
        cause = "!HOY BOT does not have one or more Discord permissions required to complete the command."
        location = f"Discord permission check / {command or 'unknown'}"
    elif isinstance(error, discord.Forbidden):
        cause = "Discord rejected the operation because the bot lacks permission, role hierarchy, or access to the target resource."
        location = f"Discord API / {command or source}"
    elif isinstance(error, discord.NotFound):
        cause = "Discord could not find the target resource. It may have been deleted, moved, or referenced by stale configuration."
        location = f"Discord API / {command or source}"
    elif isinstance(error, discord.HTTPException):
        cause = f"Discord returned an HTTP/API failure while the bot was processing the operation (HTTP {getattr(error, 'status', 'unknown')})."
        location = f"Discord API / {command or source}"
    elif isinstance(error, (app_commands.CheckFailure, app_commands.MissingPermissions)):
        cause = "The slash-command check rejected the interaction before the command body could complete."
        location = f"application command check / {command or 'unknown'}"
    else:
        cause = f"Unhandled {error_type} raised while processing {source}. The traceback identifies the exact failing code path."
        location = f"{source} handler / {command or 'unknown'}"
    context = f"source={source}; guild={guild_id or 'N/A'}; channel={channel_id or 'N/A'}; command={command or 'N/A'}"
    return cause[:2000], location[:500], context[:2000]

class ErrorEvents(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        tree = bot.tree
        original_on_error = tree.on_error
        async def on_app_command_error(interaction: discord.Interaction, error: app_commands.AppCommandError) -> None:
            original = getattr(error, "original", error)
            await self._record(source="app_command", error=original, guild_id=str(interaction.guild_id) if interaction.guild_id else None, command=interaction.command.qualified_name if interaction.command else None, user_id=str(interaction.user.id) if interaction.user else None, channel_id=str(interaction.channel_id) if interaction.channel_id else None)
            await original_on_error(interaction, error)
        tree.on_error = on_app_command_error  # type: ignore[assignment]

    async def _record(self, *, source: str, error: BaseException, guild_id: str | None = None, command: str | None = None, user_id: str | None = None, channel_id: str | None = None) -> None:
        try:
            tb = "".join(traceback.format_exception(type(error), error, error.__traceback__))
            cause, location, context = _diagnostics(error, source, command, guild_id, channel_id)
            await self.bot.repo.log_error(source=source, error_type=type(error).__name__, message=str(error) or repr(error), guild_id=guild_id, command=command, traceback_text=tb, user_id=user_id, channel_id=channel_id, cause=cause, location=location, context=context)
        except Exception:
            log.exception("Failed to record error log entry")

    @commands.Cog.listener()
    async def on_command_error(self, ctx: commands.Context, error: commands.CommandError) -> None:
        await self._record(source="command", error=error, guild_id=str(ctx.guild.id) if ctx.guild else None, command=ctx.command.qualified_name if ctx.command else getattr(error, "command", None), user_id=str(ctx.author.id) if ctx.author else None, channel_id=str(ctx.channel.id) if ctx.channel else None)

    @commands.Cog.listener()
    async def on_error(self, event_method: str, *args, **kwargs) -> None:
        import sys
        error = sys.exc_info()[1]
        if error is None: return
        await self._record(source="event", error=error, command=event_method)

async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(ErrorEvents(bot))
