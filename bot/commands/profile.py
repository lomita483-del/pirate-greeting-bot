"""/profile — a rendered PNG stat card for a member."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import discord
from discord import app_commands
from discord.ext import commands

from ..services.card_service import render_profile_card
from ..services.level_service import LevelService
from ..utils.checks import ActionRefused, ensure_guild
from ..utils.logger import get_logger
from ..utils.parsing import humanize

log = get_logger("profile")


def _date(value: datetime | None) -> str:
    return value.strftime("%d %b %Y") if value else "—"


class Profile(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name="profile", description="Show a member's AHOY profile card.")
    @app_commands.describe(member="Whose profile to show (defaults to you).")
    @app_commands.guild_only()
    async def profile(
        self, interaction: discord.Interaction, member: discord.Member | None = None
    ) -> None:
        guild = ensure_guild(interaction)
        target = member or interaction.user
        if not isinstance(target, discord.Member):
            raise ActionRefused("That member is not in this server.")

        await interaction.response.defer()
        repo = self.bot.repo  # type: ignore[attr-defined]
        guild_id = str(guild.id)

        xp_profile = await repo.get_xp(guild_id, str(target.id))
        voice = await repo.get_voice_stats(guild_id, str(target.id))
        xp = int(xp_profile.get("xp", 0) or 0)
        level = int(xp_profile.get("level", 0) or 0)
        rank = await repo.xp_rank(guild_id, xp)
        current, needed = LevelService.progress(xp, level)

        try:
            avatar_bytes = await target.display_avatar.replace(size=256, format="png").read()
        except discord.HTTPException:
            avatar_bytes = None

        voice_seconds = int(voice.get("voice_seconds", 0) or 0)
        live = voice.get("last_joined_at")
        if live:
            try:
                started = datetime.fromisoformat(str(live).replace("Z", "+00:00"))
                voice_seconds += max(
                    0, int((datetime.now(timezone.utc) - started).total_seconds())
                )
            except ValueError:
                pass

        try:
            buffer = await asyncio.to_thread(
                render_profile_card,
                username=target.display_name,
                discriminator=f"@{target.name}",
                avatar_bytes=avatar_bytes,
                level=level,
                xp_current=current,
                xp_needed=needed,
                total_xp=xp,
                rank=rank,
                messages=int(xp_profile.get("messages", 0) or 0),
                voice_time=humanize(voice_seconds) if voice_seconds else "0m",
                joined_server=_date(target.joined_at),
                joined_discord=_date(target.created_at),
            )
        except Exception as exc:  # pragma: no cover - Pillow/runtime issues
            log.exception("Profile card render failed: %s", exc)
            raise ActionRefused("I couldn't render that profile card just now.") from exc

        await interaction.followup.send(
            file=discord.File(buffer, filename=f"ahoy-profile-{target.id}.png")
        )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Profile(bot))
