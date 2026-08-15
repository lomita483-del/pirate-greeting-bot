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
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import discord

from ..database.repository import Repository
from ..utils import embeds
from ..utils.checks import ActionRefused
from ..utils.logger import get_logger

log = get_logger("features")

READ_KINDS = {"list", "view", "status", "stats", "logs", "history", "search", "export", "test"}
WRITE_KINDS = {"create", "edit", "delete", "reset", "config", "enable", "disable", "action"}


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
        *,
        member: Optional[discord.Member] = None,
        value: Optional[str] = None,
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
        actor = user if isinstance(user, discord.Member) else None
        role_ids = {str(r.id) for r in getattr(actor, "roles", [])}

        denied = set(config.get("denied_role_ids") or [])
        if denied & role_ids:
            raise ActionRefused("One of your roles is blocked from using this command here.")

        allowed = set(config.get("allowed_role_ids") or [])
        if allowed and not (allowed & role_ids):
            raise ActionRefused(
                "This command is limited to specific roles in this server."
            )

        permission = config.get("required_permission") or "none"
        if permission != "none" and actor is not None:
            if not getattr(actor.guild_permissions, permission, False):
                label = PERMISSION_LABELS.get(permission, permission)
                raise ActionRefused(f"You need the **{label}** permission to use this command.")

        channel = interaction.channel
        channel_id = str(getattr(channel, "id", ""))
        parent_id = str(getattr(getattr(channel, "category", None), "id", "") or "")

        blocked = set(config.get("blocked_channel_ids") or [])
        if channel_id in blocked:
            raise ActionRefused("This command is switched off in this channel.")

        channels = set(config.get("allowed_channel_ids") or [])
        categories = set(config.get("allowed_category_ids") or [])
        if channels or categories:
            if channel_id not in channels and parent_id not in categories:
                places = [f"<#{cid}>" for cid in list(channels)[:5]]
                if categories and not places:
                    places = ["the allowed channel categories"]
                raise ActionRefused(
                    "This command can only be used in " + (", ".join(places) or "other channels")
                    + "."
                )

        # Protected targets: some members may never be acted upon.
        if member is not None:
            protected_users = set(config.get("protected_user_ids") or [])
            protected_roles = set(config.get("protected_role_ids") or [])
            target_roles = {str(r.id) for r in getattr(member, "roles", [])}
            if str(member.id) in protected_users or (protected_roles & target_roles):
                raise ActionRefused(f"{member.mention} is protected from this command.")

        if config.get("require_reason") and not (value or "").strip():
            raise ActionRefused(
                "This command needs a reason — re-run it and fill in the `value` field."
            )

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

        rate_limit = int(config.get("rate_limit_per_minute") or 0)
        if rate_limit > 0 and interaction.guild:
            since = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
            used = await self.repo.command_uses_since(
                str(interaction.guild.id), command, str(user.id), since
            )
            if used >= rate_limit:
                raise ActionRefused(
                    f"You've hit the limit of {rate_limit} use(s) per minute for this command."
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

    @staticmethod
    def _fill(template: str, interaction: discord.Interaction, command: str, value: Optional[str]) -> str:
        guild_name = interaction.guild.name if interaction.guild else "this server"
        return (
            str(template)
            .replace("{user}", interaction.user.mention)
            .replace("{server}", guild_name)
            .replace("{command}", f"/{command}")
            .replace("{value}", value or "")
        )[:4000]

    async def _confirm(
        self, interaction: discord.Interaction, command: str, target: str
    ) -> bool:
        """Ask the runner to confirm before a state-changing command proceeds."""
        view = _ConfirmView(str(interaction.user.id))
        await interaction.followup.send(
            embed=embeds.info(
                f"/{command}",
                f"Confirm this action{target}. This prompt expires in 30 seconds.",
            ),
            view=view,
            ephemeral=True,
        )
        await view.wait()
        return view.confirmed

    async def _record(
        self,
        interaction: discord.Interaction,
        guild: discord.Guild,
        *,
        command: str,
        category: str,
        kind: str,
        member: Optional[discord.Member],
        value: Optional[str],
        config: dict[str, Any],
        outcome: str,
        detail: str,
    ) -> None:
        """Emit the machine event + human audit entry, then optional notification."""
        if not config.get("log_event", True):
            return
        guild_id = str(guild.id)
        payload = {
            "guild_id": guild_id,
            "event": f"command.{kind}",
            "command": command,
            "category": category,
            "actor_id": str(interaction.user.id),
            "actor_name": str(interaction.user),
            "target_id": str(member.id) if member else None,
            "target_name": str(member) if member else None,
            "outcome": outcome,
            "payload": {"value": value, "detail": detail},
        }
        try:
            await self.repo.emit_event(payload)
            await self.repo.write_audit_log(
                {
                    "guild_id": guild_id,
                    "command": command,
                    "category": category,
                    "actor_id": str(interaction.user.id),
                    "actor_name": str(interaction.user),
                    "target_id": str(member.id) if member else None,
                    "target_name": str(member) if member else None,
                    "outcome": outcome,
                    "summary": detail,
                }
            )
        except Exception:  # storage must never break a command
            log.warning("Could not write audit trail for /%s", command)

        log_id = config.get("log_channel_id")
        notify_id = config.get("notify_channel_id")
        role_id = config.get("notify_role_id")
        entry = embeds.info(
            f"/{command}",
            f"{interaction.user.mention} — {detail}",
        )
        for target_id, mention in ((log_id, None), (notify_id, role_id)):
            if not target_id:
                continue
            channel = guild.get_channel(int(target_id))
            if channel is None or not hasattr(channel, "send"):
                continue
            try:
                await channel.send(
                    content=f"<@&{mention}>" if mention else None, embed=entry
                )
            except discord.HTTPException:
                log.warning("Could not post /%s log to %s", command, target_id)

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
        visibility = (config.get("response_visibility") or "inherit") if config else "inherit"
        if visibility == "private":
            ephemeral = True
        elif visibility == "public":
            ephemeral = False
        else:
            ephemeral = bool(config.get("ephemeral", True)) if config else True
        await interaction.response.defer(ephemeral=ephemeral)

        try:
            await self.enforce(interaction, command, config, member=member, value=value)

            if config.get("require_confirmation") and kind in WRITE_KINDS:
                target = f" on {member.mention}" if member else ""
                if not await self._confirm(interaction, command, target):
                    await self._record(
                        interaction,
                        guild,
                        command=command,
                        category=category,
                        kind=kind,
                        member=member,
                        value=value,
                        config=config,
                        outcome="cancelled",
                        detail="Cancelled at the confirmation prompt.",
                    )
                    return

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
            template = (config or {}).get("error_response")
            message = (
                self._fill(template, interaction, command, value) if template else str(exc)
            )
            await interaction.followup.send(
                embed=embeds.error(f"/{command}", message), ephemeral=True
            )
            await self._record(
                interaction,
                guild,
                command=command,
                category=category,
                kind=kind,
                member=member,
                value=value,
                config=config,
                outcome="refused",
                detail=str(exc),
            )
            return

        embed = self.apply_custom_response(
            interaction, embed, config, command=command, value=value
        )

        if int(config.get("cooldown_seconds") or 0) > 0:
            await self.repo.touch_command_cooldown(guild_id, command, str(interaction.user.id))

        await self._record(
            interaction,
            guild,
            command=command,
            category=category,
            kind=kind,
            member=member,
            value=value,
            config=config,
            outcome="success",
            detail=f"Ran `/{command}`" + (f" with `{value}`" if value else "") + ".",
        )

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
        config: Optional[dict[str, Any]] = None,
    ) -> discord.Embed:
        guild = interaction.guild
        if guild is None:
            raise ActionRefused("This command only works inside a server.")
        guild_id = str(guild.id)

        if config is None:
            config = await self.config(guild_id, command)
            await self.enforce(interaction, command, config)


        key = self.state_key(category, sub)
        actor = str(interaction.user.id)
        payload: dict[str, Any] = {
            "value": value,
            "target_id": str(member.id) if member else None,
            "target_name": member.display_name if member else None,
        }

        await self.repo.log_command_usage(guild_id, command, category, actor)

        headline: Optional[str] = None

        if kind in ("enable", "disable"):
            enabled = kind == "enable"
            await self.repo.set_feature_state(
                guild_id, key, {"enabled": enabled, "by": actor, "at": _now(), "value": value}
            )
            headline = f"**{key}** is now **{'enabled' if enabled else 'disabled'}** for this server."

        elif kind == "reset":
            await self.repo.set_feature_state(guild_id, key, {"reset_at": _now(), "by": actor})
            await self.repo.delete_command_records(guild_id, key)
            headline = f"**{key}** has been reset to its defaults."

        elif kind == "config":
            state = await self.repo.get_feature_state(guild_id, key)
            feature_cfg = dict(state.get("config") or {})
            if value:
                field, _, raw = value.partition("=")
                if raw:
                    feature_cfg[field.strip()] = raw.strip()
                else:
                    feature_cfg["value"] = value.strip()
            await self.repo.set_feature_state(
                guild_id, key, {**state, "config": feature_cfg, "by": actor, "at": _now()}
            )
            headline = (
                f"Configuration saved for **{key}**."
                if value
                else f"Current configuration for **{key}** "
                "— pass `field=value` to change a setting."
            )

        elif kind == "create":
            if not value and member is None:
                raise ActionRefused("Provide a `value` (or a `member`) to create this entry.")
            label = value or (member.display_name if member else "entry")
            await self.repo.add_command_record(
                {
                    "guild_id": guild_id,
                    "namespace": key,
                    "command": command,
                    "label": label[:200],
                    "payload": payload,
                    "created_by": actor,
                }
            )
            headline = f"Added **{label[:200]}** to **{key}**."

        elif kind == "edit":
            if not value:
                raise ActionRefused("Provide a `value` describing the change.")
            updated = await self.repo.edit_command_record(guild_id, key, value)
            if not updated:
                raise ActionRefused(f"No matching entry in **{key}** to edit.")
            headline = f"Updated the latest entry in **{key}**."

        elif kind == "delete":
            removed = await self.repo.delete_command_records(guild_id, key, label=value)
            if not removed:
                raise ActionRefused(f"Nothing to remove from **{key}**.")
            headline = f"Removed **{removed}** entr(y/ies) from **{key}**."

        elif kind == "action":
            # One-off operations must leave a real record behind.
            label = value or (member.display_name if member else description)
            await self.repo.add_command_record(
                {
                    "guild_id": guild_id,
                    "namespace": key,
                    "command": command,
                    "label": label[:200],
                    "payload": payload,
                    "created_by": actor,
                }
            )
            headline = f"**{description}**" + (f"\n{value}" if value else "")

        # ---- every kind returns the full configuration + stats view ----
        state = await self.repo.get_feature_state(guild_id, key)
        records = await self.repo.list_command_records(guild_id, key, limit=10)
        usage = await self.repo.command_usage_count(guild_id, command)

        embed = embeds.brand(
            f"/{command}", f"{headline}\n\n{description}" if headline else description
        )
        embed.add_field(name="Area", value=category_title, inline=True)

        embed.add_field(
            name="State",
            value="🟢 Enabled" if state.get("enabled", True) else "🔴 Disabled",
            inline=True,
        )
        embed.add_field(name="Times used", value=str(usage), inline=True)

        feature_config = state.get("config") or {}
        if feature_config:
            embed.add_field(
                name="Configuration",
                value="\n".join(f"• **{k}** — {v}" for k, v in list(feature_config.items())[:8]),
                inline=False,
            )

        access: list[str] = []
        if config.get("allowed_role_ids"):
            access.append(
                "Allowed roles: " + ", ".join(f"<@&{r}>" for r in config["allowed_role_ids"][:5])
            )
        if config.get("denied_role_ids"):
            access.append(
                "Blocked roles: " + ", ".join(f"<@&{r}>" for r in config["denied_role_ids"][:5])
            )
        if (config.get("required_permission") or "none") != "none":
            access.append(
                "Permission: "
                + PERMISSION_LABELS.get(
                    config["required_permission"], config["required_permission"]
                )
            )
        if config.get("allowed_channel_ids"):
            access.append(
                "Channels: " + ", ".join(f"<#{c}>" for c in config["allowed_channel_ids"][:5])
            )
        if config.get("output_channel_id"):
            access.append(f"Output channel: <#{config['output_channel_id']}>")
        if int(config.get("cooldown_seconds") or 0) > 0:
            access.append(f"Cooldown: {config['cooldown_seconds']}s")
        if config.get("notes"):
            access.append(f"Purpose: {config['notes']}")
        if access:
            embed.add_field(name="Access & routing", value="\n".join(access)[:1000], inline=False)

        for opt_key, opt_value in list((config.get("options") or {}).items())[:8]:
            embed.add_field(name=str(opt_key)[:64], value=str(opt_value)[:200], inline=True)


        if records:
            embed.add_field(
                name=f"Entries ({len(records)})",
                value="\n".join(
                    f"• {r.get('label') or '—'} · <t:{int(datetime.fromisoformat(str(r['created_at']).replace('Z', '+00:00')).timestamp())}:R>"
                    for r in records[:8]
                )[:1000],
                inline=False,
            )
        elif not feature_config:
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
