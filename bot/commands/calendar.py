"""AHOY calendar commands — read the synced schedule from Discord.

The dashboard owns configuration (feeds, notifiers, filters, templates); these
commands surface the same data in-channel and let crew members RSVP or trigger
an out-of-band sync.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import discord
from discord import app_commands
from discord.ext import commands

from ..utils import embeds
from ..utils.checks import ensure_guild
from ..utils.logger import get_logger

log = get_logger("calendar-commands")

DASHBOARD = "https://ahoy.lovable.app/dashboard"


def _parse(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _stamp(value: Any, style: str = "F") -> str:
    moment = _parse(value)
    if moment is None:
        return "unknown time"
    return f"<t:{int(moment.timestamp())}:{style}>"


def _line(event: dict[str, Any]) -> str:
    title = str(event.get("title") or "Untitled event")[:120]
    parts = [f"**{title}**", f"{_stamp(event.get('start_time'))} · {_stamp(event.get('start_time'), 'R')}"]
    if event.get("location"):
        parts.append(f"📍 {str(event['location'])[:80]}")
    if event.get("html_link"):
        parts.append(f"[Open in calendar]({event['html_link']})")
    return "\n".join(parts)


def _rsvp_view(event_id: str) -> discord.ui.View:
    view = discord.ui.View(timeout=None)
    for action, label, style, emoji in (
        ("attending", "Attending", discord.ButtonStyle.success, "✅"),
        ("declined", "Can't make it", discord.ButtonStyle.secondary, "❌"),
        ("remindme", "Remind me", discord.ButtonStyle.primary, "🔔"),
    ):
        view.add_item(
            discord.ui.Button(
                label=label,
                style=style,
                emoji=emoji,
                custom_id=f"ahoy:rsvp:{event_id}:{action}",
            )
        )
    return view


class CalendarCommands(commands.Cog):
    """Slash surface for the AHOY calendar system."""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    group = app_commands.Group(name="calendar", description="AHOY calendar & event automation")

    def _repo(self):
        return getattr(self.bot, "repo", None)

    async def _guard(self, interaction: discord.Interaction):
        ensure_guild(interaction)
        repo = self._repo()
        if repo is None:
            await interaction.response.send_message(
                "AHOY's database is not configured.", ephemeral=True
            )
            return None
        return repo

    # -- schedule views -------------------------------------------------
    @group.command(name="upcoming", description="Show the next events on the crew calendar")
    @app_commands.describe(count="How many events to list (1-15)")
    async def upcoming(self, interaction: discord.Interaction, count: int = 5) -> None:
        repo = await self._guard(interaction)
        if repo is None:
            return
        await interaction.response.defer(ephemeral=True)
        rows = await repo.upcoming_events(str(interaction.guild_id), max(1, min(count, 15)))
        if not rows:
            await interaction.followup.send(
                embed=embeds.brand("📅 Upcoming events", "Nothing scheduled — the seas are calm."),
                ephemeral=True,
            )
            return
        body = "\n\n".join(_line(row) for row in rows)
        await interaction.followup.send(
            embed=embeds.brand(f"📅 Next {len(rows)} event(s)", body), ephemeral=True
        )

    @group.command(name="today", description="Everything happening in the next 24 hours")
    async def today(self, interaction: discord.Interaction) -> None:
        await self._range(interaction, 1, "📅 Today's events")

    @group.command(name="week", description="Everything happening over the next 7 days")
    async def week(self, interaction: discord.Interaction) -> None:
        await self._range(interaction, 7, "🗓️ This week's events")

    async def _range(self, interaction: discord.Interaction, days: int, title: str) -> None:
        repo = await self._guard(interaction)
        if repo is None:
            return
        await interaction.response.defer(ephemeral=True)
        now = datetime.now(timezone.utc)
        rows = await repo.events_between(
            str(interaction.guild_id), now.isoformat(), (now + timedelta(days=days)).isoformat()
        )
        body = "\n\n".join(_line(row) for row in rows) if rows else "Nothing scheduled in this window."
        await interaction.followup.send(embed=embeds.brand(title, body), ephemeral=True)

    @group.command(name="next", description="Announce the next event with RSVP buttons")
    async def next_event(self, interaction: discord.Interaction) -> None:
        repo = await self._guard(interaction)
        if repo is None:
            return
        await interaction.response.defer()
        rows = await repo.upcoming_events(str(interaction.guild_id), 1)
        if not rows:
            await interaction.followup.send("No upcoming events on the calendar.")
            return
        event = rows[0]
        embed = embeds.brand(
            f"⚓ {str(event.get('title') or 'Next event')[:200]}",
            _line(event) + (f"\n\n{str(event.get('description'))[:600]}" if event.get("description") else ""),
        )
        await interaction.followup.send(embed=embed, view=_rsvp_view(str(event.get("id"))))

    # -- configuration read-outs ----------------------------------------
    @group.command(name="feeds", description="List the calendars connected to this server")
    async def feeds(self, interaction: discord.Interaction) -> None:
        repo = await self._guard(interaction)
        if repo is None:
            return
        await interaction.response.defer(ephemeral=True)
        rows = await repo.calendar_sources(str(interaction.guild_id))
        if not rows:
            await interaction.followup.send(
                embed=embeds.brand(
                    "🔗 Calendar feeds",
                    f"No calendars connected yet. Add one in the [control center]({DASHBOARD}).",
                ),
                ephemeral=True,
            )
            return
        lines = []
        for row in rows:
            status = str(row.get("sync_status") or "idle")
            icon = "🟢" if status == "ok" else ("🔴" if status == "error" else "🟡")
            lines.append(
                f"{icon} **{row.get('name')}** · `{row.get('source_type')}` · "
                f"last sync {_stamp(row.get('last_synced_at'), 'R')}"
                + (f"\n└ ⚠️ {str(row.get('sync_error'))[:120]}" if row.get("sync_error") else "")
            )
        await interaction.followup.send(
            embed=embeds.brand("🔗 Calendar feeds", "\n".join(lines)), ephemeral=True
        )

    @group.command(name="notifiers", description="Show configured reminder notifiers")
    async def notifiers(self, interaction: discord.Interaction) -> None:
        repo = await self._guard(interaction)
        if repo is None:
            return
        await interaction.response.defer(ephemeral=True)
        rows = await repo.event_notifiers(str(interaction.guild_id))
        if not rows:
            await interaction.followup.send(
                embed=embeds.brand(
                    "🔔 Notifiers", f"None configured. Create one in the [control center]({DASHBOARD})."
                ),
                ephemeral=True,
            )
            return
        lines = []
        for row in rows:
            offsets = ", ".join(f"{int(m)}m" for m in (row.get("reminder_offsets") or [])) or "no offsets"
            health = str(row.get("health_status") or "healthy")
            icon = "🟢" if health == "healthy" else ("🟠" if health == "degraded" else "🔴")
            state = "" if row.get("enabled", True) else " · ⏸️ paused"
            lines.append(
                f"{icon} **{row.get('name')}** → <#{row.get('reminder_channel_id') or row.get('channel_id')}>\n"
                f"└ ⏱️ {offsets} · 🕒 {row.get('timezone') or 'UTC'} · 🔭 {row.get('detection_days') or 30}d{state}"
            )
        await interaction.followup.send(
            embed=embeds.brand("🔔 Event notifiers", "\n".join(lines)), ephemeral=True
        )

    @group.command(name="filters", description="Show the include/exclude rules applied to events")
    async def filters(self, interaction: discord.Interaction) -> None:
        repo = await self._guard(interaction)
        if repo is None:
            return
        await interaction.response.defer(ephemeral=True)
        rows = await repo.calendar_filters(str(interaction.guild_id))
        if not rows:
            await interaction.followup.send(
                embed=embeds.brand("🧭 Event filters", "No filters — every synced event is eligible."),
                ephemeral=True,
            )
            return
        lines = [
            f"{'🚫' if row.get('action') == 'exclude' else '✅'} `{row.get('field')} "
            f"{row.get('operator')} \"{row.get('value')}\"`"
            + ("" if row.get("enabled", True) else " · disabled")
            for row in rows
        ]
        await interaction.followup.send(
            embed=embeds.brand("🧭 Event filters", "\n".join(lines)), ephemeral=True
        )

    @group.command(name="status", description="Health of the calendar automation pipeline")
    async def status(self, interaction: discord.Interaction) -> None:
        repo = await self._guard(interaction)
        if repo is None:
            return
        await interaction.response.defer(ephemeral=True)
        guild_id = str(interaction.guild_id)
        sources = await repo.calendar_sources(guild_id)
        notifiers = await repo.event_notifiers(guild_id)
        pending = await repo.pending_reminder_count(guild_id)
        upcoming = await repo.upcoming_events(guild_id, 1)
        unhealthy = [n for n in notifiers if str(n.get("health_status") or "healthy") != "healthy"]
        errored = [s for s in sources if str(s.get("sync_status")) == "error"]

        body = "\n".join(
            [
                f"📚 **Feeds:** {len(sources)} connected · {len(errored)} failing",
                f"🔔 **Notifiers:** {len(notifiers)} · {len(unhealthy)} unhealthy",
                f"⏳ **Pending reminders:** {pending}",
                f"📅 **Next event:** {_stamp(upcoming[0].get('start_time'), 'R') if upcoming else 'none scheduled'}",
            ]
        )
        await interaction.followup.send(
            embed=embeds.brand("🩺 Calendar status", body), ephemeral=True
        )

    @group.command(name="logs", description="Recent calendar deliveries and failures")
    async def logs(self, interaction: discord.Interaction) -> None:
        repo = await self._guard(interaction)
        if repo is None:
            return
        await interaction.response.defer(ephemeral=True)
        rows = await repo.calendar_job_log(str(interaction.guild_id), 10)
        if not rows:
            await interaction.followup.send(
                embed=embeds.brand("🧾 Calendar log", "Nothing delivered yet."), ephemeral=True
            )
            return
        lines = [
            f"{'✅' if row.get('status') == 'sent' else '⚠️'} `{row.get('job_type')}` "
            f"{_stamp(row.get('created_at'), 'R')}"
            + (f" · {str(row.get('error'))[:80]}" if row.get("error") else "")
            for row in rows
        ]
        await interaction.followup.send(
            embed=embeds.brand("🧾 Calendar log", "\n".join(lines)), ephemeral=True
        )

    @group.command(name="sync", description="Queue an immediate calendar sync")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def sync(self, interaction: discord.Interaction) -> None:
        repo = await self._guard(interaction)
        if repo is None:
            return
        await interaction.response.defer(ephemeral=True)
        await repo.queue_calendar_sync(str(interaction.guild_id), str(interaction.user.id))
        await interaction.followup.send(
            embed=embeds.brand(
                "🔄 Sync queued",
                "AHOY will refresh the connected calendars on the next automation pass.",
            ),
            ephemeral=True,
        )

    @group.command(name="dashboard", description="Open the calendar control center")
    async def dashboard(self, interaction: discord.Interaction) -> None:
        ensure_guild(interaction)
        await interaction.response.send_message(
            embed=embeds.brand(
                "🧭 Calendar control center",
                f"Configure feeds, notifiers, filters and templates in the "
                f"[AHOY dashboard]({DASHBOARD}/{interaction.guild_id}/calendar).",
            ),
            ephemeral=True,
        )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(CalendarCommands(bot))
