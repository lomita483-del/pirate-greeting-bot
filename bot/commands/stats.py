"""Server-side statistics commands."""

from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands

from ..utils import embeds
from ..utils.checks import ensure_guild
from ..utils.parsing import humanize


class Stats(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name="serverstats", description="Live statistics for this server.")
    @app_commands.guild_only()
    async def serverstats(self, interaction: discord.Interaction) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer()

        text = len([c for c in guild.channels if isinstance(c, discord.TextChannel)])
        voice = len([c for c in guild.channels if isinstance(c, discord.VoiceChannel)])
        stage = len([c for c in guild.channels if isinstance(c, discord.StageChannel)])
        categories = len(guild.categories)
        humans = sum(1 for m in guild.members if not m.bot)
        bots = sum(1 for m in guild.members if m.bot)
        online = sum(
            1 for m in guild.members if m.status is not discord.Status.offline and not m.bot
        )
        in_voice = sum(len(c.members) for c in guild.voice_channels)

        embed = embeds.brand(
            f"{guild.name} · server stats",
            f"Created {discord.utils.format_dt(guild.created_at, 'D')} "
            f"({discord.utils.format_dt(guild.created_at, 'R')})",
        )
        if guild.icon:
            embed.set_thumbnail(url=guild.icon.url)
        embed.add_field(
            name="Members",
            value=f"**{guild.member_count:,}** total\n{humans:,} humans · {bots:,} bots",
        )
        embed.add_field(name="Online", value=f"{online:,} now\n{in_voice:,} in voice")
        embed.add_field(
            name="Boosts",
            value=f"Level {guild.premium_tier} · {guild.premium_subscription_count or 0} boosts",
        )
        embed.add_field(
            name="Channels",
            value=f"{text} text · {voice} voice\n{stage} stage · {categories} categories",
        )
        embed.add_field(name="Roles", value=f"{len(guild.roles) - 1}")
        embed.add_field(name="Emojis", value=f"{len(guild.emojis)} · {len(guild.stickers)} stickers")
        owner = guild.owner
        embed.set_footer(text=f"Owner: {owner} ⚓" if owner else "AHOY ⚓")
        await interaction.followup.send(embed=embed)

    @app_commands.command(name="voicestats", description="Who is in voice right now.")
    @app_commands.guild_only()
    async def voicestats(self, interaction: discord.Interaction) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer()

        active = [c for c in guild.voice_channels if c.members]
        lines = [
            f"**{channel.name}** — {len(channel.members)} "
            + ", ".join(m.display_name for m in channel.members[:10])
            for channel in active
        ]

        repo = self.bot.repo  # type: ignore[attr-defined]
        top = await repo.voice_leaderboard(str(guild.id), 5)
        if top:
            lines.append("")
            lines.append("**All-time voice time**")
            lines += [
                f"**{i}.** <@{row['user_id']}> — {humanize(int(row.get('voice_seconds', 0)))}"
                for i, row in enumerate(top, start=1)
            ]

        embed = embeds.brand(
            "Voice activity",
            "\n".join(lines) or "Nobody is in a voice channel right now.",
        )
        embed.add_field(name="Channels in use", value=str(len(active)))
        embed.add_field(
            name="Members connected",
            value=str(sum(len(c.members) for c in active)),
        )
        await interaction.followup.send(embed=embed)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Stats(bot))
