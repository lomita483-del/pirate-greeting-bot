"""!HOY BOT configuration.

All secrets come from environment variables. Nothing is ever hardcoded.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass


class ConfigError(RuntimeError):
    """Raised when required configuration is missing."""


@dataclass(frozen=True)
class Config:
    discord_token: str
    supabase_url: str
    supabase_key: str
    log_level: str = "INFO"
    embed_color: int = 0x1FB6A6
    brand_name: str = "!HOY BOT"
    brand_emoji: str = "⚓"


def load_config() -> Config:
    token = os.getenv("DISCORD_TOKEN", "").strip()
    if not token:
        raise ConfigError("DISCORD_TOKEN is not set. Add it to your environment or .env file.")
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip() or os.getenv("SUPABASE_ANON_KEY", "").strip()
    return Config(discord_token=token, supabase_url=supabase_url, supabase_key=supabase_key, log_level=os.getenv("LOG_LEVEL", "INFO").upper())
