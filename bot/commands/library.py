"""Registers the full AHOY command library as Discord slash commands.

Discord allows an application at most 100 top-level slash commands, so the
900+ commands in ``bot/command_library.py`` are registered as one top-level
command per category with subcommands underneath (subcommand groups are used
automatically when a category exceeds Discord's 25-subcommand limit).

Commands that already have a hand-written implementation elsewhere (``/ban``,
``/warn``, ``/profile``, …) are skipped here, so nothing is duplicated.
"""

from __future__ import annotations

from typing import Optional

import discord
from discord import app_commands
from discord.ext import commands

from ..command_library import CATEGORIES
from ..utils.logger import get_logger

log = get_logger("library")

MAX_CHILDREN = 25
CHUNK_NAMES = ("core", "extra", "advanced", "more", "plus")


def _make_callback(bot: commands.Bot, *, command: str, category: str, title: str, entry: dict):
    async def callback(
        interaction: discord.Interaction,
        member: Optional[discord.Member] = None,
        value: Optional[str] = None,
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        embed = await bot.features.execute(  # type: ignore[attr-defined]
            interaction,
            command=command,
            category=category,
            category_title=title,
            sub=entry["sub"],
            kind=entry["kind"],
            description=entry["desc"],
            member=member,
            value=value,
        )
        await interaction.followup.send(embed=embed, ephemeral=True)

    app_commands.describe(
        member="Optional member this command applies to.",
        value="Optional value, target or `field=value` configuration.",
    )(callback)
    return callback


def build_groups(bot: commands.Bot) -> list[app_commands.Group]:
    groups: list[app_commands.Group] = []
    for category in CATEGORIES:
        slug, title = category["slug"], category["title"]
        entries = [e for e in category["commands"] if not e["dedicated"]]
        if not entries:
            continue

        group = app_commands.Group(
            name=slug,
            description=title[:100],
            guild_only=True,
            default_permissions=discord.Permissions(manage_guild=True),
        )

        if len(entries) <= MAX_CHILDREN:
            containers: list[tuple[app_commands.Group, list[dict]]] = [(group, entries)]
        else:
            containers = []
            chunks = [
                entries[i : i + MAX_CHILDREN] for i in range(0, len(entries), MAX_CHILDREN)
            ]
            for index, chunk in enumerate(chunks):
                name = CHUNK_NAMES[index] if index < len(CHUNK_NAMES) else f"set{index + 1}"
                sub_group = app_commands.Group(
                    name=name,
                    description=f"{title} — {name} commands"[:100],
                    parent=group,
                )
                containers.append((sub_group, chunk))

        for container, chunk in containers:
            for entry in chunk:
                command_name = entry["name"]
                container.add_command(
                    app_commands.Command(
                        name=entry["sub"],
                        description=entry["desc"][:100],
                        callback=_make_callback(
                            bot,
                            command=command_name,
                            category=slug,
                            title=title,
                            entry=entry,
                        ),
                    )
                )
        groups.append(group)
    return groups


async def setup(bot: commands.Bot) -> None:
    registered = 0
    for group in build_groups(bot):
        try:
            bot.tree.add_command(group)
        except app_commands.CommandAlreadyRegistered:
            log.warning("Skipping duplicate command group /%s", group.name)
            continue
        registered += sum(1 for _ in group.walk_commands())
    log.info("Command library online: %d commands across grouped namespaces.", registered)
