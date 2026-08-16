"""Server event logging.

Two ways to log something:
- `send(guild, category, embed)` — the original, coarse category toggle
  (still used by a few call sites; kept for backward compatibility).
- `log(guild, event_type, embed)` — granular, per-event-type routing. Each
  event type (e.g. "role_create", "channel_delete") can be routed to its own
  channel via `logging_settings.channel_overrides` (a {event_type: channel_id}
  map configured on the website). If an event type has no override, it's
  simply not logged — matching how Sapphire's per-type "Set channel" works.
"""

from __future__ import annotations

from typing import Optional

import discord

from ..utils import embeds
from ..utils.logger import get_logger
from .settings_service import SettingsService

log = get_logger("logging")


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
        category toggle is on. Kept for the handful of call sites still
        using the original 9 broad categories."""
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

    # -- granular, per-event-type ------------------------------------------
    async def log(
        self,
        guild: Optional[discord.Guild],
        event_type: str,
        embed: discord.Embed,
    ) -> None:
        """Route a specific event type to whichever channel was configured
        for it on the website. No override configured = not logged."""
        if guild is None:
            return
        try:
            config = await self.settings.get(str(guild.id), "logging_settings")
            if not config or not config.get("enabled"):
                return
            overrides = config.get("channel_overrides") or {}
            channel_id = overrides.get(event_type)
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
        await self.send(guild, "moderation_actions", embed)
        await self.log(guild, f"moderation_{action}", embed)
