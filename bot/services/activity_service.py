"""Durable activity logging with concise, actionable Discord audit entries."""

from __future__ import annotations

from typing import Any, Optional

import discord

from ..database.repository import Repository
from ..utils.logger import get_logger
from .log_service import LogService

log = get_logger("activity")

CATEGORY_TO_SETTING: dict[str, str] = {
    "message_delete": "message_delete",
    "message_edit": "message_edit",
    "member_join": "member_join",
    "member_leave": "member_leave",
    "member_nickname": "role_changes",
    "member_roles": "role_changes",
    "channel_create": "channel_changes",
    "channel_delete": "channel_changes",
    "channel_update": "channel_changes",
    "server_update": "server_changes",
    "voice_join": "voice_activity",
    "voice_leave": "voice_activity",
    "voice_move": "voice_activity",
    "invite_create": "server_changes",
    "invite_delete": "server_changes",
    "moderation": "moderation_actions",
}


def _name(user: Any) -> Optional[str]:
    return str(user) if user is not None else None


def _metadata_lines(metadata: Optional[dict[str, Any]]) -> str:
    if not metadata:
        return ""
    lines: list[str] = []
    for key, value in metadata.items():
        if value is None or value == "":
            continue
        label = str(key).replace("_", " ").title()
        if isinstance(value, list):
            rendered: list[str] = []
            for item in value:
                if isinstance(item, dict):
                    rendered.append(str(item.get("name") or item.get("value") or "—"))
                else:
                    rendered.append(str(item))
            text = ", ".join(rendered)
        else:
            text = str(value)
        if len(text) > 500:
            text = text[:497] + "..."
        lines.append(f"**{label}:** {text}")
    return "\n".join(lines)


class ActivityService:
    def __init__(self, repo: Repository, logs: LogService) -> None:
        self.repo = repo
        self.logs = logs

    async def record(
        self,
        guild: Optional[discord.Guild],
        category: str,
        summary: str,
        *,
        actor: Optional[discord.abc.User] = None,
        target: Optional[discord.abc.User] = None,
        channel: Optional[Any] = None,
        metadata: Optional[dict[str, Any]] = None,
        embed: Optional[discord.Embed] = None,
    ) -> None:
        """Persist an activity row and optionally mirror it to Discord."""
        if guild is None:
            return
        try:
            await self.repo.log_activity(
                {
                    "guild_id": str(guild.id),
                    "category": category,
                    "actor_id": str(actor.id) if actor else None,
                    "actor_name": _name(actor),
                    "target_id": str(target.id) if target else None,
                    "target_name": _name(target),
                    "channel_id": str(channel.id) if channel is not None else None,
                    "channel_name": getattr(channel, "name", None),
                    "summary": summary[:500],
                    "metadata": metadata or {},
                }
            )
        except Exception as exc:
            log.warning("Activity log write failed (%s): %s", category, exc)

        if embed is None:
            return
        setting = CATEGORY_TO_SETTING.get(category)
        if not setting:
            return

        try:
            audit = embed.copy()
            if audit.title:
                audit.title = f"*_{audit.title.replace('*_', '').replace('_*', '')}_*"
            if audit.description:
                audit.description = f"_{audit.description.strip('_')}_"

            audit.add_field(
                name="Server",
                value=f"**{guild.name}**",
                inline=True,
            )
            if channel is not None:
                audit.add_field(
                    name="Channel",
                    value=getattr(channel, "mention", f"#{getattr(channel, 'name', 'unknown')}"),
                    inline=True,
                )
            if actor is not None:
                audit.add_field(
                    name="Action by",
                    value=actor.mention if hasattr(actor, "mention") else str(actor),
                    inline=True,
                )
            if target is not None:
                audit.add_field(
                    name="Member",
                    value=target.mention if hasattr(target, "mention") else str(target),
                    inline=True,
                )

            audit.add_field(
                name="Log",
                value=f"_{summary[:900]}_",
                inline=False,
            )
            details = _metadata_lines(metadata)
            if details:
                audit.add_field(name="Details", value=details[:1024], inline=False)
            audit.set_footer(text="!HOY BOT  •  Detailed Audit Log")
            await self.logs.send(guild, setting, audit)
        except Exception as exc:
            log.warning("Could not enrich audit embed for %s: %s", category, exc)
