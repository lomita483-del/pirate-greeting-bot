"""Roll Call — role-gated attendance panels covering event pings, daily
check-in streaks, and inactivity audits, all built on the same
"post an embed with a Present button" mechanic."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

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


async def _is_roll_call_manager(bot: commands.Bot, member: discord.Member) -> bool:
    if member.guild_permissions.manage_guild or member.guild_permissions.administrator:
        return True
    settings = await bot.repo.roll_call_settings(str(member.guild.id))  # type: ignore[attr-defined]
    manager_role_ids = set(settings.get("manager_role_ids") or [])
    if not manager_role_ids:
        return False
    member_role_ids = {str(r.id) for r in member.roles}
    return bool(member_role_ids.intersection(manager_role_ids))


def _open_embed(roll_call: dict[str, Any], target_roles: list[discord.Role]) -> discord.Embed:
    mode = str(roll_call.get("mode") or "event")
    closes_at = roll_call.get("closes_at")
    stamp = None
    if closes_at:
        try:
            stamp = int(datetime.fromisoformat(str(closes_at).replace("Z", "+00:00")).timestamp())
        except ValueError:
            stamp = None

    lines = [roll_call.get("description") or "Click **Present** to check in."]
    if target_roles:
        lines.append("")
        lines.append("**Called:** " + ", ".join(r.mention for r in target_roles))
    if stamp:
        lines.append("")
        lines.append(f"⏰ Closes <t:{stamp}:R> (<t:{stamp}:f>)")

    embed = discord.Embed(
        title=f"{MODE_EMOJI.get(mode, '📋')} {roll_call.get('title') or MODE_LABEL.get(mode, 'Roll Call')}",
        description="\n".join(lines),
        color=GOLD,
        timestamp=datetime.now(timezone.utc),
    )
    embed.set_footer(text=f"AHOY Roll Call · {MODE_LABEL.get(mode, mode.title())}")
    return embed


class RollCallView(discord.ui.View):
    """Persistent 'Present' button. One instance per open roll call, keyed
    by roll_call_id in the custom_id so it survives a bot restart via
    restore_persistent_views()."""

    def __init__(self, bot: commands.Bot, roll_call_id: str) -> None:
        super().__init__(timeout=None)
        self.bot = bot
        self.roll_call_id = roll_call_id
        button: discord.ui.Button = discord.ui.Button(
            label="Present",
            emoji="✅",
            style=discord.ButtonStyle.success,
            custom_id=_button_custom_id(roll_call_id),
        )
        button.callback = self._on_click  # type: ignore[assignment]
        self.add_item(button)

    async def _on_click(self, interaction: discord.Interaction) -> None:
        repo = self.bot.repo  # type: ignore[attr-defined]
        roll_call = await repo.get_roll_call(self.roll_call_id)
        if not roll_call:
            raise ActionRefused("This roll call no longer exists.")
        if roll_call.get("status") != "open":
            raise ActionRefused("This roll call has already closed.")

        member = interaction.user
        created = await repo.add_roll_call_response(
            self.roll_call_id, str(member.id), str(member)
        )

        if not created:
            await interaction.response.send_message(
                embed=embeds.info("Already checked in", "You've already been marked present here."),
                ephemeral=True,
            )
            return

        if roll_call.get("mode") == "daily":
            streak = await _bump_streak(repo, str(interaction.guild_id), str(member.id), str(member))
            await interaction.response.send_message(
                embed=embeds.success(
                    "Checked in ✅",
                    f"Current streak: **{streak['current_streak']} day"
                    f"{'s' if streak['current_streak'] != 1 else ''}** "
                    f"(best: {streak['longest_streak']}).",
                ),
                ephemeral=True,
            )
        else:
            await interaction.response.send_message(
                embed=embeds.success("Marked present ✅", "Thanks for checking in."),
                ephemeral=True,
            )


async def _bump_streak(repo: Any, guild_id: str, user_id: str, username: str) -> dict[str, Any]:
    current = await repo.get_streak(guild_id, user_id)
    now = datetime.now(timezone.utc)
    last = current.get("last_checked_in_at")
    streak = int(current.get("current_streak") or 0)
    longest = int(current.get("longest_streak") or 0)

    gap_days: int | None
    if last:
        try:
            last_dt = datetime.fromisoformat(str(last).replace("Z", "+00:00"))
            gap_days = (now.date() - last_dt.date()).days
        except ValueError:
            gap_days = 999
    else:
        gap_days = None

    if gap_days is None:
        streak = 1
    elif gap_days == 0:
        pass  # already checked in today (shouldn't normally happen — one roll call/day)
    elif gap_days == 1:
        streak += 1
    else:
        streak = 1  # missed at least one day — streak resets

    longest = max(longest, streak)
    payload = {
        "guild_id": guild_id,
        "user_id": user_id,
        "username": username,
        "current_streak": streak,
        "longest_streak": longest,
        "last_checked_in_at": now.isoformat(),
    }
    await repo.save_streak(payload)
    return payload


async def build_results_embed(
    bot: commands.Bot, guild: discord.Guild, roll_call: dict[str, Any]
) -> discord.Embed:
    repo = bot.repo  # type: ignore[attr-defined]
    responses = await repo.roll_call_responses(roll_call["id"])
    responded_ids = {str(r["user_id"]) for r in responses}

    target_role_ids = roll_call.get("target_role_ids") or []
    target_roles = [guild.get_role(int(rid)) for rid in target_role_ids]
    target_roles = [r for r in target_roles if r is not None]

    called_members: set[discord.Member] = set()
    if target_roles:
        for role in target_roles:
            called_members.update(m for m in role.members if not m.bot)
    else:
        called_members = {m for m in guild.members if not m.bot}

    missed = sorted(
        (m for m in called_members if str(m.id) not in responded_ids),
        key=lambda m: m.display_name.lower(),
    )

    mode = str(roll_call.get("mode") or "event")
    embed = discord.Embed(
        title=f"📊 {roll_call.get('title')} — Results",
        color=GOLD,
        timestamp=datetime.now(timezone.utc),
    )
    embed.add_field(name="Responded", value=f"**{len(responses)}** member(s)", inline=True)
    embed.add_field(name="Called", value=f"**{len(called_members)}** member(s)", inline=True)

    if mode == "audit":
        text = (
            "\n".join(f"• {m.mention}" for m in missed[:40]) if missed else "Everyone checked in. 🎉"
        )
        if len(missed) > 40:
            text += f"\n…and {len(missed) - 40} more."
        embed.add_field(name=f"Never responded ({len(missed)})", value=text[:1024], inline=False)
    else:
        text = (
            "\n".join(f"• {m.mention}" for m in missed[:25]) if missed else "Everyone responded! 🎉"
        )
        if len(missed) > 25:
            text += f"\n…and {len(missed) - 25} more."
        embed.add_field(name=f"Did not respond ({len(missed)})", value=text[:1024], inline=False)

    embed.set_footer(text=f"AHOY Roll Call · {MODE_LABEL.get(mode, mode.title())}")

    if mode == "daily" and missed:
        # Missing a daily check-in resets that member's streak (audits have
        # no streak logic — they're a presence check only).
        for member in missed:
            current = await repo.get_streak(str(guild.id), str(member.id))
            if int(current.get("current_streak") or 0) > 0:
                await repo.save_streak(
                    {
                        "guild_id": str(guild.id),
                        "user_id": str(member.id),
                        "username": str(member),
                        "current_streak": 0,
                        "longest_streak": int(current.get("longest_streak") or 0),
                        "last_checked_in_at": current.get("last_checked_in_at"),
                    }
                )

    return embed


class RollCall(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    rollcall_group = app_commands.Group(
        name="rollcall", description="Post an attendance roll call with a Present button."
    )

    @rollcall_group.command(name="start", description="Start a new roll call.")
    @app_commands.describe(
        mode="What kind of roll call this is.",
        title="Title shown on the roll call panel.",
        description="Extra detail shown under the title.",
        duration_hours="How long it stays open before auto-closing.",
        target_role="Only ping/track this role (optional — defaults to everyone).",
        channel="Where to post it (defaults to this channel).",
    )
    @app_commands.choices(
        mode=[
            app_commands.Choice(name="Event / Raid Attendance", value="event"),
            app_commands.Choice(name="Daily Check-In Streak", value="daily"),
            app_commands.Choice(name="Inactivity Audit", value="audit"),
        ]
    )
    @app_commands.guild_only()
    async def start(
        self,
        interaction: discord.Interaction,
        mode: app_commands.Choice[str],
        title: str,
        description: str | None = None,
        duration_hours: float = 2.0,
        target_role: discord.Role | None = None,
        channel: discord.TextChannel | None = None,
    ) -> None:
        guild = ensure_guild(interaction)
        member = interaction.user
        if not isinstance(member, discord.Member):
            raise ActionRefused("This only works inside a server.")

        settings = await self.bot.repo.roll_call_settings(str(guild.id))  # type: ignore[attr-defined]
        if not settings.get("enabled"):
            raise ActionRefused(
                "Roll Call is disabled here. Enable it in the AHOY Control Center first."
            )
        if not await _is_roll_call_manager(self.bot, member):
            raise ActionRefused("You need a configured Roll Call Manager role to do that.")

        target_channel = channel or interaction.channel
        if not isinstance(target_channel, discord.TextChannel):
            raise ActionRefused("Pick a text channel to post the roll call in.")

        duration_hours = max(0.25, min(duration_hours, 24 * 14))
        opens_at = datetime.now(timezone.utc)
        closes_at = opens_at + timedelta(hours=duration_hours)

        repo = self.bot.repo  # type: ignore[attr-defined]
        roll_call = await repo.create_roll_call(
            {
                "guild_id": str(guild.id),
                "mode": mode.value,
                "title": title[:200],
                "description": (description or "")[:1500] or None,
                "channel_id": str(target_channel.id),
                "target_role_ids": [str(target_role.id)] if target_role else [],
                "opens_at": opens_at.isoformat(),
                "closes_at": closes_at.isoformat(),
                "status": "open",
                "created_by": str(member.id),
            }
        )

        embed = _open_embed(roll_call, [target_role] if target_role else [])
        view = RollCallView(self.bot, roll_call["id"])
        self.bot.add_view(view)

        content = target_role.mention if target_role else None
        message = await target_channel.send(
            content=content,
            embed=embed,
            view=view,
            allowed_mentions=discord.AllowedMentions(roles=True, everyone=False, users=False),
        )
        await repo.set_roll_call_message(roll_call["id"], str(message.id))

        await interaction.response.send_message(
            embed=embeds.success(
                "Roll call started",
                f"Posted in {target_channel.mention}, closes <t:{int(closes_at.timestamp())}:R>.",
            ),
            ephemeral=True,
        )

    @rollcall_group.command(name="close", description="Close a roll call early and post results.")
    @app_commands.describe(message="The roll call message link or ID to close early.")
    @app_commands.guild_only()
    async def close(self, interaction: discord.Interaction, message: str) -> None:
        guild = ensure_guild(interaction)
        member = interaction.user
        if not isinstance(member, discord.Member) or not await _is_roll_call_manager(
            self.bot, member
        ):
            raise ActionRefused("You need a configured Roll Call Manager role to do that.")

        message_id = message.strip().split("/")[-1]
        repo = self.bot.repo  # type: ignore[attr-defined]
        roll_call = await repo.get_roll_call_by_message(str(guild.id), message_id)
        if not roll_call:
            raise ActionRefused("Could not find an open roll call for that message.")
        if roll_call.get("status") != "open":
            raise ActionRefused("That roll call is already closed.")

        await interaction.response.defer(ephemeral=True)
        await self._close_roll_call(guild, roll_call)
        await interaction.followup.send(
            embed=embeds.success("Roll call closed", "Results have been posted."), ephemeral=True
        )

    async def _close_roll_call(self, guild: discord.Guild, roll_call: dict[str, Any]) -> None:
        repo = self.bot.repo  # type: ignore[attr-defined]
        results_embed = await build_results_embed(self.bot, guild, roll_call)
        channel = guild.get_channel(int(roll_call["channel_id"]))
        if isinstance(channel, discord.TextChannel):
            try:
                await channel.send(embed=results_embed)
            except discord.HTTPException as exc:
                log.warning("Failed to post roll call results: %s", exc)
        await repo.close_roll_call(roll_call["id"])

    async def restore_persistent_views(self) -> None:
        try:
            rows = await self.bot.repo.active_roll_calls()  # type: ignore[attr-defined]
        except Exception:
            log.exception("Failed to load open roll calls during startup.")
            return
        restored = 0
        for row in rows:
            try:
                self.bot.add_view(RollCallView(self.bot, str(row["id"])))
                restored += 1
            except Exception:
                log.exception("Failed restoring roll call view %s", row.get("id"))
        log.info("Restored %s persistent roll call panel(s).", restored)


async def setup(bot: commands.Bot) -> None:
    cog = RollCall(bot)
    await bot.add_cog(cog)
    await cog.restore_persistent_views()
