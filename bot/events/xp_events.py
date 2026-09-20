"""XP progression for ordinary member messages."""
from __future__ import annotations

import discord
from discord.ext import commands

from ..services.level_service import LevelService, format_xp, rank_for_level
from ..services.card_service import render_level_up_card
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
            config = await self.bot.levels.config(str(message.guild.id))  # type: ignore[attr-defined]
            xp_per_level = config.get("xp_per_level", 200)
            rank_every = int(config.get("rank_every_levels", 2) or 2)
            current, needed = LevelService.progress(xp, level, xp_per_level)
            rank = rank_for_level(level, rank_every)

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
                    f"**{format_xp(current)} / {format_xp(needed)} XP** progress to the next level.\n"
                )

            avatar_bytes = None
            try:
                avatar_bytes = await message.author.display_avatar.read()
            except Exception as exc:
                log.warning("Level-up avatar download failed in %s: %s", message.guild.id, exc)

            card_bytes = render_level_up_card(
                username=message.author.display_name,
                avatar_bytes=avatar_bytes,
                level=new_level,
                rank=rank,
                progress_current=current,
                progress_needed=needed,
                total_xp=xp,
                message=text,
            )
            card_file = discord.File(card_bytes, filename="ahoy-level-up.png")
            card = embeds.brand("", "")
            card.set_image(url="attachment://ahoy-level-up.png")
            await channel.send(file=card_file, embed=card)
        except Exception as exc:
            log.warning("XP processing failed in %s: %s", message.guild.id, exc)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(XPEvents(bot))
