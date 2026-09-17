"""Bridge generated slash commands to the real command-action implementations."""

from __future__ import annotations

import re
from typing import Optional

import discord

from ..utils import embeds
from ..utils.checks import ActionRefused
from .command_actions import Ctx, lookup


_ROLE_RE = re.compile(r"<@&(\d+)>")
_CHANNEL_RE = re.compile(r"<#(\d+)>")


def _resolve_role(guild: discord.Guild, value: Optional[str]) -> Optional[discord.Role]:
    match = _ROLE_RE.search(value or "")
    if match:
        return guild.get_role(int(match.group(1)))
    needle = (value or "").strip().lower()
    if needle.startswith("role:"):
        needle = needle[5:].strip()
    if not needle:
        return None
    return next((role for role in guild.roles if role.name.lower() == needle), None)


def _resolve_channel(guild: discord.Guild, value: Optional[str]) -> Optional[discord.abc.GuildChannel]:
    match = _CHANNEL_RE.search(value or "")
    if match:
        return guild.get_channel(int(match.group(1)))
    needle = (value or "").strip().lower()
    if needle.startswith("channel:"):
        needle = needle[8:].strip()
    if not needle:
        return None
    return next((channel for channel in guild.channels if channel.name.lower() == needle.lstrip("#")), None)


def _amount(value: Optional[str]) -> Optional[int]:
    match = re.search(r"-?\d+", value or "")
    return int(match.group(0)) if match else None


def install(bot: object) -> None:
    """Patch the existing FeatureService instance once, preserving its fallback engine."""
    features = getattr(bot, "features", None)
    if features is None or getattr(features, "_command_actions_bridge_installed", False):
        return

    original = features.execute

    async def execute(interaction: discord.Interaction, *, command: str, category: str,
                      category_title: str, sub: str, kind: str, description: str,
                      member: Optional[discord.Member], value: Optional[str],
                      config: Optional[dict] = None) -> discord.Embed:
        guild = interaction.guild
        if guild is None:
            raise ActionRefused("This command only works inside a server.")

        # /panel dashboard was previously a generic placeholder. Make it a real
        # navigation command to the guild's web control center.
        if category == "panel" and sub == "dashboard":
            url = f"https://ahoy.lovable.app/dashboard/{guild.id}"
            embed = embeds.brand(
                "AHOY Dashboard",
                f"Open the live control center for **{guild.name}**.\n\n[Open AHOY Control Center]({url})",
            )
            embed.add_field(name="Server", value=guild.name, inline=True)
            embed.add_field(name="Status", value="Online", inline=True)
            embed.set_footer(text="!HOY BOT · Web Control Center")
            return embed

        handler = lookup(category, sub)
        if handler is None:
            return await original(
                interaction,
                command=command,
                category=category,
                category_title=category_title,
                sub=sub,
                kind=kind,
                description=description,
                member=member,
                value=value,
                config=config,
            )

        actor = interaction.user if isinstance(interaction.user, discord.Member) else None
        if actor is None:
            raise ActionRefused("This command requires a server member context.")

        role = _resolve_role(guild, value)
        channel = _resolve_channel(guild, value)
        ctx = Ctx(
            interaction=interaction,
            guild=guild,
            actor=actor,
            command=command,
            category=category,
            sub=sub,
            description=description,
            member=member,
            role=role,
            channel=channel,
            amount=_amount(value),
            value=value,
            repo=getattr(bot, "repo"),
        )
        try:
            return await handler(ctx)
        except ActionRefused:
            raise
        except (discord.Forbidden, discord.HTTPException):
            raise
        except Exception as exc:
            raise ActionRefused(f"The `{command}` action could not be completed: {exc}") from exc

    features.execute = execute
    features._command_actions_bridge_installed = True
