from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from .client import Database


async def bot_runtime_start(db: Database, instance_id: str) -> Optional[dict]:
    """Start a new persisted runtime session for the live bot process."""
    if not db.connected:
        return None

    now = datetime.now(timezone.utc).isoformat()
    result = await db.try_run(
        lambda c: c.table("bot_runtime")
        .upsert(
            {
                "id": "primary",
                "instance_id": instance_id,
                "started_at": now,
                "heartbeat_at": now,
                "stopped_at": None,
            },
            on_conflict="id",
        )
        .execute(),
        default=None,
    )
    return getattr(result, "data", None) if result is not None else None


async def bot_runtime_heartbeat(db: Database, instance_id: str) -> None:
    """Refresh the heartbeat while this bot process is alive."""
    if not db.connected:
        return

    now = datetime.now(timezone.utc).isoformat()
    await db.try_run(
        lambda c: c.table("bot_runtime")
        .update({"heartbeat_at": now, "stopped_at": None, "instance_id": instance_id})
        .eq("id", "primary")
        .execute(),
        default=None,
    )


async def bot_runtime_stop(db: Database, instance_id: str) -> None:
    """Mark the persisted runtime session offline during graceful shutdown."""
    if not db.connected:
        return

    now = datetime.now(timezone.utc).isoformat()
    await db.try_run(
        lambda c: c.table("bot_runtime")
        .update({"heartbeat_at": now, "stopped_at": now, "instance_id": instance_id})
        .eq("id", "primary")
        .execute(),
        default=None,
    )
