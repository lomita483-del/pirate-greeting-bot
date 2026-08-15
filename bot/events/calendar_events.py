"""Interaction handling for AHOY calendar event reminder buttons.

The website schedules and delivers event reminders; the embeds carry three
buttons (`ahoy:rsvp:{event_id}:{attending|declined|remindme}`). This cog
records the response and — for "remind me" — creates a personal reminder.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import discord
from discord.ext import commands

from ..utils.logger import get_logger

log = get_logger("calendar")

PREFIX = "ahoy:rsvp:"


class CalendarEvents(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @commands.Cog.listener()
    async def on_interaction(self, interaction: discord.Interaction) -> None:
        if interaction.type is not discord.InteractionType.component:
            return
        custom_id = (interaction.data or {}).get("custom_id", "") if interaction.data else ""
        if not custom_id.startswith(PREFIX):
            return

        parts = custom_id.split(":")
        if len(parts) != 4:
            return
        _, _, event_id, action = parts
        repo = getattr(self.bot, "repo", None)
        if repo is None:
            await interaction.response.send_message(
                "AHOY's database is not configured.", ephemeral=True
            )
            return

        try:
            event = await repo.calendar_event(event_id)
        except Exception as exc:  # pragma: no cover - network failure
            log.warning("RSVP lookup failed: %s", exc)
            event = None

        if event is None:
            await interaction.response.send_message(
                "That event is no longer available.", ephemeral=True
            )
            return

        guild_id = str(event.get("guild_id") or (interaction.guild_id or ""))
        title = event.get("title") or "the event"

        if action == "remindme":
            start_raw = str(event.get("start_time") or "")
            try:
                start = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
            except ValueError:
                start = datetime.now(timezone.utc) + timedelta(minutes=15)
            remind_at = max(
                start - timedelta(minutes=15),
                datetime.now(timezone.utc) + timedelta(seconds=30),
            )
            await repo.add_reminder(
                {
                    "guild_id": guild_id,
                    "channel_id": str(interaction.channel_id) if interaction.channel_id else None,
                    "user_id": str(interaction.user.id),
                    "message": f"Event starting soon: {title}",
                    "remind_at": remind_at.isoformat(),
                    "delivered": False,
                }
            )
            await interaction.response.send_message(
                f"⏰ I'll ping you 15 minutes before **{title}**.", ephemeral=True
            )
            return

        response = "attending" if action == "attending" else "declined"
        await repo.set_event_rsvp(event_id, guild_id, str(interaction.user.id), response)
        counts = await repo.event_rsvp_counts(event_id)
        label = "🟢 attending" if response == "attending" else "🔴 not attending"
        await interaction.response.send_message(
            f"Marked you as {label} for **{title}** — "
            f"🟢 {counts.get('attending', 0)} · 🔴 {counts.get('declined', 0)}.",
            ephemeral=True,
        )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(CalendarEvents(bot))
