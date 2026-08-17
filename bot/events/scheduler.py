"""Background loops for scheduled announcements and live stat channels."""

from __future__ import annotations

from datetime import datetime, timezone

import discord
from discord.ext import commands, tasks

from ..services.schedule_service import compute_next_run
from ..utils import embeds
from ..utils.logger import get_logger

log = get_logger("scheduler")

STAT_TEMPLATE_DEFAULT = "Members: {count}"


class Scheduler(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self.run_announcements.start()
        self.refresh_stat_channels.start()
        self.run_dashboard_actions.start()

    async def cog_unload(self) -> None:
        self.run_announcements.cancel()
        self.refresh_stat_channels.cancel()
        self.run_dashboard_actions.cancel()

    def _ready(self) -> bool:
        repo = getattr(self.bot, "repo", None)
        return repo is not None and bool(getattr(self.bot.db, "connected", False))  # type: ignore[attr-defined]

    # -- scheduled announcements ---------------------------------------
    @tasks.loop(seconds=60)
    async def run_announcements(self) -> None:
        if not self._ready():
            return
        repo = self.bot.repo  # type: ignore[attr-defined]
        try:
            for row in await repo.due_announcements():
                await self._announce(row)
        except Exception as exc:  # pragma: no cover - keep the loop alive
            log.exception("Announcement dispatch failed: %s", exc)

    @run_announcements.before_loop
    async def before_announcements(self) -> None:
        await self.bot.wait_until_ready()

    async def _announce(self, row: dict) -> None:
        repo = self.bot.repo  # type: ignore[attr-defined]
        channel = self.bot.get_channel(int(row["channel_id"]))
        if isinstance(channel, discord.TextChannel):
            try:
                if row.get("use_embed"):
                    colour = int(str(row.get("embed_color") or "#1FB6A6").lstrip("#"), 16)
                    embed = embeds.brand(
                        row.get("embed_title") or row.get("name") or "Announcement",
                        row.get("message", ""),
                        color=colour,
                    )
                    await channel.send(embed=embed)
                else:
                    await channel.send(row.get("message", ""))
            except (discord.HTTPException, ValueError) as exc:
                log.warning("Could not post announcement %s: %s", row.get("id"), exc)
        else:
            log.warning("Announcement %s points at a missing channel.", row.get("id"))

        now = datetime.now(timezone.utc)
        nxt = compute_next_run(
            str(row.get("recurrence") or "daily"),
            row.get("time_of_day"),
            row.get("weekday"),
            after=now,
        )
        payload = {"last_run_at": now.isoformat()}
        if nxt is None:
            payload["enabled"] = False
        else:
            payload["next_run_at"] = nxt.isoformat()
        await repo.update_announcement(row["id"], payload)

    # -- stat channels ---------------------------------------------------
    @tasks.loop(minutes=10)
    async def refresh_stat_channels(self) -> None:
        if not self._ready():
            return
        repo = self.bot.repo  # type: ignore[attr-defined]
        try:
            for guild in self.bot.guilds:
                rows = await repo.stat_channels(str(guild.id))
                for row in rows:
                    await self._refresh(guild, row)
        except Exception as exc:  # pragma: no cover - keep the loop alive
            log.exception("Stat channel refresh failed: %s", exc)

    @refresh_stat_channels.before_loop
    async def before_stats(self) -> None:
        await self.bot.wait_until_ready()

    def _value(self, guild: discord.Guild, kind: str) -> int:
        if kind == "humans":
            return sum(1 for m in guild.members if not m.bot)
        if kind == "bots":
            return sum(1 for m in guild.members if m.bot)
        if kind == "online":
            return sum(
                1
                for m in guild.members
                if m.status is not discord.Status.offline and not m.bot
            )
        if kind == "boosters":
            return guild.premium_subscription_count or 0
        return guild.member_count or 0

    async def _refresh(self, guild: discord.Guild, row: dict) -> None:
        if not row.get("enabled"):
            return
        channel = guild.get_channel(int(row["channel_id"]))
        if channel is None:
            return
        value = self._value(guild, str(row.get("kind") or "members"))
        if row.get("last_value") == value:
            return
        template = str(row.get("name_template") or STAT_TEMPLATE_DEFAULT)
        name = template.replace("{count}", f"{value:,}")[:100]
        if channel.name == name:
            return
        try:
            # Channel renames are rate limited to twice per 10 minutes per channel.
            await channel.edit(name=name, reason="AHOY stat channel update")
        except discord.HTTPException as exc:
            log.warning("Could not rename stat channel %s: %s", row.get("channel_id"), exc)
            return
        await self.bot.repo.mark_stat_channel(  # type: ignore[attr-defined]
            row["id"], value
        )


    # -- dashboard action queue -------------------------------------------
    @tasks.loop(seconds=20)
    async def run_dashboard_actions(self) -> None:
        """Perform moderation actions requested from the web dashboard."""
        if not self._ready():
            return
        repo = self.bot.repo  # type: ignore[attr-defined]
        try:
            for row in await repo.pending_bot_actions():
                try:
                    await self._perform(row)
                    await repo.finish_bot_action(row["id"], "done")
                except Exception as exc:
                    log.warning("Dashboard action %s failed: %s", row.get("action"), exc)
                    await repo.finish_bot_action(row["id"], "failed", str(exc)[:400])
            for case in await repo.expired_cases():
                await self._expire_case(case)
                await repo.update_case(case["id"], {"active": False})
        except Exception as exc:  # pragma: no cover - keep the loop alive
            log.exception("Dashboard action loop failed: %s", exc)

    @run_dashboard_actions.before_loop
    async def before_actions(self) -> None:
        await self.bot.wait_until_ready()

    async def _expire_case(self, case: dict) -> None:
        """Undo time-limited actions (currently channel locks) when they run out."""
        if case.get("action") != "lock":
            return
        meta = case.get("metadata") or {}
        channel_id = meta.get("channel_id")
        guild = self.bot.get_guild(int(case["guild_id"])) if case.get("guild_id") else None
        if not channel_id or guild is None:
            return
        channel = guild.get_channel(int(channel_id))
        if not isinstance(channel, discord.TextChannel):
            return
        try:
            overwrite = channel.overwrites_for(guild.default_role)
            overwrite.send_messages = None
            await channel.set_permissions(
                guild.default_role, overwrite=overwrite, reason="AHOY temporary lock expired"
            )
        except discord.HTTPException as exc:
            log.warning("Could not auto-unlock channel %s: %s", channel_id, exc)

    async def _perform(self, row: dict) -> None:
        guild = self.bot.get_guild(int(row["guild_id"]))
        if guild is None:
            raise RuntimeError("AHOY is not in that server.")
        action = str(row.get("action"))
        target_id = row.get("target_id")
        reason = str((row.get("payload") or {}).get("reason") or "Requested from the AHOY dashboard")
        moderator = (row.get("payload") or {}).get("moderator_name") or "AHOY dashboard"
        mod = getattr(self.bot, "moderation", None)

        if action == "unban":
            user = discord.Object(id=int(target_id))
            await guild.unban(user, reason=reason)
        elif action == "untimeout":
            member = guild.get_member(int(target_id)) or await guild.fetch_member(int(target_id))
            await member.timeout(None, reason=reason)
        elif action == "kick":
            member = guild.get_member(int(target_id)) or await guild.fetch_member(int(target_id))
            await member.kick(reason=reason)
        elif action == "ticket_panel":
            payload = row.get("payload") or {}
            channel = guild.get_channel(int(payload.get("channel_id", 0)))
            if not isinstance(channel, discord.TextChannel):
                raise RuntimeError("That ticket panel channel no longer exists.")
            from ..commands.tickets import post_ticket_panel

            await post_ticket_panel(
                self.bot,
                channel,
                payload.get("title"),
                payload.get("description"),
                payload.get("button_label"),
            )
            return
        elif action == "send_message":
            return  # handled by the /send cog poller
        else:
            raise RuntimeError(f"Unsupported action: {action}")

        if mod is not None:
            target = self.bot.get_user(int(target_id)) if target_id else None
            await mod.record(
                guild,
                action,
                target=target,
                moderator=None,
                reason=f"{reason} (by {moderator})",
            )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Scheduler(bot))
