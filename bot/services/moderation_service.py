"""Shared moderation persistence + logging so every action behaves the same."""

from __future__ import annotations

from typing import Optional

import discord

from ..database.repository import Repository
from .log_service import LogService


class ModerationService:
    def __init__(self, repo: Repository, logs: LogService) -> None:
        self.repo = repo
        self.logs = logs

    async def record(
        self,
        guild: discord.Guild,
        action: str,
        *,
        target: Optional[discord.abc.User] = None,
        moderator: Optional[discord.abc.User] = None,
        reason: str = "No reason provided",
        duration_seconds: Optional[int] = None,
        metadata: Optional[dict] = None,
        extra: str = "",
    ) -> None:
        await self.repo.log_action(
            str(guild.id),
            action,
            target_id=str(target.id) if target else None,
            target_name=str(target) if target else None,
            moderator_id=str(moderator.id) if moderator else None,
            moderator_name=str(moderator) if moderator else None,
            reason=reason,
            duration_seconds=duration_seconds,
            metadata=metadata,
        )
        await self.logs.moderation(
            guild,
            action,
            str(target) if target else "—",
            str(moderator) if moderator else "AHOY AutoMod",
            reason,
            extra,
        )
