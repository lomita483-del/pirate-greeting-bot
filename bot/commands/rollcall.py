"""Roll call — one system, three modes.

* ``event``  — one-off attendance check that auto-closes and reports who
  answered and who (from the pinged roles) did not.
* ``daily``  — recurring check-in; each click extends a per-member streak
  (a skipped day resets it). Streaks surface on Statahoy user cards.
* ``audit``  — long-running inactivity presence check; the closing report
  lists exactly who in the target role(s) never clicked.

The ✅ Present button uses one static custom_id and resolves the roll call
from the message it lives on, so buttons keep working after a restart the
same way ticket panels do.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import discord
from discord import app_commands
from discord.ext import commands

from ..utils import embeds
from ..utils.checks import ActionRefused, ensure_guild
from ..utils.logger import get_logger

log = get_logger("rollcall")

PRESENT_CUSTOM_ID = "ahoy:rollcall:present"

MODE_LABELS = {
    "event": "Event attendance",
    "daily": "Daily check-in",
    "audit": "Inactivity audit",
}
MODE_DEFAULT_HOURS = {"event": 2, "daily": 20, "audit": 168}


def _parse_iso(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def roll_call_embed(row: dict[str, Any], *, responses: int = 0) -> discord.Embed:
    mode = str(row.get("mode") or "event")
    closes = _parse_iso(row.get("closes_at"))
    embed = embeds.brand(
        f"📣 ROLL CALL · {MODE_LABELS.get(mode, 'Roll call')}",
        row.get("description") or "Tap **✅ Present** below to be counted.",
    )
    embed.add_field(name="Roll call", value=str(row.get("title") or "Roll call"), inline=False)
    if closes:
        embed.add_field(
            name="Closes",
            value=f"<t:{int(closes.timestamp())}:R> · <t:{int(closes.timestamp())}:f>",
            inline=False,
        )
    roles = row.get("target_role_ids") or []
    if roles:
        embed.add_field(
            name="Called", value=" ".join(f"<@&{rid}>" for rid in roles[:10]), inline=False
        )
    embed.add_field(name="Present so far", value=f"**{responses}**", inline=False)
    return embed


def results_embed(
    row: dict[str, Any],
    present: list[str],
    missing: list[str],
) -> discord.Embed:
    mode = str(row.get("mode") or "event")
    embed = embeds.brand(
        f"📋 ROLL CALL RESULTS · {MODE_LABELS.get(mode, 'Roll call')}",
        str(row.get("title") or "Roll call"),
    )
    embed.add_field(name="Present", value=f"**{len(present)}**")
    if mode != "daily":
        embed.add_field(name="No response", value=f"**{len(missing)}**")

    def _names(ids: list[str]) -> str:
        if not ids:
            return "Nobody."
        shown = " ".join(f"<@{i}>" for i in ids[:40])
        extra = len(ids) - 40
        return shown + (f" … and {extra} more" if extra > 0 else "")

    embed.add_field(name="Answered", value=_names(present), inline=False)
    if mode != "daily":
        embed.add_field(name="Never answered", value=_names(missing), inline=False)
    return embed


class RollCallView(discord.ui.View):
    """Persistent ✅ Present button."""

    def __init__(self) -> None:
        super().__init__(timeout=None)

    @discord.ui.button(
        label="Present",
        emoji="✅",
        style=discord.ButtonStyle.success,
        custom_id=PRESENT_CUSTOM_ID,
    )
    async def present(
        self, interaction: discord.Interaction, _button: discord.ui.Button
    ) -> None:
        bot = interaction.client
        repo = getattr(bot, "repo", None)
        if repo is None or interaction.message is None or interaction.guild is None:
            await interaction.response.send_message(
                "This roll call is unavailable right now.", ephemeral=True
            )
            return

        row = await repo.roll_call_by_message(str(interaction.message.id))
        if not row:
            await interaction.response.send_message(
                "I can no longer find this roll call.", ephemeral=True
            )
            return
        if str(row.get("status")) != "open":
            await interaction.response.send_message(
                "This roll call is already closed.", ephemeral=True
            )
            return

        recorded = await repo.add_roll_call_response(
            str(row["id"]),
            str(interaction.guild.id),
            str(interaction.user.id),
            str(interaction.user),
        )
        note = "You're marked present ✅" if recorded else "You were already marked present."

        if str(row.get("mode")) == "daily" and recorded:
            streak = await repo.bump_roll_call_streak(
                str(interaction.guild.id), str(interaction.user.id)
            )
            note += f"\nCheck-in streak: **{int(streak.get('current_streak') or 1)}** day(s)."

        await interaction.response.send_message(note, ephemeral=True)

        try:
            responses = await repo.roll_call_responses(str(row["id"]))
            await interaction.message.edit(
                embed=roll_call_embed(row, responses=len(responses)), view=self
            )
        except discord.HTTPException:
            pass


async def close_roll_call(bot: commands.Bot, row: dict[str, Any]) -> None:
    """Close a roll call and post its results back to the channel."""
    repo = bot.repo  # type: ignore[attr-defined]
    responses = await repo.roll_call_responses(str(row["id"]))
    present = [str(r.get("user_id")) for r in responses]

    guild = bot.get_guild(int(row["guild_id"])) if row.get("guild_id") else None
    missing: list[str] = []
    if guild and str(row.get("mode")) != "daily":
        targets = [str(rid) for rid in (row.get("target_role_ids") or [])]
        members: list[discord.Member] = []
        if targets:
            for member in guild.members:
                if any(str(role.id) in targets for role in member.roles) and not member.bot:
                    members.append(member)
        else:
            members = [m for m in guild.members if not m.bot]
        missing = [str(m.id) for m in members if str(m.id) not in present]

    await repo.close_roll_call(
        str(row["id"]),
        {"present": present, "missing": missing, "present_count": len(present)},
    )

    channel = bot.get_channel(int(row["channel_id"])) if row.get("channel_id") else None
    if isinstance(channel, (discord.TextChannel, discord.Thread)):
        try:
            await channel.send(embed=results_embed(row, present, missing))
        except discord.HTTPException as exc:
            log.warning("Could not post roll call results: %s", exc)

    if guild and row.get("message_id"):
        try:
            message = await channel.fetch_message(int(row["message_id"]))  # type: ignore[union-attr]
            closed = roll_call_embed(row, responses=len(present))
            closed.title = f"🔒 {closed.title}"
            await message.edit(embed=closed, view=None)
        except (discord.HTTPException, AttributeError, ValueError):
            pass


async def post_roll_call(
    bot: commands.Bot,
    guild: discord.Guild,
    channel: discord.abc.Messageable,
    row: dict[str, Any],
) -> Optional[discord.Message]:
    repo = bot.repo  # type: ignore[attr-defined]
    content = " ".join(f"<@&{rid}>" for rid in (row.get("target_role_ids") or [])) or None
    try:
        message = await channel.send(
            content=content, embed=roll_call_embed(row), view=RollCallView()
        )
    except discord.HTTPException as exc:
        log.warning("Could not post roll call in %s: %s", guild.id, exc)
        return None
    await repo.set_roll_call_message(str(row["id"]), str(message.id))
    return message


class RollCall(commands.Cog):
    """/rollcall — presence checks, streaks and inactivity audits."""

    rollcall = app_commands.Group(
        name="rollcall", description="Run presence checks and daily check-ins."
    )

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    async def _settings(self, guild_id: str) -> dict[str, Any]:
        return await self.bot.settings.get(guild_id)  # type: ignore[attr-defined]

    async def _ensure_manager(self, interaction: discord.Interaction) -> dict[str, Any]:
        guild = ensure_guild(interaction)
        settings = await self._settings(str(guild.id))
        if not settings.get("rollcall_enabled", False):
            raise ActionRefused("Roll call is switched off for this server — enable it in the dashboard.")

        member = interaction.user
        if not isinstance(member, discord.Member):
            raise ActionRefused("This command only works inside a server.")
        if member.guild_permissions.manage_guild or member.id == guild.owner_id:
            return settings

        allowed = {str(r) for r in (settings.get("rollcall_manager_roles") or [])}
        if allowed and any(str(role.id) in allowed for role in member.roles):
            return settings
        raise ActionRefused("Only Roll Call Managers can do that.")

    @rollcall.command(name="start", description="Start a roll call.")
    @app_commands.describe(
        mode="Event attendance, daily check-in or inactivity audit",
        title="Short title, e.g. 'Friday raid'",
        description="Extra detail shown in the roll call message",
        hours="How long it stays open (hours)",
        role="Role being called (optional)",
        second_role="Another role being called (optional)",
        channel="Where to post it (defaults to the configured roll call channel)",
    )
    @app_commands.choices(
        mode=[
            app_commands.Choice(name="Event attendance", value="event"),
            app_commands.Choice(name="Daily check-in", value="daily"),
            app_commands.Choice(name="Inactivity audit", value="audit"),
        ]
    )
    @app_commands.guild_only()
    async def start(
        self,
        interaction: discord.Interaction,
        mode: app_commands.Choice[str],
        title: app_commands.Range[str, 1, 120],
        description: Optional[app_commands.Range[str, 1, 900]] = None,
        hours: Optional[app_commands.Range[int, 1, 720]] = None,
        role: Optional[discord.Role] = None,
        second_role: Optional[discord.Role] = None,
        channel: Optional[discord.TextChannel] = None,
    ) -> None:
        guild = ensure_guild(interaction)
        settings = await self._ensure_manager(interaction)
        await interaction.response.defer(ephemeral=True)

        target = channel
        if target is None:
            configured = settings.get("rollcall_channel_id")
            resolved = guild.get_channel(int(configured)) if configured else None
            target = resolved if isinstance(resolved, discord.TextChannel) else None
        if target is None and isinstance(interaction.channel, discord.TextChannel):
            target = interaction.channel
        if target is None:
            raise ActionRefused("Pick a channel to post the roll call in.")

        window = hours or MODE_DEFAULT_HOURS.get(mode.value, 2)
        closes = datetime.now(timezone.utc) + timedelta(hours=window)
        roles = [str(r.id) for r in (role, second_role) if r is not None]

        repo = self.bot.repo  # type: ignore[attr-defined]
        row = await repo.create_roll_call(
            {
                "guild_id": str(guild.id),
                "mode": mode.value,
                "title": str(title),
                "description": description,
                "channel_id": str(target.id),
                "target_role_ids": roles,
                "closes_at": closes.isoformat(),
                "status": "open",
                "created_by": str(interaction.user.id),
            }
        )
        if not row:
            raise ActionRefused("Could not create that roll call. Please try again.")

        message = await post_roll_call(self.bot, guild, target, row)
        if message is None:
            raise ActionRefused(f"I could not post in {target.mention}.")

        await interaction.followup.send(
            embed=embeds.success(
                "Roll call started",
                f"**{title}** is live in {target.mention} and closes <t:{int(closes.timestamp())}:R>.",
            ),
            ephemeral=True,
        )

    @rollcall.command(name="close", description="Close the newest open roll call now.")
    @app_commands.guild_only()
    async def close(self, interaction: discord.Interaction) -> None:
        guild = ensure_guild(interaction)
        await self._ensure_manager(interaction)
        await interaction.response.defer(ephemeral=True)
        repo = self.bot.repo  # type: ignore[attr-defined]
        rows = [r for r in await repo.recent_roll_calls(str(guild.id), 25) if r.get("status") == "open"]
        if not rows:
            raise ActionRefused("There is no open roll call in this server.")
        await close_roll_call(self.bot, rows[0])
        await interaction.followup.send(
            embed=embeds.success("Roll call closed", "Results have been posted."), ephemeral=True
        )

    @rollcall.command(name="results", description="Show results for the newest roll call.")
    @app_commands.guild_only()
    async def results(self, interaction: discord.Interaction) -> None:
        guild = ensure_guild(interaction)
        await interaction.response.defer(ephemeral=True)
        repo = self.bot.repo  # type: ignore[attr-defined]
        rows = await repo.recent_roll_calls(str(guild.id), 1)
        if not rows:
            raise ActionRefused("No roll call has been run in this server yet.")
        row = rows[0]
        results = row.get("results") or {}
        responses = await repo.roll_call_responses(str(row["id"]))
        present = [str(r.get("user_id")) for r in responses]
        missing = [str(u) for u in (results.get("missing") or [])]
        await interaction.followup.send(embed=results_embed(row, present, missing), ephemeral=True)

    @rollcall.command(name="streak", description="Show a daily check-in streak.")
    @app_commands.describe(member="Whose streak to show (defaults to you)")
    @app_commands.guild_only()
    async def streak(
        self, interaction: discord.Interaction, member: Optional[discord.Member] = None
    ) -> None:
        guild = ensure_guild(interaction)
        target = member or interaction.user
        await interaction.response.defer()
        repo = self.bot.repo  # type: ignore[attr-defined]
        data = await repo.get_roll_call_streak(str(guild.id), str(target.id))
        board = await repo.roll_call_streak_leaderboard(str(guild.id), 10)

        embed = embeds.brand(
            f"{getattr(target, 'display_name', 'Member')} · check-in streak",
            f"Current **{int(data.get('current_streak') or 0)}** day(s) · best **{int(data.get('longest_streak') or 0)}**.",
        )
        if board:
            embed.add_field(
                name="Top streaks",
                value="\n".join(
                    f"**{i}.** <@{r.get('user_id')}> — {int(r.get('current_streak') or 0)} day(s)"
                    for i, r in enumerate(board, 1)
                ),
                inline=False,
            )
        await interaction.followup.send(embed=embed)

    async def restore_persistent_roll_calls(self) -> None:
        """Nothing per-message to rebuild — one static view covers them all."""
        repo = getattr(self.bot, "repo", None)
        if repo is None:
            return
        try:
            open_calls = await repo.open_roll_calls()
        except Exception as exc:  # pragma: no cover
            log.warning("Could not read open roll calls: %s", exc)
            return
        log.info("Roll call view restored for %d open roll call(s).", len(open_calls))


async def setup(bot: commands.Bot) -> None:
    cog = RollCall(bot)
    await bot.add_cog(cog)
    bot.add_view(RollCallView())
    await cog.restore_persistent_roll_calls()
