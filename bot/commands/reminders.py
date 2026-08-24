"""Persistent personal reminders."""

from __future__ import annotations

from datetime import datetime, timezone

import discord
from discord import app_commands
from discord.ext import commands, tasks

from ..utils import embeds
from ..utils.checks import ActionRefused
from ..utils.logger import get_logger
from ..utils.parsing import DurationError, clean_text, humanize, parse_duration

log = get_logger("reminders")


class Reminders(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self.dispatch_due.start()

    async def cog_unload(self) -> None:
        self.dispatch_due.cancel()

    @app_commands.command(name="remind", description="Set a personal reminder.")
    @app_commands.describe(time="e.g. 30m, 2h, 1d", message="What should AHOY remind you about?")
    async def remind(
        self, interaction: discord.Interaction, time: str, message: str
    ) -> None:
        try:
            delta = parse_duration(time)
        except DurationError as exc:
            raise ActionRefused(str(exc)) from exc

        due = datetime.now(timezone.utc) + delta
        await interaction.response.defer(ephemeral=True)
        await self.bot.repo.add_reminder(  # type: ignore[attr-defined]
            {
                "guild_id": str(interaction.guild_id) if interaction.guild_id else None,
                "channel_id": str(interaction.channel_id) if interaction.channel_id else None,
                "user_id": str(interaction.user.id),
                "message": clean_text(message, 500),
                "remind_at": due.isoformat(),
            }
        )
        await interaction.followup.send(
            embed=embeds.success(
                "Reminder set",
                f"In **{humanize(int(delta.total_seconds()))}** "
                f"({discord.utils.format_dt(due, 'f')}) I will remind you:\n"
                f"> {clean_text(message, 200)}",
            ),
            ephemeral=True,
        )

    @tasks.loop(seconds=30)
    async def dispatch_due(self) -> None:
        repo = getattr(self.bot, "repo", None)
        if repo is None or not self.bot.db.connected:  # type: ignore[attr-defined]
            return
        try:
            for row in await repo.due_reminders():
                await self._deliver(row)
                await repo.mark_reminder_delivered(row["id"])
        except Exception as exc:  # pragma: no cover
            log.exception("Reminder dispatch failed: %s", exc)

    async def _calendar_embed(self, event_id: str) -> discord.Embed | None:
        """Rebuild the same '📅 EVENT REMINDER' embed the scheduler uses,
        computed fresh right now — so times shown are always accurate,
        never a stale promise from when the reminder was scheduled."""
        repo = getattr(self.bot, "repo", None)
        if repo is None:
            return None
        try:
            event = await repo.calendar_event(event_id)
        except Exception:
            return None
        if not event:
            return None

        try:
            start = datetime.fromisoformat(str(event.get("start_time")).replace("Z", "+00:00"))
            start_ts = int(start.timestamp())
        except (ValueError, TypeError):
            start_ts = None

        description_lines = [f"**Event Name:** {event.get('title') or 'Untitled event'}"]
        if start_ts:
            description_lines.append(f"**Starting In:** <t:{start_ts}:R>")
            description_lines.append(f"**Date And Time:** <t:{start_ts}:F>")
            description_lines.append(f">>> **Duration:** <t:{start_ts}:R> <<<")
        if event.get("location"):
            description_lines.append(f"📍 {event['location']}")
        if event.get("html_link"):
            description_lines.append(f"[Open in calendar]({event['html_link']})")

        embed = discord.Embed(
            title="📅 EVENT REMINDER",
            description="\n".join(description_lines),
            color=embeds.TEAL,
            timestamp=datetime.now(timezone.utc),
        )
        guild_id = event.get("guild_id")
        guild = self.bot.get_guild(int(guild_id)) if guild_id else None
        if guild is not None and guild.icon is not None:
            embed.set_thumbnail(url=guild.icon.url)
        if self.bot.user is not None:
            embed.set_footer(text=f"{embeds.BRAND} ⚓", icon_url=self.bot.user.display_avatar.url)
        else:
            embed.set_footer(text=f"{embeds.BRAND} ⚓")
        return embed

    async def _deliver(self, row: dict) -> None:
        embed: discord.Embed | None = None
        if row.get("event_id"):
            embed = await self._calendar_embed(row["event_id"])
        if embed is None:
            # Not a calendar reminder, or the event vanished — fall back to
            # the plain personal-reminder embed as before.
            embed = embeds.brand("Reminder ⚓", row.get("message", ""))

        user = self.bot.get_user(int(row["user_id"]))
        channel = (
            self.bot.get_channel(int(row["channel_id"])) if row.get("channel_id") else None
        )
        try:
            if isinstance(channel, discord.abc.Messageable):
                await channel.send(content=f"<@{row['user_id']}>", embed=embed)
            elif user is not None:
                await user.send(embed=embed)
        except discord.HTTPException as exc:
            log.warning("Could not deliver reminder %s: %s", row.get("id"), exc)

    @dispatch_due.before_loop
    async def before_dispatch(self) -> None:
        await self.bot.wait_until_ready()


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Reminders(bot))
