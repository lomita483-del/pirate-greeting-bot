"""Configurable natural replies when a member directly mentions !HOY BOT."""

from __future__ import annotations

import time

import discord
from discord.ext import commands

from ..utils import embeds
from ..utils.logger import get_logger

log = get_logger("mentions")


class MentionEvents(commands.Cog):
    """Respond to direct mentions using the server's General settings."""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self._cooldowns: dict[tuple[str, str], float] = {}

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message) -> None:
        if message.author.bot or not message.guild or not message.content:
            return
        if self.bot.user is None or self.bot.user not in message.mentions:
            return

        try:
            settings = await self.bot.repo.get_settings(str(message.guild.id))  # type: ignore[attr-defined]
        except Exception:
            settings = {}

        if not settings.get("mention_enabled", True):
            return

        cooldown = max(0, int(settings.get("mention_cooldown_seconds", 3) or 0))
        key = (str(message.guild.id), str(message.author.id))
        now = time.monotonic()
        previous = self._cooldowns.get(key)
        if cooldown and previous is not None and now - previous < cooldown:
            return
        self._cooldowns[key] = now

        content = message.content
        for token in (f"<@{self.bot.user.id}>", f"<@!{self.bot.user.id}>"):
            content = content.replace(token, " ")
        request = " ".join(content.split()).strip().lower()

        if any(word in request for word in ("help", "command", "commands", "what can you do")):
            description = (
                f"Ahoy, {message.author.mention}. I'm on deck.\n\n"
                "Try `/help` for the command navigator, `/profile` for your crew profile, "
                "or `/stats` for live bot status. Server managers can configure this mention response "
                "from the web control center."
            )
        elif any(word in request for word in ("ping", "online", "alive", "status")):
            latency = round(self.bot.latency * 1000)
            description = (
                f"Ahoy, {message.author.mention}. **!HOY is online and listening.**\n\n"
                f"Gateway latency: `{latency} ms`\n"
                f"Servers: `{len(self.bot.guilds)}`"
            )
        elif any(word in request for word in ("thank", "thanks", "thx")):
            description = f"You're welcome, {message.author.mention}. The crew is at your service."
        elif any(word in request for word in ("hello", "hi", "hey", "ahoy")) or not request:
            description = (
                f"Ahoy, {message.author.mention}! ⚓\n"
                "!HOY is on deck and ready. Ask for **help**, **status**, or use `/help` to see the command navigator."
            )
        else:
            template = str(settings.get("mention_response") or "Ahoy {user}! I'm on deck and ready.")
            description = template.replace("{user}", message.author.mention).replace("{username}", message.author.display_name).replace("{server}", message.guild.name)

        mode = str(settings.get("mention_response_mode") or "reply")
        try:
            kwargs: dict[str, object] = {
                "embed": embeds.brand("!HOY · On Deck", description),
                "mention_author": False,
            }
            if mode == "reply":
                kwargs["reference"] = message
            await message.channel.send(**kwargs)
        except discord.HTTPException:
            log.warning("Could not respond to mention in guild %s", message.guild.id, exc_info=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(MentionEvents(bot))
