"""Natural, lightweight replies when a member directly mentions !HOY BOT."""

from __future__ import annotations

import discord
from discord.ext import commands

from ..utils import embeds
from ..utils.logger import get_logger

log = get_logger("mentions")


class MentionEvents(commands.Cog):
    """Respond when !HOY is addressed directly instead of silently ignoring it."""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message) -> None:
        if message.author.bot or not message.guild or not message.content:
            return
        if self.bot.user is None or self.bot.user not in message.mentions:
            return

        # Strip the actual bot mention and answer from the remaining text.
        content = message.content
        for token in (f"<@{self.bot.user.id}>", f"<@!{self.bot.user.id}>"):
            content = content.replace(token, " ")
        request = " ".join(content.split()).strip().lower()

        if any(word in request for word in ("help", "command", "commands", "what can you do")):
            description = (
                f"Ahoy, {message.author.mention}. I'm on deck.\n\n"
                "Try `/help` for the command navigator, `/profile` for your crew profile, "
                "or `/stats` for live bot status. Server managers can use the web control center "
                "for configuration and advanced controls."
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
            description = (
                f"Ahoy, {message.author.mention}. I heard you.\n\n"
                "I can respond to **help**, **status**, and common greetings here. "
                "For commands, try `/help`."
            )

        try:
            await message.channel.send(
                embed=embeds.brand("!HOY · On Deck", description),
                reference=message,
                mention_author=False,
            )
        except discord.HTTPException:
            log.warning("Could not respond to mention in guild %s", message.guild.id, exc_info=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(MentionEvents(bot))
