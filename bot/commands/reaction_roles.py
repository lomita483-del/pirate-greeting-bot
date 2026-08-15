"""Self-assignable roles driven by message reactions."""

from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands

from ..utils import embeds
from ..utils.checks import (
    ActionRefused,
    ensure_assignable_role,
    ensure_bot_permission,
    ensure_guild,
    ensure_permission,
)
from ..utils.logger import get_logger
from ..utils.parsing import clean_text

log = get_logger("reactionroles")


def normalise_emoji(raw: str) -> str:
    """Store custom emoji by id and unicode emoji by character."""
    value = (raw or "").strip()
    if not value:
        raise ActionRefused("Provide an emoji for members to react with.")
    match = discord.PartialEmoji.from_str(value)
    if match.id is not None:
        return str(match.id)
    if len(value) > 32:
        raise ActionRefused("That does not look like a valid emoji.")
    return value


class ReactionRoles(commands.Cog):
    group = app_commands.Group(
        name="reactionrole",
        description="Let members self-assign roles by reacting.",
        guild_only=True,
    )

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @group.command(name="create", description="Post a reaction-role message.")
    @app_commands.describe(
        channel="Where the message should be posted",
        title="Embed title",
        description="Embed body shown above the role list",
    )
    async def create(
        self,
        interaction: discord.Interaction,
        channel: discord.TextChannel,
        title: str = "Choose your roles",
        description: str = "React below to pick up a role. Remove your reaction to drop it.",
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "manage_roles")
        ensure_bot_permission(guild, "manage_roles")

        await interaction.response.defer(ephemeral=True)
        embed = embeds.brand(clean_text(title, 200), clean_text(description, 2000))
        try:
            message = await channel.send(embed=embed)
        except discord.HTTPException as exc:
            raise ActionRefused("I could not post in that channel.") from exc

        await interaction.followup.send(
            embed=embeds.success(
                "Reaction-role message posted",
                f"Message ID `{message.id}` in {channel.mention}.\n"
                f"Add options with `/reactionrole add message_id:{message.id} emoji:… role:…`",
            ),
            ephemeral=True,
        )

    @group.command(name="add", description="Attach an emoji → role option to a message.")
    @app_commands.describe(
        message_id="ID of the reaction-role message",
        emoji="Emoji members react with",
        role="Role handed out for that emoji",
        channel="Channel the message lives in (defaults to this one)",
    )
    async def add(
        self,
        interaction: discord.Interaction,
        message_id: str,
        emoji: str,
        role: discord.Role,
        channel: discord.TextChannel | None = None,
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "manage_roles")
        ensure_bot_permission(guild, "manage_roles")
        ensure_assignable_role(guild, role)

        target_channel = channel or interaction.channel
        if not isinstance(target_channel, discord.TextChannel):
            raise ActionRefused("Pick a text channel that holds the message.")
        if not message_id.isdigit():
            raise ActionRefused("Message IDs are numbers — enable Developer Mode to copy one.")

        await interaction.response.defer(ephemeral=True)
        try:
            message = await target_channel.fetch_message(int(message_id))
        except discord.NotFound as exc:
            raise ActionRefused("I could not find that message in that channel.") from exc
        except discord.Forbidden as exc:
            raise ActionRefused("I cannot read messages in that channel.") from exc

        stored = normalise_emoji(emoji)
        try:
            await message.add_reaction(emoji.strip())
        except discord.HTTPException as exc:
            raise ActionRefused("I could not react with that emoji.") from exc

        await self.bot.repo.add_reaction_role(  # type: ignore[attr-defined]
            {
                "guild_id": str(guild.id),
                "channel_id": str(target_channel.id),
                "message_id": str(message.id),
                "emoji": stored,
                "role_id": str(role.id),
                "created_by": str(interaction.user.id),
            }
        )
        await interaction.followup.send(
            embed=embeds.success(
                "Reaction role saved",
                f"{emoji.strip()} → {role.mention} on message `{message.id}`.",
            ),
            ephemeral=True,
        )

    @group.command(name="remove", description="Remove an emoji → role option.")
    @app_commands.describe(message_id="ID of the reaction-role message", emoji="Emoji to unlink")
    async def remove(
        self, interaction: discord.Interaction, message_id: str, emoji: str
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "manage_roles")
        if not message_id.isdigit():
            raise ActionRefused("Message IDs are numbers — enable Developer Mode to copy one.")

        await interaction.response.defer(ephemeral=True)
        await self.bot.repo.remove_reaction_role(  # type: ignore[attr-defined]
            str(guild.id), message_id, normalise_emoji(emoji)
        )
        await interaction.followup.send(
            embed=embeds.success("Reaction role removed", "Members can no longer claim that role."),
            ephemeral=True,
        )

    @group.command(name="list", description="Show every reaction role in this server.")
    async def list_roles(self, interaction: discord.Interaction) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "manage_roles")
        await interaction.response.defer(ephemeral=True)

        rows = await self.bot.repo.guild_reaction_roles(str(guild.id))  # type: ignore[attr-defined]
        if not rows:
            await interaction.followup.send(
                embed=embeds.info("No reaction roles yet", "Create one with `/reactionrole create`."),
                ephemeral=True,
            )
            return

        lines = []
        for row in rows[:25]:
            emoji = row.get("emoji", "")
            display = f"<:e:{emoji}>" if emoji.isdigit() else emoji
            lines.append(f"{display} → <@&{row['role_id']}> · message `{row['message_id']}`")
        await interaction.followup.send(
            embed=embeds.brand("Reaction roles", "\n".join(lines)), ephemeral=True
        )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(ReactionRoles(bot))
