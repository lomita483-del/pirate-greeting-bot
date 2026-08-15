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


PERMISSION_LABELS = {
    "manage_messages": "Manage Messages",
    "kick_members": "Kick Members",
    "ban_members": "Ban Members",
    "manage_roles": "Manage Roles",
    "manage_channels": "Manage Channels",
    "manage_guild": "Manage Server",
    "administrator": "Administrator",
}


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

    async def config(self, guild_id: str, command: str) -> dict[str, Any]:
        return await self.repo.command_config(guild_id, command)

    # -- per-command access rules -------------------------------------
    async def enforce(
        self,
        interaction: discord.Interaction,
        command: str,
        config: dict[str, Any],
    ) -> None:
        """Apply the dashboard's per-command rules before running anything."""
        if not config:
            return
        if not config.get("enabled", True):
            raise ActionRefused(
                f"`/{command}` is disabled for this server. "
                "A server manager can turn it back on from the AHOY dashboard."
            )

        user = interaction.user
        member = user if isinstance(user, discord.Member) else None
        role_ids = {str(r.id) for r in getattr(member, "roles", [])}

        denied = set(config.get("denied_role_ids") or [])
        if denied & role_ids:
            raise ActionRefused("One of your roles is blocked from using this command here.")

        allowed = set(config.get("allowed_role_ids") or [])
        if allowed and not (allowed & role_ids):
            raise ActionRefused(
                "This command is limited to specific roles in this server."
            )

        permission = config.get("required_permission") or "none"
        if permission != "none" and member is not None:
            if not getattr(member.guild_permissions, permission, False):
                label = PERMISSION_LABELS.get(permission, permission)
                raise ActionRefused(f"You need the **{label}** permission to use this command.")

        channels = set(config.get("allowed_channel_ids") or [])
        if channels and str(getattr(interaction.channel, "id", "")) not in channels:
            mentions = ", ".join(f"<#{cid}>" for cid in list(channels)[:5])
            raise ActionRefused(f"This command can only be used in {mentions}.")

        cooldown = int(config.get("cooldown_seconds") or 0)
        if cooldown > 0 and interaction.guild:
            last = await self.repo.command_cooldown_at(
                str(interaction.guild.id), command, str(user.id)
            )
            if last:
                try:
                    last_dt = datetime.fromisoformat(str(last).replace("Z", "+00:00"))
                except ValueError:
                    last_dt = None
                if last_dt:
                    elapsed = (datetime.now(timezone.utc) - last_dt).total_seconds()
                    if elapsed < cooldown:
                        raise ActionRefused(
                            f"That command is on cooldown — try again in "
                            f"{int(cooldown - elapsed)}s."
                        )

    @staticmethod
    def apply_custom_response(
        interaction: discord.Interaction,
        embed: discord.Embed,
        config: dict[str, Any],
        *,
        command: str,
        value: Optional[str],
    ) -> discord.Embed:
        template = (config or {}).get("custom_response")
        if not template:
            return embed
        guild_name = interaction.guild.name if interaction.guild else "this server"
        embed.description = (
            str(template)
            .replace("{user}", interaction.user.mention)
            .replace("{server}", guild_name)
            .replace("{command}", f"/{command}")
            .replace("{value}", value or "")
        )[:4000]
        return embed

    # -- full run: rules, execution, delivery -------------------------
    async def run(
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
    ) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message(
                "This command only works inside a server.", ephemeral=True
            )
            return

        guild_id = str(guild.id)
        config = await self.config(guild_id, command)
        ephemeral = bool(config.get("ephemeral", True)) if config else True
        await interaction.response.defer(ephemeral=ephemeral)

        try:
            await self.enforce(interaction, command, config)
            embed = await self.execute(
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
        except ActionRefused as exc:
            await interaction.followup.send(
                embed=embeds.error(f"/{command}", str(exc)), ephemeral=True
            )
            return

        embed = self.apply_custom_response(
            interaction, embed, config, command=command, value=value
        )

        if int(config.get("cooldown_seconds") or 0) > 0:
            await self.repo.touch_command_cooldown(guild_id, command, str(interaction.user.id))

        output_id = config.get("output_channel_id")
        if output_id:
            channel = guild.get_channel(int(output_id))
            if channel is not None and hasattr(channel, "send"):
                try:
                    await channel.send(embed=embed)
                    await interaction.followup.send(
                        embed=embeds.success(
                            f"/{command}", f"Result posted in <#{output_id}>."
                        ),
                        ephemeral=True,
                    )
                    return
                except discord.HTTPException:
                    log.warning("Could not deliver /%s output to %s", command, output_id)

        await interaction.followup.send(embed=embed, ephemeral=ephemeral)


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
