"""Server lifecycle and structural change logging."""

from __future__ import annotations

import discord
from discord.ext import commands

from ..utils import embeds
from ..utils.logger import get_logger

log = get_logger("guilds")


class GuildEvents(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @commands.Cog.listener()
    async def on_guild_join(self, guild: discord.Guild) -> None:
        log.info("Joined guild %s (%s)", guild.name, guild.id)
        await self.bot.repo.upsert_server(  # type: ignore[attr-defined]
            str(guild.id),
            guild.name,
            guild.icon.key if guild.icon else None,
            str(guild.owner_id) if guild.owner_id else None,
            guild.member_count or 0,
        )
        self.bot.tree.copy_global_to(guild=guild)
        await self.bot.tree.sync(guild=guild)

    @commands.Cog.listener()
    async def on_guild_remove(self, guild: discord.Guild) -> None:
        log.info("Removed from guild %s (%s)", guild.name, guild.id)
        await self.bot.repo.mark_server_left(str(guild.id))  # type: ignore[attr-defined]

    @commands.Cog.listener()
    async def on_guild_update(self, before: discord.Guild, after: discord.Guild) -> None:
        if before.name != after.name:
            await self.bot.repo.upsert_server(  # type: ignore[attr-defined]
                str(after.id),
                after.name,
                after.icon.key if after.icon else None,
                str(after.owner_id) if after.owner_id else None,
                after.member_count or 0,
            )
        await self.bot.logs.send(  # type: ignore[attr-defined]
            after,
            "server_changes",
            embeds.info("Server updated", f"**{before.name}** → **{after.name}**"),
        )

    @commands.Cog.listener()
    async def on_guild_channel_create(self, channel: discord.abc.GuildChannel) -> None:
        await self.bot.logs.send(  # type: ignore[attr-defined]
            channel.guild,
            "channel_changes",
            embeds.info("Channel created", f"**{channel.name}** (`{channel.id}`)"),
        )

    @commands.Cog.listener()
    async def on_guild_channel_delete(self, channel: discord.abc.GuildChannel) -> None:
        await self.bot.logs.send(  # type: ignore[attr-defined]
            channel.guild,
            "channel_changes",
            embeds.info("Channel deleted", f"**{channel.name}** (`{channel.id}`)"),
        )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(GuildEvents(bot))
