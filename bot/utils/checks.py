"""Permission and hierarchy validation for moderation commands."""

from __future__ import annotations

from typing import Optional

import discord


class ActionRefused(Exception):
    """Friendly, user-safe refusal reason."""


def ensure_guild(interaction: discord.Interaction) -> discord.Guild:
    if interaction.guild is None:
        raise ActionRefused("This command only works inside a server.")
    return interaction.guild


def ensure_permission(interaction: discord.Interaction, permission: str) -> None:
    member = interaction.user
    if not isinstance(member, discord.Member):
        raise ActionRefused("This command only works inside a server.")
    if not getattr(member.guild_permissions, permission, False):
        raise ActionRefused(
            f"You need the **{permission.replace('_', ' ').title()}** permission for that."
        )


def ensure_bot_permission(guild: discord.Guild, permission: str) -> None:
    me = guild.me
    if me is None or not getattr(me.guild_permissions, permission, False):
        raise ActionRefused(
            f"AHOY is missing the **{permission.replace('_', ' ').title()}** permission."
        )


def ensure_actionable(
    interaction: discord.Interaction,
    target: discord.Member,
    *,
    allow_self: bool = False,
) -> None:
    guild = ensure_guild(interaction)
    author = interaction.user

    if not allow_self and target.id == author.id:
        raise ActionRefused("You cannot use this action on yourself.")
    if target.id == guild.me.id:
        raise ActionRefused("I cannot take that action against myself.")
    if target.id == guild.owner_id:
        raise ActionRefused("The server owner cannot be moderated.")
    if isinstance(author, discord.Member) and author.id != guild.owner_id:
        if target.top_role >= author.top_role:
            raise ActionRefused(
                "That member has a role equal to or higher than yours."
            )
    if guild.me.top_role <= target.top_role:
        raise ActionRefused(
            "That member's highest role is above mine, so I cannot act on them."
        )


def ensure_assignable_role(guild: discord.Guild, role: discord.Role) -> None:
    if role.managed:
        raise ActionRefused("That role is managed by an integration and cannot be assigned.")
    if role >= guild.me.top_role:
        raise ActionRefused("That role is higher than my highest role, so I cannot assign it.")
    if role.is_default():
        raise ActionRefused("The @everyone role cannot be assigned.")


def find_member(guild: discord.Guild, user_id: int) -> Optional[discord.Member]:
    return guild.get_member(user_id)
