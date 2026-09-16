"""Durable activity logging with compact, professional Discord audit entries."""

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
        if key == "id" or key.endswith("_id") or key in {"guild_id", "channel_id", "actor_id", "target_id", "jump_url"}:
            continue
        if value is None or value == "":
            continue
        label = str(key).replace("_", " ").title()
        if isinstance(value, list):
            text = ", ".join(str(item.get("name") or item.get("value") or "—") if isinstance(item, dict) else str(item) for item in value)
        else:
            text = str(value)
        if len(text) > 500:
            text = text[:497] + "..."
        lines.append(f"{label}: {text}")
    return "\n".join(lines)


def _field(embed: discord.Embed, name: str, value: str, *, inline: bool = True) -> None:
    if value:
        embed.add_field(name=name, value=value[:1024], inline=inline)


class ActivityService:
    def __init__(self, repo: Repository, logs: LogService) -> None:
        self.repo = repo
        self.logs = logs

    async def _audit_actor(self, guild: discord.Guild, category: str, target_id: Optional[int]) -> Optional[discord.abc.User]:
        if target_id is None or not guild.me or not guild.me.guild_permissions.view_audit_log:
            return None
        action = {"member_roles": discord.AuditLogAction.member_role_update, "member_nickname": discord.AuditLogAction.member_update}.get(category)
        if action is None:
            return None
        try:
            async for entry in guild.audit_logs(limit=12, action=action):
                if getattr(entry.target, "id", None) == target_id:
                    return entry.user
        except (discord.Forbidden, discord.HTTPException, discord.ClientException):
            return None
        return None

    async def record(self, guild: Optional[discord.Guild], category: str, summary: str, *, actor: Optional[discord.abc.User] = None, target: Optional[discord.abc.User] = None, channel: Optional[Any] = None, metadata: Optional[dict[str, Any]] = None, embed: Optional[discord.Embed] = None) -> None:
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

        try:
            audit_actor = await self._audit_actor(guild, category, getattr(target, "id", None)) if category in {"member_roles", "member_nickname"} else None
            visible_actor = audit_actor or actor
            audit = embed.copy() if embed is not None else embeds.info("Activity", summary)
            audit.title = (audit.title or "Activity").replace("*_", "").replace("_*", "").strip()

            if category == "member_nickname" and target is not None:
                audit.description = f"{target.mention} changed nickname."
                audit.clear_fields()
                _field(audit, "Member", target.mention)
                _field(audit, "Action by", visible_actor.mention if visible_actor else "Audit actor unavailable")
                _field(audit, "Before", str((metadata or {}).get("before") or target.name))
                _field(audit, "After", str((metadata or {}).get("after") or target.display_name))

            elif category == "member_roles" and target is not None:
                added = [str(x) for x in (metadata or {}).get("added", [])]
                removed = [str(x) for x in (metadata or {}).get("removed", [])]
                audit.description = f"Roles updated for {target.mention}."
                audit.clear_fields()
                _field(audit, "Member", target.mention)
                _field(audit, "Action by", visible_actor.mention if visible_actor else "Audit actor unavailable")
                _field(audit, "Added", ", ".join(added) if added else "None")
                _field(audit, "Removed", ", ".join(removed) if removed else "None")
                reason = (metadata or {}).get("reason")
                if reason and reason != "No reason recorded":
                    _field(audit, "Reason", str(reason), inline=False)

            elif category == "message_delete":
                audit.clear_fields()
                audit.description = f"{target.mention if target else 'A member'}'s message was deleted in {getattr(channel, 'mention', '#unknown')}."
                _field(audit, "Message sent by", target.mention if target else "Unknown")
                _field(audit, "Deleted by", visible_actor.mention if visible_actor else "Audit actor unavailable")
                content = str((metadata or {}).get("content") or "(no text content)").replace("```", "'''")[:900]
                _field(audit, "Content", f"```{content}```", inline=False)
                attachments = int((metadata or {}).get("attachments") or 0)
                if attachments:
                    _field(audit, "Attachments", str(attachments))
                reason = (metadata or {}).get("reason")
                if reason and reason != "No reason recorded":
                    _field(audit, "Reason", str(reason))

            elif category == "message_edit":
                audit.clear_fields()
                audit.description = f"Message sent by {target.mention if target else 'a member'} was edited in {getattr(channel, 'mention', '#unknown')}."
                jump_url = (metadata or {}).get("jump_url")
                if jump_url:
                    audit.description += f" [Jump to Message]({jump_url})"
                old = str((metadata or {}).get("before") or "(no text content)").replace("```", "'''")[:900]
                new = str((metadata or {}).get("after") or "(no text content)").replace("```", "'''")[:900]
                _field(audit, "Before", f"```{old}```", inline=False)
                _field(audit, "After", f"```{new}```", inline=False)

            elif category == "moderation" and target is not None:
                audit.clear_fields()
                action_text = audit.title.lower().replace("member ", "")
                audit.description = f"{target.mention} was {action_text} from the server."
                _field(audit, "Member", target.mention)
                _field(audit, "Action by", visible_actor.mention if visible_actor else "Unknown")
                _field(audit, "Reason", str((metadata or {}).get("reason") or "No reason recorded"))

            else:
                audit.description = audit.description or summary
                existing_names = {f.name.lower().replace("*", "") for f in audit.fields}
                if visible_actor is not None and "action by" not in existing_names:
                    _field(audit, "Action by", visible_actor.mention)
                if target is not None and "member" not in existing_names:
                    _field(audit, "Member", target.mention)
                if channel is not None and "channel" not in existing_names:
                    _field(audit, "Channel", getattr(channel, "mention", f"#{getattr(channel, 'name', 'unknown')}"))
                details = _metadata_lines(metadata)
                if details:
                    _field(audit, "Details", details, inline=False)

            audit.set_footer(text="!HOY BOT  •  Detailed Audit Log")
            await self.logs.send(guild, setting, audit)
        except Exception as exc:
            log.warning("Could not enrich audit embed for %s: %s", category, exc)
