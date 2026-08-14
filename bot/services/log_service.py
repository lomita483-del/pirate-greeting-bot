"""Server event logging - each category can be toggled independently."""

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

    async def send(
        self,
        guild: Optional[discord.Guild],
        category: str,
        embed: discord.Embed,
    ) -> None:
        """Send an embed to the configured log channel when the category is on."""
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
            channel = guild.get_channel(int(channel_id))
            if isinstance(channel, discord.TextChannel):
                perms = channel.permissions_for(guild.me)
                if perms.send_messages and perms.embed_links:
                    await channel.send(embed=embed)
        except Exception as exc:  # never let logging break a command
            log.warning("Failed to write server log for guild %s: %s", guild.id, exc)

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
