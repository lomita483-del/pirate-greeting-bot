"""Shared moderation persistence + logging so every action behaves the same."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import discord

from ..database.repository import Repository
from ..utils.logger import get_logger
from .log_service import LogService

log = get_logger("moderation")

# Actions that stay "active" until they are lifted or expire.
ACTIVE_ACTIONS = {"timeout", "ban", "mute"}
# Lifting an action closes the matching open case(s).
LIFTS: dict[str, list[str]] = {
    "unban": ["ban"],
    "untimeout": ["timeout", "mute"],
    "unmute": ["mute", "timeout"],
    "warn_revoked": ["warn"],
}


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
    ) -> dict[str, Any]:
        """Write a moderation log row, open a case, and mirror it to Discord."""
        guild_id = str(guild.id)
        await self.repo.log_action(
            guild_id,
            action,
            target_id=str(target.id) if target else None,
            target_name=str(target) if target else None,
            moderator_id=str(moderator.id) if moderator else None,
            moderator_name=str(moderator) if moderator else None,
            reason=reason,
            duration_seconds=duration_seconds,
            metadata=metadata,
        )

        case: dict[str, Any] = {}
        try:
            expires_at = (
                (datetime.now(timezone.utc) + timedelta(seconds=duration_seconds)).isoformat()
                if duration_seconds
                else None
            )
            case = await self.repo.create_case(
                {
                    "guild_id": guild_id,
                    "action": action,
                    "target_id": str(target.id) if target else None,
                    "target_name": str(target) if target else None,
                    "moderator_id": str(moderator.id) if moderator else None,
                    "moderator_name": str(moderator) if moderator else "AHOY AutoMod",
                    "reason": reason,
                    "duration_seconds": duration_seconds,
                    "expires_at": expires_at,
                    "active": action in ACTIVE_ACTIONS,
                    "metadata": metadata or {},
                }
            )
            lifted = LIFTS.get(action)
            if lifted and target is not None:
                await self.repo.close_active_cases(guild_id, str(target.id), lifted)
        except Exception as exc:  # cases must never block a moderation action
            log.warning("Could not open a case for %s in %s: %s", action, guild_id, exc)

        number = case.get("case_number")
        await self.logs.moderation(
            guild,
            action,
            str(target) if target else "—",
            str(moderator) if moderator else "AHOY AutoMod",
            reason,
            (f"**Case:** #{number}\n" if number else "") + extra,
        )
        return case
