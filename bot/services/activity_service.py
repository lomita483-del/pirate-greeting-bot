"""Durable activity logging with professional, readable Discord audit entries."""

from __future__ import annotations

from typing import Any, Optional

import discord

from ..database.repository import Repository
from ..utils import embeds
from ..utils.logger import get_logger
from .log_service import LogService

log = get_logger("activity")

CATEGORY_TO_SETTING: dict[str, str] = {
    "message_delete": "message_delete", "message_edit": "message_edit", "member_join": "member_join",
    "member_leave": "member_leave", "member_nickname": "role_changes", "member_roles": "role_changes",
    "channel_create": "channel_changes", "channel_delete": "channel_changes", "channel_update": "channel_changes",
    "server_update": "server_changes", "voice_join": "voice_activity", "voice_leave": "voice_activity",
    "voice_move": "voice_activity", "invite_create": "server_changes", "invite_delete": "server_changes",
    "moderation": "moderation_actions",
}


def _name(user: Any) -> Optional[str]:
    return str(user) if user is not None else None


def _metadata_lines(metadata: Optional[dict[str, Any]]) -> str:
    if not metadata:
        return ""
    lines: list[str] = []
    for key, value in metadata.items():
        # Raw Discord IDs are deliberately kept out of the human-facing audit
        # message. Mentions/names are much more useful and remain clickable.
        if key == "id" or key.endswith("_id") or key in {"guild_id", "channel_id", "actor_id", "target_id"}:
            continue
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
        lines.append(f"*_{label}_*: {text}")
    return "\n".join(lines)


class ActivityService:
    def __init__(self, repo: Repository, logs: LogService) -> None:
        self.repo = repo
        self.logs = logs

    async def _audit_actor(
        self, guild: discord.Guild, category: str, target_id: Optional[int]
    ) -> Optional[discord.abc.User]:
        if target_id is None or not guild.me or not guild.me.guild_permissions.view_audit_log:
            return None
        action = {
            "member_roles": discord.AuditLogAction.member_role_update,
            "member_nickname": discord.AuditLogAction.member_update,
        }.get(category)
        if action is None:
            return None
        try:
            async for entry in guild.audit_logs(limit=12, action=action):
                if getattr(entry.target, "id", None) == target_id:
                    return entry.user
        except (discord.Forbidden, discord.HTTPException, discord.ClientException):
            return None
        return None

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
        if guild is None:
            return
        try:
            await self.repo.log_activity({
                "guild_id": str(guild.id), "category": category,
                "actor_id": str(actor.id) if actor else None, "actor_name": _name(actor),
                "target_id": str(target.id) if target else None, "target_name": _name(target),
                "channel_id": str(channel.id) if channel is not None else None,
                "channel_name": getattr(channel, "name", None), "summary": summary[:500],
                "metadata": metadata or {},
            })
        except Exception as exc:
            log.warning("Activity log write failed (%s): %s", category, exc)

        setting = CATEGORY_TO_SETTING.get(category)
        if not setting:
            return

        if embed is None and category == "member_roles" and target is not None:
            added = [str(item) for item in (metadata or {}).get("added", [])]
            removed = [str(item) for item in (metadata or {}).get("removed", [])]
            changes: list[str] = []
            if added:
                changes.append(f"Added: {', '.join(added)}")
            if removed:
                changes.append(f"Removed: {', '.join(removed)}")
            embed = embeds.info("Roles updated", "\n".join(changes) or "No role details available.")

        if embed is None:
            return

        try:
            # For member changes, audit_actor is resolved against the target,
            # not the moderator/member supplied as the visible actor.
            audit_actor = await self._audit_actor(
                guild, category, getattr(target, "id", None)
            ) if category in {"member_roles", "member_nickname"} else None

            audit = embed.copy()
            if audit.title:
                clean = audit.title.replace("*_", "").replace("_*", "").strip()
                audit.title = f"*_{clean}_*"
            if audit.description:
                description = audit.description.strip()
                if not (description.startswith("_") and description.endswith("_")):
                    audit.description = f"_{description.strip('_')}_"

            if category in {"member_roles", "member_nickname"}:
                member = target or actor
                if member is not None:
                    audit.add_field(name="*_Member_*", value=member.mention, inline=True)
                action_by = audit_actor or (actor if actor is not target else None)
                audit.add_field(name="*_Action by_*", value=action_by.mention if action_by is not None else "Audit actor unavailable", inline=True)
            elif actor is not None:
                audit.add_field(name="*_Action by_*", value=actor.mention if hasattr(actor, "mention") else str(actor), inline=True)

            if channel is not None:
                audit.add_field(name="*_Channel_*", value=getattr(channel, "mention", f"#{getattr(channel, 'name', 'unknown')}"), inline=True)

            if target is not None and category not in {"member_roles", "member_nickname"}:
                audit.add_field(name="*_Member_*", value=target.mention if hasattr(target, "mention") else str(target), inline=True)

            details = _metadata_lines(metadata)
            if details:
                audit.add_field(name="*_Details_*", value=details[:1024], inline=False)
            audit.add_field(name="*_Summary_*", value=f"_{summary[:900]}_", inline=False)
            audit.set_footer(text="!HOY BOT  •  Detailed Audit Log")
            await self.logs.send(guild, setting, audit)
        except Exception as exc:
            log.warning("Could not enrich audit embed for %s: %s", category, exc)
