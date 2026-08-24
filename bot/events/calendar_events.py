"""Interaction handling for AHOY calendar event reminder buttons.

The website schedules and delivers event reminders; the embeds carry a
"Remind me" button (`ahoy:rsvp:{event_id}:remindme`). This cog creates a
personal DM reminder for whoever clicks it. Older messages sent before this
update may still show the retired "Attending"/"Can't make it" buttons —
those are handled here too, for backward compatibility, but are no longer
attached to any new reminder.
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

            now = datetime.now(timezone.utc)
            target = start - timedelta(minutes=15)
            # If "15 minutes before" has already passed (e.g. this button was
            # clicked from a reminder that itself fired inside that window),
            # don't silently reschedule further out than promised — fire as
            # soon as sensibly possible instead, and be honest about it below.
            remind_at = target if target > now + timedelta(seconds=20) else now + timedelta(seconds=20)

            await repo.add_reminder(
                {
                    "guild_id": guild_id,
                    # No channel_id — this must always be delivered by DM,
                    # never posted back into the channel the button was
                    # clicked in. bot/commands/reminders.py's dispatcher
                    # falls back to a DM whenever channel_id is empty.
                    "channel_id": None,
                    "user_id": str(interaction.user.id),
                    "message": f"Event starting soon: {title}",
                    "event_id": event_id,
                    "remind_at": remind_at.isoformat(),
                    "delivered": False,
                }
            )
            # A live Discord timestamp instead of a hardcoded "15 minutes" —
            # this is always accurate even when remind_at got clamped above.
            when = f"<t:{int(remind_at.timestamp())}:R>"
            await interaction.response.send_message(
                f"⏰ I'll DM you {when}, before **{title}**.", ephemeral=True
            )
            return

        # Retired: "attending" / "declined" are no longer offered on new
        # reminders, but old messages sent before this update may still
        # carry those buttons — keep honoring them rather than breaking.
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
