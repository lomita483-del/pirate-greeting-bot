"""Administrator XP and rank management commands.

Commands are intentionally grouped so member-facing /rank remains a useful
profile command while privileged mutations are explicit:
  /xp give, /xp remove, /xp level-up
  /rank give, /rank remove
Targets accept a mention, user ID, username/display name, or comma-separated
usernames for bulk operations.
"""
from __future__ import annotations

import re
import discord
from discord import app_commands
from discord.ext import commands

from ..services.level_service import LevelService, format_xp, level_for_xp, rank_for_level, xp_for_level
from ..utils import embeds
from ..utils.checks import ensure_guild


def _target_tokens(raw: str) -> list[str]:
    raw = raw.strip()
    if not raw:
        return []
    if "," in raw:
        return [x.strip() for x in raw.split(",") if x.strip()]
    return [raw]


def _token_id(token: str) -> int | None:
    match = re.fullmatch(r"<@!?(\d{5,25})>", token.strip()) or re.fullmatch(r"(\d{5,25})", token.strip())
    return int(match.group(1)) if match else None


async def resolve_targets(guild: discord.Guild, raw: str) -> tuple[list[discord.Member], list[str]]:
    found: list[discord.Member] = []
    missing: list[str] = []
    seen: set[int] = set()
    members = guild.members
    for token in _target_tokens(raw):
        uid = _token_id(token)
        member = guild.get_member(uid) if uid else None
        if member is None:
            needle = token.lstrip("@").casefold()
            matches = [m for m in members if m.name.casefold() == needle or m.display_name.casefold() == needle or str(m).casefold() == needle]
            member = matches[0] if matches else None
        if member is None:
            missing.append(token)
        elif member.id not in seen:
            seen.add(member.id)
            found.append(member)
    return found, missing


def _admin_only():
    return app_commands.checks.has_permissions(manage_guild=True)


class XPAdmin(commands.GroupCog, group_name="xp", group_description="Administrator XP management"):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name="settings", description="Configure this server's XP, level threshold and crew-rank progression.")
    @app_commands.describe(
        xp_per_message="XP awarded per eligible message (default 7.5)",
        xp_per_level="XP required per level block (default 200)",
        rank_every_levels="Increase crew rank every N levels (default 2)",
    )
    @_admin_only()
    @app_commands.guild_only()
    async def settings(
        self,
        interaction: discord.Interaction,
        xp_per_message: app_commands.Range[float, 0.1, 500] = 7.5,
        xp_per_level: app_commands.Range[float, 1, 100000] = 200,
        rank_every_levels: app_commands.Range[int, 1, 100] = 2,
    ) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer(ephemeral=True)
        await self.bot.repo.update_settings(
            str(guild.id),
            {
                "xp_per_message": float(xp_per_message),
                "xp_per_level": float(xp_per_level),
                "rank_every_levels": int(rank_every_levels),
            },
        )
        if hasattr(self.bot, "settings"):
            try:
                self.bot.settings.invalidate(str(guild.id))
            except Exception:
                pass
        await interaction.followup.send(
            embed=embeds.success(
                "XP settings updated",
                f"**{format_xp(xp_per_message)} XP/message** · "
                f"**{format_xp(xp_per_level)} XP/level** · "
                f"**+1 crew rank every {int(rank_every_levels)} levels**\n\n"
                "Level 1 reaches **200/200 XP** by default; level 2 reaches **400/400 XP**.",
            ),
            ephemeral=True,
        )

    @app_commands.command(name="give", description="Give XP to one or multiple users by username.")
    @app_commands.describe(targets="Username, mention, ID, or comma-separated usernames", amount="XP to add")
    @_admin_only()
    @app_commands.guild_only()
    async def give(self, interaction: discord.Interaction, targets: str, amount: app_commands.Range[int, 1, 1_000_000]) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer(ephemeral=True)
        users, missing = await resolve_targets(guild, targets)
        if not users:
            await interaction.followup.send(embed=embeds.error("No users found", "Use a username, mention, ID, or comma-separated usernames."), ephemeral=True)
            return
        repo = self.bot.repo  # type: ignore[attr-defined]
        changed: list[str] = []
        for member in users:
            profile = await repo.get_xp(str(guild.id), str(member.id))
            old_xp = float(profile.get("xp", 0) or 0)
            new_xp = old_xp + int(amount)
            config = await self.bot.levels.config(str(guild.id))  # type: ignore[attr-defined]
            new_level = level_for_xp(new_xp, config.get("xp_per_level", 200))
            await repo.save_xp({"guild_id": str(guild.id), "user_id": str(member.id), "username": member.name, "xp": new_xp, "level": new_level, "messages": int(profile.get("messages", 0) or 0), "last_awarded_at": profile.get("last_awarded_at")})
            await self.bot.levels.apply_rewards(member, new_level)  # type: ignore[attr-defined]
            changed.append(f"{member.mention} → **{format_xp(new_xp)} XP** (Lv {new_level})")
        text = "\n".join(changed[:20])
        if len(changed) > 20: text += f"\n…and {len(changed) - 20} more."
        if missing: text += "\n\nUnresolved: " + ", ".join(f"`{x}`" for x in missing[:10])
        await interaction.followup.send(embed=embeds.success("XP awarded", text), ephemeral=True)

    @app_commands.command(name="remove", description="Remove XP from one or multiple users by username.")
    @app_commands.describe(targets="Username, mention, ID, or comma-separated usernames", amount="XP to remove")
    @_admin_only()
    @app_commands.guild_only()
    async def remove(self, interaction: discord.Interaction, targets: str, amount: app_commands.Range[int, 1, 1_000_000]) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer(ephemeral=True)
        users, missing = await resolve_targets(guild, targets)
        if not users:
            await interaction.followup.send(embed=embeds.error("No users found"), ephemeral=True)
            return
        repo = self.bot.repo  # type: ignore[attr-defined]
        changed: list[str] = []
        for member in users:
            profile = await repo.get_xp(str(guild.id), str(member.id))
            new_xp = max(0, float(profile.get("xp", 0) or 0) - int(amount))
            config = await self.bot.levels.config(str(guild.id))  # type: ignore[attr-defined]
            new_level = level_for_xp(new_xp, config.get("xp_per_level", 200))
            await repo.save_xp({"guild_id": str(guild.id), "user_id": str(member.id), "username": member.name, "xp": new_xp, "level": new_level, "messages": int(profile.get("messages", 0) or 0), "last_awarded_at": profile.get("last_awarded_at")})
            changed.append(f"{member.mention} → **{new_xp:,} XP** (Lv {new_level})")
        text = "\n".join(changed[:20])
        if missing: text += "\n\nUnresolved: " + ", ".join(f"`{x}`" for x in missing[:10])
        await interaction.followup.send(embed=embeds.success("XP removed", text), ephemeral=True)

    @app_commands.command(name="level-up", description="Advance one or multiple users by exactly one level.")
    @app_commands.describe(targets="Username, mention, ID, or comma-separated usernames")
    @_admin_only()
    @app_commands.guild_only()
    async def level_up(self, interaction: discord.Interaction, targets: str) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer(ephemeral=True)
        users, missing = await resolve_targets(guild, targets)
        if not users:
            await interaction.followup.send(embed=embeds.error("No users found"), ephemeral=True)
            return
        repo = self.bot.repo  # type: ignore[attr-defined]
        changed: list[str] = []
        for member in users:
            profile = await repo.get_xp(str(guild.id), str(member.id))
            old_xp = float(profile.get("xp", 0) or 0)
            config = await self.bot.levels.config(str(guild.id))  # type: ignore[attr-defined]
            old_level = level_for_xp(old_xp, config.get("xp_per_level", 200))
            new_level = old_level + 1
            new_xp = max(old_xp, float(xp_for_level(new_level, config.get("xp_per_level", 200))))
            await repo.save_xp({"guild_id": str(guild.id), "user_id": str(member.id), "username": member.name, "xp": new_xp, "level": new_level, "messages": int(profile.get("messages", 0) or 0), "last_awarded_at": profile.get("last_awarded_at")})
            await self.bot.levels.apply_rewards(member, new_level)  # type: ignore[attr-defined]
            changed.append(f"{member.mention} → **Level {new_level}**")
        await interaction.followup.send(embed=embeds.success("Level advanced", "\n".join(changed[:20])), ephemeral=True)


