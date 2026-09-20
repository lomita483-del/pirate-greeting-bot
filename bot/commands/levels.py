"""XP, ranks and leaderboards."""
from __future__ import annotations
import discord
from discord import app_commands
from discord.ext import commands
from ..services.level_service import LevelService, format_xp, rank_for_level
from ..utils import embeds
from ..utils.checks import ActionRefused, ensure_guild
MEDALS = {1: "🥇", 2: "🥈", 3: "🥉"}

def _medal(position: int) -> str:
    return MEDALS.get(position, f"`#{position:>2}`")

class Levels(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name="levels", description="Level role rewards in this server.")
    @app_commands.guild_only()
    async def levels(self, interaction: discord.Interaction) -> None:
        guild = ensure_guild(interaction); repo = self.bot.repo  # type: ignore[attr-defined]
        await interaction.response.defer(ephemeral=True)
        config = await repo.get_settings(str(guild.id), "role_settings")
        rules = (config or {}).get("level_roles") or []
        rows = []
        for rule in sorted([r for r in rules if isinstance(r, dict)], key=lambda r: int(r.get("level", 0) or 0)):
            role = guild.get_role(int(rule.get("role_id") or 0))
            if role is not None: rows.append(f"**Level {int(rule.get('level', 0))}** → {role.mention}")
        xp_settings = await repo.get_settings(str(guild.id))
        detail = f"XP per message: **{format_xp(xp_settings.get('xp_per_message', 7.5))}** · {format_xp(xp_settings.get('xp_per_level', 200))} XP per level · +1 crew rank every {int(xp_settings.get('rank_every_levels', 2) or 2)} levels"
        await interaction.followup.send(embed=embeds.brand("Level rewards", ("\n".join(rows) or "No level role rewards configured yet.") + "\n\n" + detail), ephemeral=True)

    @app_commands.command(name="leaderboard", description="Top members in this server.")
    @app_commands.describe(board="Which leaderboard to show")
    @app_commands.choices(board=[app_commands.Choice(name="XP", value="xp"), app_commands.Choice(name="Economy", value="economy")])
    @app_commands.guild_only()
    async def leaderboard(self, interaction: discord.Interaction, board: app_commands.Choice[str] | None = None) -> None:
        guild = ensure_guild(interaction); repo = self.bot.repo  # type: ignore[attr-defined]; kind = board.value if board else "xp"
        await interaction.response.defer(); settings = await repo.get_settings(str(guild.id))
        if kind == "economy":
            if not settings.get("economy_enabled"): raise ActionRefused("The economy is disabled in this server.")
            rows = await repo.economy_leaderboard(str(guild.id)); currency = settings.get("currency_name", "Coins")
            lines = [f"{_medal(i)} <@{row['user_id']}> — **{int(row.get('balance', 0)):,}** {currency}" for i, row in enumerate(rows, 1)]
            title, footer = f"{currency} leaderboard", ""
        else:
            if not settings.get("xp_enabled", True): raise ActionRefused("The XP system is disabled in this server.")
            rows = await repo.xp_leaderboard(str(guild.id)); lines = [f"{_medal(i)} <@{row['user_id']}> — **Lv {int(row.get('level', 0))}** · {format_xp(row.get('xp', 0))} XP" for i, row in enumerate(rows, 1)]
            profile = await repo.get_xp(str(guild.id), str(interaction.user.id)); my_xp = int(profile.get("xp", 0)); my_rank = await repo.xp_rank(str(guild.id), my_xp)
            footer = f"\n\n— You are **#{my_rank}** with **{my_xp:,} XP** (level {int(profile.get('level', 0))})"; title = "XP leaderboard"
        await interaction.followup.send(embed=embeds.brand(title, ("\n".join(lines) or "No activity recorded yet.") + footer))

async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Levels(bot))
