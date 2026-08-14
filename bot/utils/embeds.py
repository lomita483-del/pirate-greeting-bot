"""AHOY embed helpers - one consistent, premium visual identity."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

import discord

BRAND = "AHOY"
TEAL = 0x1FB6A6
GOLD = 0xE0B15C
RED = 0xE05252
SLATE = 0x1B2733


def _base(title: str, description: str, color: int) -> discord.Embed:
    embed = discord.Embed(
        title=title,
        description=description,
        color=color,
        timestamp=datetime.now(timezone.utc),
    )
    embed.set_footer(text=f"{BRAND} ⚓")
    return embed


def brand(title: str, description: str = "", color: int = TEAL) -> discord.Embed:
    return _base(title, description, color)


def success(title: str, description: str = "") -> discord.Embed:
    return _base(f"✅ {title}", description, TEAL)


def warning(title: str, description: str = "") -> discord.Embed:
    return _base(f"⚠️ {title}", description, GOLD)


def error(title: str, description: str = "") -> discord.Embed:
    return _base(f"🚫 {title}", description, RED)


def info(title: str, description: str = "") -> discord.Embed:
    return _base(title, description, SLATE)


def with_user(embed: discord.Embed, user: Optional[discord.abc.User]) -> discord.Embed:
    if user is not None:
        embed.set_author(name=str(user), icon_url=user.display_avatar.url)
    return embed
