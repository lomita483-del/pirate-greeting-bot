"""Privileged XP/rank controls; public overall statistics commands are removed."""
from __future__ import annotations

import re
import discord
from discord import app_commands
from discord.ext import commands
from ..services.level_service import LevelService, format_xp, level_for_xp, messages_for_level, rank_for_level
from ..utils import embeds
from ..utils.checks import ensure_guild


def _tokens(raw: str) -> list[str]:
    return [x.strip() for x in raw.split(",") if x.strip()] if "," in raw else [raw.strip()]


def _id(raw: str) -> int | None:
    m = re.fullmatch(r"<@!?(\d{5,25})>", raw.strip()) or re.fullmatch(r"(\d{5,25})", raw.strip())
    return int(m.group(1)) if m else None


async def resolve_targets(guild: discord.Guild, raw: str) -> tuple[list[discord.Member], list[str]]:
    found, missing, seen = [], [], set()
    for token in _tokens(raw):
        uid = _id(token)
        member = guild.get_member(uid) if uid else None
        if member is None:
            needle = token.lstrip("@").casefold()
            member = discord.utils.find(
                lambda m: m.name.casefold() == needle
                or m.display_name.casefold() == needle
                or str(m).casefold() == needle,
                guild.members,
            )
        if member is None:
            missing.append(token)
        elif member.id not in seen:
            found.append(member)
            seen.add(member.id)
    return found, missing


def admin_check():
    return app_commands.checks.has_permissions(manage_guild=True)


