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
GOLD = 0xD4AF37
MODE_LABEL = {"event": "Event Attendance", "daily": "Daily Check-In", "audit": "Inactivity Audit"}
MODE_EMOJI = {"event": "🏴‍☠️", "daily": "🔥", "audit": "🔍"}


def _button_custom_id(roll_call_id: str) -> str:
    return f"ahoy:rollcall:present:{roll_call_id}"


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
        value = raw.strip().strip("<@&>")
        if value.isdigit() and 5 <= len(value) <= 25 and value not in ids:
            ids.append(value)
    return ids[:25]


def _open_embed(roll_call: dict[str, Any], roles: list[discord.Role]) -> discord.Embed:
    mode = str(roll_call.get("mode") or "event")
    lines = [str(roll_call.get("description") or "Click **Present** to check in.")]
    if roles:
        lines += ["", "**Called:** " + ", ".join(role.mention for role in roles)]
    closes_at = roll_call.get("closes_at")
    if closes_at:
        try:
            stamp = int(datetime.fromisoformat(str(closes_at).replace("Z", "+00:00")).timestamp())
            lines += ["", f"⏰ Closes <t:{stamp}:R> (<t:{stamp}:f>)"]
        except ValueError:
            pass
    embed = discord.Embed(
        title=f"{MODE_EMOJI.get(mode, '📋')} {roll_call.get('title') or 'Roll Call'}",
        description="\n".join(lines), color=GOLD, timestamp=datetime.now(timezone.utc),
    )
    embed.set_footer(text=f"AHOY Roll Call · {MODE_LABEL.get(mode, mode.title())}")
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


