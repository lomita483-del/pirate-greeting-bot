"""XP progression for ordinary member messages."""
from __future__ import annotations

import discord
from discord.ext import commands

from ..services.level_service import LevelService, format_xp, rank_for_level
from ..utils import embeds
from ..utils.logger import get_logger
from ..utils.parsing import render_template

log = get_logger("xp-events")


class XPEvents(commands.Cog):
    """Award XP from every eligible member message and announce level-ups."""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message) -> None:
        if message.guild is None or message.author.bot or not isinstance(message.author, discord.Member):
            return

        try:
            new_level = await self.bot.levels.award(str(message.guild.id), message.author)  # type: ignore[attr-defined]
            if new_level is None:
                return

            try:
                await self.bot.levels.apply_rewards(message.author, new_level)  # type: ignore[attr-defined]
            except Exception as exc:
                log.warning("Level reward processing failed in %s: %s", message.guild.id, exc)

            settings = await self.bot.repo.get_settings(str(message.guild.id))  # type: ignore[attr-defined]
            channel_id = settings.get("level_up_channel_id")
            if not channel_id or not settings.get("level_up_card_enabled", True):
                return

            channel = message.guild.get_channel(int(channel_id))
            if not isinstance(channel, discord.TextChannel):
                return

            xp_profile = await self.bot.repo.get_xp(str(message.guild.id), str(message.author.id))  # type: ignore[attr-defined]
            xp = xp_profile.get("xp", 0) or 0
            level = int(xp_profile.get("level", new_level) or new_level)
            current, needed = LevelService.progress(xp, level)
            rank = rank_for_level(level)

            template = settings.get("level_up_message") or "Ahoy {user}, you reached level {level}! ⚓"
            text = render_template(
                template,
                user=message.author.mention,
                username=message.author.display_name,
                server=message.guild.name,
                level=str(new_level),
            )

            description = f"{text}\n\n"
            if settings.get("level_up_card_show_progress", True):
                description += (
                    f"{LevelService.bar(current, needed, 24)}\n"
                    f"**{format_xp(current)} / {format_xp(needed)} XP** to the next level.\n"
                )

            card = embeds.brand(f"⚓ LEVEL UP · {new_level}", description, embeds.GOLD)
            card.set_author(name=message.author.display_name, icon_url=message.author.display_avatar.url)
            if settings.get("level_up_card_show_rank", True):
                card.add_field(name="Crew rank", value=f"**#{rank}**", inline=True)
            card.add_field(name="Total XP", value=f"**{format_xp(xp)}**", inline=True)
            card.set_thumbnail(url=message.author.display_avatar.url)
            card.set_footer(text="!HOY BOT · Cinematic Glassmorphism Level Card ⚓")
            await channel.send(embed=card)
        except Exception as exc:
            log.warning("XP processing failed in %s: %s", message.guild.id, exc)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(XPEvents(bot))
