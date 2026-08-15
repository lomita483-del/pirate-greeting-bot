"""Typed data-access helpers. Every table touched by AHOY lives here."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from .client import Database, DatabaseError
from ..utils.logger import get_logger

log = get_logger("repository")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Repository:
    def __init__(self, db: Database) -> None:
        self.db = db

    # -- servers ------------------------------------------------------
    async def upsert_server(
        self,
        guild_id: str,
        name: str,
        icon: Optional[str],
        owner_id: Optional[str],
        member_count: int,
    ) -> None:
        payload = {
            "guild_id": guild_id,
            "name": name,
            "icon": icon,
            "owner_id": owner_id,
            "member_count": member_count,
            "bot_present": True,
        }
        await self.db.try_run(
            lambda c: c.table("servers").upsert(payload, on_conflict="guild_id").execute()
        )
        # Ensure the per-server configuration rows exist.
        for table in (
            "server_settings",
            "welcome_settings",
            "logging_settings",
            "automod_settings",
            "role_settings",
        ):
            await self.db.try_run(
                lambda c, t=table: c.table(t)
                .upsert({"guild_id": guild_id}, on_conflict="guild_id", ignore_duplicates=True)
                .execute()
            )

    async def mark_server_left(self, guild_id: str) -> None:
        await self.db.try_run(
            lambda c: c.table("servers")
            .update({"bot_present": False})
            .eq("guild_id", guild_id)
            .execute()
        )

    # -- settings -----------------------------------------------------
    async def get_settings(self, guild_id: str, table: str = "server_settings") -> dict[str, Any]:
        rows = await self.db.try_run(
            lambda c: c.table(table).select("*").eq("guild_id", guild_id).limit(1).execute()
        )
        data = getattr(rows, "data", None) or []
        return data[0] if data else {}

    # -- members ------------------------------------------------------
    async def upsert_member(self, guild_id: str, member: Any) -> None:
        payload = {
            "guild_id": guild_id,
            "user_id": str(member.id),
            "username": member.name,
            "display_name": member.display_name,
            "avatar": member.display_avatar.url if member.display_avatar else None,
            "is_bot": bool(member.bot),
            "joined_at": member.joined_at.isoformat() if getattr(member, "joined_at", None) else None,
            "left_at": None,
        }
        await self.db.try_run(
            lambda c: c.table("members")
            .upsert(payload, on_conflict="guild_id,user_id")
            .execute()
        )

    async def mark_member_left(self, guild_id: str, user_id: str) -> None:
        await self.db.try_run(
            lambda c: c.table("members")
            .update({"left_at": _now()})
            .eq("guild_id", guild_id)
            .eq("user_id", user_id)
            .execute()
        )

    # -- moderation ---------------------------------------------------
    async def add_warning(
        self,
        guild_id: str,
        user_id: str,
        username: str,
        moderator_id: str,
        moderator_name: str,
        reason: str,
    ) -> dict[str, Any]:
        result = await self.db.run(
            lambda c: c.table("warnings")
            .insert(
                {
                    "guild_id": guild_id,
                    "user_id": user_id,
                    "username": username,
                    "moderator_id": moderator_id,
                    "moderator_name": moderator_name,
                    "reason": reason,
                }
            )
            .execute()
        )
        rows = getattr(result, "data", None) or [{}]
        return rows[0]

    async def list_warnings(self, guild_id: str, user_id: str) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("warnings")
            .select("*")
            .eq("guild_id", guild_id)
            .eq("user_id", user_id)
            .eq("active", True)
            .order("created_at", desc=True)
            .limit(25)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def log_action(
        self,
        guild_id: str,
        action: str,
        *,
        target_id: Optional[str] = None,
        target_name: Optional[str] = None,
        moderator_id: Optional[str] = None,
        moderator_name: Optional[str] = None,
        reason: Optional[str] = None,
        duration_seconds: Optional[int] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        await self.db.try_run(
            lambda c: c.table("moderation_logs")
            .insert(
                {
                    "guild_id": guild_id,
                    "action": action,
                    "target_id": target_id,
                    "target_name": target_name,
                    "moderator_id": moderator_id,
                    "moderator_name": moderator_name,
                    "reason": reason,
                    "duration_seconds": duration_seconds,
                    "metadata": metadata or {},
                }
            )
            .execute()
        )

    async def recent_actions(self, guild_id: str, limit: int = 10) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("moderation_logs")
            .select("*")
            .eq("guild_id", guild_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return getattr(rows, "data", None) or []

    # -- xp -----------------------------------------------------------
    async def get_xp(self, guild_id: str, user_id: str) -> dict[str, Any]:
        rows = await self.db.try_run(
            lambda c: c.table("xp_profiles")
            .select("*")
            .eq("guild_id", guild_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        data = getattr(rows, "data", None) or []
        return data[0] if data else {}

    async def save_xp(self, payload: dict[str, Any]) -> None:
        await self.db.try_run(
            lambda c: c.table("xp_profiles")
            .upsert(payload, on_conflict="guild_id,user_id")
            .execute()
        )

    async def xp_leaderboard(self, guild_id: str, limit: int = 10) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("xp_profiles")
            .select("*")
            .eq("guild_id", guild_id)
            .order("xp", desc=True)
            .limit(limit)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def xp_rank(self, guild_id: str, xp: int) -> int:
        rows = await self.db.try_run(
            lambda c: c.table("xp_profiles")
            .select("user_id")
            .eq("guild_id", guild_id)
            .gt("xp", xp)
            .execute()
        )
        return len(getattr(rows, "data", None) or []) + 1

    # -- economy ------------------------------------------------------
    async def get_wallet(self, guild_id: str, user_id: str) -> dict[str, Any]:
        rows = await self.db.try_run(
            lambda c: c.table("economy_profiles")
            .select("*")
            .eq("guild_id", guild_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        data = getattr(rows, "data", None) or []
        return data[0] if data else {}

    async def save_wallet(self, payload: dict[str, Any]) -> None:
        await self.db.run(
            lambda c: c.table("economy_profiles")
            .upsert(payload, on_conflict="guild_id,user_id")
            .execute()
        )

    async def economy_leaderboard(self, guild_id: str, limit: int = 10) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("economy_profiles")
            .select("*")
            .eq("guild_id", guild_id)
            .order("balance", desc=True)
            .limit(limit)
            .execute()
        )
        return getattr(rows, "data", None) or []

    # -- tickets ------------------------------------------------------
    async def next_ticket_number(self, guild_id: str) -> int:
        rows = await self.db.try_run(
            lambda c: c.table("tickets")
            .select("ticket_number")
            .eq("guild_id", guild_id)
            .order("ticket_number", desc=True)
            .limit(1)
            .execute()
        )
        data = getattr(rows, "data", None) or []
        return (data[0]["ticket_number"] + 1) if data else 1

    async def create_ticket(self, payload: dict[str, Any]) -> dict[str, Any]:
        result = await self.db.run(lambda c: c.table("tickets").insert(payload).execute())
        rows = getattr(result, "data", None) or [{}]
        return rows[0]

    async def get_ticket_by_channel(self, channel_id: str) -> dict[str, Any]:
        rows = await self.db.try_run(
            lambda c: c.table("tickets")
            .select("*")
            .eq("channel_id", channel_id)
            .limit(1)
            .execute()
        )
        data = getattr(rows, "data", None) or []
        return data[0] if data else {}

    async def update_ticket(self, ticket_id: str, payload: dict[str, Any]) -> None:
        await self.db.try_run(
            lambda c: c.table("tickets").update(payload).eq("id", ticket_id).execute()
        )

    async def add_ticket_message(self, ticket_id: str, author: Any, content: str) -> None:
        await self.db.try_run(
            lambda c: c.table("ticket_messages")
            .insert(
                {
                    "ticket_id": ticket_id,
                    "author_id": str(author.id),
                    "author_name": str(author),
                    "content": content[:4000],
                }
            )
            .execute()
        )

    async def ticket_transcript(self, ticket_id: str) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("ticket_messages")
            .select("*")
            .eq("ticket_id", ticket_id)
            .order("sent_at")
            .limit(500)
            .execute()
        )
        return getattr(rows, "data", None) or []

    # -- reminders ----------------------------------------------------
    async def add_reminder(self, payload: dict[str, Any]) -> None:
        await self.db.run(lambda c: c.table("reminders").insert(payload).execute())

    async def due_reminders(self) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("reminders")
            .select("*")
            .eq("delivered", False)
            .lte("remind_at", _now())
            .limit(50)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def mark_reminder_delivered(self, reminder_id: str) -> None:
        await self.db.try_run(
            lambda c: c.table("reminders")
            .update({"delivered": True})
            .eq("id", reminder_id)
            .execute()
        )

    # -- custom commands ----------------------------------------------
    async def custom_commands(self, guild_id: str) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("custom_commands")
            .select("*")
            .eq("guild_id", guild_id)
            .eq("enabled", True)
            .limit(100)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def bump_custom_command(self, command_id: str, uses: int) -> None:
        await self.db.try_run(
            lambda c: c.table("custom_commands")
            .update({"uses": uses + 1})
            .eq("id", command_id)
            .execute()
        )


    # -- reaction roles -----------------------------------------------
    async def add_reaction_role(self, payload: dict[str, Any]) -> None:
        await self.db.run(
            lambda c: c.table("reaction_roles")
            .upsert(payload, on_conflict="message_id,emoji")
            .execute()
        )

    async def reaction_roles_for_message(self, message_id: str) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("reaction_roles")
            .select("*")
            .eq("message_id", message_id)
            .limit(50)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def guild_reaction_roles(self, guild_id: str) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("reaction_roles")
            .select("*")
            .eq("guild_id", guild_id)
            .order("created_at", desc=True)
            .limit(200)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def remove_reaction_role(self, guild_id: str, message_id: str, emoji: str) -> None:
        await self.db.try_run(
            lambda c: c.table("reaction_roles")
            .delete()
            .eq("guild_id", guild_id)
            .eq("message_id", message_id)
            .eq("emoji", emoji)
            .execute()
        )

    # -- giveaways ----------------------------------------------------
    async def create_giveaway(self, payload: dict[str, Any]) -> dict[str, Any]:
        result = await self.db.run(lambda c: c.table("giveaways").insert(payload).execute())
        rows = getattr(result, "data", None) or [{}]
        return rows[0]

    async def update_giveaway(self, giveaway_id: str, payload: dict[str, Any]) -> None:
        await self.db.try_run(
            lambda c: c.table("giveaways").update(payload).eq("id", giveaway_id).execute()
        )

    async def due_giveaways(self) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("giveaways")
            .select("*")
            .eq("status", "running")
            .lte("ends_at", _now())
            .limit(25)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def get_giveaway_by_message(self, message_id: str) -> dict[str, Any]:
        rows = await self.db.try_run(
            lambda c: c.table("giveaways")
            .select("*")
            .eq("message_id", message_id)
            .limit(1)
            .execute()
        )
        data = getattr(rows, "data", None) or []
        return data[0] if data else {}

    async def latest_giveaway(self, guild_id: str) -> dict[str, Any]:
        rows = await self.db.try_run(
            lambda c: c.table("giveaways")
            .select("*")
            .eq("guild_id", guild_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        data = getattr(rows, "data", None) or []
        return data[0] if data else {}


    # -- platform (website owner controls) -----------------------------
    async def platform_user(self, user_id: str) -> Optional[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("platform_users")
            .select("banned, bot_blocked, plan, feature_flags")
            .eq("discord_user_id", user_id)
            .limit(1)
            .execute()
        )
        data = getattr(rows, "data", None) or []
        return data[0] if data else None

    async def pending_notifications(self) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("platform_notifications")
            .select("*")
            .eq("delivery_status", "pending")
            .limit(20)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def mark_notification(
        self, notification_id: str, status: str, error: Optional[str] = None
    ) -> None:
        await self.db.try_run(
            lambda c: c.table("platform_notifications")
            .update(
                {
                    "delivery_status": status,
                    "delivery_error": error,
                    "delivered_at": _now(),
                }
            )
            .eq("id", notification_id)
            .execute()
        )

    # -- polls ----------------------------------------------------------
    async def create_poll(self, payload: dict[str, Any]) -> dict[str, Any]:
        result = await self.db.run(lambda c: c.table("polls").insert(payload).execute())
        rows = getattr(result, "data", None) or [{}]
        return rows[0]

    async def get_poll_by_message(self, message_id: str) -> dict[str, Any]:
        rows = await self.db.try_run(
            lambda c: c.table("polls").select("*").eq("message_id", message_id).limit(1).execute()
        )
        data = getattr(rows, "data", None) or []
        return data[0] if data else {}

    async def latest_poll(self, guild_id: str) -> dict[str, Any]:
        rows = await self.db.try_run(
            lambda c: c.table("polls")
            .select("*")
            .eq("guild_id", guild_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        data = getattr(rows, "data", None) or []
        return data[0] if data else {}

    async def due_polls(self) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("polls")
            .select("*")
            .eq("status", "open")
            .not_.is_("ends_at", "null")
            .lte("ends_at", _now())
            .limit(25)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def update_poll(self, poll_id: str, payload: dict[str, Any]) -> None:
        await self.db.try_run(
            lambda c: c.table("polls").update(payload).eq("id", poll_id).execute()
        )

    # -- starboard ------------------------------------------------------
    async def starboard_settings(self, guild_id: str) -> dict[str, Any]:
        rows = await self.db.try_run(
            lambda c: c.table("starboard_settings")
            .select("*")
            .eq("guild_id", guild_id)
            .limit(1)
            .execute()
        )
        data = getattr(rows, "data", None) or []
        return data[0] if data else {}

    async def starboard_entry(self, source_message_id: str) -> dict[str, Any]:
        rows = await self.db.try_run(
            lambda c: c.table("starboard_entries")
            .select("*")
            .eq("source_message_id", source_message_id)
            .limit(1)
            .execute()
        )
        data = getattr(rows, "data", None) or []
        return data[0] if data else {}

    async def save_starboard_entry(self, payload: dict[str, Any]) -> None:
        await self.db.try_run(
            lambda c: c.table("starboard_entries")
            .upsert(payload, on_conflict="source_message_id")
            .execute()
        )

    # -- scheduled announcements ----------------------------------------
    async def due_announcements(self) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("scheduled_announcements")
            .select("*")
            .eq("enabled", True)
            .lte("next_run_at", _now())
            .limit(25)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def update_announcement(self, announcement_id: str, payload: dict[str, Any]) -> None:
        await self.db.try_run(
            lambda c: c.table("scheduled_announcements")
            .update(payload)
            .eq("id", announcement_id)
            .execute()
        )

    # -- stat channels ----------------------------------------------------
    async def stat_channels(self, guild_id: str) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("stat_channels")
            .select("*")
            .eq("guild_id", guild_id)
            .eq("enabled", True)
            .limit(25)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def mark_stat_channel(self, row_id: str, value: int) -> None:
        await self.db.try_run(
            lambda c: c.table("stat_channels")
            .update({"last_value": value, "last_updated_at": _now()})
            .eq("id", row_id)
            .execute()
        )


__all__ = ["Repository", "DatabaseError"]