class XPAdmin(commands.GroupCog, group_name="xp", group_description="Administrator XP management"):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="settings", description="Configure XP per message, XP per level and crew-rank progression.")
    @app_commands.describe(
        xp_per_message="XP awarded per eligible message (default 7.5).",
        xp_per_level="XP threshold for each level (default 200).",
        rank_every_levels="Increase crew rank every N levels (default 2).",
    )
    @app_commands.guild_only()
    @admin_check()
    async def settings(self, interaction: discord.Interaction, xp_per_message: app_commands.Range[float, 0.1, 500.0] | None = None, xp_per_level: app_commands.Range[float, 1.0, 100000.0] | None = None, rank_every_levels: app_commands.Range[int, 1, 100] | None = None) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer(ephemeral=True)
        repo = self.bot.repo
        current = await repo.get_settings(str(guild.id))
        message_xp = float(xp_per_message if xp_per_message is not None else current.get("xp_per_message", 7.5))
        level_xp = float(xp_per_level if xp_per_level is not None else current.get("xp_per_level", 200))
        rank_interval = int(rank_every_levels if rank_every_levels is not None else current.get("rank_every_levels", 2))
        await repo.update_settings(str(guild.id), {"xp_per_message": message_xp, "xp_per_level": level_xp, "rank_every_levels": rank_interval})
        try:
            self.bot.settings.invalidate(str(guild.id))  # type: ignore[attr-defined]
        except Exception:
            pass
        await interaction.followup.send(
            embed=embeds.success(
                "XP settings updated",
                f"**{format_xp(message_xp)} XP/message**\n"
                f"**{format_xp(level_xp)} XP per level**\n"
                f"**+1 crew rank every {rank_interval} levels**\n\n"
                f"**{format_xp(level_xp)}/{format_xp(level_xp)} XP** = Level 1 = Rank 0\n"
                f"**{format_xp(level_xp * 2)}/{format_xp(level_xp * 2)} XP** = Level 2 = Rank 1",
            ),
            ephemeral=True,
        )

    @app_commands.command(name="give", description="Give XP to one or multiple users by username.")
    @app_commands.describe(targets="Username, mention, ID, or comma-separated usernames", amount="XP to add")
    @admin_check()
    @app_commands.guild_only()
    async def give(self, interaction: discord.Interaction, targets: str, amount: app_commands.Range[int, 1, 1_000_000]) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer(ephemeral=True)
        users, missing = await resolve_targets(guild, targets)
        if not users:
            await interaction.followup.send(embed=embeds.error("No users found", "Use a username, mention, ID, or comma-separated usernames."), ephemeral=True)
            return
        repo = self.bot.repo
        lines = []
        for member in users:
            p = await repo.get_xp(str(guild.id), str(member.id))
            xp = int(p.get("xp", 0) or 0) + int(amount)
            messages = int(p.get("messages", 0) or 0)
            level = level_for_messages(messages)
            await repo.save_xp({"guild_id": str(guild.id), "user_id": str(member.id), "username": member.name, "xp": xp, "level": level, "messages": messages, "last_awarded_at": p.get("last_awarded_at")})
            lines.append(f"{member.mention} → **{xp:,} XP** · Lv **{level}**")
        if missing:
            lines.append("\nUnresolved: " + ", ".join(f"`{x}`" for x in missing[:10]))
        await interaction.followup.send(embed=embeds.success("XP awarded", "\n".join(lines[:21])), ephemeral=True)

    @app_commands.command(name="remove", description="Remove XP from one or multiple users by username.")
    @app_commands.describe(targets="Username, mention, ID, or comma-separated usernames", amount="XP to remove")
    @admin_check()
    @app_commands.guild_only()
    async def remove(self, interaction: discord.Interaction, targets: str, amount: app_commands.Range[int, 1, 1_000_000]) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer(ephemeral=True)
        users, missing = await resolve_targets(guild, targets)
        if not users:
            await interaction.followup.send(embed=embeds.error("No users found"), ephemeral=True)
            return
        repo = self.bot.repo
        lines = []
        for member in users:
            p = await repo.get_xp(str(guild.id), str(member.id))
            xp = max(0, int(p.get("xp", 0) or 0) - int(amount))
            messages = int(p.get("messages", 0) or 0)
            level = level_for_messages(messages)
            await repo.save_xp({"guild_id": str(guild.id), "user_id": str(member.id), "username": member.name, "xp": xp, "level": level, "messages": messages, "last_awarded_at": p.get("last_awarded_at")})
            lines.append(f"{member.mention} → **{xp:,} XP** · Lv **{level}**")
        if missing:
            lines.append("\nUnresolved: " + ", ".join(f"`{x}`" for x in missing[:10]))
        await interaction.followup.send(embed=embeds.success("XP removed", "\n".join(lines[:21])), ephemeral=True)

    @app_commands.command(name="level-up", description="Advance one or multiple users by exactly one level.")
    @app_commands.describe(targets="Username, mention, ID, or comma-separated usernames")
    @admin_check()
    @app_commands.guild_only()
    async def level_up(self, interaction: discord.Interaction, targets: str) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer(ephemeral=True)
        users, missing = await resolve_targets(guild, targets)
        if not users:
            await interaction.followup.send(embed=embeds.error("No users found"), ephemeral=True)
            return
        repo = self.bot.repo
        lines = []
        for member in users:
            p = await repo.get_xp(str(guild.id), str(member.id))
            old_messages = int(p.get("messages", 0) or 0)
            old_level = level_for_messages(old_messages)
            new_level = old_level + 1
            new_messages = max(old_messages, messages_for_level(new_level))
            xp = int(p.get("xp", 0) or 0)
            await repo.save_xp({"guild_id": str(guild.id), "user_id": str(member.id), "username": member.name, "xp": xp, "level": new_level, "messages": new_messages, "last_awarded_at": p.get("last_awarded_at")})
            await self.bot.levels.apply_rewards(member, new_level)
            lines.append(f"{member.mention} → **Level {new_level}**")
        if missing:
            lines.append("\nUnresolved: " + ", ".join(f"`{x}`" for x in missing[:10]))
        await interaction.followup.send(embed=embeds.success("Level advanced", "\n".join(lines[:20])), ephemeral=True)


