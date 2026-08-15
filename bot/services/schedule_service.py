"""Recurrence maths for scheduled announcements."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

RECURRENCES = ("once", "hourly", "daily", "weekly")


def parse_time_of_day(value: str | None) -> tuple[int, int]:
    try:
        hour, minute = (value or "12:00").split(":")[:2]
        return max(0, min(23, int(hour))), max(0, min(59, int(minute)))
    except (ValueError, AttributeError):
        return 12, 0


def compute_next_run(
    recurrence: str,
    time_of_day: str | None,
    weekday: int | None,
    *,
    after: datetime | None = None,
) -> datetime | None:
    """Next UTC run strictly after ``after`` (defaults to now)."""
    now = after or datetime.now(timezone.utc)
    hour, minute = parse_time_of_day(time_of_day)

    if recurrence == "hourly":
        candidate = now.replace(minute=minute, second=0, microsecond=0)
        return candidate if candidate > now else candidate + timedelta(hours=1)

    if recurrence == "weekly":
        target = 0 if weekday is None else max(0, min(6, int(weekday)))
        candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        delta = (target - candidate.weekday()) % 7
        candidate += timedelta(days=delta)
        return candidate if candidate > now else candidate + timedelta(days=7)

    if recurrence == "once":
        return None

    candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return candidate if candidate > now else candidate + timedelta(days=1)
