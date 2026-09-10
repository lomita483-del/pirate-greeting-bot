"""Message edit / delete logging — routed through LogService so it respects
the website's per-event channel overrides, with a "pro bot" style embed
(resolved mentions, Old/New code blocks, Jump to Message link).
"""

from __future__ import annotations

import discord
from discord.ext import commands

from ..utils.logger import get_logger
from ..utils.parsing import clean_text

log = get_logger("messages")

GOLD = 0xE0B15C
RED = 0xE05252


def _jump(message: discord.Message) -> str:
    try:
        return message.jump_url
    except Exception:  # pragma: no cover
        return ""


def _channel_ref(channel: discord.abc.GuildChannel | None) -> str:
    if channel is None:
        return "—"
    mention = getattr(channel, "mention", None)
    return mention or f"#{getattr(channel, 'name', 'unknown')}"


class MessageEvents(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @commands.Cog.listener()
    async def on_message_edit(self, before: discord.Message, after: discord.Message) -> None:
        if after.guild is None or after.author.bot:
            return
        if before.content == after.content:
            return  # embed-only / pin updates etc. — nothing textual changed

        old = clean_text(before.content or "", 1000) or "*(empty)*"
        new = clean_text(after.content or "", 1000) or "*(empty)*"

        embed = discord.Embed(
            title="📝 Message Edited",
            description=(
                f"**Author:** {after.author.mention}\n"
                f"**Channel:** {_channel_ref(after.channel)}\n"
                f"[Jump to Message]({_jump(after)})"
            ),
            color=GOLD,
        )
        embed.add_field(name="Old", value=f"```\n{old}\n```", inline=False)
        embed.add_field(name="New", value=f"```\n{new}\n```", inline=False)
        embed.set_footer(
            text=f"Author ID: {after.author.id} • Message ID: {after.id}",
            icon_url=after.author.display_avatar.url,
        )
        embed.timestamp = discord.utils.utcnow()

        await self.bot.logs.log(after.guild, "message_edit", embed)  # type: ignore[attr-defined]

    @commands.Cog.listener()
    async def on_message_delete(self, message: discord.Message) -> None:
        if message.guild is None or message.author.bot:
            return

        content = clean_text(message.content or "", 1000) or "*(no text content — embed, image or attachment only)*"

        embed = discord.Embed(
            title="🗑️ Message Deleted",
            description=(
                f"**Author:** {message.author.mention}\n"
                f"**Channel:** {_channel_ref(message.channel)}"
            ),
            color=RED,
        )
        embed.add_field(name="Content", value=f"```\n{content}\n```", inline=False)
        if message.attachments:
            names = ", ".join(a.filename for a in message.attachments[:5])
            embed.add_field(name="Attachments", value=names[:1024], inline=False)
        embed.set_footer(
            text=f"Author ID: {message.author.id} • Message ID: {message.id}",
            icon_url=message.author.display_avatar.url,
        )
        embed.timestamp = discord.utils.utcnow()

        await self.bot.logs.log(message.guild, "message_delete", embed)  # type: ignore[attr-defined]

    @commands.Cog.listener()
    async def on_bulk_message_delete(self, messages: list[discord.Message]) -> None:
        if not messages:
            return
        first = messages[0]
        if first.guild is None:
            return

        authors = {m.author for m in messages if not m.author.bot}
        embed = discord.Embed(
            title="🗑️ Bulk Message Delete",
            description=(
                f"**Channel:** {_channel_ref(first.channel)}\n"
                f"**Messages removed:** {len(messages)}\n"
                f"**Authors involved:** {len(authors)}"
            ),
            color=RED,
        )
        embed.timestamp = discord.utils.utcnow()
        embed.set_footer(text="AHOY ⚓")

        await self.bot.logs.log(first.guild, "message_bulk_delete", embed)  # type: ignore[attr-defined]


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(MessageEvents(bot))
