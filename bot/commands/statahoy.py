"""Statahoy — Statbot-style analytics commands, running in the same bot
and reading/writing the same Supabase database as the rest of AHOY.

Everything lives under a single /statahoy command group so it can never
collide with AHOY's existing top-level commands (general.py already has
a plain "/stats" command for bot runtime stats).

Data comes from bot/events/stats_events.py (messages) and the voice-time
bucketing added to bot/events/activity_events.py — see bot/database/
repository.py for the underlying queries.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import discord
from discord import app_commands
from discord.ext import commands

from ..utils import embeds
from ..utils.checks import ensure_guild
from ..utils.parsing import humanize

DEFAULT_DAYS = 14


def _since(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()


def _user_lines(rows: list[dict], key: str, fmt) -> str:
    lines = [f"**{i}.** <@{row['user_id']}> — {fmt(row[key])}" for i, row in enumerate(rows, 1)]
    return "\n".join(lines) or "No tracked activity yet in this window."


def _channel_lines(rows: list[dict], key: str, fmt) -> str:
    lines = [f"**{i}.** <#{row['channel_id']}> — {fmt(row[key])}" for i, row in enumerate(rows, 1)]
    return "\n".join(lines) or "No tracked activity yet in this window."


class Statahoy(commands.Cog):
    """/statahoy — message, voice, member and channel analytics."""

    statahoy = app_commands.Group(name="statahoy", description="Statahoy analytics for this server.")

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    # -- overview -------------------------------------------------------
    @statahoy.command(name="server", description="Server-wide message & voice overview.")
    @app_commands.describe(days="Lookback window in days (default 14)")
    @app_commands.guild_only()
    async def server(
        self, interaction: discord.Interaction, days: app_commands.Range[int, 1, 90] = DEFAULT_DAYS
    ) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer()
        repo = self.bot.repo  # type: ignore[attr-defined]
        since = _since(days)
        guild_id = str(guild.id)

        messages = await repo.message_totals_since(guild_id, since)
        voice_rows = await repo.voice_series(guild_id, since)
        voice_seconds = sum(int(r.get("seconds", 0) or 0) for r in voice_rows)
        growth = await repo.member_growth_series(guild_id, since)

        embed = embeds.brand(f"{guild.name} · Statahoy overview", f"Last **{days}** day(s).")
        embed.add_field(name="Messages tracked", value=f"{messages:,}")
        embed.add_field(name="Voice time tracked", value=humanize(voice_seconds))
        embed.add_field(name="Members now", value=f"{guild.member_count:,}")
        if len(growth) >= 2:
            delta = int(growth[-1]["member_count"]) - int(growth[0]["member_count"])
            sign = "+" if delta >= 0 else ""
            embed.add_field(
                name="Member change",
                value=f"{sign}{delta:,} since {growth[0]['day']}",
                inline=False,
            )
        embed.set_footer(text="Statahoy ⚓ · view charts on the dashboard")
        await interaction.followup.send(embed=embed)

    # -- messages ---------------------------------------------------------
    @statahoy.command(name="message", description="Message activity for this server.")
    @app_commands.describe(days="Lookback window in days (default 14)")
    @app_commands.guild_only()
    async def message(
        self, interaction: discord.Interaction, days: app_commands.Range[int, 1, 90] = DEFAULT_DAYS
    ) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer()
        repo = self.bot.repo  # type: ignore[attr-defined]
        since = _since(days)
        guild_id = str(guild.id)

        total = await repo.message_totals_since(guild_id, since)
        top_users = await repo.message_leaderboard(guild_id, since, 10)
        top_channels = await repo.channel_leaderboard(guild_id, since, 5)

        embed = embeds.brand(f"Message activity · last {days}d", f"**{total:,}** messages tracked.")
        embed.add_field(
            name="Top senders", value=_user_lines(top_users, "messages", lambda v: f"{v:,}"), inline=False
        )
        embed.add_field(
            name="Top channels",
            value=_channel_lines(top_channels, "messages", lambda v: f"{v:,}"),
            inline=False,
        )
        await interaction.followup.send(embed=embed)

    # -- voice --------------------------------------------------------------
    @statahoy.command(name="voice", description="Voice activity for this server.")
    @app_commands.describe(days="Lookback window in days (default 14)")
    @app_commands.guild_only()
    async def voice(
        self, interaction: discord.Interaction, days: app_commands.Range[int, 1, 90] = DEFAULT_DAYS
    ) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer()
        repo = self.bot.repo  # type: ignore[attr-defined]
        since = _since(days)
        guild_id = str(guild.id)

        series = await repo.voice_series(guild_id, since)
        total_seconds = sum(int(r.get("seconds", 0) or 0) for r in series)
        top_users = await repo.voice_user_leaderboard(guild_id, since, 10)

        embed = embeds.brand(
            f"Voice activity · last {days}d", f"**{humanize(total_seconds)}** of voice time tracked."
        )
        embed.add_field(
            name="Top members",
            value=_user_lines(top_users, "voice_seconds", humanize),
            inline=False,
        )
        await interaction.followup.send(embed=embed)

    # -- member -----------------------------------------------------------
    @statahoy.command(name="user", description="Statistics for a member.")
    @app_commands.describe(member="Who to look up (defaults to you)", days="Lookback window in days")
    @app_commands.guild_only()
    async def user(
        self,
        interaction: discord.Interaction,
        member: discord.Member | None = None,
        days: app_commands.Range[int, 1, 90] = DEFAULT_DAYS,
    ) -> None:
        guild = ensure_guild(interaction)
        target = member or interaction.user
        await interaction.response.defer()
        repo = self.bot.repo  # type: ignore[attr-defined]
        since = _since(days)
        guild_id = str(guild.id)

        messages = await repo.user_message_total(guild_id, str(target.id), since)
        voice_stats = await repo.get_voice_stats(guild_id, str(target.id))

        embed = embeds.brand(f"{target.display_name} · Statahoy", f"Last **{days}** day(s).")
        if hasattr(target, "display_avatar"):
            embed.set_thumbnail(url=target.display_avatar.url)
        embed.add_field(name="Messages", value=f"{messages:,}")
        embed.add_field(
            name="Voice time (all-time)", value=humanize(int(voice_stats.get("voice_seconds", 0) or 0))
        )
        embed.add_field(name="Voice sessions", value=f"{int(voice_stats.get('sessions', 0) or 0):,}")
        await interaction.followup.send(embed=embed)

    # -- channel ------------------------------------------------------------
    @statahoy.command(name="channel", description="Statistics for a channel.")
    @app_commands.describe(channel="Which channel (defaults to this one)", days="Lookback window in days")
    @app_commands.guild_only()
    async def channel(
        self,
        interaction: discord.Interaction,
        channel: discord.TextChannel | None = None,
        days: app_commands.Range[int, 1, 90] = DEFAULT_DAYS,
    ) -> None:
        guild = ensure_guild(interaction)
        target = channel or interaction.channel
        await interaction.response.defer()
        repo = self.bot.repo  # type: ignore[attr-defined]
        since = _since(days)
        total = await repo.channel_message_total(str(guild.id), str(target.id), since)

        embed = embeds.brand(
            f"#{getattr(target, 'name', 'channel')} · Statahoy",
            f"**{total:,}** messages tracked over the last **{days}** day(s).",
        )
        await interaction.followup.send(embed=embed)

    # -- leaderboards ---------------------------------------------------
    @statahoy.command(name="topmessages", description="Top message senders.")
    @app_commands.describe(days="Lookback window in days (default 14)")
    @app_commands.guild_only()
    async def topmessages(
        self, interaction: discord.Interaction, days: app_commands.Range[int, 1, 90] = DEFAULT_DAYS
    ) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer()
        repo = self.bot.repo  # type: ignore[attr-defined]
        rows = await repo.message_leaderboard(str(guild.id), _since(days), 10)
        embed = embeds.brand(
            f"Top message senders · last {days}d",
            _user_lines(rows, "messages", lambda v: f"{v:,}"),
        )
        await interaction.followup.send(embed=embed)

    @statahoy.command(name="topvoice", description="Top voice members.")
    @app_commands.describe(days="Lookback window in days (default 14)")
    @app_commands.guild_only()
    async def topvoice(
        self, interaction: discord.Interaction, days: app_commands.Range[int, 1, 90] = DEFAULT_DAYS
    ) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer()
        repo = self.bot.repo  # type: ignore[attr-defined]
        rows = await repo.voice_user_leaderboard(str(guild.id), _since(days), 10)
        embed = embeds.brand(
            f"Top voice members · last {days}d",
            _user_lines(rows, "voice_seconds", humanize),
        )
        await interaction.followup.send(embed=embed)

    @statahoy.command(name="topchannels", description="Top channels by messages.")
    @app_commands.describe(days="Lookback window in days (default 14)")
    @app_commands.guild_only()
    async def topchannels(
        self, interaction: discord.Interaction, days: app_commands.Range[int, 1, 90] = DEFAULT_DAYS
    ) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer()
        repo = self.bot.repo  # type: ignore[attr-defined]
        rows = await repo.channel_leaderboard(str(guild.id), _since(days), 10)
        embed = embeds.brand(
            f"Top channels · last {days}d",
            _channel_lines(rows, "messages", lambda v: f"{v:,}"),
        )
        await interaction.followup.send(embed=embed)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Statahoy(bot))
