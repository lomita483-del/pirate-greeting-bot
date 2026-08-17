"""/report — let members flag a user or message for moderator review."""

from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands

from ..utils import embeds
from ..utils.checks import ActionRefused
from ..utils.logger import get_logger

log = get_logger("reports")


class ReportCommands(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self.report_user_ctx = app_commands.ContextMenu(
            name="Report User", callback=self._report_user_ctx
        )
        self.report_message_ctx = app_commands.ContextMenu(
            name="Report Message", callback=self._report_message_ctx
        )
        bot.tree.add_command(self.report_user_ctx)
        bot.tree.add_command(self.report_message_ctx)

    def cog_unload(self) -> None:
        self.bot.tree.remove_command(self.report_user_ctx.name, type=self.report_user_ctx.type)
        self.bot.tree.remove_command(
            self.report_message_ctx.name, type=self.report_message_ctx.type
        )

    async def _file_report(
        self,
        interaction: discord.Interaction,
        *,
        reported: discord.Member | discord.User,
        reason: str,
        message_id: str | None = None,
        channel_id: str | None = None,
    ) -> None:
        guild = interaction.guild
        assert guild is not None
        if reported.id == interaction.user.id:
            raise ActionRefused("You can't report yourself.")
        if reported.bot:
            raise ActionRefused("You can't report a bot.")

        row = await self.bot.repo.create_report(  # type: ignore[attr-defined]
            {
                "guild_id": str(guild.id),
                "reporter_id": str(interaction.user.id),
                "reporter_name": str(interaction.user),
                "reported_user_id": str(reported.id),
                "reported_user_name": str(reported),
                "reason": reason[:1000],
                "message_id": message_id,
                "channel_id": channel_id,
            }
        )

        embed = embeds.warning(
            f"🚩 New report — #{str(row.get('id', ''))[:8]}",
            f"**Reported:** {reported.mention} (`{reported.id}`)\n"
            f"**Reporter:** {interaction.user.mention}\n"
            f"**Reason:** {reason}"
            + (f"\n**Message:** <#{channel_id}> ({message_id})" if message_id else ""),
        )
        await self.bot.logs.send(guild, "moderation_actions", embed)  # type: ignore[attr-defined]
        await self.bot.logs.log(guild, "moderation_report", embed)  # type: ignore[attr-defined]

        await interaction.response.send_message(
            embed=embeds.success(
                "Report submitted", "Thanks — the moderation team has been notified."
            ),
            ephemeral=True,
        )

    @app_commands.command(name="report", description="Report a member to the moderation team.")
    @app_commands.describe(user="Who you're reporting", reason="What happened")
    @app_commands.guild_only()
    async def report(
        self, interaction: discord.Interaction, user: discord.Member, reason: str
    ) -> None:
        await self._file_report(interaction, reported=user, reason=reason)

    async def _report_user_ctx(
        self, interaction: discord.Interaction, member: discord.Member
    ) -> None:
        await interaction.response.send_modal(_ReportModal(self, member))

    async def _report_message_ctx(
        self, interaction: discord.Interaction, message: discord.Message
    ) -> None:
        await interaction.response.send_modal(
            _ReportModal(
                self,
                message.author,
                message_id=str(message.id),
                channel_id=str(message.channel.id),
            )
        )


class _ReportModal(discord.ui.Modal, title="Report"):
    reason = discord.ui.TextInput(
        label="Reason", style=discord.TextStyle.paragraph, max_length=1000, required=True
    )

    def __init__(
        self,
        cog: ReportCommands,
        reported: discord.Member | discord.User,
        *,
        message_id: str | None = None,
        channel_id: str | None = None,
    ) -> None:
        super().__init__()
        self.cog = cog
        self.reported = reported
        self.message_id = message_id
        self.channel_id = channel_id

    async def on_submit(self, interaction: discord.Interaction) -> None:
        await self.cog._file_report(
            interaction,
            reported=self.reported,
            reason=str(self.reason),
            message_id=self.message_id,
            channel_id=self.channel_id,
        )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(ReportCommands(bot))
