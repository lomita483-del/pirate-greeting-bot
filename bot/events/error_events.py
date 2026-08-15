"""Central error capture: logs every command/app-command/event error so the
website's Error Log page has something real to show."""

from __future__ import annotations

import traceback

import discord
from discord import app_commands
from discord.ext import commands

from ..utils.logger import get_logger

log = get_logger("errors")


class ErrorEvents(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

        # app_commands errors go through the CommandTree, not Cog listeners.
        tree = bot.tree
        original_on_error = tree.on_error

        async def on_app_command_error(
            interaction: discord.Interaction, error: app_commands.AppCommandError
        ) -> None:
            await self._record(
                source="app_command",
                error=error,
                guild_id=str(interaction.guild_id) if interaction.guild_id else None,
                command=interaction.command.qualified_name if interaction.command else None,
                user_id=str(interaction.user.id) if interaction.user else None,
                channel_id=str(interaction.channel_id) if interaction.channel_id else None,
            )
            # Preserve whatever behavior was already there (user-facing replies etc).
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
    ) -> None:
        try:
            tb = "".join(traceback.format_exception(type(error), error, error.__traceback__))
            await self.bot.repo.log_error(  # type: ignore[attr-defined]
                source=source,
                error_type=type(error).__name__,
                message=str(error) or repr(error),
                guild_id=guild_id,
                command=command,
                traceback_text=tb,
                user_id=user_id,
                channel_id=channel_id,
            )
        except Exception:  # never let error logging itself crash the bot
            log.exception("Failed to record error log entry")

    @commands.Cog.listener()
    async def on_command_error(self, ctx: commands.Context, error: commands.CommandError) -> None:
        await self._record(
            source="command",
            error=error,
            guild_id=str(ctx.guild.id) if ctx.guild else None,
            command=ctx.command.qualified_name if ctx.command else None,
            user_id=str(ctx.author.id) if ctx.author else None,
            channel_id=str(ctx.channel.id) if ctx.channel else None,
        )

    @commands.Cog.listener()
    async def on_error(self, event_method: str, *args, **kwargs) -> None:  # noqa: ANN002, ANN003
        import sys

        error = sys.exc_info()[1]
        if error is None:
            return
        await self._record(source="event", error=error, command=event_method)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(ErrorEvents(bot))
