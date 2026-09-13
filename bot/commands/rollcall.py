"""Roll Call: event attendance, daily check-in streaks and inactivity audits."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

import discord
from discord import app_commands
from discord.ext import commands

from ..utils import embeds
from ..utils.checks import ActionRefused, ensure_guild
from ..utils.logger import get_logger

log = get_logger("rollcall")
SEA = 0x20C7B7
MODE_LABEL = {"event": "Event Attendance", "daily": "Daily Check-In", "audit": "Inactivity Audit"}
MODE_EMOJI = {"event": "🏴‍☠️", "daily": "🔥", "audit": "🔍"}
DEFAULT_BUTTONS = [{"id": "present", "label": "Present", "emoji": "✅", "style": "success", "purpose": "Record attendance"}]
STYLE_MAP = {"primary": discord.ButtonStyle.primary, "secondary": discord.ButtonStyle.secondary, "success": discord.ButtonStyle.success, "danger": discord.ButtonStyle.danger}


def _button_custom_id(roll_call_id: str, button_id: str) -> str:
    return f"ahoy:rollcall:{roll_call_id}:{button_id}"[:100]


def _buttons(roll_call: dict[str, Any]) -> list[dict[str, Any]]:
    raw = roll_call.get("buttons")
    if not isinstance(raw, list):
        return DEFAULT_BUTTONS.copy()
    result: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in raw[:5]:
        if not isinstance(item, dict):
            continue
        button_id = str(item.get("id") or "").strip().lower()
        label = str(item.get("label") or "").strip()
        purpose = str(item.get("purpose") or "").strip()
        if not button_id or not label or not purpose or button_id in seen:
            continue
        seen.add(button_id)
        result.append({"id": button_id, "label": label[:80], "emoji": str(item.get("emoji") or "")[:32] or None, "style": str(item.get("style") or "secondary"), "purpose": purpose[:200]})
    return result or DEFAULT_BUTTONS.copy()


async def _is_manager(bot: commands.Bot, member: discord.Member) -> bool:
    if member.guild_permissions.manage_guild or member.guild_permissions.administrator:
        return True
    settings = await bot.repo.roll_call_settings(str(member.guild.id))  # type: ignore[attr-defined]
    allowed = {str(x) for x in settings.get("manager_role_ids") or []}
    return bool(allowed.intersection(str(role.id) for role in member.roles))


def _parse_role_ids(value: str | None) -> list[str]:
    if not value:
        return []
    ids: list[str] = []
    for raw in value.replace(",", " ").split():
        role_id = raw.strip().strip("<@&>")
        if role_id.isdigit() and 5 <= len(role_id) <= 25 and role_id not in ids:
            ids.append(role_id)
    return ids[:25]


def _open_embed(roll_call: dict[str, Any], roles: list[discord.Role]) -> discord.Embed:
    mode = str(roll_call.get("mode") or "event")
    buttons = _buttons(roll_call)
    lines = [str(roll_call.get("description") or "Use the buttons below to respond.")]
    if buttons:
        lines += ["", "**Actions:** " + " · ".join(f"{b.get('emoji') or ''} **{b['label']}** — {b['purpose']}" for b in buttons)]
    if roles:
        lines += ["", "**Called:** " + ", ".join(role.mention for role in roles)]
    closes_at = roll_call.get("closes_at")
    if closes_at:
        try:
            stamp = int(datetime.fromisoformat(str(closes_at).replace("Z", "+00:00")).timestamp())
            lines += ["", f"⏰ Closes <t:{stamp}:R> (<t:{stamp}:f>)"]
        except ValueError:
            pass
    embed = discord.Embed(title=f"{MODE_EMOJI.get(mode, '📋')} {roll_call.get('title') or 'Roll Call'}", description="\n".join(lines), color=SEA, timestamp=datetime.now(timezone.utc))
    embed.set_footer(text=f"!HOY BOT · {MODE_LABEL.get(mode, mode.title())}")
    return embed


async def _server_today(repo: Any, guild_id: str) -> tuple[datetime, str]:
    rows = await repo.db.try_run(lambda c: c.table("server_settings").select("timezone").eq("guild_id", guild_id).limit(1).execute())
    timezone_name = ((getattr(rows, "data", None) or [{}])[0].get("timezone") or "UTC")
    try:
        tz = ZoneInfo(str(timezone_name))
    except Exception:
        tz = timezone.utc
    now = datetime.now(tz)
    return now, now.date().isoformat()


async def _save_response(bot: commands.Bot, roll_call_id: str, guild_id: str, member: discord.Member, button: dict[str, Any]) -> bool:
    repo = bot.repo  # type: ignore[attr-defined]
    existing = await repo.db.try_run(lambda c: c.table("roll_call_responses").select("id").eq("roll_call_id", roll_call_id).eq("user_id", str(member.id)).eq("button_id", str(button["id"])).limit(1).execute())
    if getattr(existing, "data", None):
        return False
    await repo.db.try_run(lambda c: c.table("roll_call_responses").insert({"roll_call_id": roll_call_id, "guild_id": guild_id, "user_id": str(member.id), "username": member.name, "display_name": member.display_name, "button_id": str(button["id"]), "button_label": str(button["label"]), "button_purpose": str(button["purpose"]), "responded_at": datetime.now(timezone.utc).isoformat()}).execute())
    return True


async def _bump_streak(repo: Any, guild_id: str, user_id: str, username: str, display_name: str) -> dict[str, Any]:
    current = await repo.get_streak(guild_id, user_id)
    now, today = await _server_today(repo, guild_id)
    last_day = current.get("last_checked_in_day")
    if not last_day and current.get("last_checked_in_at"):
        try:
            last_day = datetime.fromisoformat(str(current["last_checked_in_at"]).replace("Z", "+00:00")).date().isoformat()
        except ValueError:
            last_day = None
    streak = int(current.get("current_streak") or 0)
    longest = int(current.get("longest_streak") or 0)
    if last_day == today:
        return current
    if last_day:
        previous = datetime.fromisoformat(f"{last_day}T00:00:00+00:00").date()
        delta = (datetime.fromisoformat(f"{today}T00:00:00+00:00").date() - previous).days
        streak = streak + 1 if delta == 1 else 1
    else:
        streak = 1
    longest = max(longest, streak)
    payload = {"guild_id": guild_id, "user_id": user_id, "username": username, "current_streak": streak, "longest_streak": longest, "last_checked_in_at": now.astimezone(timezone.utc).isoformat(), "last_checked_in_day": today}
    await repo.save_streak(payload)
    return payload


class RollCallView(discord.ui.View):
    def __init__(self, bot: commands.Bot, roll_call_id: str, button_configs: list[dict[str, Any]] | None = None) -> None:
        super().__init__(timeout=None)
        self.bot = bot
        self.roll_call_id = roll_call_id
        configs = button_configs or DEFAULT_BUTTONS
        for config in configs[:5]:
            style = STYLE_MAP.get(str(config.get("style")), discord.ButtonStyle.secondary)
            button = discord.ui.Button(label=str(config.get("label") or "Action")[:80], emoji=str(config.get("emoji"))[:32] if config.get("emoji") else None, style=style, custom_id=_button_custom_id(roll_call_id, str(config.get("id") or "action")))
            button.callback = self._make_callback(str(config.get("id") or "action"))  # type: ignore[assignment]
            self.add_item(button)

    def _make_callback(self, button_id: str):
        async def callback(interaction: discord.Interaction) -> None:
            await self._on_click(interaction, button_id)
        return callback

    async def _on_click(self, interaction: discord.Interaction, button_id: str) -> None:
        repo = self.bot.repo  # type: ignore[attr-defined]
        roll_call = await repo.get_roll_call(self.roll_call_id)
        if not roll_call or roll_call.get("status") != "open":
            raise ActionRefused("This roll call has already closed or no longer exists.")
        if not isinstance(interaction.user, discord.Member) or interaction.guild is None:
            raise ActionRefused("This button can only be used inside the server.")
        config = next((item for item in _buttons(roll_call) if str(item["id"]) == button_id), None)
        if not config:
            raise ActionRefused("That Roll Call action is no longer available.")
        member = interaction.user
        created = await _save_response(self.bot, self.roll_call_id, str(interaction.guild.id), member, config)
        if not created:
            await interaction.response.send_message(embed=embeds.info("Already selected", f"You've already selected **{config['label']}** on this panel."), ephemeral=True)
            return
        if roll_call.get("mode") == "daily" and button_id == "present":
            streak = await _bump_streak(repo, str(interaction.guild.id), str(member.id), member.name, member.display_name)
            await interaction.response.send_message(embed=embeds.success(f"{config['label']} recorded", f"Current streak: **{streak.get('current_streak', 1)} day(s)** · Best: **{streak.get('longest_streak', 1)}**."), ephemeral=True)
        else:
            await interaction.response.send_message(embed=embeds.success(f"{config['label']} recorded", config["purpose"]), ephemeral=True)


async def _called_members(guild: discord.Guild, role_ids: list[str]) -> list[discord.Member]:
    members: dict[int, discord.Member] = {}
    roles = [guild.get_role(int(role_id)) for role_id in role_ids]
    for role in [r for r in roles if r is not None]:
        for member in role.members:
            if not member.bot:
                members[member.id] = member
    if not role_ids:
        members = {m.id: m for m in guild.members if not m.bot}
    return sorted(members.values(), key=lambda m: m.display_name.casefold())


def _pack_result_lines(lines: list[str], label: str, *, max_field_chars: int = 1000) -> list[tuple[str, str]]:
    if not lines:
        return [(label, "_None_")]
    fields: list[tuple[str, str]] = []
    current: list[str] = []
    current_len = 0
    part = 1
    for line in lines:
        extra = len(line) + (1 if current else 0)
        if current and current_len + extra > max_field_chars:
            suffix = f" · {part}" if part > 1 else ""
            fields.append((f"{label}{suffix}", "\n".join(current)))
            part += 1
            current = []
            current_len = 0
        current.append(line)
        current_len += len(line) + (1 if len(current) > 1 else 0)
    if current:
        suffix = f" · {part}" if part > 1 else ""
        fields.append((f"{label}{suffix}", "\n".join(current)))
    return fields


async def build_results_embeds(bot: commands.Bot, guild: discord.Guild, roll_call: dict[str, Any]) -> list[discord.Embed]:
    """Build the complete Roll Call result as one polished sea-glass embed."""
    repo = bot.repo  # type: ignore[attr-defined]
    responses = await repo.roll_call_responses(roll_call["id"])
    called = await _called_members(guild, [str(x) for x in roll_call.get("target_role_ids") or []])
    response_users = {str(r["user_id"]) for r in responses}
    missed = [m for m in called if str(m.id) not in response_users]
    mode = str(roll_call.get("mode") or "event")

    present_lines = []
    for row in responses:
        user_id = str(row.get("user_id") or "")
        if not user_id:
            continue
        display_name = str(row.get("display_name") or row.get("username") or "Unknown User")
        # Discord resolves this mention into the member's current clickable username/tag.
        present_lines.append(f"• **{display_name}** • <@{user_id}> — ✅")

    missed_lines = [f"• **{member.display_name}** • <@{member.id}> ❌" for member in missed]

    embed = discord.Embed(
        title=f"🌊 {roll_call.get('title') or 'Roll Call'} · Attendance Report",
        description="**ROLL CALL REPORT**\n\nA complete attendance report is provided below, showing the members called, those recorded as present, those who did not respond, and the exact closing time for this roll call.",
        color=SEA,
        timestamp=datetime.now(timezone.utc),
    )

    embed.add_field(name="📋 RESPONSES", value=f"**{len(responses)}** members responded\n**{len(missed)}** members didn't respond", inline=False)
    embed.add_field(name="👥 CALLED", value=f"**{len(called)}** members on the server", inline=False)
    embed.add_field(name="✅ PRESENT", value=f"**{len(response_users)}** users were recorded as present in this roll call out of **{len(called)}** users", inline=False)

    for field_name, field_value in _pack_result_lines(present_lines, "📝 LIST OF PRESENT USERS ✅"):
        embed.add_field(name=field_name, value=field_value, inline=False)

    for field_name, field_value in _pack_result_lines(missed_lines, "📝 LIST OF NON PRESENT USERS ❌"):
        embed.add_field(name=field_name, value=field_value, inline=False)

    closes_at = roll_call.get("closes_at")
    if closes_at:
        try:
            closed_at = datetime.fromisoformat(str(closes_at).replace("Z", "+00:00"))
            stamp = int(closed_at.timestamp())
            embed.add_field(
                name="⏱️ CLOSED",
                value=f"**Date:** <t:{stamp}:D>\n**Time:** <t:{stamp}:t>\n**Duration:** <t:{stamp}:R>",
                inline=False,
            )
        except ValueError:
            pass

    embed.set_footer(text=f"!HOY BOT  •  {MODE_LABEL.get(mode, mode.title())}  •  Secure attendance report")

    if mode == "daily" and missed:
        for member in missed:
            current = await repo.get_streak(str(guild.id), str(member.id))
            if int(current.get("current_streak") or 0) > 0:
                await repo.save_streak({"guild_id": str(guild.id), "user_id": str(member.id), "username": member.name, "current_streak": 0, "longest_streak": int(current.get("longest_streak") or 0), "last_checked_in_at": current.get("last_checked_in_at"), "last_checked_in_day": current.get("last_checked_in_day")})

    return [embed]


class RollCall(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    rollcall_group = app_commands.Group(name="rollcall", description="Attendance roll calls with configurable action buttons.")

    @rollcall_group.command(name="start", description="Start a new roll call.")
    @app_commands.describe(mode="Event, daily streak or inactivity audit", title="Roll call title", description="Description", duration_hours="Hours until close", target_roles="Role IDs or role mentions, comma-separated; leave blank for everyone", channel="Channel")
    @app_commands.choices(mode=[app_commands.Choice(name="Event / Raid Attendance", value="event"), app_commands.Choice(name="Daily Check-In Streak", value="daily"), app_commands.Choice(name="Inactivity Audit", value="audit")])
    @app_commands.guild_only()
    async def start(self, interaction: discord.Interaction, mode: app_commands.Choice[str], title: str, description: str | None = None, duration_hours: float = 2.0, target_roles: str | None = None, channel: discord.TextChannel | None = None) -> None:
        guild = ensure_guild(interaction)
        if not isinstance(interaction.user, discord.Member) or not await _is_manager(self.bot, interaction.user): raise ActionRefused("You need a configured Roll Call Manager role to do that.")
        settings = await self.bot.repo.roll_call_settings(str(guild.id))  # type: ignore[attr-defined]
        if not settings.get("enabled"): raise ActionRefused("Roll Call is disabled here. Enable it in the !HOY BOT Control Center first.")
        target_channel = channel or interaction.channel
        if not isinstance(target_channel, discord.TextChannel): target_channel = guild.get_channel(int(settings.get("default_channel_id") or 0))
        if not isinstance(target_channel, discord.TextChannel): raise ActionRefused("Select a text channel for the roll call.")
        role_ids = _parse_role_ids(target_roles); duration_hours = max(0.25, min(duration_hours, 336)); opens_at = datetime.now(timezone.utc); closes_at = opens_at + timedelta(hours=duration_hours); repo = self.bot.repo  # type: ignore[attr-defined]
        row = await repo.create_roll_call({"guild_id": str(guild.id), "mode": mode.value, "title": title[:200], "description": (description or "")[:1500] or None, "channel_id": str(target_channel.id), "target_role_ids": role_ids, "buttons": DEFAULT_BUTTONS, "opens_at": opens_at.isoformat(), "closes_at": closes_at.isoformat(), "status": "open", "created_by": str(interaction.user.id)})
        roles = [guild.get_role(int(x)) for x in role_ids]; roles = [r for r in roles if r is not None]; view = RollCallView(self.bot, str(row["id"]), _buttons(row)); self.bot.add_view(view)
        message = await target_channel.send(content=" ".join(r.mention for r in roles) or None, embed=_open_embed(row, roles), view=view, allowed_mentions=discord.AllowedMentions(roles=True, users=False, everyone=False)); await repo.set_roll_call_message(row["id"], str(message.id)); await interaction.response.send_message(embed=embeds.success("Roll call started", f"Posted in {target_channel.mention}; closes <t:{int(closes_at.timestamp())}:R>."), ephemeral=True)

    @rollcall_group.command(name="close", description="Close a roll call early and post results.")
    @app_commands.describe(message="Roll call message ID or Discord message URL")
    @app_commands.guild_only()
    async def close(self, interaction: discord.Interaction, message: str) -> None:
        guild = ensure_guild(interaction)
        if not isinstance(interaction.user, discord.Member) or not await _is_manager(self.bot, interaction.user): raise ActionRefused("You need a configured Roll Call Manager role to do that.")
        message_id = message.strip().split("/")[-1]; row = await self.bot.repo.get_roll_call_by_message(str(guild.id), message_id)  # type: ignore[attr-defined]
        if not row or row.get("status") != "open": raise ActionRefused("Could not find an open roll call for that message.")
        await interaction.response.defer(ephemeral=True); await self._close_roll_call(guild, row); await interaction.followup.send(embed=embeds.success("Roll call closed", "Results have been posted."), ephemeral=True)

    async def _close_roll_call(self, guild: discord.Guild, roll_call: dict[str, Any]) -> None:
        repo = self.bot.repo  # type: ignore[attr-defined]
        channel = guild.get_channel(int(roll_call["channel_id"]))
        if isinstance(channel, discord.TextChannel):
            result_embeds = await build_results_embeds(self.bot, guild, roll_call)
            for result_embed in result_embeds:
                await channel.send(embed=result_embed, allowed_mentions=discord.AllowedMentions(users=True, roles=False, everyone=False))
        await repo.close_roll_call(roll_call["id"])

    async def restore_persistent_views(self) -> None:
        rows = await self.bot.repo.active_roll_calls()  # type: ignore[attr-defined]
        for row in rows:
            try:
                self.bot.add_view(RollCallView(self.bot, str(row["id"]), _buttons(row)))
            except Exception:
                log.exception("Failed restoring roll call view %s", row.get("id"))


async def setup(bot: commands.Bot) -> None:
    cog = RollCall(bot)
    await bot.add_cog(cog)
    await cog.restore_persistent_views()
