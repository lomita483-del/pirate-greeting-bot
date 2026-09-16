"""Server lifecycle and structural change logging with detailed audit entries."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import discord
from discord.ext import commands

from ..utils import embeds
from ..utils.logger import get_logger

log = get_logger("guilds")


async def _audit_entry(
    guild: discord.Guild,
    action: discord.AuditLogAction,
    *,
    target_id: int | None = None,
    limit: int = 15,
) -> Any | None:
    """Find the recent Discord audit entry for a structural change."""
    if not guild.me or not guild.me.guild_permissions.view_audit_log:
        return None
    try:
        async for entry in guild.audit_logs(limit=limit, action=action):
            age = (datetime.now(timezone.utc) - entry.created_at).total_seconds()
            if age < -2 or age > 20:
                continue
            if target_id is not None and getattr(entry.target, "id", None) != target_id:
                continue
            return entry
    except (discord.Forbidden, discord.HTTPException, discord.ClientException):
        return None
    except Exception as exc:  # pragma: no cover
        log.debug("Audit lookup failed in %s: %s", guild.id, exc)
    return None


def _actor(entry: Any | None) -> discord.abc.User | None:
    return getattr(entry, "user", None) if entry else None


def _reason(entry: Any | None) -> str:
    return (getattr(entry, "reason", None) or "No reason recorded").strip() or "No reason recorded"


def _mention(user: Any | None) -> str:
    return getattr(user, "mention", None) or "Unknown"


def _details(**items: Any) -> str:
    return "\n".join(f"{key}: {value}" for key, value in items.items() if value is not None)


class GuildEvents(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @commands.Cog.listener()
    async def on_guild_join(self, guild: discord.Guild) -> None:
        log.info("Joined guild %s (%s)", guild.name, guild.id)
        await self.bot.repo.upsert_server(str(guild.id), guild.name, guild.icon.key if guild.icon else None,
                                          str(guild.owner_id) if guild.owner_id else None, guild.member_count or 0)
        self.bot.tree.copy_global_to(guild=guild)
        await self.bot.tree.sync(guild=guild)

    @commands.Cog.listener()
    async def on_guild_remove(self, guild: discord.Guild) -> None:
        log.info("Removed from guild %s (%s)", guild.name, guild.id)
        await self.bot.repo.mark_server_left(str(guild.id))

    @commands.Cog.listener()
    async def on_guild_update(self, before: discord.Guild, after: discord.Guild) -> None:
        changes: list[str] = []
        if before.name != after.name:
            changes.append(f"Name: {before.name} → {after.name}")
        if before.icon != after.icon:
            changes.append("Icon: changed")
        if before.owner_id != after.owner_id:
            changes.append(f"Owner: <@{before.owner_id}> → <@{after.owner_id}>")
        if before.verification_level != after.verification_level:
            changes.append(f"Verification level: {before.verification_level} → {after.verification_level}")
        if before.premium_subscription_count != after.premium_subscription_count:
            changes.append(f"Boost count: {before.premium_subscription_count} → {after.premium_subscription_count}")
        if not changes:
            return

        await self.bot.repo.upsert_server(str(after.id), after.name, after.icon.key if after.icon else None,
                                          str(after.owner_id) if after.owner_id else None, after.member_count or 0)
        entry = await _audit_entry(after, discord.AuditLogAction.guild_update)
        actor = _actor(entry)
        description = _details(**{"Action by": _mention(actor), "Changes": "\n".join(changes), "Reason": _reason(entry)})
        await self.bot.logs.log(after, "server_changes", embeds.info("Server updated", description))

    @commands.Cog.listener()
    async def on_guild_channel_create(self, channel: discord.abc.GuildChannel) -> None:
        entry = await _audit_entry(channel.guild, discord.AuditLogAction.channel_create, target_id=channel.id)
        actor = _actor(entry)
        description = _details(Channel=channel.mention if hasattr(channel, "mention") else f"#{channel.name}",
                               Type=str(channel.type), **{"Action by": _mention(actor), "Reason": _reason(entry)})
        await self.bot.logs.log(channel.guild, "channel_create", embeds.info("Channel created", description))

    @commands.Cog.listener()
    async def on_guild_channel_delete(self, channel: discord.abc.GuildChannel) -> None:
        entry = await _audit_entry(channel.guild, discord.AuditLogAction.channel_delete, target_id=channel.id)
        actor = _actor(entry)
        description = _details(Channel=f"#{channel.name}", Type=str(channel.type), **{"Action by": _mention(actor), "Reason": _reason(entry)})
        await self.bot.logs.log(channel.guild, "channel_delete", embeds.info("Channel deleted", description))

    @commands.Cog.listener()
    async def on_guild_channel_update(self, before: discord.abc.GuildChannel, after: discord.abc.GuildChannel) -> None:
        changes: list[str] = []
        if before.name != after.name:
            changes.append(f"Name: {before.name} → {after.name}")
        if getattr(before, "topic", None) != getattr(after, "topic", None):
            changes.append("Topic: changed")
        if getattr(before, "nsfw", None) != getattr(after, "nsfw", None):
            changes.append(f"NSFW: {getattr(before, 'nsfw', None)} → {getattr(after, 'nsfw', None)}")
        if getattr(before, "category", None) != getattr(after, "category", None):
            old = getattr(getattr(before, "category", None), "name", "None")
            new = getattr(getattr(after, "category", None), "name", "None")
            changes.append(f"Category: {old} → {new}")
        if getattr(before, "slowmode_delay", None) != getattr(after, "slowmode_delay", None):
            changes.append(f"Slowmode: {getattr(before, 'slowmode_delay', 0)}s → {getattr(after, 'slowmode_delay', 0)}s")
        if not changes:
            return
        entry = await _audit_entry(after.guild, discord.AuditLogAction.channel_update, target_id=after.id)
        actor = _actor(entry)
        description = _details(Channel=after.mention if hasattr(after, "mention") else f"#{after.name}",
                               **{"Action by": _mention(actor), "Changes": "\n".join(changes), "Reason": _reason(entry)})
        await self.bot.logs.log(after.guild, "channel_name_update", embeds.info("Channel updated", description))

    @commands.Cog.listener()
    async def on_guild_role_create(self, role: discord.Role) -> None:
        entry = await _audit_entry(role.guild, discord.AuditLogAction.role_create, target_id=role.id)
        actor = _actor(entry)
        description = _details(Role=role.mention, Name=role.name, **{"Action by": _mention(actor), "Reason": _reason(entry)})
        await self.bot.logs.log(role.guild, "role_create", embeds.info("Role created", description))

    @commands.Cog.listener()
    async def on_guild_role_delete(self, role: discord.Role) -> None:
        entry = await _audit_entry(role.guild, discord.AuditLogAction.role_delete, target_id=role.id)
        actor = _actor(entry)
        description = _details(Role=f"@{role.name}", **{"Action by": _mention(actor), "Reason": _reason(entry)})
        await self.bot.logs.log(role.guild, "role_delete", embeds.info("Role deleted", description))

    @commands.Cog.listener()
    async def on_guild_role_update(self, before: discord.Role, after: discord.Role) -> None:
        changes: list[str] = []
        if before.name != after.name:
            changes.append(f"Name: {before.name} → {after.name}")
        if before.color != after.color:
            changes.append(f"Color: {before.color} → {after.color}")
        if before.permissions != after.permissions:
            changes.append("Permissions: changed")
        if before.hoist != after.hoist:
            changes.append(f"Hoist: {before.hoist} → {after.hoist}")
        if before.mentionable != after.mentionable:
            changes.append(f"Mentionable: {before.mentionable} → {after.mentionable}")
        if before.position != after.position:
            changes.append(f"Position: {before.position} → {after.position}")
        if not changes:
            return
        entry = await _audit_entry(after.guild, discord.AuditLogAction.role_update, target_id=after.id)
        actor = _actor(entry)
        description = _details(Role=after.mention, **{"Action by": _mention(actor), "Changes": "\n".join(changes), "Reason": _reason(entry)})
        await self.bot.logs.log(after.guild, "role_name_update", embeds.info("Role updated", description))

    @commands.Cog.listener()
    async def on_guild_emojis_update(self, guild: discord.Guild, before, after) -> None:  # noqa: ANN001
        before_ids = {e.id for e in before}; after_ids = {e.id for e in after}
        for emoji in after:
            if emoji.id not in before_ids:
                entry = await _audit_entry(guild, discord.AuditLogAction.emoji_create, target_id=emoji.id)
                await self.bot.logs.log(guild, "emoji_create", embeds.info("Emoji added", _details(Name=emoji.name, **{"Action by": _mention(_actor(entry)), "Reason": _reason(entry)})))
        for emoji in before:
            if emoji.id not in after_ids:
                entry = await _audit_entry(guild, discord.AuditLogAction.emoji_delete, target_id=emoji.id)
                await self.bot.logs.log(guild, "emoji_delete", embeds.info("Emoji removed", _details(Name=emoji.name, **{"Action by": _mention(_actor(entry)), "Reason": _reason(entry)})))

    @commands.Cog.listener()
    async def on_guild_stickers_update(self, guild: discord.Guild, before, after) -> None:  # noqa: ANN001
        before_ids = {s.id for s in before}; after_ids = {s.id for s in after}
        for sticker in after:
            if sticker.id not in before_ids:
                entry = await _audit_entry(guild, discord.AuditLogAction.sticker_create, target_id=sticker.id)
                await self.bot.logs.log(guild, "sticker_create", embeds.info("Sticker added", _details(Name=sticker.name, **{"Action by": _mention(_actor(entry)), "Reason": _reason(entry)})))
        for sticker in before:
            if sticker.id not in after_ids:
                entry = await _audit_entry(guild, discord.AuditLogAction.sticker_delete, target_id=sticker.id)
                await self.bot.logs.log(guild, "sticker_delete", embeds.info("Sticker removed", _details(Name=sticker.name, **{"Action by": _mention(_actor(entry)), "Reason": _reason(entry)})))

    @commands.Cog.listener()
    async def on_invite_create(self, invite: discord.Invite) -> None:
        if invite.guild is None:
            return
        entry = await _audit_entry(invite.guild, discord.AuditLogAction.invite_create)
        actor = invite.inviter or _actor(entry)
        description = _details(Code=f"`{invite.code}`", Channel=getattr(invite.channel, "mention", "Unknown"),
                               **{"Created by": _mention(actor), "Max uses": invite.max_uses, "Reason": _reason(entry)})
        await self.bot.logs.log(invite.guild, "invite_create", embeds.info("Invite created", description))

    @commands.Cog.listener()
    async def on_invite_delete(self, invite: discord.Invite) -> None:
        if invite.guild is None:
            return
        entry = await _audit_entry(invite.guild, discord.AuditLogAction.invite_delete)
        description = _details(Code=f"`{invite.code}`", **{"Action by": _mention(_actor(entry)), "Reason": _reason(entry)})
        await self.bot.logs.log(invite.guild, "invite_delete", embeds.info("Invite deleted", description))

    @commands.Cog.listener()
    async def on_thread_create(self, thread: discord.Thread) -> None:
        entry = await _audit_entry(thread.guild, discord.AuditLogAction.thread_create, target_id=thread.id)
        description = _details(Thread=thread.mention, **{"Action by": _mention(_actor(entry)), "Reason": _reason(entry)})
        await self.bot.logs.log(thread.guild, "thread_create", embeds.info("Thread created", description))

    @commands.Cog.listener()
    async def on_thread_delete(self, thread: discord.Thread) -> None:
        entry = await _audit_entry(thread.guild, discord.AuditLogAction.thread_delete, target_id=thread.id)
        description = _details(Thread=f"#{thread.name}", **{"Action by": _mention(_actor(entry)), "Reason": _reason(entry)})
        await self.bot.logs.log(thread.guild, "thread_delete", embeds.info("Thread deleted", description))

    @commands.Cog.listener()
    async def on_thread_update(self, before: discord.Thread, after: discord.Thread) -> None:
        changes: list[str] = []
        if before.name != after.name: changes.append(f"Name: {before.name} → {after.name}")
        if before.archived != after.archived: changes.append(f"Archived: {before.archived} → {after.archived}")
        if before.locked != after.locked: changes.append(f"Locked: {before.locked} → {after.locked}")
        if not changes: return
        entry = await _audit_entry(after.guild, discord.AuditLogAction.thread_update, target_id=after.id)
        description = _details(Thread=after.mention, **{"Action by": _mention(_actor(entry)), "Changes": "\n".join(changes), "Reason": _reason(entry)})
        await self.bot.logs.log(after.guild, "thread_name_update", embeds.info("Thread updated", description))

    @commands.Cog.listener()
    async def on_webhooks_update(self, channel: discord.abc.GuildChannel) -> None:
        description = _details(Channel=channel.mention if hasattr(channel, "mention") else f"#{channel.name}",
                               **{"Action by": "Unknown", "Details": "Webhook activity detected. Discord does not identify the exact webhook action through this event."})
        await self.bot.logs.log(channel.guild, "webhook_update", embeds.info("Webhook activity", description))


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(GuildEvents(bot))
