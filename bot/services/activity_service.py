"""Durable activity logging.

Every significant server event is written to ``activity_logs`` so the
dashboard can show a filterable audit trail, and (when the matching logging
category is enabled) mirrored to the Discord log channel by ``LogService``.
"""

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
        text = str(value)
        if len(text) > 500:
            text = text[:497] + "..."
        lines.append(f"**{str(key).replace('_', ' ').title()}:** {text}")
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
        """Persist an activity row and optionally mirror a complete audit record to Discord."""
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

        if embed is not None:
            setting = CATEGORY_TO_SETTING.get(category)
            if setting:
                # Enrich every mirrored audit embed with the same context that
                # exists in the database. This makes Discord logs actionable
                # without forcing an admin to cross-reference IDs manually.
                try:
                    audit = embed.copy()
                    audit.add_field(
                        name="🛡️ SERVER",
                        value=f"**{guild.name}**\n`{guild.id}`",
                        inline=True,
                    )
                    if channel is not None:
                        audit.add_field(
                            name="💬 CHANNEL",
                            value=f"**#{getattr(channel, 'name', 'unknown')}**\n`{channel.id}`",
                            inline=True,
                        )
                    if actor is not None:
                        audit.add_field(
                            name="👤 ACTOR",
                            value=f"**{actor}**\n<@{actor.id}>\n`{actor.id}`",
                            inline=True,
                        )
                    if target is not None:
                        audit.add_field(
                            name="🎯 TARGET",
                            value=f"**{target}**\n<@{target.id}>\n`{target.id}`",
                            inline=True,
                        )
                    audit.add_field(name="📌 EVENT", value=f"`{category}`\n{summary[:900]}", inline=False)
                    details = _metadata_lines(metadata)
                    if details:
                        audit.add_field(name="🧾 DETAILS", value=details[:1024], inline=False)
                    audit.set_footer(text="!HOY BOT  •  Detailed Audit Log")
                    await self.logs.send(guild, setting, audit)
                except Exception as exc:
                    log.warning("Could not enrich audit embed for %s: %s", category, exc)
