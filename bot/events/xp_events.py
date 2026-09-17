"""XP progression for ordinary member messages."""

from __future__ import annotations

import discord
from discord.ext import commands

from ..utils.parsing import render_template
from ..utils.logger import get_logger

log = get_logger("xp-events")


class XPEvents(commands.Cog):
    """Award configured XP from real member messages and handle level-ups."""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message) -> None:
        if message.guild is None or message.author.bot:
            return
        if not isinstance(message.author, discord.Member):
            return

        try:
            new_level = await self.bot.levels.award(str(message.guild.id), message.author)  # type: ignore[attr-defined]
            if new_level is None:
                return

            # Apply any configured level reward roles.
            try:
                await self.bot.levels.apply_rewards(message.author, new_level)  # type: ignore[attr-defined]
            except Exception as exc:
                log.warning("Level reward processing failed in %s: %s", message.guild.id, exc)

            # Announce level-ups only when a channel has been configured.
            settings = await self.bot.repo.get_settings(str(message.guild.id))  # type: ignore[attr-defined]
            channel_id = settings.get("level_up_channel_id")
            if not channel_id:
                return
            channel = message.guild.get_channel(int(channel_id))
            if not isinstance(channel, discord.TextChannel):
                return

            template = settings.get("level_up_message") or "Ahoy {user}, you reached level {level}!"
            text = render_template(
                template,
                user=message.author.mention,
                username=message.author.display_name,
                server=message.guild.name,
                level=str(new_level),
            )
            await channel.send(text)
        except Exception as exc:
            # XP must never break normal message processing.
            log.warning("XP processing failed in %s: %s", message.guild.id, exc)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(XPEvents(bot))
