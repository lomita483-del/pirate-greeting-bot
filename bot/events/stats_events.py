"""Statahoy tracking: per-day message counters and member-count snapshots.

Voice-time tracking lives in ``bot/events/activity_events.py`` next to the
existing ``voice_stats`` accumulator (see the Statahoy edit in that file) —
this cog only handles messages, the once-a-day member snapshot, and the
periodic boost/invite refresh, since those don't naturally hook into any
existing listener.
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
        self.refresh_growth_counters.start()

    def cog_unload(self) -> None:
        self.snapshot_member_counts.cancel()
        self.refresh_growth_counters.cancel()

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

        # Plans/tasks unlock system: live total used by "message_count" tasks.
        try:
            await repo.increment_server_counter(
                str(message.guild.id), "message_count_total", 1
            )
        except Exception as exc:
            log.warning("message_count_total bump failed: %s", exc)

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

    # -- boost / invite refresh (for "boost_count" / "invite_count" tasks) -
    @tasks.loop(minutes=30)
    async def refresh_growth_counters(self) -> None:
        repo = getattr(self.bot, "repo", None)
        if repo is None:
            return
        for guild in self.bot.guilds:
            values: dict[str, int] = {"boost_count": guild.premium_subscription_count or 0}
            if guild.me.guild_permissions.manage_guild:
                try:
                    invites = await guild.invites()
                    values["invite_count"] = sum(inv.uses or 0 for inv in invites)
                except discord.HTTPException as exc:
                    log.warning("Could not read invites for %s: %s", guild.id, exc)
            try:
                await repo.set_server_counters(str(guild.id), values)
            except Exception as exc:
                log.warning("Growth counter refresh failed for %s: %s", guild.id, exc)

    @refresh_growth_counters.before_loop
    async def _before_growth(self) -> None:
        await self.bot.wait_until_ready()


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(StatsEvents(bot))
