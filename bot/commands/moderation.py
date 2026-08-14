"""Moderation commands. Every action validates, confirms, logs and persists."""

from __future__ import annotations

from datetime import timedelta

import discord
from discord import app_commands
from discord.ext import commands

from ..utils import embeds
from ..utils.checks import (
    ActionRefused,
    ensure_actionable,
    ensure_bot_permission,
    ensure_guild,
    ensure_permission,
)
from ..utils.parsing import clean_text, humanize, parse_duration, DurationError


class Moderation(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @property
    def mod(self):  # ModerationService
        return self.bot.moderation  # type: ignore[attr-defined]

    @property
    def repo(self):
        return self.bot.repo  # type: ignore[attr-defined]

    # -- warnings -----------------------------------------------------
    @app_commands.command(name="warn", description="Warn a member.")
    @app_commands.describe(member="Member to warn", reason="Why they are being warned")
    @app_commands.guild_only()
    async def warn(
        self, interaction: discord.Interaction, member: discord.Member, reason: str
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "moderate_members")
        ensure_actionable(interaction, member)
        reason = clean_text(reason, 500) or "No reason provided"

        await interaction.response.defer(ephemeral=True)
        await self.repo.add_warning(
            str(guild.id),
            str(member.id),
            str(member),
            str(interaction.user.id),
            str(interaction.user),
            reason,
        )
        warnings = await self.repo.list_warnings(str(guild.id), str(member.id))
        await self.mod.record(
            guild, "warn", target=member, moderator=interaction.user, reason=reason
        )

        try:
            await member.send(
                embed=embeds.warning(
                    f"Warning in {guild.name}", f"**Reason:** {reason}"
                )
            )
        except discord.HTTPException:
            pass

        await interaction.followup.send(
            embed=embeds.success(
                "Warning recorded",
                f"{member.mention} now has **{len(warnings)}** active warning(s).\n"
                f"**Reason:** {reason}",
            ),
            ephemeral=True,
        )

    @app_commands.command(name="warnings", description="List a member's active warnings.")
    @app_commands.guild_only()
    async def warnings(
        self, interaction: discord.Interaction, member: discord.Member
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "moderate_members")
        await interaction.response.defer(ephemeral=True)

        rows = await self.repo.list_warnings(str(guild.id), str(member.id))
        if not rows:
            await interaction.followup.send(
                embed=embeds.info("No warnings", f"{member.mention} has a clean record."),
                ephemeral=True,
            )
            return

        embed = embeds.brand(
            f"Warnings · {member.display_name}", f"{len(rows)} active warning(s)"
        )
        for row in rows[:10]:
            embed.add_field(
                name=f"{row.get('created_at', '')[:10]} · {row.get('moderator_name', 'Unknown')}",
                value=clean_text(row.get("reason", "No reason provided"), 200),
                inline=False,
            )
        await interaction.followup.send(embed=embed, ephemeral=True)

    # -- messages -----------------------------------------------------
    @app_commands.command(name="clear", description="Bulk delete recent messages.")
    @app_commands.describe(amount="How many messages to delete (1-100)")
    @app_commands.guild_only()
    async def clear(self, interaction: discord.Interaction, amount: int) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "manage_messages")
        ensure_bot_permission(guild, "manage_messages")
        if not 1 <= amount <= 100:
            raise ActionRefused("Choose an amount between 1 and 100.")
        if not isinstance(interaction.channel, discord.TextChannel):
            raise ActionRefused("This command only works in text channels.")

        await interaction.response.defer(ephemeral=True)
        deleted = await interaction.channel.purge(limit=amount)
        await self.mod.record(
            guild,
            "clear",
            moderator=interaction.user,
            reason=f"Cleared {len(deleted)} messages in #{interaction.channel.name}",
            metadata={"channel_id": str(interaction.channel.id), "count": len(deleted)},
        )
        await interaction.followup.send(
            embed=embeds.success("Messages cleared", f"Removed **{len(deleted)}** message(s)."),
            ephemeral=True,
        )

    # -- timeouts -----------------------------------------------------
    @app_commands.command(name="timeout", description="Temporarily mute a member.")
    @app_commands.describe(
        member="Member to time out", duration="e.g. 30m, 2h, 1d", reason="Reason"
    )
    @app_commands.guild_only()
    async def timeout(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
        duration: str,
        reason: str = "No reason provided",
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "moderate_members")
        ensure_bot_permission(guild, "moderate_members")
        ensure_actionable(interaction, member)
        try:
            delta = parse_duration(duration)
        except DurationError as exc:
            raise ActionRefused(str(exc)) from exc

        reason = clean_text(reason, 400)
        await interaction.response.defer(ephemeral=True)
        await member.timeout(delta, reason=f"{interaction.user}: {reason}")
        await self.mod.record(
            guild,
            "timeout",
            target=member,
            moderator=interaction.user,
            reason=reason,
            duration_seconds=int(delta.total_seconds()),
        )
        await interaction.followup.send(
            embed=embeds.success(
                "Member timed out",
                f"{member.mention} is muted for **{humanize(int(delta.total_seconds()))}**.",
            ),
            ephemeral=True,
        )

    @app_commands.command(name="untimeout", description="Remove a member's timeout.")
    @app_commands.guild_only()
    async def untimeout(
        self, interaction: discord.Interaction, member: discord.Member
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "moderate_members")
        ensure_bot_permission(guild, "moderate_members")
        if member.timed_out_until is None:
            raise ActionRefused("That member is not currently timed out.")

        await interaction.response.defer(ephemeral=True)
        await member.timeout(None, reason=f"Timeout lifted by {interaction.user}")
        await self.mod.record(
            guild, "untimeout", target=member, moderator=interaction.user, reason="Timeout lifted"
        )
        await interaction.followup.send(
            embed=embeds.success("Timeout removed", f"{member.mention} can speak again."),
            ephemeral=True,
        )

    # -- kick / ban ---------------------------------------------------
    @app_commands.command(name="kick", description="Remove a member from the server.")
    @app_commands.guild_only()
    async def kick(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
        reason: str = "No reason provided",
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "kick_members")
        ensure_bot_permission(guild, "kick_members")
        ensure_actionable(interaction, member)
        reason = clean_text(reason, 400)

        await interaction.response.defer(ephemeral=True)
        await guild.kick(member, reason=f"{interaction.user}: {reason}")
        await self.mod.record(
            guild, "kick", target=member, moderator=interaction.user, reason=reason
        )
        await interaction.followup.send(
            embed=embeds.success("Member kicked", f"{member} has been removed."),
            ephemeral=True,
        )

    @app_commands.command(name="ban", description="Ban a member.")
    @app_commands.describe(delete_days="Days of their messages to delete (0-7)")
    @app_commands.guild_only()
    async def ban(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
        reason: str = "No reason provided",
        delete_days: int = 0,
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "ban_members")
        ensure_bot_permission(guild, "ban_members")
        ensure_actionable(interaction, member)
        if not 0 <= delete_days <= 7:
            raise ActionRefused("`delete_days` must be between 0 and 7.")
        reason = clean_text(reason, 400)

        await interaction.response.defer(ephemeral=True)
        await guild.ban(
            member, reason=f"{interaction.user}: {reason}", delete_message_days=delete_days
        )
        await self.mod.record(
            guild, "ban", target=member, moderator=interaction.user, reason=reason
        )
        await interaction.followup.send(
            embed=embeds.success("Member banned", f"{member} has been banned."),
            ephemeral=True,
        )

    @app_commands.command(name="unban", description="Lift a ban using the user ID.")
    @app_commands.guild_only()
    async def unban(
        self, interaction: discord.Interaction, user_id: str, reason: str = "Ban lifted"
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "ban_members")
        ensure_bot_permission(guild, "ban_members")
        if not user_id.isdigit():
            raise ActionRefused("Provide a numeric Discord user ID.")

        await interaction.response.defer(ephemeral=True)
        user = discord.Object(id=int(user_id))
        try:
            await guild.unban(user, reason=f"{interaction.user}: {clean_text(reason, 200)}")
        except discord.NotFound as exc:
            raise ActionRefused("That user is not banned in this server.") from exc

        await self.mod.record(
            guild,
            "unban",
            moderator=interaction.user,
            reason=reason,
            metadata={"target_id": user_id},
        )
        await interaction.followup.send(
            embed=embeds.success("Ban lifted", f"User `{user_id}` may rejoin."),
            ephemeral=True,
        )

    # -- roles --------------------------------------------------------
    role_group = app_commands.Group(
        name="role", description="Manage member roles.", guild_only=True
    )

    @role_group.command(name="add", description="Give a role to a member.")
    async def role_add(
        self, interaction: discord.Interaction, member: discord.Member, role: discord.Role
    ) -> None:
        from ..utils.checks import ensure_assignable_role

        guild = ensure_guild(interaction)
        ensure_permission(interaction, "manage_roles")
        ensure_bot_permission(guild, "manage_roles")
        ensure_assignable_role(guild, role)
        if role in member.roles:
            raise ActionRefused(f"{member.mention} already has {role.mention}.")

        await interaction.response.defer(ephemeral=True)
        await member.add_roles(role, reason=f"Added by {interaction.user}")
        await self.mod.record(
            guild,
            "role_add",
            target=member,
            moderator=interaction.user,
            reason=f"Role {role.name} added",
        )
        await interaction.followup.send(
            embed=embeds.success("Role added", f"{role.mention} → {member.mention}"),
            ephemeral=True,
        )

    @role_group.command(name="remove", description="Remove a role from a member.")
    async def role_remove(
        self, interaction: discord.Interaction, member: discord.Member, role: discord.Role
    ) -> None:
        from ..utils.checks import ensure_assignable_role

        guild = ensure_guild(interaction)
        ensure_permission(interaction, "manage_roles")
        ensure_bot_permission(guild, "manage_roles")
        ensure_assignable_role(guild, role)
        if role not in member.roles:
            raise ActionRefused(f"{member.mention} does not have {role.mention}.")

        await interaction.response.defer(ephemeral=True)
        await member.remove_roles(role, reason=f"Removed by {interaction.user}")
        await self.mod.record(
            guild,
            "role_remove",
            target=member,
            moderator=interaction.user,
            reason=f"Role {role.name} removed",
        )
        await interaction.followup.send(
            embed=embeds.success("Role removed", f"{role.mention} removed from {member.mention}"),
            ephemeral=True,
        )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Moderation(bot))
