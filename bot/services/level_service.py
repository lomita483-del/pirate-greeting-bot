"""XP and level maths for message activity.

Level progression is intentionally message-based: every 10 eligible messages
advances one level. Each message still awards the configured XP amount, so
with the default 15 XP/message the progression is 10 messages = 150 XP = 1
level, 20 messages = 300 XP = 2 levels, and so on.
"""
from __future__ import annotations

import math
from typing import Any, Optional

import discord

from ..database.repository import Repository
from ..utils.logger import get_logger
from .settings_service import SettingsService

log = get_logger("levels")

MESSAGES_PER_LEVEL = 10


def level_for_messages(messages: int) -> int:
    return max(0, int(messages)) // MESSAGES_PER_LEVEL


def messages_for_level(level: int) -> int:
    return max(0, int(level)) * MESSAGES_PER_LEVEL


# Compatibility aliases for callers that still use the old names.
level_for_xp = level_for_messages
xp_for_level = messages_for_level


class LevelService:
    def __init__(self, repo: Repository, settings: SettingsService) -> None:
        self.repo = repo
        self.settings = settings

    async def award(self, guild_id: str, member: Any) -> Optional[int]:
        """Award XP on each eligible message; level advances every 10 messages."""
        config = await self.settings.get(guild_id)
        if config and not config.get("xp_enabled", True):
            return None

        amount = max(1, int((config or {}).get("xp_per_message", 15)))
        profile = await self.repo.get_xp(guild_id, str(member.id))
        current_xp = int(profile.get("xp", 0) or 0)
        current_messages = int(profile.get("messages", 0) or 0)

        previous_level = level_for_messages(current_messages)
        new_messages = current_messages + 1
        new_xp = current_xp + amount
        new_level = level_for_messages(new_messages)

        await self.repo.save_xp(
            {
                "guild_id": guild_id,
                "user_id": str(member.id),
                "username": member.name,
                "xp": new_xp,
                "level": new_level,
                "messages": new_messages,
                "last_awarded_at": None,
            }
        )
        return new_level if new_level > previous_level else None

    async def apply_rewards(self, member: Any, level: int) -> list[Any]:
        guild = getattr(member, "guild", None)
        if guild is None or not guild.me.guild_permissions.manage_roles:
            return []

        config = await self.settings.get(str(guild.id), "role_settings")
        rules = (config or {}).get("level_roles") or []
        granted = []

        for rule in rules:
            if not isinstance(rule, dict):
                continue
            try:
                threshold = int(rule.get("level", 0))
                role_id = int(rule.get("role_id"))
            except (TypeError, ValueError):
                continue
            if threshold <= 0 or level < threshold:
                continue
            role = guild.get_role(role_id)
            if (
                role is None
                or role.managed
                or role >= guild.me.top_role
                or role in getattr(member, "roles", [])
            ):
                continue
            try:
                await member.add_roles(
                    role, reason=f"AHOY level reward (level {threshold})"
                )
                granted.append(role)
            except discord.HTTPException as exc:
                log.warning("Level reward failed in %s: %s", guild.id, exc)
        return granted

    @staticmethod
    def progress(messages: int, level: int) -> tuple[int, int]:
        """Return messages into the current 10-message level and its size."""
        into_level = max(0, int(messages)) - messages_for_level(level)
        return max(0, into_level), MESSAGES_PER_LEVEL

    @staticmethod
    def bar(current: int, total: int, width: int = 16) -> str:
        filled = max(0, min(width, math.floor(width * current / max(1, total))))
        return "█" * filled + "░" * (width - filled)
