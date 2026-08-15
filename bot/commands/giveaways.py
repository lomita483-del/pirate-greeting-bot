"""Timed giveaways with reaction entry and automatic winner draws."""

from __future__ import annotations

import random
from datetime import datetime, timezone

import discord
from discord import app_commands
from discord.ext import commands, tasks

from ..utils import embeds
from ..utils.checks import ActionRefused, ensure_guild, ensure_permission
from ..utils.logger import get_logger
from ..utils.parsing import DurationError, clean_text, humanize, parse_duration

log = get_logger("giveaways")

ENTRY_EMOJI = "🎉"


class Giveaways(commands.Cog):
    group = app_commands.Group(
        name="giveaway", description="Run prize giveaways.", guild_only=True
    )

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self.draw_due.start()

    async def cog_unload(self) -> None:
        self.draw_due.cancel()

    # -- commands ------------------------------------------------------
    @group.command(name="start", description="Start a giveaway in this channel.")
    @app_commands.describe(
        prize="What is being given away",
        duration="How long it runs, e.g. 30m, 2h, 1d",
        winners="How many winners to draw (1-20)",
        channel="Channel to host it in (defaults to this one)",
    )
    async def start(
        self,
        interaction: discord.Interaction,
        prize: str,
        duration: str,
        winners: app_commands.Range[int, 1, 20] = 1,
        channel: discord.TextChannel | None = None,
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "manage_guild")

        try:
            delta = parse_duration(duration)
        except DurationError as exc:
            raise ActionRefused(str(exc)) from exc

        target = channel or interaction.channel
        if not isinstance(target, discord.TextChannel):
            raise ActionRefused("Giveaways can only run in text channels.")

        await interaction.response.defer(ephemeral=True)
        ends_at = datetime.now(timezone.utc) + delta
        prize_text = clean_text(prize, 200)

        embed = embeds.brand(
            f"🎁 Giveaway · {prize_text}",
            f"React with {ENTRY_EMOJI} to enter!\n\n"
            f"**Winners:** {winners}\n"
            f"**Ends:** {discord.utils.format_dt(ends_at, 'R')} "
            f"({discord.utils.format_dt(ends_at, 'f')})\n"
            f"**Hosted by:** {interaction.user.mention}",
        )
        try:
            message = await target.send(embed=embed)
            await message.add_reaction(ENTRY_EMOJI)
        except discord.HTTPException as exc:
            raise ActionRefused("I could not post the giveaway in that channel.") from exc

        await self.bot.repo.create_giveaway(  # type: ignore[attr-defined]
            {
                "guild_id": str(guild.id),
                "channel_id": str(target.id),
                "message_id": str(message.id),
                "prize": prize_text,
                "winner_count": int(winners),
                "ends_at": ends_at.isoformat(),
                "host_id": str(interaction.user.id),
                "host_name": str(interaction.user),
            }
        )
        await interaction.followup.send(
            embed=embeds.success(
                "Giveaway started",
                f"**{prize_text}** in {target.mention}, ending in "
                f"**{humanize(int(delta.total_seconds()))}**.",
            ),
            ephemeral=True,
        )

    @group.command(name="end", description="End a running giveaway now.")
    @app_commands.describe(message_id="Giveaway message ID (defaults to the latest one)")
    async def end(self, interaction: discord.Interaction, message_id: str | None = None) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "manage_guild")
        await interaction.response.defer(ephemeral=True)

        row = await self._find(str(guild.id), message_id)
        if row.get("status") != "running":
            raise ActionRefused("That giveaway has already ended.")
        await self._conclude(row)
        await interaction.followup.send(
            embed=embeds.success("Giveaway ended", "Winners have been announced."), ephemeral=True
        )

    @group.command(name="reroll", description="Draw new winners for a finished giveaway.")
    @app_commands.describe(message_id="Giveaway message ID (defaults to the latest one)")
    async def reroll(
        self, interaction: discord.Interaction, message_id: str | None = None
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "manage_guild")
        await interaction.response.defer(ephemeral=True)

        row = await self._find(str(guild.id), message_id)
        if row.get("status") == "running":
            raise ActionRefused("That giveaway is still running — use `/giveaway end` first.")
        await self._conclude(row, reroll=True)
        await interaction.followup.send(
            embed=embeds.success("Giveaway rerolled", "New winners have been announced."),
            ephemeral=True,
        )

    async def _find(self, guild_id: str, message_id: str | None) -> dict:
        repo = self.bot.repo  # type: ignore[attr-defined]
        row = (
            await repo.get_giveaway_by_message(message_id)
            if message_id
            else await repo.latest_giveaway(guild_id)
        )
        if not row or row.get("guild_id") != guild_id:
            raise ActionRefused("I could not find a giveaway for this server.")
        return row

    # -- drawing -------------------------------------------------------
    @tasks.loop(seconds=30)
    async def draw_due(self) -> None:
        repo = getattr(self.bot, "repo", None)
        if repo is None or not self.bot.db.connected:  # type: ignore[attr-defined]
            return
        try:
            for row in await repo.due_giveaways():
                await self._conclude(row)
        except Exception as exc:  # pragma: no cover - keep the loop alive
            log.exception("Giveaway draw failed: %s", exc)

    @draw_due.before_loop
    async def before_draw(self) -> None:
        await self.bot.wait_until_ready()

    async def _conclude(self, row: dict, *, reroll: bool = False) -> None:
        repo = self.bot.repo  # type: ignore[attr-defined]
        channel = self.bot.get_channel(int(row["channel_id"]))
        if not isinstance(channel, discord.TextChannel):
            await repo.update_giveaway(row["id"], {"status": "cancelled"})
            return

        entrants = await self._entrants(channel, row)
        exclude = set(row.get("winner_ids") or []) if reroll else set()
        pool = [uid for uid in entrants if uid not in exclude]
        count = min(int(row.get("winner_count", 1)), len(pool))
        winners = random.sample(pool, count) if count else []

        prize = row.get("prize", "a prize")
        if winners:
            mentions = ", ".join(f"<@{uid}>" for uid in winners)
            embed = embeds.brand(
                f"🎉 Giveaway {'rerolled' if reroll else 'ended'} · {prize}",
                f"**Winner{'s' if len(winners) > 1 else ''}:** {mentions}\n"
                f"Entries: {len(entrants)}",
            )
        else:
            embed = embeds.warning(
                f"Giveaway ended · {prize}", "Nobody entered, so there is no winner."
            )

        try:
            await channel.send(embed=embed)
        except discord.HTTPException as exc:
            log.warning("Could not announce giveaway %s: %s", row.get("id"), exc)

        await repo.update_giveaway(
            row["id"], {"status": "ended", "winner_ids": winners}
        )

    async def _entrants(self, channel: discord.TextChannel, row: dict) -> list[str]:
        if not row.get("message_id"):
            return []
        try:
            message = await channel.fetch_message(int(row["message_id"]))
        except discord.HTTPException:
            return []
        for reaction in message.reactions:
            if str(reaction.emoji) != ENTRY_EMOJI:
                continue
            return [
                str(user.id)
                async for user in reaction.users()
                if not user.bot
            ]
        return []


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Giveaways(bot))
