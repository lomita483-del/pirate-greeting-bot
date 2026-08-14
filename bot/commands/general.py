"""General AHOY commands: /ahoy, /ping, /help, /server, /profile, /stats."""

from __future__ import annotations

import platform
import time
from datetime import datetime, timezone

import discord
from discord import app_commands
from discord.ext import commands

from ..services.level_service import LevelService
from ..utils import embeds

HELP_SECTIONS: dict[str, tuple[str, list[tuple[str, str]]]] = {
    "general": (
        "General",
        [
            ("/ahoy", "A friendly greeting from AHOY."),
            ("/ping", "Show gateway and API latency."),
            ("/help", "Open this interactive command menu."),
            ("/server", "Server information at a glance."),
            ("/profile", "Your AHOY profile for this server."),
            ("/stats", "AHOY runtime statistics."),
        ],
    ),
    "moderation": (
        "Moderation",
        [
            ("/warn", "Warn a member and store the record."),
            ("/warnings", "List a member's active warnings."),
            ("/clear", "Bulk delete recent messages."),
            ("/timeout", "Temporarily mute a member."),
            ("/untimeout", "Remove a timeout."),
            ("/kick", "Remove a member from the server."),
            ("/ban", "Ban a member."),
            ("/unban", "Lift a ban by user ID."),
            ("/role add · /role remove", "Manage a member's roles."),
        ],
    ),
    "community": (
        "Community",
        [
            ("/rank", "Your XP and level progress."),
            ("/leaderboard", "Top members by XP or balance."),
            ("/balance", "Check your wallet."),
            ("/daily", "Claim your daily reward."),
            ("/give", "Send currency to another member."),
        ],
    ),
    "utility": (
        "Utility",
        [
            ("/ticket", "Open a private support ticket."),
            ("/remind", "Set a personal reminder."),
        ],
    ),
}


class HelpSelect(discord.ui.Select):
    def __init__(self) -> None:
        options = [
            discord.SelectOption(label=title, value=key, description=f"{len(cmds)} commands")
            for key, (title, cmds) in HELP_SECTIONS.items()
        ]
        super().__init__(placeholder="Choose a command category…", options=options)

    async def callback(self, interaction: discord.Interaction) -> None:
        await interaction.response.edit_message(embed=build_help_embed(self.values[0]), view=self.view)


class HelpView(discord.ui.View):
    def __init__(self) -> None:
        super().__init__(timeout=180)
        self.add_item(HelpSelect())

    @discord.ui.button(label="Overview", style=discord.ButtonStyle.secondary, emoji="⚓")
    async def overview(self, interaction: discord.Interaction, _: discord.ui.Button) -> None:
        await interaction.response.edit_message(embed=build_help_embed("general"), view=self)

    @discord.ui.button(label="Control Center", style=discord.ButtonStyle.primary, emoji="🧭")
    async def dashboard(self, interaction: discord.Interaction, _: discord.ui.Button) -> None:
        await interaction.response.send_message(
            embed=embeds.brand(
                "AHOY Control Center",
                "Server administrators can configure every AHOY module from the web "
                "dashboard — welcome messages, logging, tickets, XP, economy, AutoMod "
                "and custom commands.",
            ),
            ephemeral=True,
        )


def build_help_embed(section: str) -> discord.Embed:
    title, commands_list = HELP_SECTIONS[section]
    embed = embeds.brand(
        f"AHOY · {title}",
        "Select another category below to keep exploring.",
    )
    for name, description in commands_list:
        embed.add_field(name=name, value=description, inline=False)
    return embed


