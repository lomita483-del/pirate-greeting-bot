"""Statahoy tracking: per-day counters plus per-user presence/activity analytics."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import discord
from discord import app_commands
from discord.ext import commands, tasks

from ..utils import embeds
from ..utils.logger import get_logger
from ..utils.parsing import clean_text, humanize

log = get_logger("stats-events")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _status(member: discord.Member) -> str:
    return str(member.status).lower()


def _clip(value: str, limit: int = 500) -> str:
    text = clean_text(value or "", limit)
    return text if len(text) <= limit else text[: limit - 1] + "…"


class StatsEvents(commands.Cog):
    """Statahoy counters and detailed per-user activity tracking."""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self.snapshot_member_counts.start()
        self.refresh_growth_counters.start()

    def cog_unload(self) -> None:
        self.snapshot_member_counts.cancel()
        self.refresh_growth_counters.cancel()

    @property
    def repo(self):
        return getattr(self.bot, "repo", None)

    async def _read_user_activity(self, guild_id: str, user_id: str) -> dict[str, Any]:
        repo = self.repo
        if repo is None:
            return {}
        try:
            rows = await repo.db.try_run(
                lambda c: c.table("user_activity")
                .select("*")
                .eq("guild_id", guild_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            data = getattr(rows, "data", None) or []
            return dict(data[0]) if data else {}
        except Exception as exc:
            log.warning("Could not read user activity for %s/%s: %s", guild_id, user_id, exc)
            return {}

    async def _save_user_activity(self, payload: dict[str, Any]) -> None:
        repo = self.repo
        if repo is None:
            return
        try:
            await repo.db.try_run(
                lambda c: c.table("user_activity")
                .upsert(payload, on_conflict="guild_id,user_id")
                .execute()
            )
        except Exception as exc:
            log.warning("Could not save user activity: %s", exc)

    async def _touch_user(
        self,
        member: discord.Member,
        *,
        message: discord.Message | None = None,
        command_name: str | None = None,
        status: str | None = None,
        online_transition: bool = False,
        voice_join_at: str | None = None,
        voice_leave_at: str | None = None,
    ) -> None:
        if member.bot:
            return

        guild_id = str(member.guild.id)
        user_id = str(member.id)
        now = _now()
        current = await self._read_user_activity(guild_id, user_id)

        payload: dict[str, Any] = {
            "guild_id": guild_id,
            "user_id": user_id,
            "username": member.name,
            "updated_at": now,
        }

        if message is not None:
            payload.update(
                {
                    "last_message_at": now,
                    "last_message_content": _clip(message.content or "*(no text content)*"),
                    "last_message_channel_id": str(message.channel.id),
                    "last_seen_at": now,
                }
            )

        if command_name:
            payload.update(
                {
                    "last_command_at": now,
                    "last_command_name": command_name[:100],
                    "command_count": int(current.get("command_count", 0) or 0) + 1,
                    "last_seen_at": now,
                }
            )

        if status is not None:
            payload.update(
                {
                    "last_seen_at": now,
                    "last_online_status": status,
                }
            )
            if online_transition:
                payload["last_online_status"] = status

        if voice_join_at:
            payload["last_voice_join_at"] = voice_join_at
            payload["last_seen_at"] = now

        if voice_leave_at:
            payload["last_voice_leave_at"] = voice_leave_at
            payload["last_seen_at"] = now

        # Preserve existing values because this is a partial event-driven upsert.
        for key in (
            "username",
            "last_seen_at",
            "last_online_status",
            "last_message_at",
            "last_message_content",
            "last_message_channel_id",
            "last_command_at",
            "last_command_name",
            "command_count",
            "last_voice_join_at",
            "last_voice_leave_at",
        ):
            if key not in payload and current.get(key) is not None:
                payload[key] = current[key]

        await self._save_user_activity(payload)

    # -- messages ---------------------------------------------------------
    @commands.Cog.listener()
    async def on_message(self, message: discord.Message) -> None:
        if message.guild is None or message.author.bot:
            return
        repo = self.repo
        if repo is None:
            return

        try:
            await repo.bump_message_activity(
                str(message.guild.id),
                str(message.author.id),
                str(message.channel.id),
                _today(),
            )
        except Exception as exc:
            log.warning("Message activity tracking failed: %s", exc)

        try:
            await repo.increment_server_counter(
                str(message.guild.id), "message_count_total", 1
            )
        except Exception as exc:
            log.warning("message_count_total bump failed: %s", exc)

        await self._touch_user(message.author, message=message)

    # -- presence / online history ---------------------------------------
    @commands.Cog.listener()
    async def on_presence_update(
        self, before: discord.Member, after: discord.Member
    ) -> None:
        if after.bot or after.guild is None:
            return

        before_status = _status(before)
        after_status = _status(after)
        if before_status == after_status:
            return

        # Discord presence events are the best available source for server-side
        # online history. last_seen_at records the latest presence event; the
        # status field records the last known Discord status.
        await self._touch_user(
            after,
            status=after_status,
            online_transition=before_status == "offline" and after_status != "offline",
        )

    # -- command usage ----------------------------------------------------
    @commands.Cog.listener()
    async def on_app_command_completion(
        self, interaction: discord.Interaction, command: app_commands.Command
    ) -> None:
        if interaction.guild is None or interaction.user.bot:
            return
        member = interaction.user if isinstance(interaction.user, discord.Member) else None
        if member is None:
            try:
                member = interaction.guild.get_member(interaction.user.id) or await interaction.guild.fetch_member(interaction.user.id)
            except discord.HTTPException:
                return
        await self._touch_user(member, command_name=command.qualified_name)

    @commands.Cog.listener()
    async def on_command_completion(self, ctx: commands.Context) -> None:
        if ctx.guild is None or ctx.author.bot:
            return
        if isinstance(ctx.author, discord.Member):
            await self._touch_user(ctx.author, command_name=ctx.command.qualified_name if ctx.command else "unknown")

    # -- voice -------------------------------------------------------------
    @commands.Cog.listener()
    async def on_voice_state_update(
        self,
        member: discord.Member,
        before: discord.VoiceState,
        after: discord.VoiceState,
    ) -> None:
        if member.bot or before.channel == after.channel:
            return

        now = _now()
        if before.channel is None and after.channel is not None:
            await self._touch_user(member, voice_join_at=now)
            return

        if before.channel is not None and after.channel is None:
            await self._touch_user(member, voice_leave_at=now)
            return

        # A move is still activity, but it is not a new voice join.
        await self._touch_user(member, status=_status(member))

    # -- /activity --------------------------------------------------------
    @app_commands.command(name="activity", description="View detailed Discord activity for a member or your server.")
    @app_commands.describe(member="Member to inspect. Leave empty to show the most recently tracked members.")
    @app_commands.guild_only()
    async def activity_command(
        self, interaction: discord.Interaction, member: discord.Member | None = None
    ) -> None:
        guild = interaction.guild
        if guild is None:
            return
        await interaction.response.defer(ephemeral=True)
        repo = self.repo
        if repo is None:
            await interaction.followup.send("Activity storage is unavailable.", ephemeral=True)
            return

        if member is not None:
            row = await self._read_user_activity(str(guild.id), str(member.id))
            voice = await repo.get_voice_stats(str(guild.id), str(member.id))
            message_total = await repo.user_message_total(str(guild.id), str(member.id), "2000-01-01")
            embed = self._activity_embed(member, row, voice, message_total)
            await interaction.followup.send(embed=embed, ephemeral=True)
            return

        try:
            rows_result = await repo.db.try_run(
                lambda c: c.table("user_activity")
                .select("*")
                .eq("guild_id", str(guild.id))
                .order("last_seen_at", desc=True)
                .limit(10)
                .execute()
            )
            rows = getattr(rows_result, "data", None) or []
        except Exception as exc:
            log.warning("Activity leaderboard failed: %s", exc)
            rows = []

        embed = embeds.brand(
            f"{guild.name} · User activity",
            "Most recently tracked members. Use **/activity member:@user** for full details.",
        )
        if not rows:
            embed.description = "No user activity has been tracked yet. Activity tracking starts from the moment this update is running."
        else:
            for row in rows[:10]:
                uid = str(row.get("user_id"))
                target = guild.get_member(int(uid)) if uid.isdigit() else None
                name = target.display_name if target else (row.get("username") or uid)
                status = row.get("last_online_status") or "unknown"
                messages = await repo.user_message_total(str(guild.id), uid, "2000-01-01")
                embed.add_field(
                    name=f"{name} · {status}",
                    value=(
                        f"Messages: **{messages:,}** · Bot uses: **{int(row.get('command_count', 0) or 0):,}**\n"
                        f"Last seen: {discord.utils.format_dt(discord.utils.parse_time(row.get('last_seen_at')) or datetime.now(timezone.utc), style='R')}"
                    ),
                    inline=False,
                )
        embed.set_footer(text="Statahoy ⚓")
        await interaction.followup.send(embed=embed, ephemeral=True)

    @staticmethod
    def _activity_embed(
        member: discord.Member,
        row: dict[str, Any],
        voice: dict[str, Any],
        message_total: int,
    ) -> discord.Embed:
        status = row.get("last_online_status") or str(member.status)
        last_seen = discord.utils.parse_time(row.get("last_seen_at")) if row.get("last_seen_at") else None
        last_message = discord.utils.parse_time(row.get("last_message_at")) if row.get("last_message_at") else None
        last_command = discord.utils.parse_time(row.get("last_command_at")) if row.get("last_command_at") else None
        last_voice_join = discord.utils.parse_time(row.get("last_voice_join_at")) if row.get("last_voice_join_at") else None

        embed = embeds.brand(
            f"{member.display_name} · Activity",
            f"Last known Discord status: **{status}**",
        )
        embed.set_thumbnail(url=member.display_avatar.url)
        embed.add_field(name="Messages", value=f"{message_total:,}")
        embed.add_field(name="Bot uses", value=f"{int(row.get('command_count', 0) or 0):,}")
        embed.add_field(name="Voice time", value=humanize(int(voice.get("voice_seconds", 0) or 0)))
        embed.add_field(name="Voice sessions", value=f"{int(voice.get('sessions', 0) or 0):,}")
        embed.add_field(name="Last seen", value=discord.utils.format_dt(last_seen, "R") if last_seen else "Never")
        embed.add_field(name="Last came online", value=discord.utils.format_dt(last_seen, "R") if last_seen and status != "offline" else "Not recorded")
        embed.add_field(name="Last message", value=discord.utils.format_dt(last_message, "R") if last_message else "Never")
        embed.add_field(name="Last command", value=f"`{row.get('last_command_name')}` · {discord.utils.format_dt(last_command, 'R')}" if last_command else "Never")
        embed.add_field(name="Last voice join", value=discord.utils.format_dt(last_voice_join, "R") if last_voice_join else "Never")
        content = row.get("last_message_content") or "No text message recorded."
        embed.add_field(name="Last message sent", value=_clip(str(content), 900), inline=False)
        embed.set_footer(text="Statahoy ⚓")
        return embed

    # -- daily member-count snapshot --------------------------------------
    @tasks.loop(hours=24)
    async def snapshot_member_counts(self) -> None:
        repo = self.repo
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

    # -- boost / invite refresh -------------------------------------------
    @tasks.loop(minutes=30)
    async def refresh_growth_counters(self) -> None:
        repo = self.repo
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