class RankAdmin(commands.GroupCog, group_name="rank", group_description="Rank display and administrator role management"):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="show", description="Show a member's XP rank card in Discord.")
    @app_commands.describe(member="Member to inspect")
    @app_commands.guild_only()
    async def show(self, interaction: discord.Interaction, member: discord.Member | None = None) -> None:
        guild = ensure_guild(interaction)
        target = member or interaction.user
        repo = self.bot.repo
        settings = await repo.get_settings(str(guild.id))
        if not settings.get("xp_enabled", True):
            await interaction.response.send_message(embed=embeds.warning("XP disabled", "The XP system is disabled in this server."), ephemeral=True)
            return
        await interaction.response.defer()
        p = await repo.get_xp(str(guild.id), str(target.id))
        xp = int(p.get("xp", 0) or 0)
        messages = int(p.get("messages", 0) or 0)
        level = level_for_messages(messages)
        current, needed = LevelService.progress(messages, level)
        rank = await repo.xp_rank(str(guild.id), xp)
        percent = min(100, round(current / max(1, needed) * 100))
        e = embeds.brand(
            f"⚓ {target.display_name} · Rank Card",
            f"**LEVEL {level}**  ·  **RANK #{rank}**\n\n{LevelService.bar(current, needed, 24)}\n`{current:,} / {needed:,} messages`  ·  **{percent}%**\n\n**{xp:,} total XP**  ·  **{messages:,} messages**",
        )
        e.set_thumbnail(url=target.display_avatar.url)
        await interaction.followup.send(embed=e)

    async def _role(self, guild: discord.Guild, raw: str) -> discord.Role | None:
        m = re.fullmatch(r"<@&(\d{5,25})>", raw.strip())
        return guild.get_role(int(m.group(1))) if m else discord.utils.find(lambda r: r.name.casefold() == raw.lstrip("@").casefold(), guild.roles)

    @app_commands.command(name="give", description="Give a Discord rank role to one or multiple users.")
    @app_commands.describe(targets="Username, mention, ID, or comma-separated usernames", role="Role name or role mention")
    @admin_check()
    @app_commands.guild_only()
    async def give(self, interaction: discord.Interaction, targets: str, role: str) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer(ephemeral=True)
        r = await self._role(guild, role)
        users, missing = await resolve_targets(guild, targets)
        if r is None:
            await interaction.followup.send(embed=embeds.error("Role not found", f"Could not resolve `{role}`."), ephemeral=True)
            return
        if r.managed or guild.me is None or r >= guild.me.top_role:
            await interaction.followup.send(embed=embeds.error("Role cannot be managed", "Move the target role below the bot's highest role."), ephemeral=True)
            return
        changed = 0
        for member in users:
            if r not in member.roles:
                await member.add_roles(r, reason="AHOY admin rank grant")
                changed += 1
        await interaction.followup.send(embed=embeds.success("Rank granted", f"**{r.name}** applied to **{changed}** user(s)." + (f" Unresolved: {', '.join(missing[:10])}" if missing else "")), ephemeral=True)

    @app_commands.command(name="remove", description="Remove a Discord rank role from one or multiple users.")
    @app_commands.describe(targets="Username, mention, ID, or comma-separated usernames", role="Role name or role mention")
    @admin_check()
    @app_commands.guild_only()
    async def remove(self, interaction: discord.Interaction, targets: str, role: str) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer(ephemeral=True)
        r = await self._role(guild, role)
        users, missing = await resolve_targets(guild, targets)
        if r is None:
            await interaction.followup.send(embed=embeds.error("Role not found"), ephemeral=True)
            return
        changed = 0
        for member in users:
            if r in member.roles:
                await member.remove_roles(r, reason="AHOY admin rank revoke")
                changed += 1
        await interaction.followup.send(embed=embeds.success("Rank removed", f"**{r.name}** removed from **{changed}** user(s)." + (f" Unresolved: {', '.join(missing[:10])}" if missing else "")), ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(XPAdmin(bot))
    await bot.add_cog(RankAdmin(bot))
