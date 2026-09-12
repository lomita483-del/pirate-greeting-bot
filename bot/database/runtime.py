from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from .client import Database


async def bot_runtime_start(db: Database, instance_id: str) -> Optional[dict]:
    if not db.connected:
        return None
    now = datetime.now(timezone.utc).isoformat()
    result = await db.try_run(
        lambda c: c.table("bot_runtime")
        .upsert(
            {
                "instance_id": instance_id,
                "started_at": now,
                "last_heartbeat_at": now,
                "status": "online",
            },
            on_conflict="instance_id",
        )
        .execute(),
        default=None,
    )
    return getattr(result, "data", None) if result is not None else None


async def bot_runtime_heartbeat(db: Database, instance_id: str) -> None:
    if not db.connected:
        return
    now = datetime.now(timezone.utc).isoformat()
    await db.try_run(
        lambda c: c.table("bot_runtime")
        .update({"last_heartbeat_at": now, "status": "online"})
        .eq("instance_id", instance_id)
        .execute(),
        default=None,
    )


async def bot_runtime_stop(db: Database, instance_id: str) -> None:
    if not db.connected:
        return
    now = datetime.now(timezone.utc).isoformat()
    await db.try_run(
        lambda c: c.table("bot_runtime")
        .update({"last_heartbeat_at": now, "status": "offline"})
        .eq("instance_id", instance_id)
        .execute(),
        default=None,
    )
