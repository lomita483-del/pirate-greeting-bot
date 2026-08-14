"""Cached per-server settings access.

Settings are read constantly (every message for XP/AutoMod), so they are cached
in memory with a short TTL. The dashboard writes straight to the database and
changes are picked up within the TTL window.
"""

from __future__ import annotations

import time
from typing import Any

from ..database.repository import Repository

TTL_SECONDS = 60


class SettingsService:
    def __init__(self, repo: Repository) -> None:
        self.repo = repo
        self._cache: dict[tuple[str, str], tuple[float, dict[str, Any]]] = {}

    async def get(self, guild_id: str, table: str = "server_settings") -> dict[str, Any]:
        key = (guild_id, table)
        cached = self._cache.get(key)
        now = time.monotonic()
        if cached and now - cached[0] < TTL_SECONDS:
            return cached[1]
        data = await self.repo.get_settings(guild_id, table)
        self._cache[key] = (now, data)
        return data

    def invalidate(self, guild_id: str) -> None:
        for key in list(self._cache):
            if key[0] == guild_id:
                self._cache.pop(key, None)
