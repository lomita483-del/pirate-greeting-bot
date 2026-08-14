"""Platform-level access control and owner notification delivery.

The website owner can block a Discord account from using AHOY entirely, or
disable individual feature groups for that account. Those decisions live in
``platform_users`` and are cached here for a short while so we never hit the
database on every interaction.
"""

from __future__ import annotations

import time
from typing import Any, Optional

from ..database.repository import Repository
from ..utils.logger import get_logger

log = get_logger("platform")

CACHE_TTL_SECONDS = 120

# Maps a slash command name onto the feature flag that gates it.
COMMAND_FEATURES: dict[str, str] = {
    "warn": "moderation",
    "warnings": "moderation",
    "clearwarn": "moderation",
    "kick": "moderation",
    "ban": "moderation",
    "unban": "moderation",
    "timeout": "moderation",
    "untimeout": "moderation",
    "purge": "moderation",
    "slowmode": "moderation",
    "lock": "moderation",
    "unlock": "moderation",
    "rank": "levels",
    "level": "levels",
    "leaderboard": "levels",
    "balance": "economy",
    "daily": "economy",
    "pay": "economy",
    "deposit": "economy",
    "withdraw": "economy",
    "work": "economy",
    "ticket": "tickets",
    "close": "tickets",
    "remind": "reminders",
    "reminders": "reminders",
}


class AccessDenied(Exception):
    """Raised when the platform owner has restricted this user."""


class PlatformService:
    def __init__(self, repo: Repository) -> None:
        self.repo = repo
        self._cache: dict[str, tuple[float, Optional[dict[str, Any]]]] = {}

    def invalidate(self, user_id: str) -> None:
        self._cache.pop(user_id, None)

    async def _profile(self, user_id: str) -> Optional[dict[str, Any]]:
        cached = self._cache.get(user_id)
        if cached and time.monotonic() - cached[0] < CACHE_TTL_SECONDS:
            return cached[1]
        profile = await self.repo.platform_user(user_id)
        self._cache[user_id] = (time.monotonic(), profile)
        return profile

    async def ensure_allowed(self, user_id: str, command_name: str) -> None:
        """Raise ``AccessDenied`` when the owner blocked this user or feature."""
        profile = await self._profile(user_id)
        if not profile:
            return

        if profile.get("banned") or profile.get("bot_blocked"):
            raise AccessDenied(
                "Your access to AHOY has been restricted by the bot owner."
            )

        feature = COMMAND_FEATURES.get(command_name)
        if not feature:
            return
        flags = profile.get("feature_flags") or {}
        if flags.get(feature) is False:
            raise AccessDenied(
                f"The **{feature.replace('_', ' ')}** features are disabled for your account."
            )


__all__ = ["PlatformService", "AccessDenied", "COMMAND_FEATURES"]
