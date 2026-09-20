"""XP, level and crew-rank maths for message activity."""
from __future__ import annotations

import math
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

import discord

from ..database.repository import Repository
from ..utils.logger import get_logger
from .settings_service import SettingsService

log = get_logger("levels")

DEFAULT_XP_PER_LEVEL = Decimal("200")
DEFAULT_XP_PER_MESSAGE = Decimal("7.5")
DEFAULT_RANK_EVERY_LEVELS = 2


def _xp(value: Any) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0")


def _config_number(config: dict[str, Any], key: str, default: Decimal) -> Decimal:
    value = _xp(config.get(key, default))
    return value if value > 0 else default


def level_for_xp(xp: Any, xp_per_level: Any = DEFAULT_XP_PER_LEVEL) -> int:
    """Each completed XP block is one level: 200 XP = Lv1, 400 XP = Lv2."""
    amount = _config_number({"value": xp_per_level}, "value", DEFAULT_XP_PER_LEVEL)
    return max(0, int((_xp(xp) + amount - Decimal("0.0000001")) // amount))


def xp_for_level(level: int, xp_per_level: Any = DEFAULT_XP_PER_LEVEL) -> Decimal:
    """Return the XP threshold for a level: Lv1=200, Lv2=400 by default."""
    amount = _config_number({"value": xp_per_level}, "value", DEFAULT_XP_PER_LEVEL)
    return max(Decimal("0"), Decimal(max(0, int(level))) * amount)


def rank_for_level(level: int, every_levels: int = DEFAULT_RANK_EVERY_LEVELS) -> int:
    """Crew rank: +1 at every N levels. Default: Lv1=0, Lv2=1, Lv3=1, Lv4=2."""
    interval = max(1, int(every_levels or DEFAULT_RANK_EVERY_LEVELS))
    return max(0, int(level) // interval)


# Back-compat names for callers that still import the old helpers.
level_for_messages = level_for_xp
messages_for_level = lambda level: max(0, int(level) - 1) * 20


class LevelService:
    def __init__(self, repo: Repository, settings: SettingsService) -> None:
        self.repo = repo
        self.settings = settings

    async def config(self, guild_id: str) -> dict[str, Any]:
        return await self.settings.get(guild_id)

    async def award(self, guild_id: str, member: Any) -> Optional[int]:
        """Award configured XP for every eligible message and derive its level."""
        config = await self.settings.get(guild_id)
        if config and not config.get("xp_enabled", True):
            return None

        amount = _config_number(config or {}, "xp_per_message", DEFAULT_XP_PER_MESSAGE)
        per_level = _config_number(config or {}, "xp_per_level", DEFAULT_XP_PER_LEVEL)

        profile = await self.repo.get_xp(guild_id, str(member.id))
        current_xp = _xp(profile.get("xp", 0))
        current_messages = int(profile.get("messages", 0) or 0)
        previous_level = level_for_xp(current_xp, per_level)

        new_messages = current_messages + 1
        new_xp = current_xp + amount
        new_level = level_for_xp(new_xp, per_level)

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
            if role is None or role.managed or role >= guild.me.top_role or role in getattr(member, "roles", []):
                continue
            try:
                await member.add_roles(role, reason=f"AHOY level reward (level {threshold})")
                granted.append(role)
            except discord.HTTPException as exc:
                log.warning("Level reward failed in %s: %s", guild.id, exc)
        return granted

    @staticmethod
    def progress(
        xp: Any,
        level: int,
        xp_per_level: Any = DEFAULT_XP_PER_LEVEL,
    ) -> tuple[float, int]:
        """Show cumulative XP toward the level threshold: 200/200 = Lv1, 400/400 = Lv2."""
        amount = _config_number({"value": xp_per_level}, "value", DEFAULT_XP_PER_LEVEL)
        target = xp_for_level(level, amount) if int(level) > 0 else amount
        current = min(max(Decimal("0"), _xp(xp)), target)
        return float(current), int(target) if target % 1 == 0 else float(target)

    @staticmethod
    def bar(current: float, total: float, width: int = 16) -> str:
        filled = max(0, min(width, math.floor(width * current / max(1, total))))
        return "█" * filled + "░" * (width - filled)


def format_xp(value: Any) -> str:
    number = _xp(value)
    return f"{number:.1f}".rstrip("0").rstrip(".") if number % 1 else f"{int(number):,}"
