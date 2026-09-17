"""Self-assignable roles with persistent buttons, plus legacy reaction compatibility."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

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
        raise ActionRefused("Provide an emoji for members to use.")
    match = discord.PartialEmoji.from_str(value)
    if match.id is not None:
        return str(match.id)
    if len(value) > 32:
        raise ActionRefused("That does not look like a valid emoji.")
    return value


def display_emoji(value: str) -> str | discord.PartialEmoji:
    if str(value).isdigit():
        return discord.PartialEmoji(name="role", id=int(value))
    return value


class ReactionRoleView(discord.ui.View):
    """Persistent button view used by newly-created reaction-role panels."""

    def __init__(self, bot: commands.Bot, rows: list[dict[str, Any]]) -> None:
        super().__init__(timeout=None)
        self.bot = bot
        for row in rows[:25]:
            role_id = str(row.get("role_id") or "")
            if not role_id.isdigit():
                continue
            emoji = str(row.get("emoji") or "")
            label = str(row.get("description") or "Role")[:80]
            item = discord.ui.Button(
                label=label,
                emoji=display_emoji(emoji),
                style=discord.ButtonStyle.secondary,
                custom_id=f"hoy:role:{row.get('message_id')}:{role_id}",
            )
            item.callback = self._make_callback(role_id)
            self.add_item(item)

    def _make_callback(self, role_id: str):
        async def callback(interaction: discord.Interaction) -> None:
            guild = interaction.guild
            if guild is None or not isinstance(interaction.user, discord.Member):
                await interaction.response.send_message("This role picker only works inside a server.", ephemeral=True)
                return
            role = guild.get_role(int(role_id))
            if role is None:
                await interaction.response.send_message("That role no longer exists.", ephemeral=True)
                return
            try:
                ensure_bot_permission(guild, "manage_roles")
                ensure_assignable_role(guild, role)
                member = interaction.user
                if role in member.roles:
                    await member.remove_roles(role, reason="! HOY role picker")
                    action = "removed"
                    detail = f"Removed {role.mention} from {member.mention}."
                else:
                    await member.add_roles(role, reason="! HOY role picker")
                    action = "added"
                    detail = f"Added {role.mention} to {member.mention}."
                try:
                    await self.bot.repo.log_activity({
                        "guild_id": str(guild.id),
                        "kind": "reaction_role_toggle",
                        "summary": f"{member} {action} role {role.name}",
                        "metadata": {"user_id": str(member.id), "role_id": str(role.id), "action": action},
                    })
                except Exception:
                    log.warning("Could not record role toggle", exc_info=True)
                await interaction.response.send_message(embed=embeds.success("Role updated", detail), ephemeral=True)
            except (ActionRefused, discord.Forbidden) as exc:
                await interaction.response.send_message(
                    embed=embeds.error("Role could not be updated", str(exc) or "Discord rejected the role change."),
                    ephemeral=True,
                )
            except discord.HTTPException:
                await interaction.response.send_message(
                    embed=embeds.error("Discord error", "Discord rejected that role change. Check the bot's role position."),
                    ephemeral=True,
                )

        return callback


class ReactionRoles(commands.Cog):
    group = app_commands.Group(
        name="reactionrole",
        description="Let members self-assign roles with persistent buttons.",
        guild_only=True,
    )

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    async def _restore_views(self) -> None:
        """Restore persistent role-picker buttons after a bot restart."""
        try:
            for guild in self.bot.guilds:
                rows = await self.bot.repo.guild_reaction_roles(str(guild.id))  # type: ignore[attr-defined]
                grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
                for row in rows:
                    grouped[str(row.get("message_id"))].append(row)
                for message_id, message_rows in grouped.items():
                    view = ReactionRoleView(self.bot, message_rows)
                    self.bot.add_view(view, message_id=int(message_id))
        except Exception:
            log.exception("Failed to restore reaction-role button views")

    @commands.Cog.listener()
    async def on_ready(self) -> None:
        await self._restore_views()

    async def _refresh_message_view(self, channel: discord.TextChannel, message: discord.Message) -> None:
        rows = await self.bot.repo.reaction_roles_for_message(str(message.id))  # type: ignore[attr-defined]
        view = ReactionRoleView(self.bot, rows)
        self.bot.add_view(view, message_id=message.id)
        await message.edit(view=view if view.children else None)

    @group.command(name="create", description="Post a role-picker panel with persistent buttons.")
    @app_commands.describe(
        channel="Where the panel should be posted",
        title="Embed title",
        description="Embed body shown above the role buttons",
    )
    async def create(
        self,
        interaction: discord.Interaction,
        channel: discord.TextChannel,
        title: str = "Choose your roles",
        description: str = "Use the buttons below to add or remove roles. Your choice survives bot restarts.",
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
                "Role picker posted",
                f"Message ID `{message.id}` in {channel.mention}.\nAdd buttons with `/reactionrole add message_id:{message.id} emoji:… role:…`. ",
            ),
            ephemeral=True,
        )

    @group.command(name="add", description="Attach an emoji → role button to a panel.")
    @app_commands.describe(
        message_id="ID of the role-picker message",
        emoji="Emoji displayed on the button",
        role="Role handed out when the button is pressed",
        channel="Channel the message lives in (defaults to this one)",
        label="Optional button label",
    )
    async def add(
        self,
        interaction: discord.Interaction,
        message_id: str,
        emoji: str,
        role: discord.Role,
        channel: discord.TextChannel | None = None,
        label: str | None = None,
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
        stored = normalise_emoji(emoji)
        await interaction.response.defer(ephemeral=True)
        try:
            message = await target_channel.fetch_message(int(message_id))
        except discord.NotFound as exc:
            raise ActionRefused("I could not find that message in that channel.") from exc
        except discord.Forbidden as exc:
            raise ActionRefused("I cannot read messages in that channel.") from exc
        await self.bot.repo.add_reaction_role({
            "guild_id": str(guild.id),
            "channel_id": str(target_channel.id),
            "message_id": str(message.id),
            "emoji": stored,
            "role_id": str(role.id),
            "created_by": str(interaction.user.id),
            "description": clean_text(label or role.name, 80),
        })
        await self._refresh_message_view(target_channel, message)
        await interaction.followup.send(
            embed=embeds.success("Role button saved", f"{emoji.strip()} → {role.mention} on message `{message.id}`."),
            ephemeral=True,
        )

    @group.command(name="remove", description="Remove a role button from a panel.")
    @app_commands.describe(message_id="ID of the role-picker message", emoji="Emoji to unlink", channel="Channel holding the message")
    async def remove(
        self,
        interaction: discord.Interaction,
        message_id: str,
        emoji: str,
        channel: discord.TextChannel | None = None,
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "manage_roles")
        if not message_id.isdigit():
            raise ActionRefused("Message IDs are numbers — enable Developer Mode to copy one.")
        target_channel = channel or interaction.channel
        if not isinstance(target_channel, discord.TextChannel):
            raise ActionRefused("Pick the text channel that holds the message.")
        await interaction.response.defer(ephemeral=True)
        stored = normalise_emoji(emoji)
        await self.bot.repo.remove_reaction_role(str(guild.id), message_id, stored)  # type: ignore[attr-defined]
        try:
            message = await target_channel.fetch_message(int(message_id))
            await self._refresh_message_view(target_channel, message)
        except discord.HTTPException:
            pass
        await interaction.followup.send(embed=embeds.success("Role button removed", "Members can no longer claim that role from this panel."), ephemeral=True)

    @group.command(name="list", description="Show every role picker option in this server.")
    async def list_roles(self, interaction: discord.Interaction) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "manage_roles")
        await interaction.response.defer(ephemeral=True)
        rows = await self.bot.repo.guild_reaction_roles(str(guild.id))  # type: ignore[attr-defined]
        if not rows:
            await interaction.followup.send(embed=embeds.info("No role pickers yet", "Create one with `/reactionrole create`."), ephemeral=True)
            return
        lines = []
        for row in rows[:25]:
            emoji = row.get("emoji", "")
            display = f"<:role:{emoji}>" if str(emoji).isdigit() else emoji
            lines.append(f"{display} → <@&{row['role_id']}> · message `{row['message_id']}`")
        await interaction.followup.send(embed=embeds.brand("Role pickers", "\n".join(lines)), ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(ReactionRoles(bot))
