"""Full activity logging: messages, members, roles, channels, voice, invites."""

from __future__ import annotations

from datetime import datetime, timezone

import discord
from discord.ext import commands

from ..utils import embeds
from ..utils.logger import get_logger
from ..utils.parsing import clean_text

log = get_logger("activity-events")


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _jump(message: discord.Message) -> str:
    try:
        return message.jump_url
    except Exception:  # pragma: no cover
        return ""


class ActivityEvents(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @property
    def activity(self):
        return getattr(self.bot, "activity_log", None)

    async def _record(self, *args, **kwargs) -> None:
        service = self.activity
        if service is None:
            return
        try:
            await service.record(*args, **kwargs)
        except Exception as exc:  # pragma: no cover - never break an event
            log.warning("Activity record failed: %s", exc)

    # -- messages -------------------------------------------------------
    @commands.Cog.listener()
    async def on_message_delete(self, message: discord.Message) -> None:
        if message.guild is None or message.author.bot:
            return
        content = clean_text(message.content or "", 400) or "*(no text content)*"
        await self._record(
            message.guild,
            "message_delete",
            f"Message by {message.author} deleted in #{getattr(message.channel, 'name', '?')}",
            actor=message.author,
            channel=message.channel,
            metadata={"content": content, "attachments": len(message.attachments)},
            embed=embeds.warning(
                "Message deleted",
                f"**Author:** {message.author.mention}\n"
                f"**Channel:** {message.channel.mention if hasattr(message.channel, 'mention') else '—'}\n"
                f"**Content:** {content}",
            ),
        )

    @commands.Cog.listener()
    async def on_message_edit(self, before: discord.Message, after: discord.Message) -> None:
        if after.guild is None or after.author.bot or before.content == after.content:
            return
        old = clean_text(before.content or "", 300) or "—"
        new = clean_text(after.content or "", 300) or "—"
        await self._record(
            after.guild,
            "message_edit",
            f"Message by {after.author} edited in #{getattr(after.channel, 'name', '?')}",
            actor=after.author,
            channel=after.channel,
            metadata={"before": old, "after": new, "jump_url": _jump(after)},
            embed=embeds.info(
                "Message edited",
                f"**Author:** {after.author.mention}\n**Before:** {old}\n**After:** {new}\n"
                f"[Jump to message]({_jump(after)})",
            ),
        )

    # -- members --------------------------------------------------------
    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member) -> None:
        await self._record(
            member.guild,
            "member_join",
            f"{member} joined the server",
            actor=member,
            metadata={"member_count": member.guild.member_count},
        )

    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member) -> None:
        await self._record(
            member.guild,
            "member_leave",
            f"{member} left the server",
            actor=member,
            metadata={"member_count": member.guild.member_count},
        )

    @commands.Cog.listener()
    async def on_member_update(self, before: discord.Member, after: discord.Member) -> None:
        if before.nick != after.nick:
            await self._record(
                after.guild,
                "member_nickname",
                f"{after} changed nickname",
                actor=after,
                metadata={"before": before.nick, "after": after.nick},
                embed=embeds.info(
                    "Nickname changed",
                    f"{after.mention}\n**Before:** {before.nick or '—'}\n"
                    f"**After:** {after.nick or '—'}",
                ),
            )

        added = [r for r in after.roles if r not in before.roles]
        removed = [r for r in before.roles if r not in after.roles]
        if added or removed:
            detail = ", ".join(
                [f"+{r.name}" for r in added] + [f"-{r.name}" for r in removed]
            )
            await self._record(
                after.guild,
                "member_roles",
                f"Roles updated for {after}: {detail}",
                actor=after,
                metadata={
                    "added": [{"id": str(r.id), "name": r.name} for r in added],
                    "removed": [{"id": str(r.id), "name": r.name} for r in removed],
                },
                embed=embeds.info("Roles updated", f"{after.mention}\n{detail}"),
            )

    # -- channels -------------------------------------------------------
    @commands.Cog.listener()
    async def on_guild_channel_create(self, channel: discord.abc.GuildChannel) -> None:
        await self._record(
            channel.guild,
            "channel_create",
            f"Channel #{channel.name} created",
            channel=channel,
            metadata={"type": str(channel.type)},
            embed=embeds.success("Channel created", f"**{channel.name}** ({channel.type})"),
        )

    @commands.Cog.listener()
    async def on_guild_channel_delete(self, channel: discord.abc.GuildChannel) -> None:
        await self._record(
            channel.guild,
            "channel_delete",
            f"Channel #{channel.name} deleted",
            channel=channel,
            metadata={"type": str(channel.type)},
            embed=embeds.warning("Channel deleted", f"**{channel.name}** ({channel.type})"),
        )

    @commands.Cog.listener()
    async def on_guild_channel_update(
        self, before: discord.abc.GuildChannel, after: discord.abc.GuildChannel
    ) -> None:
        if before.name == after.name:
            return
        await self._record(
            after.guild,
            "channel_update",
            f"Channel renamed {before.name} → {after.name}",
            channel=after,
            metadata={"before": before.name, "after": after.name},
            embed=embeds.info("Channel renamed", f"**{before.name}** → **{after.name}**"),
        )

    # -- invites ---------------------------------------------------------
    @commands.Cog.listener()
    async def on_invite_create(self, invite: discord.Invite) -> None:
        guild = invite.guild if isinstance(invite.guild, discord.Guild) else None
        await self._record(
            guild,
            "invite_create",
            f"Invite {invite.code} created",
            actor=invite.inviter,
            channel=invite.channel,
            metadata={
                "code": invite.code,
                "max_uses": invite.max_uses,
                "expires_at": invite.expires_at.isoformat() if invite.expires_at else None,
            },
            embed=embeds.info(
                "Invite created",
                f"**Code:** {invite.code}\n**By:** {invite.inviter or '—'}",
            ),
        )

    @commands.Cog.listener()
    async def on_invite_delete(self, invite: discord.Invite) -> None:
        guild = invite.guild if isinstance(invite.guild, discord.Guild) else None
        await self._record(
            guild,
            "invite_delete",
            f"Invite {invite.code} deleted",
            channel=invite.channel,
            metadata={"code": invite.code},
        )

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
        repo = getattr(self.bot, "repo", None)
        guild_id = str(member.guild.id)
        now = datetime.now(timezone.utc)

        if before.channel is None and after.channel is not None:
            await self._record(
                member.guild,
                "voice_join",
                f"{member} joined voice #{after.channel.name}",
                actor=member,
                channel=after.channel,
                embed=embeds.info("Voice join", f"{member.mention} → **{after.channel.name}**"),
            )
            if repo is not None:
                stats = await repo.get_voice_stats(guild_id, str(member.id))
                await repo.save_voice_stats(
                    {
                        "guild_id": guild_id,
                        "user_id": str(member.id),
                        "username": member.name,
                        "voice_seconds": int(stats.get("voice_seconds", 0) or 0),
                        "sessions": int(stats.get("sessions", 0) or 0) + 1,
                        "last_joined_at": now.isoformat(),
                    }
                )
            return

        if before.channel is not None and after.channel is None:
            await self._record(
                member.guild,
                "voice_leave",
                f"{member} left voice #{before.channel.name}",
                actor=member,
                channel=before.channel,
                embed=embeds.info("Voice leave", f"{member.mention} ← **{before.channel.name}**"),
            )
            if repo is not None:
                stats = await repo.get_voice_stats(guild_id, str(member.id))
                seconds = int(stats.get("voice_seconds", 0) or 0)
                session_seconds = 0
                joined = stats.get("last_joined_at")
                if joined:
                    try:
                        started = datetime.fromisoformat(str(joined).replace("Z", "+00:00"))
                        session_seconds = max(0, int((now - started).total_seconds()))
                        seconds += session_seconds
                    except ValueError:
                        pass
                await repo.save_voice_stats(
                    {
                        "guild_id": guild_id,
                        "user_id": str(member.id),
                        "username": member.name,
                        "voice_seconds": seconds,
                        "sessions": int(stats.get("sessions", 0) or 0),
                        "last_joined_at": None,
                        "last_left_at": now.isoformat(),
                    }
                )
                # Statahoy: also bucket this session's seconds into today's
                # per-channel daily counter, for the voice activity chart.
                if session_seconds > 0:
                    try:
                        await repo.bump_voice_activity(
                            guild_id,
                            str(member.id),
                            str(before.channel.id),
                            _today(),
                            session_seconds,
                        )
                    except Exception as exc:
                        log.warning("Voice activity bucket failed: %s", exc)
            return

        if before.channel is not None and after.channel is not None:
            await self._record(
                member.guild,
                "voice_move",
                f"{member} moved {before.channel.name} → {after.channel.name}",
                actor=member,
                channel=after.channel,
                metadata={"from": before.channel.name, "to": after.channel.name},
            )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(ActivityEvents(bot))
