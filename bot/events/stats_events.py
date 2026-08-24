"""Statahoy tracking: per-day message counters and member-count snapshots.

Voice-time tracking lives in ``bot/events/activity_events.py`` next to the
existing ``voice_stats`` accumulator (see the Statahoy edit in that file) —
this cog only handles messages and the once-a-day member snapshot, since
those don't naturally hook into any existing listener.
"""

from __future__ import annotations

from datetime import datetime, timezone

import discord
from discord.ext import commands, tasks

from ..utils.logger import get_logger

log = get_logger("stats-events")


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


class StatsEvents(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self.snapshot_member_counts.start()

    def cog_unload(self) -> None:
        self.snapshot_member_counts.cancel()

    # -- messages ---------------------------------------------------------
    @commands.Cog.listener()
    async def on_message(self, message: discord.Message) -> None:
        if message.guild is None or message.author.bot:
            return
        repo = getattr(self.bot, "repo", None)
        if repo is None:
            return
        try:
            await repo.bump_message_activity(
                str(message.guild.id),
                str(message.author.id),
                str(message.channel.id),
                _today(),
            )
        except Exception as exc:  # never let tracking break message handling
            log.warning("Message activity tracking failed: %s", exc)

    # -- daily member-count snapshot (for the growth chart) ----------------
    @tasks.loop(hours=24)
    async def snapshot_member_counts(self) -> None:
        repo = getattr(self.bot, "repo", None)
        if repo is None:
            return
        today = _today()
        for guild in self.bot.guilds:
            try:
                await repo.record_member_count(str(guild.id), today, guild.member_count or 0)
            except Exception as exc:
                log.warning("Member snapshot failed for %s: %s", guild.id, exc)

    @snapshot_member_counts.before_loop
    async def _before_snapshot(self) -> None:
        await self.bot.wait_until_ready()


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(StatsEvents(bot))
