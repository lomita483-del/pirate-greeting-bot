"""Execution engine for the generated AHOY command library.

Every command in ``bot/command_library.py`` runs through this service. Commands
are grouped by intent (``kind``) so that a single, well tested code path powers
all of them:

* ``enable`` / ``disable``  — flip a stored feature switch
* ``config``               — store a configuration value
* ``create`` / ``edit`` / ``delete`` — manage records for that feature area
* ``list`` / ``view`` / ``status`` / ``stats`` / ``logs`` / ``search`` / ``export``
                            — read stored state back out
* ``action``               — record and acknowledge a one-off operation

State lives in ``guild_feature_state``; records live in ``command_records``;
every invocation is written to ``command_usage`` so the dashboard can report
on real usage.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional

import discord

from ..database.repository import Repository
from ..utils import embeds
from ..utils.checks import ActionRefused
from ..utils.logger import get_logger

log = get_logger("features")

READ_KINDS = {"list", "view", "status", "stats", "logs", "history", "search", "export", "test"}
WRITE_KINDS = {"create", "edit", "delete", "reset", "config", "enable", "disable"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class FeatureService:
    def __init__(self, repo: Repository) -> None:
        self.repo = repo

    # -- helpers ------------------------------------------------------
    @staticmethod
    def state_key(category: str, sub: str) -> str:
        base = sub
        for suffix in ("-enable", "-disable", "-status", "-list", "-view", "-config", "-reset"):
            if base.endswith(suffix):
                base = base[: -len(suffix)]
                break
        return f"{category}:{base or sub}"

    async def is_enabled(self, guild_id: str, command: str) -> bool:
        return await self.repo.command_enabled(guild_id, command)

    # -- main entry ---------------------------------------------------
    async def execute(
        self,
        interaction: discord.Interaction,
        *,
        command: str,
        category: str,
        category_title: str,
        sub: str,
        kind: str,
        description: str,
        member: Optional[discord.Member],
        value: Optional[str],
    ) -> discord.Embed:
        guild = interaction.guild
        if guild is None:
            raise ActionRefused("This command only works inside a server.")
        guild_id = str(guild.id)

        if not await self.is_enabled(guild_id, command):
            raise ActionRefused(
                f"`/{command}` is disabled for this server. "
                "A server manager can turn it back on from the AHOY dashboard."
            )

        key = self.state_key(category, sub)
        actor = str(interaction.user.id)
        payload: dict[str, Any] = {
            "value": value,
            "target_id": str(member.id) if member else None,
            "target_name": member.display_name if member else None,
        }

        await self.repo.log_command_usage(guild_id, command, category, actor)

        if kind in ("enable", "disable"):
            enabled = kind == "enable"
            await self.repo.set_feature_state(
                guild_id, key, {"enabled": enabled, "by": actor, "at": _now(), "value": value}
            )
            return embeds.success(
                f"/{command}",
                f"**{key}** is now **{'enabled' if enabled else 'disabled'}** for this server.",
            )

        if kind == "reset":
            await self.repo.set_feature_state(guild_id, key, {"reset_at": _now(), "by": actor})
            await self.repo.delete_command_records(guild_id, key)
            return embeds.success(f"/{command}", f"**{key}** has been reset to its defaults.")

        if kind == "config":
            state = await self.repo.get_feature_state(guild_id, key)
            config = dict(state.get("config") or {})
            if value:
                field, _, raw = value.partition("=")
                if raw:
                    config[field.strip()] = raw.strip()
                else:
                    config["value"] = value.strip()
            await self.repo.set_feature_state(
                guild_id, key, {**state, "config": config, "by": actor, "at": _now()}
            )
            body = "\n".join(f"• **{k}** — {v}" for k, v in config.items()) or "No values set yet."
            return embeds.success(
                f"/{command}",
                f"Configuration for **{key}**:\n{body}\n\n"
                "_Tip: pass `field=value` to set a specific field._",
            )

        if kind == "create":
            if not value and member is None:
                raise ActionRefused("Provide a `value` (or a `member`) to create this entry.")
            label = value or (member.display_name if member else "entry")
            record = await self.repo.add_command_record(
                {
                    "guild_id": guild_id,
                    "namespace": key,
                    "command": command,
                    "label": label[:200],
                    "payload": payload,
                    "created_by": actor,
                }
            )
            return embeds.success(
                f"/{command}",
                f"Added **{label[:200]}** to **{key}**."
                + (f"\nReference: `{record.get('id', '')[:8]}`" if record else ""),
            )

        if kind == "edit":
            if not value:
                raise ActionRefused("Provide a `value` describing the change.")
            updated = await self.repo.edit_command_record(guild_id, key, value)
            if not updated:
                raise ActionRefused(f"No matching entry in **{key}** to edit.")
            return embeds.success(f"/{command}", f"Updated the latest entry in **{key}**.")

        if kind == "delete":
            removed = await self.repo.delete_command_records(guild_id, key, label=value)
            if not removed:
                raise ActionRefused(f"Nothing to remove from **{key}**.")
            return embeds.success(f"/{command}", f"Removed **{removed}** entr(y/ies) from **{key}**.")

        # ---- read-only kinds ----
        state = await self.repo.get_feature_state(guild_id, key)
        records = await self.repo.list_command_records(guild_id, key, limit=10)
        usage = await self.repo.command_usage_count(guild_id, command)

        embed = embeds.brand(f"/{command}", description)
        embed.add_field(name="Area", value=category_title, inline=True)
        embed.add_field(
            name="State",
            value="🟢 Enabled" if state.get("enabled", True) else "🔴 Disabled",
            inline=True,
        )
        embed.add_field(name="Times used", value=str(usage), inline=True)

        config = state.get("config") or {}
        if config:
            embed.add_field(
                name="Configuration",
                value="\n".join(f"• **{k}** — {v}" for k, v in list(config.items())[:8]),
                inline=False,
            )
        if records:
            embed.add_field(
                name=f"Entries ({len(records)})",
                value="\n".join(
                    f"• {r.get('label') or '—'} · <t:{int(datetime.fromisoformat(str(r['created_at']).replace('Z', '+00:00')).timestamp())}:R>"
                    for r in records[:8]
                )[:1000],
                inline=False,
            )
        elif not config:
            embed.add_field(
                name="No data yet",
                value=(
                    "Nothing has been stored for this feature yet. Use the matching "
                    "`create`/`config`/`enable` command, or configure it from the AHOY dashboard."
                ),
                inline=False,
            )

        if kind == "export":
            snapshot = json.dumps({"state": state, "records": records}, default=str)[:1500]
            embed.add_field(name="Export", value=f"```json\n{snapshot}\n```", inline=False)

        return embed


__all__ = ["FeatureService"]
