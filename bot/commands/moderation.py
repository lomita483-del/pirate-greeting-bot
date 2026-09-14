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
    @app_commands.command(name="clear", description="Bulk delete messages in a channel.")
    @app_commands.describe(
        channel="Channel to clean (defaults to the current channel)",
        amount="How many messages to delete (1-1000)",
        user="Only delete messages from this member",
    )
    @app_commands.guild_only()
    async def clear(
        self,
        interaction: discord.Interaction,
        amount: int,
        channel: discord.TextChannel | None = None,
        user: discord.Member | None = None,
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "manage_messages")
        ensure_bot_permission(guild, "manage_messages")
        if not 1 <= amount <= 1000:
            raise ActionRefused("Choose an amount between 1 and 1000.")

        target_channel = channel or interaction.channel
        if not isinstance(target_channel, discord.TextChannel):
            raise ActionRefused("This command only works in text channels.")

        await interaction.response.defer(ephemeral=True)

        # Always pass a callable predicate to discord.py. Passing None through
        # the purge path caused the observed `'NoneType' object is not callable`
        # failure on /clear when no member filter was supplied.
        check = (lambda m: m.author.id == user.id) if user else (lambda m: True)

        # Discord caps a single purge at 100 messages, so batch the request.
        deleted_total = 0
        remaining = amount
        while remaining > 0:
            batch = min(100, remaining)
            try:
                deleted = await target_channel.purge(
                    limit=batch if user is None else 100,
                    check=check,
                    reason=f"/clear by {interaction.user}",
                )
            except discord.HTTPException as exc:
                if deleted_total == 0:
                    raise ActionRefused(f"Discord refused the purge: {exc}") from exc
                break
            if not deleted:
                break
            deleted_total += len(deleted)
            remaining -= len(deleted)

        scope = f" from {user.mention}" if user else ""
        await self.mod.record(
            guild,
            "clear",
            target=user,
            moderator=interaction.user,
            reason=f"Cleared {deleted_total} messages in #{target_channel.name}",
            metadata={
                "channel_id": str(target_channel.id),
                "count": deleted_total,
                "user_id": str(user.id) if user else None,
            },
        )
        await interaction.followup.send(
            embed=embeds.success(
                "Messages cleared",
                f"Removed **{deleted_total}** message(s) in {target_channel.mention}{scope}.",
            ),
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
        ensure_actionable(interaction, member)
        await interaction.response.defer(ephemeral=True)
        await member.timeout(None, reason=f"/untimeout by {interaction.user}")
        await self.mod.record(
            guild,
            "untimeout",
            target=member,
            moderator=interaction.user,
            reason="Timeout removed",
        )
        await interaction.followup.send(
            embed=embeds.success("Timeout removed", f"{member.mention} can speak again."),
            ephemeral=True,
        )

    # -- kicks --------------------------------------------------------
    @app_commands.command(name="kick", description="Kick a member.")
    @app_commands.describe(member="Member to kick", reason="Reason")
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
        await member.kick(reason=f"{interaction.user}: {reason}")
        await self.mod.record(
            guild, "kick", target=member, moderator=interaction.user, reason=reason
        )
        await interaction.followup.send(
            embed=embeds.success("Member kicked", f"{member} was removed.\n**Reason:** {reason}"),
            ephemeral=True,
        )

    # -- bans ---------------------------------------------------------
    @app_commands.command(name="ban", description="Ban a member.")
    @app_commands.describe(member="Member to ban", reason="Reason")
    @app_commands.guild_only()
    async def ban(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
        reason: str = "No reason provided",
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "ban_members")
        ensure_bot_permission(guild, "ban_members")
        ensure_actionable(interaction, member)
        reason = clean_text(reason, 400)
        await interaction.response.defer(ephemeral=True)
        await member.ban(reason=f"{interaction.user}: {reason}")
        await self.mod.record(
            guild, "ban", target=member, moderator=interaction.user, reason=reason
        )
        await interaction.followup.send(
            embed=embeds.success("Member banned", f"{member} was banned.\n**Reason:** {reason}"),
            ephemeral=True,
        )

    @app_commands.command(name="unban", description="Unban a user by ID.")
    @app_commands.describe(user_id="Discord user ID", reason="Reason")
    @app_commands.guild_only()
    async def unban(
        self,
        interaction: discord.Interaction,
        user_id: str,
        reason: str = "No reason provided",
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "ban_members")
        ensure_bot_permission(guild, "ban_members")
        try:
            uid = int(user_id.strip())
        except ValueError as exc:
            raise ActionRefused("Enter a valid Discord user ID.") from exc

        reason = clean_text(reason, 400)
        await interaction.response.defer(ephemeral=True)
        try:
            await guild.unban(discord.Object(id=uid), reason=f"{interaction.user}: {reason}")
        except discord.NotFound as exc:
            raise ActionRefused("That user is not currently banned in this server.") from exc
        await self.mod.record(
            guild,
            "unban",
            moderator=interaction.user,
            reason=f"User {uid}: {reason}",
            metadata={"user_id": str(uid)},
        )
        await interaction.followup.send(
            embed=embeds.success("Member unbanned", f"<@{uid}> is no longer banned."),
            ephemeral=True,
        )

    # -- case history -------------------------------------------------
    @app_commands.command(name="case", description="Inspect a moderation case or recent cases.")
    @app_commands.describe(number="Case number (leave empty for recent cases)")
    @app_commands.guild_only()
    async def case(
        self, interaction: discord.Interaction, number: int | None = None
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "moderate_members")
        await interaction.response.defer(ephemeral=True)

        if number is None:
            rows = await self.repo.recent_cases(str(guild.id), 10)
            if not rows:
                await interaction.followup.send(
                    embed=embeds.info("No cases", "This server has no moderation cases yet."),
                    ephemeral=True,
                )
                return
            embed = embeds.brand("Recent moderation cases", f"Latest {len(rows)} case(s)")
            for row in rows:
                embed.add_field(
                    name=f"Case #{row.get('case_number')} · {row.get('action', 'unknown')}",
                    value=f"<@{row.get('target_id')}> · {clean_text(row.get('reason', 'No reason provided'), 160)}",
                    inline=False,
                )
            await interaction.followup.send(embed=embed, ephemeral=True)
            return

        row = await self.repo.get_case(str(guild.id), number)
        if not row:
            raise ActionRefused(f"Case #{number} was not found.")
        embed = embeds.brand(
            f"Case #{number}",
            f"**Action:** {row.get('action', 'unknown')}\n"
            f"**Target:** <@{row.get('target_id')}>\n"
            f"**Moderator:** <@{row.get('moderator_id')}>\n"
            f"**Reason:** {row.get('reason', 'No reason provided')}",
        )
        await interaction.followup.send(embed=embed, ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Moderation(bot))
