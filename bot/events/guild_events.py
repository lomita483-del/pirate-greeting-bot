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

    # -- lifecycle -----------------------------------------------------
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
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after, "server_name_update", embeds.info("Server name updated", f"**{before.name}** → **{after.name}**")
            )
        if before.icon != after.icon:
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after, "server_icon_update", embeds.info("Server icon updated", after.name)
            )
        if before.owner_id != after.owner_id:
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after,
                "server_owner_update",
                embeds.info("Server owner updated", f"<@{before.owner_id}> → <@{after.owner_id}>"),
            )
        if before.verification_level != after.verification_level:
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after,
                "verification_level_update",
                embeds.info("Verification level updated", f"{before.verification_level} → {after.verification_level}"),
            )
        if before.premium_subscription_count != after.premium_subscription_count:
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after,
                "server_boost_level_update",
                embeds.info("Boost count changed", f"{before.premium_subscription_count} → {after.premium_subscription_count}"),
            )
        await self.bot.logs.send(  # type: ignore[attr-defined]
            after,
            "server_changes",
            embeds.info("Server updated", f"**{before.name}** → **{after.name}**"),
        )

    # -- channels --------------------------------------------------------
    @commands.Cog.listener()
    async def on_guild_channel_create(self, channel: discord.abc.GuildChannel) -> None:
        embed = embeds.info("Channel created", f"**{channel.name}** (`{channel.id}`)")
        await self.bot.logs.send(channel.guild, "channel_changes", embed)  # type: ignore[attr-defined]
        await self.bot.logs.log(channel.guild, "channel_create", embed)  # type: ignore[attr-defined]

    @commands.Cog.listener()
    async def on_guild_channel_delete(self, channel: discord.abc.GuildChannel) -> None:
        embed = embeds.info("Channel deleted", f"**{channel.name}** (`{channel.id}`)")
        await self.bot.logs.send(channel.guild, "channel_changes", embed)  # type: ignore[attr-defined]
        await self.bot.logs.log(channel.guild, "channel_delete", embed)  # type: ignore[attr-defined]

    @commands.Cog.listener()
    async def on_guild_channel_update(
        self, before: discord.abc.GuildChannel, after: discord.abc.GuildChannel
    ) -> None:
        if before.name != after.name:
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after.guild,
                "channel_name_update",
                embeds.info("Channel renamed", f"**{before.name}** → **{after.name}**"),
            )
        before_topic = getattr(before, "topic", None)
        after_topic = getattr(after, "topic", None)
        if before_topic != after_topic:
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after.guild, "channel_topic_update", embeds.info("Channel topic updated", after.mention)
            )
        before_nsfw = getattr(before, "nsfw", None)
        after_nsfw = getattr(after, "nsfw", None)
        if before_nsfw != after_nsfw:
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after.guild, "channel_nsfw_update", embeds.info("Channel NSFW flag updated", f"{after.mention}: {after_nsfw}")
            )
        if getattr(before, "category", None) != getattr(after, "category", None):
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after.guild, "channel_parent_update", embeds.info("Channel category changed", after.mention)
            )
        if getattr(before, "slowmode_delay", None) != getattr(after, "slowmode_delay", None):
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after.guild,
                "channel_slow_mode_update",
                embeds.info("Slowmode updated", f"{after.mention}: {getattr(after, 'slowmode_delay', 0)}s"),
            )

    # -- roles -------------------------------------------------------------
    @commands.Cog.listener()
    async def on_guild_role_create(self, role: discord.Role) -> None:
        await self.bot.logs.log(  # type: ignore[attr-defined]
            role.guild, "role_create", embeds.info("Role created", f"**{role.name}** (`{role.id}`)")
        )

    @commands.Cog.listener()
    async def on_guild_role_delete(self, role: discord.Role) -> None:
        await self.bot.logs.log(  # type: ignore[attr-defined]
            role.guild, "role_delete", embeds.info("Role deleted", f"**{role.name}** (`{role.id}`)")
        )

    @commands.Cog.listener()
    async def on_guild_role_update(self, before: discord.Role, after: discord.Role) -> None:
        if before.name != after.name:
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after.guild, "role_name_update", embeds.info("Role renamed", f"**{before.name}** → **{after.name}**")
            )
        if before.color != after.color:
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after.guild, "role_color_update", embeds.info("Role color updated", after.mention)
            )
        if before.permissions != after.permissions:
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after.guild, "role_permissions_update", embeds.info("Role permissions updated", after.mention)
            )
        if before.hoist != after.hoist:
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after.guild, "role_hoist_update", embeds.info("Role hoist setting updated", after.mention)
            )
        if before.mentionable != after.mentionable:
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after.guild, "role_mentionable_update", embeds.info("Role mentionable setting updated", after.mention)
            )
        if before.position != after.position:
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after.guild, "role_position_update", embeds.info("Role position updated", after.mention)
            )

    # -- emojis & stickers --------------------------------------------------
    @commands.Cog.listener()
    async def on_guild_emojis_update(
        self, guild: discord.Guild, before, after  # noqa: ANN001
    ) -> None:
        before_ids = {e.id for e in before}
        after_ids = {e.id for e in after}
        for emoji in after:
            if emoji.id not in before_ids:
                await self.bot.logs.log(  # type: ignore[attr-defined]
                    guild, "emoji_create", embeds.info("Emoji added", f"**{emoji.name}**")
                )
        for emoji in before:
            if emoji.id not in after_ids:
                await self.bot.logs.log(  # type: ignore[attr-defined]
                    guild, "emoji_delete", embeds.info("Emoji removed", f"**{emoji.name}**")
                )

    @commands.Cog.listener()
    async def on_guild_stickers_update(
        self, guild: discord.Guild, before, after  # noqa: ANN001
    ) -> None:
        before_ids = {s.id for s in before}
        after_ids = {s.id for s in after}
        for sticker in after:
            if sticker.id not in before_ids:
                await self.bot.logs.log(  # type: ignore[attr-defined]
                    guild, "sticker_create", embeds.info("Sticker added", f"**{sticker.name}**")
                )
        for sticker in before:
            if sticker.id not in after_ids:
                await self.bot.logs.log(  # type: ignore[attr-defined]
                    guild, "sticker_delete", embeds.info("Sticker removed", f"**{sticker.name}**")
                )

    # -- invites -------------------------------------------------------------
    @commands.Cog.listener()
    async def on_invite_create(self, invite: discord.Invite) -> None:
        if invite.guild is None:
            return
        await self.bot.logs.log(  # type: ignore[attr-defined]
            invite.guild,  # type: ignore[arg-type]
            "invite_create",
            embeds.info("Invite created", f"`{invite.code}` → {invite.channel.mention if invite.channel else 'unknown'}"),
        )

    @commands.Cog.listener()
    async def on_invite_delete(self, invite: discord.Invite) -> None:
        if invite.guild is None:
            return
        await self.bot.logs.log(  # type: ignore[attr-defined]
            invite.guild, "invite_delete", embeds.info("Invite deleted", f"`{invite.code}`")  # type: ignore[arg-type]
        )

    # -- threads -------------------------------------------------------------
    @commands.Cog.listener()
    async def on_thread_create(self, thread: discord.Thread) -> None:
        await self.bot.logs.log(  # type: ignore[attr-defined]
            thread.guild, "thread_create", embeds.info("Thread created", thread.mention)
        )

    @commands.Cog.listener()
    async def on_thread_delete(self, thread: discord.Thread) -> None:
        await self.bot.logs.log(  # type: ignore[attr-defined]
            thread.guild, "thread_delete", embeds.info("Thread deleted", f"**{thread.name}**")
        )

    @commands.Cog.listener()
    async def on_thread_update(self, before: discord.Thread, after: discord.Thread) -> None:
        if not before.archived and after.archived:
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after.guild, "thread_archive", embeds.info("Thread archived", after.mention)
            )
        elif before.archived and not after.archived:
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after.guild, "thread_unarchive", embeds.info("Thread unarchived", after.mention)
            )
        if before.locked != after.locked:
            key = "thread_lock" if after.locked else "thread_unlock"
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after.guild, key, embeds.info("Thread lock state changed", after.mention)
            )
        if before.name != after.name:
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after.guild, "thread_name_update", embeds.info("Thread renamed", f"**{before.name}** → **{after.name}**")
            )

    # -- webhooks (Discord only tells us "something changed in this channel") -
    @commands.Cog.listener()
    async def on_webhooks_update(self, channel: discord.abc.GuildChannel) -> None:
        await self.bot.logs.log(  # type: ignore[attr-defined]
            channel.guild, "webhook_update", embeds.info("Webhook activity", f"In {channel.mention}")
        )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(GuildEvents(bot))
