"""Full activity logging: messages, members, roles, channels, voice, invites."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

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


async def _audit_entry(
    guild: discord.Guild,
    action: discord.AuditLogAction,
    *,
    target_id: int | None = None,
    channel_id: int | None = None,
    limit: int = 12,
) -> Any | None:
    """Return a very recent matching audit entry without ever exposing IDs in logs."""
    try:
        async for entry in guild.audit_logs(limit=limit, action=action):
            created = entry.created_at
            age = (datetime.now(timezone.utc) - created).total_seconds()
            if age < -2 or age > 15:
                continue
            target = getattr(entry, "target", None)
            if target_id is not None and getattr(target, "id", None) != target_id:
                continue
            extra = getattr(entry, "extra", None)
            if channel_id is not None and extra is not None:
                extra_channel = getattr(extra, "channel", None)
                if extra_channel is not None and getattr(extra_channel, "id", None) != channel_id:
                    continue
            return entry
    except (discord.Forbidden, discord.HTTPException, AttributeError) as exc:
        log.debug("Audit lookup unavailable in %s: %s", guild.id, exc)
    except Exception as exc:  # pragma: no cover
        log.debug("Audit lookup failed in %s: %s", guild.id, exc)
    return None


def _reason(entry: Any | None) -> str:
    if entry is None:
        return "No reason recorded"
    return (getattr(entry, "reason", None) or "No reason recorded").strip() or "No reason recorded"


def _actor(entry: Any | None) -> discord.abc.User | None:
    return getattr(entry, "user", None) if entry is not None else None


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
        content = clean_text(message.content or "", 1200) or "(no text content)"
        entry = await _audit_entry(
            message.guild,
            discord.AuditLogAction.message_delete,
            target_id=message.author.id,
            channel_id=getattr(message.channel, "id", None),
        )
        deleter = _actor(entry)
        actor_label = deleter.mention if deleter is not None else "Unknown / audit log unavailable"
        metadata = {
            "sent_by": message.author.mention,
            "deleted_by": actor_label,
            "content": content,
            "attachments": len(message.attachments),
        }
        await self._record(
            message.guild,
            "message_delete",
            f"{message.author.mention}'s message was deleted in {getattr(message.channel, 'mention', '#' + getattr(message.channel, 'name', '?'))}",
            actor=deleter or message.author,
            target=message.author,
            channel=message.channel,
            metadata=metadata,
            embed=embeds.info(
                "Message deleted",
                f"Message sent by {message.author.mention} was deleted.\n"
                f"Deleted by: {actor_label}\n"
                f"Reason: {_reason(entry)}",
            ),
        )

    @commands.Cog.listener()
    async def on_message_edit(self, before: discord.Message, after: discord.Message) -> None:
        if after.guild is None or after.author.bot or before.content == after.content:
            return
        old = clean_text(before.content or "", 1200) or "(no text content)"
        new = clean_text(after.content or "", 1200) or "(no text content)"
        old_block = old.replace("```", "'''")
        new_block = new.replace("```", "'''")

        embed = discord.Embed(
            title="Message edited",
            description=(
                f"Message sent by {after.author.mention} was edited in "
                f"{getattr(after.channel, 'mention', '#' + getattr(after.channel, 'name', '?'))}. "
                f"[Jump to Message]({_jump(after)})"
            ),
            color=embeds.TEAL,
            timestamp=datetime.now(timezone.utc),
        )
        embed.add_field(name="Before", value=f"```{old_block}```", inline=False)
        embed.add_field(name="After", value=f"```{new_block}```", inline=False)
        embed.set_footer(text=f"{embeds.BRAND}  •  Detailed Audit Log")

        await self._record(
            after.guild,
            "message_edit",
            f"Message sent by {after.author.mention} was edited in {getattr(after.channel, 'mention', '#' + getattr(after.channel, 'name', '?'))}",
            actor=after.author,
            target=after.author,
            channel=after.channel,
            metadata={"before": old, "after": new, "jump_url": _jump(after)},
            embed=embed,
        )

    # -- members --------------------------------------------------------
    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member) -> None:
        await self._record(
            member.guild,
            "member_join",
            f"{member.mention} joined the server",
            actor=member,
            target=member,
            metadata={"member_count": member.guild.member_count},
        )

    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member) -> None:
        kick = await _audit_entry(member.guild, discord.AuditLogAction.kick, target_id=member.id)
        ban = await _audit_entry(member.guild, discord.AuditLogAction.ban, target_id=member.id)

        if kick is not None:
            moderator = _actor(kick)
            moderator_label = moderator.mention if moderator is not None else "Unknown"
            await self._record(
                member.guild,
                "moderation",
                f"{member.mention} was kicked from the server",
                actor=moderator,
                target=member,
                metadata={"reason": _reason(kick)},
                embed=embeds.info(
                    "Member kicked",
                    f"Member: {member.mention}\nAction by: {moderator_label}\nReason: {_reason(kick)}",
                ),
            )
            return

        if ban is not None:
            moderator = _actor(ban)
            moderator_label = moderator.mention if moderator is not None else "Unknown"
            await self._record(
                member.guild,
                "moderation",
                f"{member.mention} was banned from the server",
                actor=moderator,
                target=member,
                metadata={"reason": _reason(ban)},
                embed=embeds.info(
                    "Member banned",
                    f"Member: {member.mention}\nAction by: {moderator_label}\nReason: {_reason(ban)}",
                ),
            )
            return

        await self._record(
            member.guild,
            "member_leave",
            f"{member.mention} left the server",
            actor=member,
            target=member,
            metadata={"member_count": member.guild.member_count},
        )

    @commands.Cog.listener()
    async def on_member_update(self, before: discord.Member, after: discord.Member) -> None:
        if before.nick != after.nick:
            entry = await _audit_entry(
                after.guild,
                discord.AuditLogAction.member_update,
                target_id=after.id,
            )
            moderator = _actor(entry) or after
            await self._record(
                after.guild,
                "member_nickname",
                f"{after.mention} changed nickname",
                actor=moderator,
                target=after,
                metadata={
                    "before": before.nick or before.name,
                    "after": after.nick or after.name,
                },
                embed=embeds.info(
                    "Nickname changed",
                    f"Member: {after.mention}\n"
                    f"Action by: {moderator.mention}\n"
                    f"Before: {before.nick or before.name}\n"
                    f"After: {after.nick or after.name}",
                ),
            )

        added = [r for r in after.roles if r not in before.roles]
        removed = [r for r in before.roles if r not in after.roles]
        if added or removed:
            entry = await _audit_entry(
                after.guild,
                discord.AuditLogAction.member_role_update,
                target_id=after.id,
            )
            moderator = _actor(entry) or after
            await self._record(
                after.guild,
                "member_roles",
                f"Roles updated for {after.mention}",
                actor=moderator,
                target=after,
                metadata={
                    "added": [r.name for r in added],
                    "removed": [r.name for r in removed],
                    "reason": _reason(entry),
                },
            )

    # -- channels -------------------------------------------------------
    @commands.Cog.listener()
    async def on_guild_channel_create(self, channel: discord.abc.GuildChannel) -> None:
        await self._record(
            channel.guild,
            "channel_create",
            f"Channel {channel.mention if hasattr(channel, 'mention') else '#' + channel.name} was created",
            channel=channel,
            metadata={"type": str(channel.type)},
            embed=embeds.info("Channel created", f"Channel: {channel.mention if hasattr(channel, 'mention') else channel.name}\nType: {channel.type}"),
        )

    @commands.Cog.listener()
    async def on_guild_channel_delete(self, channel: discord.abc.GuildChannel) -> None:
        await self._record(
            channel.guild,
            "channel_delete",
            f"Channel #{channel.name} was deleted",
            channel=channel,
            metadata={"type": str(channel.type)},
            embed=embeds.info("Channel deleted", f"Channel: #{channel.name}\nType: {channel.type}"),
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
            embed=embeds.info("Channel renamed", f"Before: {before.name}\nAfter: {after.name}"),
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
                f"Code: `{invite.code}`\nBy: {invite.inviter.mention if invite.inviter else 'Unknown'}",
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
            embed=embeds.info("Invite deleted", f"Code: `{invite.code}`"),
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
                f"{member.mention} joined voice {after.channel.mention}",
                actor=member,
                target=member,
                channel=after.channel,
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
                f"{member.mention} left voice {before.channel.mention}",
                actor=member,
                target=member,
                channel=before.channel,
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
                    minutes = session_seconds // 60
                    if minutes > 0:
                        try:
                            await repo.increment_server_counter(
                                guild_id, "voice_minutes_total", minutes
                            )
                        except Exception as exc:
                            log.warning("voice_minutes_total bump failed: %s", exc)
            return

        if before.channel is not None and after.channel is not None:
            await self._record(
                member.guild,
                "voice_move",
                f"{member.mention} moved from {before.channel.mention} to {after.channel.mention}",
                actor=member,
                target=member,
                channel=after.channel,
                metadata={"from": before.channel.name, "to": after.channel.name},
            )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(ActivityEvents(bot))
