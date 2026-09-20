"""XP and level maths for message activity."""
from __future__ import annotations

import math
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

import discord

from ..database.repository import Repository
from ..utils.logger import get_logger
from .settings_service import SettingsService

log = get_logger("levels")

XP_PER_LEVEL = Decimal("150")
DEFAULT_XP_PER_MESSAGE = Decimal("7.5")


def _xp(value: Any) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0")


def level_for_xp(xp: Any) -> int:
    """Level 1 starts at 0 XP; each additional 150 XP advances one level."""
    return max(1, int(_xp(xp) // XP_PER_LEVEL) + 1)


def xp_for_level(level: int) -> Decimal:
    """XP floor for a level (level 1 starts at 0 XP)."""
    return max(Decimal("0"), Decimal(max(1, int(level)) - 1) * XP_PER_LEVEL)


def rank_for_level(level: int) -> int:
    """Crew rank: +1 rank at every second level (Lv1=0, Lv2=1, Lv3=1...)."""
    return max(0, int(level) // 2)


# Back-compat names for callers that still import the old helpers.
level_for_messages = level_for_xp
messages_for_level = lambda level: max(0, int(level) - 1) * 20


class LevelService:
    def __init__(self, repo: Repository, settings: SettingsService) -> None:
        self.repo = repo
        self.settings = settings

    async def award(self, guild_id: str, member: Any) -> Optional[int]:
        """Award XP for every eligible message and derive level from total XP."""
        config = await self.settings.get(guild_id)
        if config and not config.get("xp_enabled", True):
            return None

        amount = _xp((config or {}).get("xp_per_message", DEFAULT_XP_PER_MESSAGE))
        if amount <= 0:
            amount = DEFAULT_XP_PER_MESSAGE

        profile = await self.repo.get_xp(guild_id, str(member.id))
        current_xp = _xp(profile.get("xp", 0))
        current_messages = int(profile.get("messages", 0) or 0)
        previous_level = level_for_xp(current_xp)

        new_messages = current_messages + 1
        new_xp = current_xp + amount
        new_level = level_for_xp(new_xp)

        await self.repo.save_xp(
            {
                "guild_id": guild_id,
                "user_id": str(member.id),
                "username": member.name,
                "xp": float(new_xp) if new_xp % 1 else int(new_xp),
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
    def progress(xp: Any, level: int) -> tuple[float, int]:
        """Progress within the current 150-XP level."""
        current = max(Decimal("0"), _xp(xp) - xp_for_level(level))
        current = min(XP_PER_LEVEL, current)
        return float(current), int(XP_PER_LEVEL)

    @staticmethod
    def bar(current: float, total: int, width: int = 16) -> str:
        filled = max(0, min(width, math.floor(width * current / max(1, total))))
        return "█" * filled + "░" * (width - filled)


def format_xp(value: Any) -> str:
    """Display XP cleanly without showing unnecessary .0."""
    number = _xp(value)
    return f"{number:.1f}".rstrip("0").rstrip(".") if number % 1 else f"{int(number):,}"
