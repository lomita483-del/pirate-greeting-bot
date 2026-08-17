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

    # -- calendar events / RSVPs ---------------------------------------
    async def calendar_event(self, event_id: str) -> Optional[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("calendar_events")
            .select("*")
            .eq("id", event_id)
            .limit(1)
            .execute()
        )
        data = getattr(rows, "data", None) or []
        return data[0] if data else None

    async def set_event_rsvp(self, event_id: str, guild_id: str, user_id: str, response: str) -> None:
        payload = {
            "event_id": event_id,
            "guild_id": guild_id,
            "user_id": user_id,
            "response": response,
            "updated_at": _now(),
        }
        await self.db.try_run(
            lambda c: c.table("event_rsvps")
            .upsert(payload, on_conflict="event_id,user_id")
            .execute()
        )

    async def event_rsvp_counts(self, event_id: str) -> dict[str, int]:
        rows = await self.db.try_run(
            lambda c: c.table("event_rsvps")
            .select("response")
            .eq("event_id", event_id)
            .limit(1000)
            .execute()
        )
        data = getattr(rows, "data", None) or []
        counts = {"attending": 0, "declined": 0, "maybe": 0}
        for row in data:
            key = str(row.get("response") or "attending")
            counts[key] = counts.get(key, 0) + 1
        return counts

    async def calendar_sources(self, guild_id: str) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("calendar_sources")
            .select("*")
            .eq("guild_id", guild_id)
            .limit(50)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def upcoming_events(self, guild_id: str, limit: int = 10) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("calendar_events")
            .select("*")
            .eq("guild_id", guild_id)
            .eq("status", "confirmed")
            .gte("start_time", _now())
            .order("start_time")
            .limit(limit)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def events_between(
        self, guild_id: str, start_iso: str, end_iso: str, limit: int = 25
    ) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("calendar_events")
            .select("*")
            .eq("guild_id", guild_id)
            .eq("status", "confirmed")
            .gte("start_time", start_iso)
            .lte("start_time", end_iso)
            .order("start_time")
            .limit(limit)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def event_notifiers(self, guild_id: str) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("event_notifiers")
            .select("*")
            .eq("guild_id", guild_id)
            .limit(50)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def calendar_filters(self, guild_id: str) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("calendar_filters")
            .select("*")
            .eq("guild_id", guild_id)
            .order("priority", desc=True)
            .limit(50)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def calendar_job_log(self, guild_id: str, limit: int = 10) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("calendar_job_log")
            .select("*")
            .eq("guild_id", guild_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def pending_reminder_count(self, guild_id: str) -> int:
        rows = await self.db.try_run(
            lambda c: c.table("event_reminders")
            .select("id")
            .eq("guild_id", guild_id)
            .eq("status", "pending")
            .limit(1000)
            .execute()
        )
        return len(getattr(rows, "data", None) or [])

    async def queue_calendar_sync(self, guild_id: str, requested_by: str) -> None:
        await self.db.try_run(
            lambda c: c.table("bot_action_queue")
            .insert(
                {
                    "guild_id": guild_id,
                    "action": "calendar_sync",
                    "payload": {},
                    "requested_by": requested_by,
                    "status": "pending",
                }
            )
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

    # -- moderation cases -------------------------------------------------
    async def next_case_number(self, guild_id: str) -> int:
        result = await self.db.try_run(
            lambda c: c.rpc("next_case_number", {"_guild_id": guild_id}).execute()
        )
        value = getattr(result, "data", None)
        if isinstance(value, list):
            value = value[0] if value else None
        try:
            return int(value)
        except (TypeError, ValueError):
            return 1

    async def create_case(self, payload: dict[str, Any]) -> dict[str, Any]:
        payload = dict(payload)
        payload.setdefault("case_number", await self.next_case_number(payload["guild_id"]))
        result = await self.db.try_run(
            lambda c: c.table("moderation_cases").insert(payload).execute()
        )
        rows = getattr(result, "data", None) or [{}]
        return rows[0]

    async def close_active_cases(self, guild_id: str, user_id: str, actions: list[str]) -> None:
        await self.db.try_run(
            lambda c: c.table("moderation_cases")
            .update({"active": False})
            .eq("guild_id", guild_id)
            .eq("target_id", user_id)
            .eq("active", True)
            .in_("action", actions)
            .execute()
        )

    async def expired_cases(self) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("moderation_cases")
            .select("*")
            .eq("active", True)
            .not_.is_("expires_at", "null")
            .lte("expires_at", _now())
            .limit(50)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def update_case(self, case_id: str, payload: dict[str, Any]) -> None:
        await self.db.try_run(
            lambda c: c.table("moderation_cases").update(payload).eq("id", case_id).execute()
        )

    # -- activity log -----------------------------------------------------
    async def log_activity(self, payload: dict[str, Any]) -> None:
        await self.db.try_run(
            lambda c: c.table("activity_logs").insert(payload).execute()
        )

    # -- dashboard action queue -------------------------------------------
    async def pending_bot_actions(self, limit: int = 20) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("bot_action_queue")
            .select("*")
            .eq("status", "pending")
            .order("created_at")
            .limit(limit)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def finish_bot_action(
        self, action_id: str, status: str, error: Optional[str] = None
    ) -> None:
        await self.db.try_run(
            lambda c: c.table("bot_action_queue")
            .update({"status": status, "error": error, "processed_at": _now()})
            .eq("id", action_id)
            .execute()
        )

    # -- voice stats --------------------------------------------------------
    async def get_voice_stats(self, guild_id: str, user_id: str) -> dict[str, Any]:
        rows = await self.db.try_run(
            lambda c: c.table("voice_stats")
            .select("*")
            .eq("guild_id", guild_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        data = getattr(rows, "data", None) or []
        return data[0] if data else {}

    async def voice_leaderboard(self, guild_id: str, limit: int = 10) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("voice_stats")
            .select("*")
            .eq("guild_id", guild_id)
            .order("voice_seconds", desc=True)
            .limit(limit)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def save_voice_stats(self, payload: dict[str, Any]) -> None:
        await self.db.try_run(
            lambda c: c.table("voice_stats")
            .upsert(payload, on_conflict="guild_id,user_id")
            .execute()
        )

    # -- command library ----------------------------------------------------
    async def command_settings(self, guild_id: str) -> dict[str, bool]:
        rows = await self.db.try_run(
            lambda c: c.table("guild_command_settings")
            .select("command, enabled")
            .eq("guild_id", guild_id)
            .execute()
        )
        return {r["command"]: bool(r["enabled"]) for r in (getattr(rows, "data", None) or [])}

    async def command_config(self, guild_id: str, command: str) -> dict[str, Any]:
        """Full per-command configuration row (empty dict when never configured)."""
        rows = await self.db.try_run(
            lambda c: c.table("guild_command_settings")
            .select("*")
            .eq("guild_id", guild_id)
            .eq("command", command)
            .limit(1)
            .execute()
        )
        data = getattr(rows, "data", None) or []
        return dict(data[0]) if data else {}

    async def command_cooldown_at(self, guild_id: str, command: str, user_id: str):
        rows = await self.db.try_run(
            lambda c: c.table("command_cooldowns")
            .select("last_used_at")
            .eq("guild_id", guild_id)
            .eq("command", command)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        data = getattr(rows, "data", None) or []
        return data[0]["last_used_at"] if data else None

    async def touch_command_cooldown(self, guild_id: str, command: str, user_id: str) -> None:
        await self.db.try_run(
            lambda c: c.table("command_cooldowns")
            .upsert(
                {
                    "guild_id": guild_id,
                    "command": command,
                    "user_id": user_id,
                    "last_used_at": _now(),
                },
                on_conflict="guild_id,command,user_id",
            )
            .execute()
        )

    async def command_enabled(self, guild_id: str, command: str) -> bool:
        config = await self.command_config(guild_id, command)
        return bool(config.get("enabled", True)) if config else True


    async def set_command_enabled(self, guild_id: str, command: str, enabled: bool) -> None:
        await self.db.try_run(
            lambda c: c.table("guild_command_settings")
            .upsert(
                {
                    "guild_id": guild_id,
                    "command": command,
                    "enabled": enabled,
                    "updated_at": _now(),
                },
                on_conflict="guild_id,command",
            )
            .execute()
        )

    async def get_feature_state(self, guild_id: str, key: str) -> dict[str, Any]:
        rows = await self.db.try_run(
            lambda c: c.table("guild_feature_state")
            .select("value")
            .eq("guild_id", guild_id)
            .eq("key", key)
            .limit(1)
            .execute()
        )
        data = getattr(rows, "data", None) or []
        return dict(data[0].get("value") or {}) if data else {}

    async def set_feature_state(self, guild_id: str, key: str, value: dict[str, Any]) -> None:
        await self.db.try_run(
            lambda c: c.table("guild_feature_state")
            .upsert(
                {"guild_id": guild_id, "key": key, "value": value, "updated_at": _now()},
                on_conflict="guild_id,key",
            )
            .execute()
        )

    async def add_command_record(self, payload: dict[str, Any]) -> dict[str, Any]:
        rows = await self.db.try_run(
            lambda c: c.table("command_records").insert(payload).execute()
        )
        data = getattr(rows, "data", None) or []
        return data[0] if data else {}

    async def list_command_records(
        self, guild_id: str, namespace: str, limit: int = 10
    ) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("command_records")
            .select("*")
            .eq("guild_id", guild_id)
            .eq("namespace", namespace)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return getattr(rows, "data", None) or []

    async def edit_command_record(self, guild_id: str, namespace: str, label: str) -> bool:
        latest = await self.list_command_records(guild_id, namespace, limit=1)
        if not latest:
            return False
        await self.db.try_run(
            lambda c: c.table("command_records")
            .update({"label": label[:200]})
            .eq("id", latest[0]["id"])
            .execute()
        )
        return True

    async def delete_command_records(
        self, guild_id: str, namespace: str, label: Optional[str] = None
    ) -> int:
        existing = await self.list_command_records(guild_id, namespace, limit=100)
        targets = [
            r for r in existing if not label or (r.get("label") or "").lower() == label.lower()
        ]
        for row in targets:
            await self.db.try_run(
                lambda c, i=row["id"]: c.table("command_records").delete().eq("id", i).execute()
            )
        return len(targets)

    async def log_command_usage(
        self, guild_id: str, command: str, category: str, user_id: str
    ) -> None:
        await self.db.try_run(
            lambda c: c.table("command_usage")
            .insert(
                {
                    "guild_id": guild_id,
                    "command": command,
                    "category": category,
                    "user_id": user_id,
                }
            )
            .execute()
        )

    async def command_usage_count(self, guild_id: str, command: str) -> int:
        rows = await self.db.try_run(
            lambda c: c.table("command_usage")
            .select("id")
            .eq("guild_id", guild_id)
            .eq("command", command)
            .limit(1000)
            .execute()
        )
        return len(getattr(rows, "data", None) or [])

    async def command_uses_since(
        self, guild_id: str, command: str, user_id: str, since_iso: str
    ) -> int:
        """How many times this member ran this command in the given window."""
        rows = await self.db.try_run(
            lambda c: c.table("command_usage")
            .select("id")
            .eq("guild_id", guild_id)
            .eq("command", command)
            .eq("user_id", user_id)
            .gte("created_at", since_iso)
            .limit(1000)
            .execute()
        )
        return len(getattr(rows, "data", None) or [])

    # -- events + audit trail (always scoped to one guild) ------------------
    async def emit_event(self, payload: dict[str, Any]) -> Optional[str]:
        rows = await self.db.try_run(
            lambda c: c.table("system_events").insert(payload).execute()
        )
        data = getattr(rows, "data", None) or []
        return data[0].get("id") if data else None

    async def write_audit_log(self, payload: dict[str, Any]) -> None:
        await self.db.try_run(lambda c: c.table("audit_logs").insert(payload).execute())

    async def recent_audit_logs(self, guild_id: str, limit: int = 10) -> list[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("audit_logs")
            .select("*")
            .eq("guild_id", guild_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return getattr(rows, "data", None) or []

    # -- embed templates (used by /send and the website embed builder) ----
    async def list_embed_template_names(self, guild_id: str) -> list[str]:
        rows = await self.db.try_run(
            lambda c: c.table("embed_templates")
            .select("name")
            .eq("guild_id", guild_id)
            .order("name")
            .limit(100)
            .execute()
        )
        return [r["name"] for r in (getattr(rows, "data", None) or [])]

    async def get_embed_template(self, guild_id: str, name: str) -> Optional[dict[str, Any]]:
        rows = await self.db.try_run(
            lambda c: c.table("embed_templates")
            .select("*")
            .eq("guild_id", guild_id)
            .ilike("name", name)
            .limit(1)
            .execute()
        )
        data = getattr(rows, "data", None) or []
        return data[0] if data else None

    # -- reports ------------------------------------------------------
    async def create_report(self, payload: dict[str, Any]) -> dict[str, Any]:
        result = await self.db.try_run(
            lambda c: c.table("user_reports").insert(payload).execute()
        )
        rows = getattr(result, "data", None) or [{}]
        return rows[0]

    # -- error log ------------------------------------------------------
    async def log_error(
        self,
        *,
        source: str,
        error_type: str,
        message: str,
        guild_id: Optional[str] = None,
        command: Optional[str] = None,
        traceback_text: Optional[str] = None,
        user_id: Optional[str] = None,
        channel_id: Optional[str] = None,
    ) -> None:
        await self.db.try_run(
            lambda c: c.table("bot_error_logs")
            .insert(
                {
                    "guild_id": guild_id,
                    "source": source,
                    "command": command,
                    "error_type": error_type,
                    "message": message[:2000],
                    "traceback": (traceback_text or "")[:8000] or None,
                    "user_id": user_id,
                    "channel_id": channel_id,
                }
            )
            .execute()
        )


__all__ = ["Repository", "DatabaseError"]
