"""Background loops for scheduled announcements, live stat channels, the
dashboard action queue, and calendar event reminder delivery."""

from __future__ import annotations

from datetime import datetime, timezone

import discord
from discord.ext import commands, tasks

from ..commands.calendar import _rsvp_view
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
        self.run_event_reminders.start()

    async def cog_unload(self) -> None:
        self.run_announcements.cancel()
        self.refresh_stat_channels.cancel()
        self.run_dashboard_actions.cancel()
        self.run_event_reminders.cancel()

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

    # -- calendar event reminders ------------------------------------------
    @tasks.loop(seconds=30)
    async def run_event_reminders(self) -> None:
        if not self._ready():
            return
        repo = self.bot.repo  # type: ignore[attr-defined]
        try:
            for reminder in await repo.due_event_reminders():
                await self._deliver_reminder(reminder)
        except Exception as exc:  # pragma: no cover - keep the loop alive
            log.exception("Event reminder dispatch failed: %s", exc)

    @run_event_reminders.before_loop
    async def before_event_reminders(self) -> None:
        await self.bot.wait_until_ready()

    async def _deliver_reminder(self, reminder: dict) -> None:
        repo = self.bot.repo  # type: ignore[attr-defined]
        reminder_id = reminder["id"]
        attempts = int(reminder.get("attempts") or 0) + 1
        event = reminder.get("event")

        if not event:
            await repo.mark_event_reminder_failed(reminder_id, "Parent event no longer exists.", 3)
            return

        channel_id = reminder.get("discord_channel_id") or event.get("discord_channel_id")
        if not channel_id:
            await repo.mark_event_reminder_failed(reminder_id, "No channel configured.", 3)
            return

        guild_id = reminder.get("guild_id") or event.get("guild_id")
        guild = self.bot.get_guild(int(guild_id)) if guild_id else None
        channel = guild.get_channel(int(channel_id)) if guild else None
        if not isinstance(channel, discord.TextChannel):
            await repo.mark_event_reminder_failed(
                reminder_id, "Configured channel no longer exists.", attempts
            )
            return

        perms = channel.permissions_for(channel.guild.me)
        if not perms.send_messages or not perms.embed_links:
            await repo.mark_event_reminder_failed(
                reminder_id, "AHOY lacks permission to post there.", attempts
            )
            return

        minutes = int(reminder.get("reminder_minutes") or 0)
        when_text = "starting now" if minutes <= 0 else f"starting in {_format_minutes(minutes)}"

        start = event.get("start_time")
        start_ts = None
        if start:
            try:
                start_ts = int(datetime.fromisoformat(str(start).replace("Z", "+00:00")).timestamp())
            except ValueError:
                start_ts = None

        description_lines = [
            f"**Event Name:** {event.get('title') or 'Untitled event'}",
            f"**Starting In:** {when_text.removeprefix('starting ')}",
        ]
        if start_ts:
            description_lines.append(f"**Date And Time:** <t:{start_ts}:F>")
            description_lines.append(f">>> **Duration:** <t:{start_ts}:R> <<<")
        else:
            description_lines.append(f">>> **Duration:** {when_text} <<<")
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
        if guild is not None and guild.icon is not None:
            embed.set_thumbnail(url=guild.icon.url)
        if self.bot.user is not None:
            embed.set_footer(text=f"{embeds.BRAND} ⚓", icon_url=self.bot.user.display_avatar.url)
        else:
            embed.set_footer(text=f"{embeds.BRAND} ⚓")

        mention_text = ""
        mention = reminder.get("mention") or "none"
        role_mentions = reminder.get("role_mentions") or []
        if mention == "everyone":
            mention_text = "@everyone"
        elif mention == "here":
            mention_text = "@here"
        elif role_mentions:
            mention_text = " ".join(f"<@&{rid}>" for rid in role_mentions)

        try:
            sent = await channel.send(
                content=mention_text or None,
                embed=embed,
                view=_rsvp_view(str(event.get("id"))),
            )
            await repo.mark_event_reminder_sent(reminder_id, str(sent.id))
        except discord.HTTPException as exc:
            log.warning("Failed to deliver event reminder %s: %s", reminder_id, exc)
            await repo.mark_event_reminder_failed(reminder_id, str(exc)[:400], attempts)

    # -- dashboard action queue -------------------------------------------
    @tasks.loop(seconds=20)
    async def run_dashboard_actions(self) -> None:
        """Perform moderation actions requested from the web dashboard."""
        if not self._ready():
            return
        repo = self.bot.repo  # type: ignore[attr-defined]
        try:
            for row in await repo.pending_bot_actions():
                if row.get("action") == "send_message":
                    continue  # handled by the /send cog poller
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
                payload.get("buttons") or [],
            )
            return
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


def _format_minutes(minutes: int) -> str:
    if minutes % 1440 == 0:
        days = minutes // 1440
        return f"{days} day{'s' if days != 1 else ''}"
    if minutes % 60 == 0:
        hours = minutes // 60
        return f"{hours} hour{'s' if hours != 1 else ''}"
    return f"{minutes} minute{'s' if minutes != 1 else ''}"


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Scheduler(bot))
