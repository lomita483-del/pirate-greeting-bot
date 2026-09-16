"""Channel lock and unlock moderation commands."""

from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands

from ..utils import embeds
from ..utils.checks import ensure_bot_permission, ensure_guild, ensure_permission
from ..utils.parsing import clean_text


class ChannelLock(commands.Cog):
    """Provide simple, explicit /lock and /unlock commands."""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @property
    def mod(self):
        return self.bot.moderation  # type: ignore[attr-defined]

    @app_commands.command(name="lock", description="Lock a channel so members cannot send messages.")
    @app_commands.describe(
        channel="Channel to lock",
        reason="Reason for locking the channel",
    )
    @app_commands.guild_only()
    async def lock(
        self,
        interaction: discord.Interaction,
        channel: discord.TextChannel,
        reason: str,
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "manage_channels")
        ensure_bot_permission(guild, "manage_channels")
        reason = clean_text(reason, 400) or "No reason provided"

        everyone = guild.default_role
        overwrite = channel.overwrites_for(everyone)
        overwrite.send_messages = False

        await interaction.response.defer(ephemeral=True)
        await channel.set_permissions(
            everyone,
            overwrite=overwrite,
            reason=f"/lock by {interaction.user}: {reason}",
        )
        await self.mod.record(
            guild,
            "channel_lock",
            moderator=interaction.user,
            reason=reason,
            metadata={
                "channel_id": str(channel.id),
                "channel_name": channel.name,
            },
        )
        await interaction.followup.send(
            embed=embeds.success(
                "Channel locked",
                f"{channel.mention} is now read-only.\n**Reason:** {reason}",
            ),
            ephemeral=True,
        )

    @app_commands.command(name="unlock", description="Unlock a channel so members can send messages again.")
    @app_commands.describe(channel="Channel to unlock")
    @app_commands.guild_only()
    async def unlock(
        self,
        interaction: discord.Interaction,
        channel: discord.TextChannel,
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "manage_channels")
        ensure_bot_permission(guild, "manage_channels")

        everyone = guild.default_role
        overwrite = channel.overwrites_for(everyone)
        overwrite.send_messages = None

        await interaction.response.defer(ephemeral=True)
        await channel.set_permissions(
            everyone,
            overwrite=overwrite,
            reason=f"/unlock by {interaction.user}",
        )
        await self.mod.record(
            guild,
            "channel_unlock",
            moderator=interaction.user,
            reason="Channel unlocked",
            metadata={
                "channel_id": str(channel.id),
                "channel_name": channel.name,
            },
        )
        await interaction.followup.send(
            embed=embeds.success(
                "Channel unlocked",
                f"{channel.mention} is open for members again.",
            ),
            ephemeral=True,
        )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(ChannelLock(bot))
