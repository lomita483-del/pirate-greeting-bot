"""AutoMod: spam, mentions, invites, blocked words, duplicates."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from datetime import timedelta
from typing import Deque, Optional

import discord

from ..utils import embeds
from ..utils.parsing import INVITE_RE
from .moderation_service import ModerationService
from .settings_service import SettingsService


class AutoModService:
    def __init__(
        self,
        settings: SettingsService,
        moderation: ModerationService,
    ) -> None:
        self.settings = settings
        self.moderation = moderation
        self._recent: dict[tuple[int, int], Deque[tuple[float, str]]] = defaultdict(
            lambda: deque(maxlen=30)
        )

    async def inspect(self, message: discord.Message) -> Optional[str]:
        """Return the triggered rule name after handling it, else None."""
        guild = message.guild
        if guild is None or message.author.bot:
            return None
        if isinstance(message.author, discord.Member) and (
            message.author.guild_permissions.manage_messages
        ):
            return None

        config = await self.settings.get(str(guild.id), "automod_settings")
        if not config or not config.get("enabled"):
            return None

        author = message.author
        if isinstance(author, discord.Member):
            ignored_roles = set(config.get("ignored_role_ids") or [])
            if ignored_roles.intersection({str(r.id) for r in author.roles}):
                return None
        if str(message.channel.id) in set(config.get("ignored_channel_ids") or []):
            return None

        key = (guild.id, author.id)
        history = self._recent[key]
        now = time.monotonic()
        content = (message.content or "").strip().lower()

        rule: Optional[str] = None
        action = "delete"

        if config.get("mention_limit_enabled") and len(message.mentions) >= int(
            config.get("mention_limit", 5)
        ):
            rule, action = "excessive mentions", config.get("mention_action", "delete")
        elif config.get("invite_filter_enabled") and INVITE_RE.search(message.content or ""):
            rule, action = "invite link", config.get("invite_action", "delete")
        elif config.get("word_filter_enabled") and any(
            word and word.lower() in content for word in (config.get("blocked_words") or [])
        ):
            rule, action = "blocked word", config.get("word_action", "delete")
        elif config.get("duplicate_filter_enabled") and content and sum(
            1 for ts, text in history if text == content and now - ts < 30
        ) >= 2:
            rule, action = "duplicate messages", config.get("duplicate_action", "delete")
        elif config.get("anti_spam_enabled"):
            window = int(config.get("anti_spam_seconds", 5))
            limit = int(config.get("anti_spam_messages", 5))
            recent = [ts for ts, _ in history if now - ts <= window]
            if len(recent) + 1 >= limit:
                rule, action = "message spam", config.get("anti_spam_action", "delete")

        history.append((now, content))
        if rule is None:
            return None

        await self._enforce(message, rule, action, int(config.get("timeout_seconds", 300)))
        return rule

    async def _enforce(
        self, message: discord.Message, rule: str, action: str, timeout_seconds: int
    ) -> None:
        guild = message.guild
        assert guild is not None
        try:
            if message.channel.permissions_for(guild.me).manage_messages:
                await message.delete()
        except discord.HTTPException:
            pass

        note = f"AutoMod · {rule}"
        if action == "timeout" and isinstance(message.author, discord.Member):
            try:
                await message.author.timeout(
                    timedelta(seconds=timeout_seconds), reason=note
                )
            except discord.HTTPException:
                pass

        await self.moderation.record(
            guild,
            "automod",
            target=message.author,
            reason=note,
            metadata={"rule": rule, "action": action, "channel_id": str(message.channel.id)},
        )

        try:
            await message.channel.send(
                embed=embeds.warning(
                    "AutoMod",
                    f"{message.author.mention}, that message was removed — **{rule}**.",
                ),
                delete_after=8,
            )
        except discord.HTTPException:
            pass