class General(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name="ahoy", description="Greet AHOY.")
    async def ahoy(self, interaction: discord.Interaction) -> None:
        await interaction.response.send_message("Ahoy, matey! 🏴‍☠️")

    @app_commands.command(name="ping", description="Show AHOY's latency.")
    async def ping(self, interaction: discord.Interaction) -> None:
        gateway = round(self.bot.latency * 1000)
        started = time.perf_counter()
        await interaction.response.defer(thinking=True)
        api = round((time.perf_counter() - started) * 1000)
        await interaction.followup.send(
            embed=embeds.brand(
                "Latency",
                f"**Gateway:** {gateway} ms\n**API round trip:** {api} ms",
            )
        )

    @app_commands.command(name="help", description="Browse AHOY's commands.")
    async def help_command(self, interaction: discord.Interaction) -> None:
        await interaction.response.send_message(
            embed=build_help_embed("general"), view=HelpView(), ephemeral=True
        )

    @app_commands.command(name="server", description="Show information about this server.")
    @app_commands.guild_only()
    async def server(self, interaction: discord.Interaction) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message(
                embed=embeds.error("Server only", "Use this inside a server."), ephemeral=True
            )
            return

        online = sum(
            1 for m in guild.members if m.status is not discord.Status.offline
        ) if guild.members else 0

        embed = embeds.brand(guild.name, "Server overview")
        if guild.icon:
            embed.set_thumbnail(url=guild.icon.url)
        embed.add_field(name="Members", value=str(guild.member_count or 0))
        embed.add_field(name="Online (cached)", value=str(online))
        embed.add_field(name="Channels", value=str(len(guild.channels)))
        embed.add_field(name="Roles", value=str(len(guild.roles)))
        embed.add_field(
            name="Owner", value=guild.owner.mention if guild.owner else "Unknown"
        )
        embed.add_field(
            name="Created", value=discord.utils.format_dt(guild.created_at, "D")
        )
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="profile", description="Show your AHOY profile.")
    @app_commands.describe(member="Member to inspect (defaults to you).")
    @app_commands.guild_only()
    async def profile(
        self, interaction: discord.Interaction, member: discord.Member | None = None
    ) -> None:
        guild = interaction.guild
        target = member or interaction.user
        if guild is None or not isinstance(target, discord.Member):
            await interaction.response.send_message(
                embed=embeds.error("Server only", "Use this inside a server."), ephemeral=True
            )
            return

        await interaction.response.defer()
        repo = self.bot.repo  # type: ignore[attr-defined]
        guild_id = str(guild.id)
        xp = await repo.get_xp(guild_id, str(target.id))
        wallet = await repo.get_wallet(guild_id, str(target.id))
        warnings = await repo.list_warnings(guild_id, str(target.id))
        settings = await repo.get_settings(guild_id)

        level = int(xp.get("level", 0))
        current, needed = LevelService.progress(int(xp.get("xp", 0)), level)

        embed = embeds.brand(f"{target.display_name}", "AHOY profile")
        embed.set_thumbnail(url=target.display_avatar.url)
        embed.add_field(name="Level", value=str(level))
        embed.add_field(name="XP", value=f"{int(xp.get('xp', 0)):,}")
        embed.add_field(name="Messages", value=f"{int(xp.get('messages', 0)):,}")
        embed.add_field(
            name="Progress",
            value=f"{LevelService.bar(current, needed)} {current}/{needed}",
            inline=False,
        )
        if settings.get("economy_enabled"):
            currency = settings.get("currency_name", "Coins")
            embed.add_field(
                name=currency, value=f"{int(wallet.get('balance', 0)):,}"
            )
        embed.add_field(name="Active warnings", value=str(len(warnings)))
        embed.add_field(
            name="Joined",
            value=discord.utils.format_dt(target.joined_at, "D") if target.joined_at else "—",
        )
        await interaction.followup.send(embed=embed)

    @app_commands.command(name="stats", description="Show AHOY statistics.")
    async def stats(self, interaction: discord.Interaction) -> None:
        started: datetime = getattr(self.bot, "started_at", datetime.now(timezone.utc))
        uptime = datetime.now(timezone.utc) - started
        hours, remainder = divmod(int(uptime.total_seconds()), 3600)
        minutes = remainder // 60

        embed = embeds.brand(
            "AHOY statistics",
            "Sailing steady and ready to serve. ⚓",
        )
        embed.add_field(name="Servers", value=str(len(self.bot.guilds)))
        embed.add_field(
            name="Members (cached)",
            value=f"{sum(g.member_count or 0 for g in self.bot.guilds):,}",
        )
        embed.add_field(name="Uptime", value=f"{hours}h {minutes}m")
        embed.add_field(name="Latency", value=f"{round(self.bot.latency * 1000)} ms")
        embed.add_field(name="discord.py", value=discord.__version__)
        embed.add_field(name="Python", value=platform.python_version())
        embed.add_field(
            name="Database",
            value="Connected" if self.bot.db.connected else "Offline",  # type: ignore[attr-defined]
        )
        await interaction.response.send_message(embed=embed)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(General(bot))