async def _save_response(bot: commands.Bot, roll_call_id: str, guild_id: str, member: discord.Member) -> bool:
    repo = bot.repo  # type: ignore[attr-defined]
    existing = await repo.db.try_run(
        lambda c: c.table("roll_call_responses").select("id").eq("roll_call_id", roll_call_id).eq("user_id", str(member.id)).limit(1).execute()
    )
    if getattr(existing, "data", None):
        return False
    await repo.db.try_run(
        lambda c: c.table("roll_call_responses").insert({
            "roll_call_id": roll_call_id,
            "guild_id": guild_id,
            "user_id": str(member.id),
            "username": member.name,
            "display_name": member.display_name,
            "responded_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    )
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
    def __init__(self, bot: commands.Bot, roll_call_id: str) -> None:
        super().__init__(timeout=None)
        self.bot = bot
        self.roll_call_id = roll_call_id
        button = discord.ui.Button(label="Present", emoji="✅", style=discord.ButtonStyle.success, custom_id=_button_custom_id(roll_call_id))
        button.callback = self._on_click  # type: ignore[assignment]
        self.add_item(button)

    async def _on_click(self, interaction: discord.Interaction) -> None:
        repo = self.bot.repo  # type: ignore[attr-defined]
        roll_call = await repo.get_roll_call(self.roll_call_id)
        if not roll_call or roll_call.get("status") != "open":
            raise ActionRefused("This roll call has already closed or no longer exists.")
        if not isinstance(interaction.user, discord.Member) or interaction.guild is None:
            raise ActionRefused("This button can only be used inside the server.")
        member = interaction.user
        created = await _save_response(self.bot, self.roll_call_id, str(interaction.guild.id), member)
        if not created:
            await interaction.response.send_message(embed=embeds.info("Already checked in", "You've already been marked present here."), ephemeral=True)
            return
        if roll_call.get("mode") == "daily":
            streak = await _bump_streak(repo, str(interaction.guild.id), str(member.id), member.name, member.display_name)
            await interaction.response.send_message(embed=embeds.success("Checked in ✅", f"Current streak: **{streak.get('current_streak', 1)} day(s)** · Best: **{streak.get('longest_streak', 1)}**."), ephemeral=True)
        else:
            await interaction.response.send_message(embed=embeds.success("Marked present ✅", "Your attendance has been recorded."), ephemeral=True)


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


async def build_results_embeds(bot: commands.Bot, guild: discord.Guild, roll_call: dict[str, Any]) -> list[discord.Embed]:
    repo = bot.repo  # type: ignore[attr-defined]
    responses = await repo.roll_call_responses(roll_call["id"])
    responded_ids = {str(r["user_id"]) for r in responses}
    called = await _called_members(guild, [str(x) for x in roll_call.get("target_role_ids") or []])
    missed = [m for m in called if str(m.id) not in responded_ids]
    mode = str(roll_call.get("mode") or "event")

    def identity(row: dict[str, Any]) -> str:
        return f"• {row.get('display_name') or row.get('username') or row.get('user_id')} (@{row.get('username') or 'unknown'}) · `{row.get('user_id')}`"

    responder_lines = [identity(r) for r in responses]
    missed_lines = [f"• {m.display_name} (@{m.name}) · `{m.id}`" for m in missed]
    embeds_out: list[discord.Embed] = []
    base = discord.Embed(title=f"📊 {roll_call.get('title')} — Results", color=GOLD, timestamp=datetime.now(timezone.utc))
    base.add_field(name="Responded", value=f"**{len(responses)}**", inline=True)
    base.add_field(name="Called", value=f"**{len(called)}**", inline=True)
    base.add_field(name="Missed", value=f"**{len(missed)}**", inline=True)
    base.set_footer(text=f"AHOY Roll Call · {MODE_LABEL.get(mode, mode.title())}")
    embeds_out.append(base)

    def chunks(lines: list[str], size: int = 12) -> list[list[str]]:
        return [lines[i:i + size] for i in range(0, len(lines), size)] or [[]]

    for index, chunk in enumerate(chunks(responder_lines)):
        e = discord.Embed(title=f"Responders · {index + 1}/{max(1, len(chunks(responder_lines)))}", description="\n".join(chunk) or "Nobody checked in.", color=GOLD)
        embeds_out.append(e)
    for index, chunk in enumerate(chunks(missed_lines)):
        title = "Never responded" if mode == "audit" else "Did not respond"
        e = discord.Embed(title=f"{title} · {index + 1}/{max(1, len(chunks(missed_lines)))}", description="\n".join(chunk) or "Everyone checked in. 🎉", color=GOLD)
        embeds_out.append(e)

    if mode == "daily" and missed:
        for member in missed:
            current = await repo.get_streak(str(guild.id), str(member.id))
            if int(current.get("current_streak") or 0) > 0:
                await repo.save_streak({"guild_id": str(guild.id), "user_id": str(member.id), "username": member.name, "current_streak": 0, "longest_streak": int(current.get("longest_streak") or 0), "last_checked_in_at": current.get("last_checked_in_at"), "last_checked_in_day": current.get("last_checked_in_day")})
    return embeds_out


class RollCall(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    rollcall_group = app_commands.Group(name="rollcall", description="Attendance roll calls with a Present button.")

    @rollcall_group.command(name="start", description="Start a new roll call.")
    @app_commands.describe(mode="Event, daily streak or inactivity audit", title="Roll call title", description="Description", duration_hours="Hours until close", target_roles="Role IDs or role mentions, comma-separated; leave blank for everyone", channel="Channel")
    @app_commands.choices(mode=[app_commands.Choice(name="Event / Raid Attendance", value="event"), app_commands.Choice(name="Daily Check-In Streak", value="daily"), app_commands.Choice(name="Inactivity Audit", value="audit")])
    @app_commands.guild_only()
    async def start(self, interaction: discord.Interaction, mode: app_commands.Choice[str], title: str, description: str | None = None, duration_hours: float = 2.0, target_roles: str | None = None, channel: discord.TextChannel | None = None) -> None:
        guild = ensure_guild(interaction)
        if not isinstance(interaction.user, discord.Member) or not await _is_manager(self.bot, interaction.user):
            raise ActionRefused("You need a configured Roll Call Manager role to do that.")
        settings = await self.bot.repo.roll_call_settings(str(guild.id))  # type: ignore[attr-defined]
        if not settings.get("enabled"):
            raise ActionRefused("Roll Call is disabled here. Enable it in the AHOY Control Center first.")
        target_channel = channel or interaction.channel
        if not isinstance(target_channel, discord.TextChannel):
            target_channel = guild.get_channel(int(settings.get("default_channel_id") or 0))
        if not isinstance(target_channel, discord.TextChannel):
            raise ActionRefused("Select a text channel for the roll call.")
        role_ids = _parse_role_ids(target_roles)
        duration_hours = max(0.25, min(duration_hours, 336))
        opens_at = datetime.now(timezone.utc)
        closes_at = opens_at + timedelta(hours=duration_hours)
        repo = self.bot.repo  # type: ignore[attr-defined]
        row = await repo.create_roll_call({"guild_id": str(guild.id), "mode": mode.value, "title": title[:200], "description": (description or "")[:1500] or None, "channel_id": str(target_channel.id), "target_role_ids": role_ids, "opens_at": opens_at.isoformat(), "closes_at": closes_at.isoformat(), "status": "open", "created_by": str(interaction.user.id)})
        roles = [guild.get_role(int(x)) for x in role_ids]
        roles = [r for r in roles if r is not None]
        view = RollCallView(self.bot, str(row["id"]))
        self.bot.add_view(view)
        message = await target_channel.send(content=" ".join(r.mention for r in roles) or None, embed=_open_embed(row, roles), view=view, allowed_mentions=discord.AllowedMentions(roles=True, users=False, everyone=False))
        await repo.set_roll_call_message(row["id"], str(message.id))
        await interaction.response.send_message(embed=embeds.success("Roll call started", f"Posted in {target_channel.mention}; closes <t:{int(closes_at.timestamp())}:R>."), ephemeral=True)

    @rollcall_group.command(name="close", description="Close a roll call early and post results.")
    @app_commands.describe(message="Roll call message ID or Discord message URL")
    @app_commands.guild_only()
    async def close(self, interaction: discord.Interaction, message: str) -> None:
        guild = ensure_guild(interaction)
        if not isinstance(interaction.user, discord.Member) or not await _is_manager(self.bot, interaction.user):
            raise ActionRefused("You need a configured Roll Call Manager role to do that.")
        message_id = message.strip().split("/")[-1]
        row = await self.bot.repo.get_roll_call_by_message(str(guild.id), message_id)  # type: ignore[attr-defined]
        if not row or row.get("status") != "open":
            raise ActionRefused("Could not find an open roll call for that message.")
        await interaction.response.defer(ephemeral=True)
        await self._close_roll_call(guild, row)
        await interaction.followup.send(embed=embeds.success("Roll call closed", "Results have been posted."), ephemeral=True)

    async def _close_roll_call(self, guild: discord.Guild, roll_call: dict[str, Any]) -> None:
        repo = self.bot.repo  # type: ignore[attr-defined]
        for result_embed in await build_results_embeds(self.bot, guild, roll_call):
            channel = guild.get_channel(int(roll_call["channel_id"]))
            if isinstance(channel, discord.TextChannel):
                await channel.send(embed=result_embed)
        await repo.close_roll_call(roll_call["id"])

    async def restore_persistent_views(self) -> None:
        rows = await self.bot.repo.active_roll_calls()  # type: ignore[attr-defined]
        for row in rows:
            try:
                self.bot.add_view(RollCallView(self.bot, str(row["id"])))
            except Exception:
                log.exception("Failed restoring roll call view %s", row.get("id"))


async def setup(bot: commands.Bot) -> None:
    cog = RollCall(bot)
    await bot.add_cog(cog)
    await cog.restore_persistent_views()
