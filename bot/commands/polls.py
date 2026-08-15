"""Reaction-based polls with live vote counts and timed results."""

from __future__ import annotations

from datetime import datetime, timezone

import discord
from discord import app_commands
from discord.ext import commands, tasks

from ..utils import embeds
from ..utils.checks import ActionRefused, ensure_guild, ensure_permission
from ..utils.logger import get_logger
from ..utils.parsing import DurationError, clean_text, humanize, parse_duration

log = get_logger("polls")

NUMBERS = ("1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟")


def split_options(raw: str) -> list[str]:
    parts = [clean_text(part, 100) for part in raw.split("|")]
    options = [part for part in parts if part]
    if len(options) < 2:
        raise ActionRefused("Give at least two options, separated by `|`.")
    if len(options) > 10:
        raise ActionRefused("A poll can have at most 10 options.")
    return options


def render(row: dict, counts: list[int], *, closed: bool = False) -> discord.Embed:
    options: list[str] = list(row.get("options") or [])
    total = sum(counts) or 0
    lines = []
    for index, option in enumerate(options):
        votes = counts[index] if index < len(counts) else 0
        share = (votes / total) if total else 0
        bar = "█" * round(share * 12) or "▁"
        lines.append(
            f"{NUMBERS[index]} **{option}**\n`{bar:<12}` {votes} vote"
            f"{'' if votes == 1 else 's'} · {round(share * 100)}%"
        )

    footer = f"\n\n**Total votes:** {total}"
    if closed:
        winner = max(range(len(options)), key=lambda i: counts[i] if i < len(counts) else 0, default=None)
        result = (
            f"\n**Winner:** {options[winner]}" if total and winner is not None else "\n_No votes were cast._"
        )
        return embeds.brand(f"📊 Poll closed · {row.get('question', '')}", "\n\n".join(lines) + footer + result)

    ends_at = row.get("ends_at")
    when = ""
    if ends_at:
        due = datetime.fromisoformat(str(ends_at).replace("Z", "+00:00"))
        when = f"\n**Closes:** {discord.utils.format_dt(due, 'R')}"
    return embeds.brand(
        f"📊 {row.get('question', '')}",
        "\n\n".join(lines) + footer + when + "\n_React below to vote._",
    )


class Polls(commands.Cog):
    group = app_commands.Group(name="poll", description="Run server polls.", guild_only=True)

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self.close_due.start()

    async def cog_unload(self) -> None:
        self.close_due.cancel()

    @group.command(name="create", description="Post a poll with up to 10 options.")
    @app_commands.describe(
        question="The question to ask",
        options="Options separated by | e.g. Yes | No | Maybe",
        duration="Optional auto-close time, e.g. 30m, 2h, 1d",
        channel="Channel to post in (defaults to this one)",
    )
    async def create(
        self,
        interaction: discord.Interaction,
        question: str,
        options: str,
        duration: str | None = None,
        channel: discord.TextChannel | None = None,
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "manage_messages")
        choices = split_options(options)

        ends_at = None
        if duration:
            try:
                delta = parse_duration(duration)
            except DurationError as exc:
                raise ActionRefused(str(exc)) from exc
            ends_at = datetime.now(timezone.utc) + delta

        target = channel or interaction.channel
        if not isinstance(target, discord.TextChannel):
            raise ActionRefused("Polls can only run in text channels.")

        await interaction.response.defer(ephemeral=True)
        row = {
            "guild_id": str(guild.id),
            "channel_id": str(target.id),
            "question": clean_text(question, 250),
            "options": choices,
            "ends_at": ends_at.isoformat() if ends_at else None,
            "created_by": str(interaction.user.id),
            "created_by_name": str(interaction.user),
        }
        try:
            message = await target.send(embed=render(row, [0] * len(choices)))
            for index in range(len(choices)):
                await message.add_reaction(NUMBERS[index])
        except discord.HTTPException as exc:
            raise ActionRefused("I could not post the poll in that channel.") from exc

        row["message_id"] = str(message.id)
        await self.bot.repo.create_poll(row)  # type: ignore[attr-defined]
        await interaction.followup.send(
            embed=embeds.success(
                "Poll posted",
                f"{target.mention} · {len(choices)} options"
                + (f", closing in **{humanize(int(delta.total_seconds()))}**" if ends_at else ""),
            ),
            ephemeral=True,
        )

    @group.command(name="end", description="Close a poll and post the results.")
    @app_commands.describe(message_id="Poll message ID (defaults to the latest one)")
    async def end(self, interaction: discord.Interaction, message_id: str | None = None) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "manage_messages")
        await interaction.response.defer(ephemeral=True)

        repo = self.bot.repo  # type: ignore[attr-defined]
        row = (
            await repo.get_poll_by_message(message_id)
            if message_id
            else await repo.latest_poll(str(guild.id))
        )
        if not row or row.get("guild_id") != str(guild.id):
            raise ActionRefused("I could not find a poll for this server.")
        if row.get("status") != "open":
            raise ActionRefused("That poll is already closed.")

        await self._close(row)
        await interaction.followup.send(
            embed=embeds.success("Poll closed", "Results have been posted."), ephemeral=True
        )

    # -- live updates --------------------------------------------------
    async def refresh(self, message_id: int) -> None:
        repo = getattr(self.bot, "repo", None)
        if repo is None:
            return
        row = await repo.get_poll_by_message(str(message_id))
        if not row or row.get("status") != "open":
            return
        message = await self._fetch(row)
        if message is None:
            return
        try:
            await message.edit(embed=render(row, self._counts(message, row)))
        except discord.HTTPException as exc:
            log.warning("Could not refresh poll %s: %s", row.get("id"), exc)

    def _counts(self, message: discord.Message, row: dict) -> list[int]:
        options = list(row.get("options") or [])
        tally = [0] * len(options)
        for reaction in message.reactions:
            emoji = str(reaction.emoji)
            if emoji in NUMBERS:
                index = NUMBERS.index(emoji)
                if index < len(tally):
                    tally[index] = max(reaction.count - 1, 0)
        return tally

    async def _fetch(self, row: dict) -> discord.Message | None:
        channel = self.bot.get_channel(int(row["channel_id"]))
        if not isinstance(channel, discord.TextChannel) or not row.get("message_id"):
            return None
        try:
            return await channel.fetch_message(int(row["message_id"]))
        except discord.HTTPException:
            return None

    @tasks.loop(seconds=30)
    async def close_due(self) -> None:
        repo = getattr(self.bot, "repo", None)
        if repo is None or not self.bot.db.connected:  # type: ignore[attr-defined]
            return
        try:
            for row in await repo.due_polls():
                await self._close(row)
        except Exception as exc:  # pragma: no cover - keep the loop alive
            log.exception("Poll close failed: %s", exc)

    @close_due.before_loop
    async def before_close(self) -> None:
        await self.bot.wait_until_ready()

    async def _close(self, row: dict) -> None:
        repo = self.bot.repo  # type: ignore[attr-defined]
        message = await self._fetch(row)
        counts = self._counts(message, row) if message else [0] * len(row.get("options") or [])
        summary = render(row, counts, closed=True)
        if message is not None:
            try:
                await message.edit(embed=summary)
                await message.channel.send(embed=summary)
            except discord.HTTPException as exc:
                log.warning("Could not publish poll results %s: %s", row.get("id"), exc)
        await repo.update_poll(
            row["id"],
            {"status": "closed", "votes": {str(i): c for i, c in enumerate(counts)}},
        )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Polls(bot))
