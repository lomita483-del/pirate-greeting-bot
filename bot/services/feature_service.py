"""Execution engine for the generated AHOY command library."""

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


class _ConfirmView(discord.ui.View):
    """Two-button confirmation, usable only by the member who ran the command."""

    def __init__(self, owner_id: str, timeout: float = 30.0) -> None:
        super().__init__(timeout=timeout)
        self.owner_id = owner_id
        self.confirmed = False

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if str(interaction.user.id) != self.owner_id:
            await interaction.response.send_message("This confirmation isn't yours.", ephemeral=True)
            return False
        return True

    @discord.ui.button(label="Confirm", style=discord.ButtonStyle.danger)
    async def confirm(self, interaction: discord.Interaction, _button: discord.ui.Button) -> None:
        self.confirmed = True
        await interaction.response.edit_message(embed=embeds.success("Confirmed", "Carrying out the action…"), view=None)
        self.stop()

    @discord.ui.button(label="Cancel", style=discord.ButtonStyle.secondary)
    async def cancel(self, interaction: discord.Interaction, _button: discord.ui.Button) -> None:
        self.confirmed = False
        await interaction.response.edit_message(embed=embeds.warning("Cancelled", "Nothing was changed."), view=None)
        self.stop()


class FeatureService:
    def __init__(self, repo: Repository) -> None:
        self.repo = repo

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

    async def enforce(self, interaction: discord.Interaction, command: str, config: dict[str, Any], *, member: Optional[discord.Member] = None, value: Optional[str] = None) -> None:
        if not config:
            return
        if not config.get("enabled", True):
            raise ActionRefused(f"`/{command}` is disabled for this server. A server manager can turn it back on from the AHOY dashboard.")
        user = interaction.user
        actor = user if isinstance(user, discord.Member) else None
        role_ids = {str(r.id) for r in getattr(actor, "roles", [])}
        denied = set(config.get("denied_role_ids") or [])
        if denied & role_ids:
            raise ActionRefused("One of your roles is blocked from using this command here.")
        allowed = set(config.get("allowed_role_ids") or [])
        if allowed and not (allowed & role_ids):
            raise ActionRefused("This command is limited to specific roles in this server.")
        permission = config.get("required_permission") or "none"
        if permission != "none" and actor is not None and not getattr(actor.guild_permissions, permission, False):
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
                raise ActionRefused("This command can only be used in " + (", ".join(places) or "other channels") + ".")
        if member is not None:
            protected_users = set(config.get("protected_user_ids") or [])
            protected_roles = set(config.get("protected_role_ids") or [])
            target_roles = {str(r.id) for r in getattr(member, "roles", [])}
            if str(member.id) in protected_users or (protected_roles & target_roles):
                raise ActionRefused(f"{member.mention} is protected from this command.")
        if config.get("require_reason") and not (value or "").strip():
            raise ActionRefused("This command needs a reason — re-run it and fill in the `value` field.")
        cooldown = int(config.get("cooldown_seconds") or 0)
        if cooldown > 0 and interaction.guild:
            last = await self.repo.command_cooldown_at(str(interaction.guild.id), command, str(user.id))
            if last:
                try:
                    last_dt = datetime.fromisoformat(str(last).replace("Z", "+00:00"))
                except ValueError:
                    last_dt = None
                if last_dt:
                    elapsed = (datetime.now(timezone.utc) - last_dt).total_seconds()
                    if elapsed < cooldown:
                        raise ActionRefused(f"That command is on cooldown — try again in {int(cooldown - elapsed)}s.")
        rate_limit = int(config.get("rate_limit_per_minute") or 0)
        if rate_limit > 0 and interaction.guild:
            since = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
            used = await self.repo.command_uses_since(str(interaction.guild.id), command, str(user.id), since)
            if used >= rate_limit:
                raise ActionRefused(f"You've hit the limit of {rate_limit} use(s) per minute for this command.")

    @staticmethod
    def apply_custom_response(interaction: discord.Interaction, embed: discord.Embed, config: dict[str, Any], *, command: str, value: Optional[str]) -> discord.Embed:
        template = (config or {}).get("custom_response")
        if not template:
            return embed
        guild_name = interaction.guild.name if interaction.guild else "this server"
        embed.description = str(template).replace("{user}", interaction.user.mention).replace("{server}", guild_name).replace("{command}", f"/{command}").replace("{value}", value or "")[:4000]
        return embed

    @staticmethod
    def _fill(template: str, interaction: discord.Interaction, command: str, value: Optional[str]) -> str:
        guild_name = interaction.guild.name if interaction.guild else "this server"
        return str(template).replace("{user}", interaction.user.mention).replace("{server}", guild_name).replace("{command}", f"/{command}").replace("{value}", value or "")

    async def _confirm(self, interaction: discord.Interaction, command: str, target: str) -> bool:
        view = _ConfirmView(str(interaction.user.id))
        await interaction.followup.send(embed=embeds.info(f"/{command}", f"Confirm this action{target}. This prompt expires in 30 seconds."), view=view, ephemeral=True)
        await view.wait()
        return view.confirmed

    async def _record(self, interaction: discord.Interaction, guild: discord.Guild, *, command: str, category: str, kind: str, member: Optional[discord.Member], value: Optional[str], config: dict[str, Any], outcome: str, detail: str) -> None:
        """Emit database audit data and a complete human-readable audit-channel entry."""
        if not config.get("log_event", True):
            return
        guild_id = str(guild.id)
        source_channel = interaction.channel
        channel_id = str(getattr(source_channel, "id", "") or "") or None
        channel_name = getattr(source_channel, "name", None) or "DM / Unknown channel"
        actor = interaction.user
        actor_tag = str(actor)
        actor_display = getattr(actor, "display_name", None) or getattr(actor, "global_name", None) or actor_tag
        target_display = None
        target_tag = None
        if member:
            target_display = getattr(member, "display_name", None) or str(member)
            target_tag = str(member)
        category_name = getattr(source_channel, "category", None)
        metadata = {
            "command": command,
            "category": category,
            "kind": kind,
            "outcome": outcome,
            "actor_name": actor_tag,
            "actor_display_name": actor_display,
            "target_name": target_tag,
            "target_display_name": target_display,
            "value": value,
            "summary": detail,
            "guild_name": guild.name,
            "guild_id": guild_id,
            "channel_name": channel_name,
            "channel_id": channel_id,
            "channel_category": getattr(category_name, "name", None),
            "actor_id": str(actor.id),
            "target_id": str(member.id) if member else None,
            "timestamp": _now(),
        }
        try:
            event_id = await self.repo.emit_event({
                "guild_id": guild_id, "event_type": f"command.{kind}.{outcome}", "actor_id": str(actor.id),
                "target_id": str(member.id) if member else None, "resource_type": "command", "resource_id": command,
                "channel_id": channel_id, "source": "discord", "metadata": metadata,
            })
            await self.repo.write_audit_log({
                "guild_id": guild_id, "event_id": event_id, "action": f"{command} ({outcome})", "actor_id": str(actor.id),
                "target_id": str(member.id) if member else None, "resource_type": "command", "resource_id": command,
                "reason": value or None, "metadata": metadata,
            })
        except Exception:
            log.warning("Could not write audit trail for /%s", command, exc_info=True)

        log_id = config.get("log_channel_id")
        notify_id = config.get("notify_channel_id")
        role_id = config.get("notify_role_id")
        entry = discord.Embed(
            title=f"⚓ /{command} · {outcome.upper()}",
            description=f"{detail}",
            colour=discord.Colour.from_rgb(32, 199, 183),
            timestamp=datetime.now(timezone.utc),
        )
        entry.add_field(name="👤 Actor", value=f"{actor_display} • {actor.mention}\nID: `{actor.id}`", inline=True)
        entry.add_field(name="🏴 Server", value=f"{guild.name}\nID: `{guild.id}`", inline=True)
        entry.add_field(name="💬 Channel", value=f"{channel_name} • <#{channel_id}>\nID: `{channel_id or 'N/A'}`", inline=True)
        entry.add_field(name="🎯 Target", value=(f"{target_display} • {member.mention}\nID: `{member.id}`" if member else "None"), inline=True)
        entry.add_field(name="🧭 Category / Kind", value=f"{category} / {kind}", inline=True)
        entry.add_field(name="📝 Value / Reason", value=(value or "None")[:1024], inline=True)
        entry.add_field(name="📌 Details", value=detail[:1024], inline=False)
        entry.add_field(name="🕒 Timestamp", value=f"<t:{int(datetime.now(timezone.utc).timestamp())}:F>\n<t:{int(datetime.now(timezone.utc).timestamp())}:R>", inline=False)
        entry.set_footer(text="!HOY BOT • Detailed Audit Trail")

        for target_id, mention in ((log_id, None), (notify_id, role_id)):
            if not target_id:
                continue
            try:
                channel = guild.get_channel(int(target_id))
            except (TypeError, ValueError):
                channel = None
            if channel is None or not hasattr(channel, "send"):
                log.warning("Audit destination channel %s is unavailable in guild %s", target_id, guild.id)
                continue
            try:
                await channel.send(content=(f"<@&{mention}>" if mention else None), embed=entry, allowed_mentions=discord.AllowedMentions(roles=True))
            except discord.HTTPException:
                log.warning("Could not post /%s audit log to %s", command, target_id, exc_info=True)

    async def run(self, interaction: discord.Interaction, *, command: str, category: str, category_title: str, sub: str, kind: str, description: str, member: Optional[discord.Member], value: Optional[str]) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message("This command only works inside a server.", ephemeral=True)
            return
        guild_id = str(guild.id)
        config = await self.config(guild_id, command)
        visibility = (config.get("response_visibility") or "inherit") if config else "inherit"
        ephemeral = True if visibility == "private" else False if visibility == "public" else bool(config.get("ephemeral", True)) if config else True
        await interaction.response.defer(ephemeral=ephemeral)
        try:
            await self.enforce(interaction, command, config, member=member, value=value)
            if config.get("require_confirmation") and kind in WRITE_KINDS:
                target = f" on {member.mention}" if member else ""
                if not await self._confirm(interaction, command, target):
                    await self._record(interaction, guild, command=command, category=category, kind=kind, member=member, value=value, config=config, outcome="cancelled", detail="Cancelled at the confirmation prompt.")
                    return
            embed = await self.execute(interaction, command=command, category=category, category_title=category_title, sub=sub, kind=kind, description=description, member=member, value=value, config=config)
        except ActionRefused as exc:
            template = (config or {}).get("error_response")
            message = self._fill(template, interaction, command, value) if template else str(exc)
            await interaction.followup.send(embed=embeds.error(f"/{command}", message), ephemeral=True)
            await self._record(interaction, guild, command=command, category=category, kind=kind, member=member, value=value, config=config, outcome="blocked", detail=message)
            return
        except Exception as exc:
            log.exception("Feature command /%s failed", command)
            await interaction.followup.send(embed=embeds.error(f"/{command}", f"The command failed: {type(exc).__name__}: {exc}"), ephemeral=True)
            await self._record(interaction, guild, command=command, category=category, kind=kind, member=member, value=value, config=config, outcome="error", detail=f"{type(exc).__name__}: {exc}")
            return
        await interaction.followup.send(embed=self.apply_custom_response(interaction, embed, config, command=command, value=value), ephemeral=ephemeral)
        await self._record(interaction, guild, command=command, category=category, kind=kind, member=member, value=value, config=config, outcome="success", detail=embed.description or "Command completed successfully.")

    async def execute(self, interaction: discord.Interaction, *, command: str, category: str, category_title: str, sub: str, kind: str, description: str, member: Optional[discord.Member], value: Optional[str], config: dict[str, Any]) -> discord.Embed:
        """Dispatch into the generated command implementation."""
        return await self._execute_generated(interaction, command=command, category=category, category_title=category_title, sub=sub, kind=kind, description=description, member=member, value=value, config=config)

    async def _execute_generated(self, interaction: discord.Interaction, *, command: str, category: str, category_title: str, sub: str, kind: str, description: str, member: Optional[discord.Member], value: Optional[str], config: dict[str, Any]) -> discord.Embed:
        # The generated implementation is loaded by the command library at runtime.
        # This method is intentionally kept as the service boundary.
        return embeds.info(f"/{command}", description)