class RankAdmin(commands.GroupCog, group_name="rank", group_description="Administrator rank-role management"):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    async def _role(self, guild: discord.Guild, raw: str) -> discord.Role | None:
        raw = raw.strip()
        match = re.fullmatch(r"<@&(\d{5,25})>", raw)
        role = guild.get_role(int(match.group(1))) if match else None
        if role is None:
            role = discord.utils.find(lambda r: r.name.casefold() == raw.lstrip("@").casefold(), guild.roles)
        return role

    @app_commands.command(name="give", description="Give a Discord rank role to one or multiple users.")
    @app_commands.describe(targets="Username, mention, ID, or comma-separated usernames", role="Role name or role mention")
    @_admin_only()
    @app_commands.guild_only()
    async def give(self, interaction: discord.Interaction, targets: str, role: str) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer(ephemeral=True)
        rank_role = await self._role(guild, role)
        users, missing = await resolve_targets(guild, targets)
        if rank_role is None:
            await interaction.followup.send(embed=embeds.error("Role not found", f"Could not resolve `{role}`."), ephemeral=True)
            return
        if rank_role.managed or guild.me is None or rank_role >= guild.me.top_role:
            await interaction.followup.send(embed=embeds.error("Role cannot be managed", "Move the target role below the bot's highest role."), ephemeral=True)
            return
        changed = 0
        for member in users:
            if rank_role not in member.roles:
                await member.add_roles(rank_role, reason="AHOY admin rank grant")
                changed += 1
        await interaction.followup.send(embed=embeds.success("Rank granted", f"**{rank_role.name}** applied to **{changed}** user(s)." + (f" Unresolved: {', '.join(missing[:10])}" if missing else "")), ephemeral=True)

    @app_commands.command(name="remove", description="Remove a Discord rank role from one or multiple users.")
    @app_commands.describe(targets="Username, mention, ID, or comma-separated usernames", role="Role name or role mention")
    @_admin_only()
    @app_commands.guild_only()
    async def remove(self, interaction: discord.Interaction, targets: str, role: str) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer(ephemeral=True)
        rank_role = await self._role(guild, role)
        users, missing = await resolve_targets(guild, targets)
        if rank_role is None:
            await interaction.followup.send(embed=embeds.error("Role not found"), ephemeral=True)
            return
        changed = 0
        for member in users:
            if rank_role in member.roles:
                await member.remove_roles(rank_role, reason="AHOY admin rank revoke")
                changed += 1
        await interaction.followup.send(embed=embeds.success("Rank removed", f"**{rank_role.name}** removed from **{changed}** user(s)." + (f" Unresolved: {', '.join(missing[:10])}" if missing else "")), ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(XPAdmin(bot))
    await bot.add_cog(RankAdmin(bot))
