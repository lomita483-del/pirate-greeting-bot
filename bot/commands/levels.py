"""XP, ranks and leaderboards."""

from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands

from ..services.level_service import LevelService
from ..utils import embeds
from ..utils.checks import ActionRefused, ensure_guild


class Levels(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name="rank", description="Show XP and level progress.")
    @app_commands.guild_only()
    async def rank(
        self, interaction: discord.Interaction, member: discord.Member | None = None
    ) -> None:
        guild = ensure_guild(interaction)
        target = member or interaction.user
        repo = self.bot.repo  # type: ignore[attr-defined]

        settings = await repo.get_settings(str(guild.id))
        if settings and not settings.get("xp_enabled", True):
            raise ActionRefused("The XP system is disabled in this server.")

        await interaction.response.defer()
        profile = await repo.get_xp(str(guild.id), str(target.id))
        xp = int(profile.get("xp", 0))
        level = int(profile.get("level", 0))
        rank = await repo.xp_rank(str(guild.id), xp)
        current, needed = LevelService.progress(xp, level)

        embed = embeds.brand(
            f"Rank · {target.display_name}",
            f"{LevelService.bar(current, needed)}  {current}/{needed} XP",
        )
        embed.set_thumbnail(url=target.display_avatar.url)
        embed.add_field(name="Level", value=str(level))
        embed.add_field(name="Total XP", value=f"{xp:,}")
        embed.add_field(name="Server rank", value=f"#{rank}")
        await interaction.followup.send(embed=embed)

    @app_commands.command(name="leaderboard", description="Top members in this server.")
    @app_commands.describe(board="Which leaderboard to show")
    @app_commands.choices(
        board=[
            app_commands.Choice(name="XP", value="xp"),
            app_commands.Choice(name="Economy", value="economy"),
        ]
    )
    @app_commands.guild_only()
    async def leaderboard(
        self,
        interaction: discord.Interaction,
        board: app_commands.Choice[str] | None = None,
    ) -> None:
        guild = ensure_guild(interaction)
        repo = self.bot.repo  # type: ignore[attr-defined]
        kind = board.value if board else "xp"
        await interaction.response.defer()

        if kind == "economy":
            settings = await repo.get_settings(str(guild.id))
            if not settings.get("economy_enabled"):
                raise ActionRefused("The economy is disabled in this server.")
            rows = await repo.economy_leaderboard(str(guild.id))
            currency = settings.get("currency_name", "Coins")
            lines = [
                f"**{i}.** <@{row['user_id']}> — {int(row.get('balance', 0)):,} {currency}"
                for i, row in enumerate(rows, start=1)
            ]
            title = f"{currency} leaderboard"
        else:
            rows = await repo.xp_leaderboard(str(guild.id))
            lines = [
                f"**{i}.** <@{row['user_id']}> — level {int(row.get('level', 0))} "
                f"({int(row.get('xp', 0)):,} XP)"
                for i, row in enumerate(rows, start=1)
            ]
            title = "XP leaderboard"

        await interaction.followup.send(
            embed=embeds.brand(title, "\n".join(lines) or "No activity recorded yet.")
        )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Levels(bot))
