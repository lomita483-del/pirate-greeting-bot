"""XP, ranks and leaderboards."""

from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands

from ..services.level_service import LevelService, xp_for_level
from ..utils import embeds
from ..utils.checks import ActionRefused, ensure_guild

MEDALS = {1: "🥇", 2: "🥈", 3: "🥉"}


def _medal(position: int) -> str:
    return MEDALS.get(position, f"`#{position:>2}`")


class Levels(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name="rank", description="Show XP and level progress.")
    @app_commands.describe(member="Whose rank card to show")
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
        messages = int(profile.get("messages", 0))
        rank = await repo.xp_rank(str(guild.id), xp)
        current, needed = LevelService.progress(xp, level)
        remaining = max(0, needed - current)
        percent = min(100, round(current / max(1, needed) * 100))

        embed = embeds.brand(
            f"Rank · {target.display_name}",
            f"**Level {level}** · {percent}% to level {level + 1}\n"
            f"{LevelService.bar(current, needed, 20)}\n"
            f"`{current:,} / {needed:,} XP`  ·  **{remaining:,} XP** to go",
        )
        embed.set_thumbnail(url=target.display_avatar.url)
        embed.add_field(name="Server rank", value=f"#{rank}")
        embed.add_field(name="Total XP", value=f"{xp:,}")
        embed.add_field(name="Messages", value=f"{messages:,}")
        embed.add_field(name="Next level at", value=f"{xp_for_level(level + 1):,} XP")
        if messages:
            embed.add_field(name="Avg XP / message", value=f"{xp / messages:.1f}")
        await interaction.followup.send(embed=embed)

    @app_commands.command(name="levels", description="Level role rewards in this server.")
    @app_commands.guild_only()
    async def levels(self, interaction: discord.Interaction) -> None:
        guild = ensure_guild(interaction)
        repo = self.bot.repo  # type: ignore[attr-defined]
        await interaction.response.defer(ephemeral=True)

        config = await repo.get_settings(str(guild.id), "role_settings") if hasattr(
            repo, "get_settings"
        ) else {}
        rules = (config or {}).get("level_roles") or []
        rows = []
        for rule in sorted(
            [r for r in rules if isinstance(r, dict)],
            key=lambda r: int(r.get("level", 0) or 0),
        ):
            role = guild.get_role(int(rule.get("role_id") or 0))
            if role is None:
                continue
            rows.append(f"**Level {int(rule.get('level', 0))}** → {role.mention}")

        xp_settings = await repo.get_settings(str(guild.id))
        detail = (
            f"XP per message: **{int(xp_settings.get('xp_per_message', 15))}** · "
            f"Cooldown: **{int(xp_settings.get('xp_cooldown_seconds', 60))}s**"
        )
        await interaction.followup.send(
            embed=embeds.brand(
                "Level rewards",
                (("\n".join(rows) or "No level role rewards configured yet.") + "\n\n" + detail),
            ),
            ephemeral=True,
        )

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

        settings = await repo.get_settings(str(guild.id))

        if kind == "economy":
            if not settings.get("economy_enabled"):
                raise ActionRefused("The economy is disabled in this server.")
            rows = await repo.economy_leaderboard(str(guild.id))
            currency = settings.get("currency_name", "Coins")
            lines = [
                f"{_medal(i)} <@{row['user_id']}> — **{int(row.get('balance', 0)):,}** {currency}"
                for i, row in enumerate(rows, start=1)
            ]
            title = f"{currency} leaderboard"
            footer = ""
        else:
            if not settings.get("xp_enabled", True):
                raise ActionRefused("The XP system is disabled in this server.")
            rows = await repo.xp_leaderboard(str(guild.id))
            lines = [
                f"{_medal(i)} <@{row['user_id']}> — **Lv {int(row.get('level', 0))}** "
                f"· {int(row.get('xp', 0)):,} XP"
                for i, row in enumerate(rows, start=1)
            ]
            title = "XP leaderboard"

            profile = await repo.get_xp(str(guild.id), str(interaction.user.id))
            my_xp = int(profile.get("xp", 0))
            my_rank = await repo.xp_rank(str(guild.id), my_xp)
            footer = (
                f"\n\n— You are **#{my_rank}** with **{my_xp:,} XP** "
                f"(level {int(profile.get('level', 0))})"
            )

        embed = embeds.brand(title, ("\n".join(lines) or "No activity recorded yet.") + footer)
        embed.set_thumbnail(url=guild.icon.url if guild.icon else None)
        await interaction.followup.send(embed=embed)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Levels(bot))
