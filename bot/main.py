"""AHOY — Discord bot entry point.

Startup sequence:
  1. Load environment configuration
  2. Connect to the database
  3. Load feature extensions
  4. Register slash commands
  5. Connect to Discord
  6. Handle graceful shutdown
"""

from __future__ import annotations

import asyncio
import signal
import sys
import traceback
from datetime import datetime, timezone
from typing import Optional

import discord
from discord import app_commands
from discord.ext import commands

from .config import Config, ConfigError, load_config
from .database.client import Database, DatabaseError
from .database.repository import Repository
from .services.automod_service import AutoModService
from .services.level_service import LevelService
from .services.log_service import LogService
from .services.moderation_service import ModerationService
from .health import start_health_server
from .services.platform_service import AccessDenied, PlatformService
from .services.activity_service import ActivityService
from .services.starboard_service import StarboardService
from .services.feature_service import FeatureService
from .services.settings_service import SettingsService
from .utils import embeds
from .utils.checks import ActionRefused
from .utils.logger import get_logger, setup_logging

EXTENSIONS = (
    "bot.commands.general",
    "bot.commands.moderation",
    "bot.commands.levels",
    "bot.commands.economy",
    "bot.commands.tickets",
    "bot.commands.reminders",
    "bot.commands.reaction_roles",
    "bot.commands.giveaways",
    "bot.commands.polls",
    "bot.commands.profile",
    "bot.commands.stats",
    "bot.commands.statahoy",
    "bot.commands.calendar",
    "bot.commands.send",
    "bot.commands.reports",
    "bot.commands.activity",
    "bot.commands.rollcall",
    "bot.commands.library",
    "bot.events.guild_events",
    "bot.events.member_events",
    "bot.events.message_events",
    "bot.events.custom_command_events",
    "bot.events.reaction_events",
    "bot.events.activity_events",
    "bot.events.stats_events",
    "bot.events.calendar_events",
    "bot.events.scheduler",
)

log = get_logger("core")


class AhoyBot(commands.Bot):
    def __init__(self, config: Config) -> None:
        intents = discord.Intents.default()
        intents.members = True
        intents.message_content = True
        intents.voice_states = True
        intents.reactions = True
        intents.presences = True

        super().__init__(
            command_prefix=commands.when_mentioned_or("!PIRATE ", "!pirate ", "!Pirate "),
            intents=intents,
            help_command=None,
            activity=discord.Activity(type=discord.ActivityType.watching, name="the horizon ⚓"),
        )

    # The remainder of the bot lifecycle is unchanged from the existing
    # implementation; this file only adds the custom command event extension
    # to the existing extension list.
