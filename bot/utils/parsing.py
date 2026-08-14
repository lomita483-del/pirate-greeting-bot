"""Input parsing and sanitising helpers."""

from __future__ import annotations

import re
from datetime import timedelta

DURATION_RE = re.compile(r"(?P<value>\d+)\s*(?P<unit>[smhdw])", re.IGNORECASE)
UNITS = {"s": 1, "m": 60, "h": 3600, "d": 86400, "w": 604800}
INVITE_RE = re.compile(r"(discord\.(gg|io|me|li)|discord(app)?\.com/invite)/\S+", re.I)


class DurationError(ValueError):
    """Raised when a duration string cannot be understood."""


def parse_duration(raw: str) -> timedelta:
    """Parse durations like ``30m``, ``2h``, ``1d12h`` into a timedelta."""
    matches = list(DURATION_RE.finditer(raw or ""))
    if not matches:
        raise DurationError(
            "Use a duration like `30m`, `2h`, `1d` or `1w` (s/m/h/d/w)."
        )
    seconds = sum(int(m.group("value")) * UNITS[m.group("unit").lower()] for m in matches)
    if seconds <= 0:
        raise DurationError("Duration must be greater than zero.")
    if seconds > 28 * 86400:
        raise DurationError("Duration cannot be longer than 28 days.")
    return timedelta(seconds=seconds)


def humanize(seconds: int) -> str:
    parts: list[str] = []
    for label, size in (("d", 86400), ("h", 3600), ("m", 60), ("s", 1)):
        if seconds >= size:
            amount, seconds = divmod(seconds, size)
            parts.append(f"{amount}{label}")
    return " ".join(parts) or "0s"


def clean_text(value: str, limit: int = 1000) -> str:
    """Strip mass mentions and clamp length before storing or echoing text."""
    value = (value or "").replace("@everyone", "@\u200beveryone").replace(
        "@here", "@\u200bhere"
    )
    value = re.sub(r"```", "'''", value)
    return value.strip()[:limit]


def render_template(template: str, **values: str) -> str:
    out = template or ""
    for key, value in values.items():
        out = out.replace("{" + key + "}", str(value))
    return out[:2000]
