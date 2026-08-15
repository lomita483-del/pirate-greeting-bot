"""Message pipeline: AutoMod → XP → ticket transcripts → custom commands."""

from __future__ import annotations

import discord
from discord.ext import commands

from ..utils import embeds
from ..utils.logger import get_logger
from ..utils.parsing import clean_text, render_template

log = get_logger("messages")


class MessageEvents(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message) -> None:
        if message.author.bot or message.guild is None:
            return

        guild_id = str(message.guild.id)

        try:
            if await self.bot.automod.inspect(message):  # type: ignore[attr-defined]
                return
        except Exception as exc:  # AutoMod must never break chat
            log.exception("AutoMod failure in %s: %s", guild_id, exc)

        # XP
        try:
            new_level = await self.bot.levels.award(guild_id, message.author)  # type: ignore[attr-defined]
            if new_level:
                rewards = await self.bot.levels.apply_rewards(message.author, new_level)  # type: ignore[attr-defined]
                await self._announce_level(message, new_level, rewards)
        except Exception as exc:
            log.exception("XP award failed in %s: %s", guild_id, exc)

        # Ticket transcripts
        try:
            ticket = await self.bot.repo.get_ticket_by_channel(str(message.channel.id))  # type: ignore[attr-defined]
            if ticket and ticket.get("status") != "closed":
                settings = await self.bot.settings.get(guild_id)  # type: ignore[attr-defined]
                if settings.get("ticket_transcripts_enabled", True):
                    await self.bot.repo.add_ticket_message(  # type: ignore[attr-defined]
                        ticket["id"], message.author, message.content or ""
                    )
        except Exception as exc:
            log.debug("Transcript capture skipped: %s", exc)

        await self._maybe_custom_command(message, guild_id)

    async def _announce_level(
        self,
        message: discord.Message,
        level: int,
        rewards: list | None = None,
    ) -> None:
        settings = await self.bot.settings.get(str(message.guild.id))  # type: ignore[attr-defined]
        template = settings.get("level_up_message") or "Ahoy {user}, you reached level {level}! ⚓"
        text = render_template(
            template,
            user=message.author.mention,
            username=message.author.name,
            level=str(level),
            server=message.guild.name,  # type: ignore[union-attr]
        )
        channel: discord.abc.Messageable = message.channel
        target_id = settings.get("level_up_channel_id")
        if target_id:
            maybe = message.guild.get_channel(int(target_id))  # type: ignore[union-attr]
            if isinstance(maybe, discord.TextChannel):
                channel = maybe
        if rewards:
            text += "\nUnlocked: " + ", ".join(role.mention for role in rewards)
        try:
            await channel.send(text)
        except discord.HTTPException:
            pass

    async def _maybe_custom_command(self, message: discord.Message, guild_id: str) -> None:
        content = (message.content or "").strip()
        settings = await self.bot.settings.get(guild_id)  # type: ignore[attr-defined]
        prefix = settings.get("prefix") or "!"
        if not content.startswith(prefix):
            return
        name = content[len(prefix) :].split()[0].lower() if content[len(prefix) :] else ""
        if not name:
            return
        try:
            for command in await self.bot.repo.custom_commands(guild_id):  # type: ignore[attr-defined]
                if command.get("name") == name:
                    response = clean_text(command.get("response", ""), 2000)
                    if command.get("is_embed"):
                        color = command.get("embed_color") or "#1FB6A6"
                        try:
                            embed = discord.Embed(
                                title=command.get("embed_title") or name.title(),
                                description=response,
                                color=discord.Color.from_str(color),
                            )
                        except ValueError:
                            embed = embeds.brand(command.get("embed_title") or name.title(), response)
                        await message.channel.send(embed=embed)
                    else:
                        await message.channel.send(response)
                    await self.bot.repo.bump_custom_command(  # type: ignore[attr-defined]
                        command["id"], int(command.get("uses", 0))
                    )
                    return
        except Exception as exc:
            log.exception("Custom command failed in %s: %s", guild_id, exc)

    @commands.Cog.listener()
    async def on_message_delete(self, message: discord.Message) -> None:
        if message.guild is None or message.author.bot:
            return
        await self.bot.logs.send(  # type: ignore[attr-defined]
            message.guild,
            "message_delete",
            embeds.info(
                "Message deleted",
                f"**Author:** {message.author.mention}\n"
                f"**Channel:** {message.channel.mention}\n"
                f"**Content:** {clean_text(message.content or '—', 800)}",
            ),
        )

    @commands.Cog.listener()
    async def on_message_edit(self, before: discord.Message, after: discord.Message) -> None:
        if before.guild is None or before.author.bot or before.content == after.content:
            return
        await self.bot.logs.send(  # type: ignore[attr-defined]
            before.guild,
            "message_edit",
            embeds.info(
                "Message edited",
                f"**Author:** {before.author.mention}\n"
                f"**Channel:** {before.channel.mention}\n"
                f"**Before:** {clean_text(before.content, 400)}\n"
                f"**After:** {clean_text(after.content, 400)}",
            ),
        )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(MessageEvents(bot))
