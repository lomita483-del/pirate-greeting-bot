"""Starboard: highlight messages the community stars."""

from __future__ import annotations

import discord

from ..utils import embeds
from ..utils.logger import get_logger

log = get_logger("starboard")

DEFAULT_EMOJI = "⭐"


class StarboardService:
    def __init__(self, bot: discord.Client, repo) -> None:  # type: ignore[no-untyped-def]
        self.bot = bot
        self.repo = repo

    async def handle(self, payload: discord.RawReactionActionEvent) -> None:
        if payload.guild_id is None:
            return
        guild = self.bot.get_guild(payload.guild_id)
        if guild is None:
            return

        settings = await self.repo.starboard_settings(str(guild.id))
        if not settings or not settings.get("enabled") or not settings.get("channel_id"):
            return
        emoji = settings.get("emoji") or DEFAULT_EMOJI
        if str(payload.emoji) != emoji:
            return
        if str(payload.channel_id) in (settings.get("ignored_channel_ids") or []):
            return
        if str(payload.channel_id) == str(settings["channel_id"]):
            return

        source = self.bot.get_channel(payload.channel_id)
        board = self.bot.get_channel(int(settings["channel_id"]))
        if not isinstance(source, discord.abc.Messageable) or not isinstance(
            board, discord.TextChannel
        ):
            return

        try:
            message = await source.fetch_message(payload.message_id)
        except discord.HTTPException:
            return

        count = self._count(message, emoji, allow_self=bool(settings.get("allow_self_star")))
        entry = await self.repo.starboard_entry(str(payload.message_id))
        threshold = int(settings.get("threshold") or 3)

        if count < threshold and not entry:
            return

        embed = self._render(message, emoji, count)
        if entry and entry.get("starboard_message_id"):
            await self._update(board, entry, embed, count)
        elif count >= threshold:
            await self._post(board, message, embed, count)

    def _count(self, message: discord.Message, emoji: str, *, allow_self: bool) -> int:
        for reaction in message.reactions:
            if str(reaction.emoji) != emoji:
                continue
            count = reaction.count
            if not allow_self:
                # Best-effort: the author's own star does not count.
                users = getattr(reaction, "_users", None)
                if users is None:
                    return count
            return count
        return 0

    def _render(self, message: discord.Message, emoji: str, count: int) -> discord.Embed:
        embed = embeds.brand(
            f"{emoji} {count} · #{getattr(message.channel, 'name', 'channel')}",
            message.content or "_No text content_",
            color=embeds.GOLD,
        )
        embed.add_field(name="Jump", value=f"[Go to message]({message.jump_url})", inline=False)
        embed = embeds.with_user(embed, message.author)
        attachment = next(
            (a for a in message.attachments if (a.content_type or "").startswith("image/")), None
        )
        if attachment is not None:
            embed.set_image(url=attachment.url)
        return embed

    async def _post(
        self,
        board: discord.TextChannel,
        message: discord.Message,
        embed: discord.Embed,
        count: int,
    ) -> None:
        try:
            posted = await board.send(embed=embed)
        except discord.HTTPException as exc:
            log.warning("Could not post to starboard: %s", exc)
            return
        await self.repo.save_starboard_entry(
            {
                "guild_id": str(message.guild.id) if message.guild else "",
                "source_message_id": str(message.id),
                "source_channel_id": str(message.channel.id),
                "author_id": str(message.author.id),
                "author_name": str(message.author),
                "starboard_message_id": str(posted.id),
                "star_count": count,
            }
        )

    async def _update(
        self,
        board: discord.TextChannel,
        entry: dict,
        embed: discord.Embed,
        count: int,
    ) -> None:
        try:
            existing = await board.fetch_message(int(entry["starboard_message_id"]))
            await existing.edit(embed=embed)
        except discord.HTTPException as exc:
            log.warning("Could not update starboard entry %s: %s", entry.get("id"), exc)
            return
        await self.repo.save_starboard_entry(
            {
                "guild_id": entry["guild_id"],
                "source_message_id": entry["source_message_id"],
                "source_channel_id": entry["source_channel_id"],
                "author_id": entry.get("author_id"),
                "author_name": entry.get("author_name"),
                "starboard_message_id": entry["starboard_message_id"],
                "star_count": count,
            }
        )
