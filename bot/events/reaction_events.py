"""Raw reaction listeners that grant and remove self-assignable roles."""

from __future__ import annotations

import discord
from discord.ext import commands

from ..utils.logger import get_logger

log = get_logger("reactions")


def emoji_key(emoji: discord.PartialEmoji) -> str:
    return str(emoji.id) if emoji.id is not None else str(emoji.name)


class ReactionEvents(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    async def _resolve(
        self, payload: discord.RawReactionActionEvent
    ) -> tuple[discord.Guild, discord.Role] | None:
        if payload.guild_id is None:
            return None
        guild = self.bot.get_guild(payload.guild_id)
        if guild is None or not guild.me.guild_permissions.manage_roles:
            return None

        rows = await self.bot.repo.reaction_roles_for_message(str(payload.message_id))  # type: ignore[attr-defined]
        if not rows:
            return None
        key = emoji_key(payload.emoji)
        match = next((r for r in rows if r.get("emoji") == key), None)
        if match is None:
            return None

        role = guild.get_role(int(match["role_id"]))
        if role is None or role.managed or role >= guild.me.top_role:
            return None
        return guild, role

    @commands.Cog.listener()
    async def on_raw_reaction_add(self, payload: discord.RawReactionActionEvent) -> None:
        if payload.user_id == getattr(self.bot.user, "id", None):
            return
        try:
            resolved = await self._resolve(payload)
        except Exception as exc:  # never break reactions on a database blip
            log.warning("Reaction-role lookup failed: %s", exc)
            return
        if resolved is None:
            return
        guild, role = resolved

        member = payload.member or guild.get_member(payload.user_id)
        if member is None or member.bot or role in member.roles:
            return
        try:
            await member.add_roles(role, reason="AHOY reaction role")
        except discord.HTTPException as exc:
            log.warning("Could not grant reaction role in %s: %s", guild.id, exc)

    @commands.Cog.listener()
    async def on_raw_reaction_remove(self, payload: discord.RawReactionActionEvent) -> None:
        try:
            resolved = await self._resolve(payload)
        except Exception as exc:
            log.warning("Reaction-role lookup failed: %s", exc)
            return
        if resolved is None:
            return
        guild, role = resolved

        member = guild.get_member(payload.user_id)
        if member is None or member.bot or role not in member.roles:
            return
        try:
            await member.remove_roles(role, reason="AHOY reaction role removed")
        except discord.HTTPException as exc:
            log.warning("Could not remove reaction role in %s: %s", guild.id, exc)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(ReactionEvents(bot))
