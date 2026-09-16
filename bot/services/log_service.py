"""Server event logging with clean, readable audit formatting."""

from __future__ import annotations

import re
from typing import Optional

import discord

from ..utils import embeds
from ..utils.logger import get_logger
from .settings_service import SettingsService

log = get_logger("logging")

GRANULAR_TO_CATEGORY: dict[str, str] = {
    "user_join": "member_join", "user_leave": "member_leave", "user_roles_add": "role_changes", "user_roles_remove": "role_changes",
    "user_name_update": "role_changes", "user_avatar_update": "role_changes", "user_timed_out": "moderation_actions", "user_timeout_removed": "moderation_actions",
    "message_delete": "message_delete", "message_bulk_delete": "message_delete", "message_edit": "message_edit", "voice_user_join": "voice_activity",
    "voice_user_leave": "voice_activity", "voice_user_switch": "voice_activity", "role_create": "role_changes", "role_delete": "role_changes",
    "role_name_update": "role_changes", "role_color_update": "role_changes", "role_permissions_update": "role_changes", "role_hoist_update": "role_changes",
    "role_mentionable_update": "role_changes", "role_position_update": "role_changes", "channel_create": "channel_changes", "channel_delete": "channel_changes",
    "channel_name_update": "channel_changes", "channel_topic_update": "channel_changes", "channel_nsfw_update": "channel_changes", "channel_parent_update": "channel_changes",
    "channel_slow_mode_update": "channel_changes", "server_name_update": "server_changes", "server_icon_update": "server_changes", "server_owner_update": "server_changes",
    "verification_level_update": "server_changes", "server_boost_level_update": "server_changes", "moderation_ban": "moderation_actions", "moderation_unban": "moderation_actions",
    "moderation_kick": "moderation_actions", "moderation_warn": "moderation_actions", "moderation_timeout": "moderation_actions", "moderation_untimeout": "moderation_actions",
    "moderation_automod": "moderation_actions",
}


class LogService:
    def __init__(self, bot: discord.Client, settings: SettingsService) -> None:
        self.bot = bot
        self.settings = settings

    async def send(self, guild: Optional[discord.Guild], category: str, embed: discord.Embed) -> None:
        if guild is None:
            return
        try:
            config = await self.settings.get(str(guild.id), "logging_settings")
            if not config or not config.get("enabled") or not config.get(category, False):
                return
            channel_id = config.get("log_channel_id")
            if not channel_id:
                return
            await self._deliver(guild, channel_id, embed, category)
        except Exception as exc:
            log.warning("Failed to write server log for guild %s: %s", guild.id, exc)

    async def log(self, guild: Optional[discord.Guild], event_type: str, embed: discord.Embed) -> None:
        if guild is None:
            return

        if event_type in {"user_roles_add", "user_roles_remove", "user_name_update"}:
            return

        try:
            config = await self.settings.get(str(guild.id), "logging_settings")
            if not config or not config.get("enabled"):
                return
            overrides = config.get("channel_overrides") or {}
            channel_id = overrides.get(event_type)
            if not channel_id:
                category = GRANULAR_TO_CATEGORY.get(event_type)
                if category and config.get(category, False):
                    channel_id = config.get("log_channel_id")
            if not channel_id:
                return
            await self._deliver(guild, channel_id, embed, event_type)
        except Exception as exc:
            log.warning("Failed to write granular log '%s' for guild %s: %s", event_type, guild.id, exc)

    async def _find_message_deleter(self, guild: discord.Guild, embed: discord.Embed) -> Optional[discord.abc.User]:
        """Resolve the moderator who deleted a message from Discord audit logs."""
        if not guild.me.guild_permissions.view_audit_log:
            return None
        description = embed.description or ""
        author_match = re.search(r"<@!?([0-9]+)>", description)
        channel_match = re.search(r"<#([0-9]+)>", description)
        author_id = int(author_match.group(1)) if author_match else None
        channel_id = int(channel_match.group(1)) if channel_match else None
        try:
            async for entry in guild.audit_logs(limit=12, action=discord.AuditLogAction.message_delete):
                target_id = getattr(entry.target, "id", None)
                extra = getattr(entry, "extra", None)
                extra_channel_id = getattr(getattr(extra, "channel", None), "id", None)
                if author_id is not None and target_id != author_id:
                    continue
                if channel_id is not None and extra_channel_id not in {None, channel_id}:
                    continue
                return entry.user
        except (discord.Forbidden, discord.HTTPException, discord.ClientException):
            return None
        return None

    async def _deliver(self, guild: discord.Guild, channel_id: str, embed: discord.Embed, event_type: str) -> None:
        channel = guild.get_channel(int(channel_id))
        if not isinstance(channel, discord.TextChannel):
            return
        perms = channel.permissions_for(guild.me)
        if not (perms.send_messages and perms.embed_links):
            return

        audit = embed.copy()
        if audit.title:
            clean_title = audit.title.replace("*_", "").replace("_*", "").strip()
            audit.title = f"*_{clean_title}_*"
        if audit.description:
            audit.description = f"_{audit.description.strip('_')}_"
        audit.add_field(name="Server", value=f"**{guild.name}**", inline=True)
        audit.add_field(name="Log type", value=f"`{event_type}`", inline=True)

        if event_type in {"message_delete", "message_bulk_delete"}:
            deleter = await self._find_message_deleter(guild, embed)
            audit.add_field(
                name="Deleted by",
                value=deleter.mention if deleter is not None else "Discord audit actor unavailable",
                inline=True,
            )

        audit.set_footer(text="!HOY BOT  •  Detailed Audit Log")
        await channel.send(embed=audit)

    async def moderation(
        self,
        guild: discord.Guild,
        action: str,
        target: discord.abc.User | None,
        moderator: discord.abc.User | None,
        reason: str,
        extra: str = "",
    ) -> None:
        target_text = target.mention if target is not None else "—"
        moderator_text = moderator.mention if moderator is not None else "AHOY AutoMod"
        title = f"Moderation · {action.title()}"
        description = (
            f"**Action:** `/{action}`\n"
            f"**Member:** {target_text}\n"
            f"**Action by:** {moderator_text}\n"
            f"**Reason:** {reason}"
            + (f"\n{extra}" if extra else "")
        )
        embed = embeds.info(title, description)
        await self.log(guild, f"moderation_{action}", embed)
