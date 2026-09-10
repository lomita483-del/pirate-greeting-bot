"""Server event logging.

One way to log something now: `log(guild, event_type, embed)`.

Each specific event type (e.g. "user_join", "voice_user_leave") can be
routed to its own channel via `logging_settings.channel_overrides` (a
{event_type: channel_id} map configured on the website's "Detailed event
log" grid). If nothing is set for that exact event type, it falls back to
that event's broad category toggle + the single "Default log channel"
(the website's original 9-toggle section) — so admins who only fill in the
simple toggles still get everything in one channel, and admins who also
set a specific override get that one broken out, without ever posting the
same event twice.

`send()` still exists for the couple of call sites that only make sense as
a broad category (nothing granular defined for them yet) — just don't call
both `send()` and `log()` for the same conceptual event, or you're back to
double-posting.
"""

from __future__ import annotations

from typing import Optional

import discord

from ..utils import embeds
from ..utils.logger import get_logger
from .settings_service import SettingsService

log = get_logger("logging")

# Granular event_type -> its broad category toggle, used as a fallback when
# no specific channel_overrides entry exists for that exact event type.
# Keys match the website's GRANULAR_CATEGORIES; values match LOG_EVENTS.
GRANULAR_TO_CATEGORY: dict[str, str] = {
    "user_join": "member_join",
    "user_leave": "member_leave",
    "user_roles_add": "role_changes",
    "user_roles_remove": "role_changes",
    "user_name_update": "role_changes",
    "user_avatar_update": "role_changes",
    "user_timed_out": "moderation_actions",
    "user_timeout_removed": "moderation_actions",
    "message_delete": "message_delete",
    "message_bulk_delete": "message_delete",
    "message_edit": "message_edit",
    "voice_user_join": "voice_activity",
    "voice_user_leave": "voice_activity",
    "voice_user_switch": "voice_activity",
    "role_create": "role_changes",
    "role_delete": "role_changes",
    "role_name_update": "role_changes",
    "role_color_update": "role_changes",
    "role_permissions_update": "role_changes",
    "role_hoist_update": "role_changes",
    "role_mentionable_update": "role_changes",
    "role_position_update": "role_changes",
    "channel_create": "channel_changes",
    "channel_delete": "channel_changes",
    "channel_name_update": "channel_changes",
    "channel_topic_update": "channel_changes",
    "channel_nsfw_update": "channel_changes",
    "channel_parent_update": "channel_changes",
    "channel_slow_mode_update": "channel_changes",
    "server_name_update": "server_changes",
    "server_icon_update": "server_changes",
    "server_owner_update": "server_changes",
    "verification_level_update": "server_changes",
    "server_boost_level_update": "server_changes",
    "moderation_ban": "moderation_actions",
    "moderation_unban": "moderation_actions",
    "moderation_kick": "moderation_actions",
    "moderation_warn": "moderation_actions",
    "moderation_timeout": "moderation_actions",
    "moderation_untimeout": "moderation_actions",
    "moderation_automod": "moderation_actions",
}


class LogService:
    def __init__(self, bot: discord.Client, settings: SettingsService) -> None:
        self.bot = bot
        self.settings = settings

    # -- coarse (legacy) ---------------------------------------------------
    async def send(
        self,
        guild: Optional[discord.Guild],
        category: str,
        embed: discord.Embed,
    ) -> None:
        """Send an embed to the single configured log channel when the
        category toggle is on. Only use this for events that have no
        granular equivalent in GRANULAR_TO_CATEGORY / the website's
        detailed-log grid — otherwise use `log()` alone, which already
        falls back to this same behavior."""
        if guild is None:
            return
        try:
            config = await self.settings.get(str(guild.id), "logging_settings")
            if not config or not config.get("enabled"):
                return
            if not config.get(category, False):
                return
            channel_id = config.get("log_channel_id")
            if not channel_id:
                return
            await self._deliver(guild, channel_id, embed)
        except Exception as exc:  # never let logging break a command
            log.warning("Failed to write server log for guild %s: %s", guild.id, exc)

    # -- granular, per-event-type, with fallback ----------------------------
    async def log(
        self,
        guild: Optional[discord.Guild],
        event_type: str,
        embed: discord.Embed,
    ) -> None:
        """Route a specific event type to whichever channel was configured
        for it on the website. If nothing specific is set, fall back to
        that event's broad category toggle + default log channel (so this
        one call replaces needing to also call `send()` for the same
        event — calling both is what causes duplicate posts)."""
        if guild is None:
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
            await self._deliver(guild, channel_id, embed)
        except Exception as exc:
            log.warning(
                "Failed to write granular log '%s' for guild %s: %s", event_type, guild.id, exc
            )

    async def _deliver(self, guild: discord.Guild, channel_id: str, embed: discord.Embed) -> None:
        channel = guild.get_channel(int(channel_id))
        if isinstance(channel, discord.TextChannel):
            perms = channel.permissions_for(guild.me)
            if perms.send_messages and perms.embed_links:
                await channel.send(embed=embed)

    async def moderation(
        self,
        guild: discord.Guild,
        action: str,
        target: str,
        moderator: str,
        reason: str,
        extra: str = "",
    ) -> None:
        embed = embeds.info(
            f"Moderation · {action.title()}",
            f"**Member:** {target}\n**Moderator:** {moderator}\n**Reason:** {reason}"
            + (f"\n{extra}" if extra else ""),
        )
        # log() alone is enough — it falls back to the "moderation_actions"
        # toggle + default channel when no specific override is set, so a
        # paired send() call here would just double-post.
        await self.log(guild, f"moderation_{action}", embed)
