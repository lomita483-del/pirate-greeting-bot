"""XP and level maths for message activity."""
from __future__ import annotations
import math
from typing import Any, Optional
import discord
from ..database.repository import Repository
from ..utils.logger import get_logger
from .settings_service import SettingsService
log = get_logger("levels")

def level_for_xp(xp: int) -> int:
    level = 0
    while xp >= xp_for_level(level + 1): level += 1
    return level

def xp_for_level(level: int) -> int:
    if level <= 0: return 0
    return int(5 * (level ** 2) + 50 * level + 100)

class LevelService:
    def __init__(self, repo: Repository, settings: SettingsService) -> None:
        self.repo = repo; self.settings = settings

    async def award(self, guild_id: str, member: Any) -> Optional[int]:
        """Award the configured XP amount for every eligible message."""
        config = await self.settings.get(guild_id)
        if config and not config.get("xp_enabled", True): return None
        amount = max(1, int((config or {}).get("xp_per_message", 15)))
        profile = await self.repo.get_xp(guild_id, str(member.id))
        current_xp = int(profile.get("xp", 0) or 0)
        previous_level = level_for_xp(current_xp)
        new_xp = current_xp + amount
        new_level = level_for_xp(new_xp)
        await self.repo.save_xp({"guild_id": guild_id, "user_id": str(member.id), "username": member.name, "xp": new_xp, "level": new_level, "messages": int(profile.get("messages", 0) or 0) + 1, "last_awarded_at": None})
        return new_level if new_level > previous_level else None

    async def apply_rewards(self, member: Any, level: int) -> list[Any]:
        guild = getattr(member, "guild", None)
        if guild is None or not guild.me.guild_permissions.manage_roles: return []
        config = await self.settings.get(str(guild.id), "role_settings"); rules = (config or {}).get("level_roles") or []; granted = []
        for rule in rules:
            if not isinstance(rule, dict): continue
            try: threshold = int(rule.get("level", 0)); role_id = int(rule.get("role_id"))
            except (TypeError, ValueError): continue
            if threshold <= 0 or level < threshold: continue
            role = guild.get_role(role_id)
            if role is None or role.managed or role >= guild.me.top_role or role in getattr(member, "roles", []): continue
            try: await member.add_roles(role, reason=f"AHOY level reward (level {threshold})"); granted.append(role)
            except discord.HTTPException as exc: log.warning("Level reward failed in %s: %s", guild.id, exc)
        return granted

    @staticmethod
    def progress(xp: int, level: int) -> tuple[int, int]:
        floor_xp = xp_for_level(level); ceil_xp = xp_for_level(level + 1)
        return max(0, xp - floor_xp), max(1, ceil_xp - floor_xp)

    @staticmethod
    def bar(current: int, total: int, width: int = 16) -> str:
        filled = max(0, min(width, math.floor(width * current / max(1, total))))
        return "█" * filled + "░" * (width - filled)
