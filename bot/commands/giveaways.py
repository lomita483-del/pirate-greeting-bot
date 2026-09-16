"""Advanced giveaway system with persistent button entry and weighted winners."""

from __future__ import annotations

import re
import secrets
from datetime import datetime, timezone
from typing import Any

import discord
from discord import app_commands
from discord.ext import commands, tasks

from ..utils import embeds
from ..utils.checks import ActionRefused, ensure_guild, ensure_permission
from ..utils.logger import get_logger
from ..utils.parsing import DurationError, clean_text, humanize, parse_duration

log = get_logger("giveaways")
ENTRY_EMOJI = "🎉"


def _utc() -> datetime:
    return datetime.now(timezone.utc)


class GiveawayView(discord.ui.View):
    """Persistent entry controls; buttons remain usable after bot restarts."""

    def __init__(self, cog: "Giveaways", giveaway_id: str):
        super().__init__(timeout=None)
        self.cog = cog
        self.giveaway_id = giveaway_id
        enter = discord.ui.Button(label="Enter Giveaway", emoji=ENTRY_EMOJI, style=discord.ButtonStyle.success, custom_id=f"giveaway:enter:{giveaway_id}")
        leave = discord.ui.Button(label="Leave Giveaway", emoji="🚪", style=discord.ButtonStyle.secondary, custom_id=f"giveaway:leave:{giveaway_id}")
        enter.callback = self.enter_callback  # type: ignore[assignment]
        leave.callback = self.leave_callback  # type: ignore[assignment]
        self.add_item(enter)
        self.add_item(leave)

    async def enter_callback(self, interaction: discord.Interaction) -> None:
        await self.cog.handle_entry(interaction, self.giveaway_id, entering=True)

    async def leave_callback(self, interaction: discord.Interaction) -> None:
        await self.cog.handle_entry(interaction, self.giveaway_id, entering=False)


class Giveaways(commands.Cog):
    group = app_commands.Group(name="giveaway", description="Run advanced prize giveaways.", guild_only=True)

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self.draw_due.start()
        self.restore_views.start()

    async def cog_unload(self) -> None:
        self.draw_due.cancel()
        self.restore_views.cancel()

    @group.command(name="start", description="Start an advanced giveaway with requirements and weighted entries.")
    @app_commands.describe(
        prize="What is being given away",
        duration="How long it runs, e.g. 30m, 2h, 1d",
        winners="How many winners to draw (1-20)",
        channel="Channel to host it in",
        description="Extra giveaway details",
        required_role="Role a member must have to enter",
        bonus_role="Role that receives extra winning weight",
        bonus_entries="Extra winning weight for the bonus role (1-10)",
        min_account_age_days="Minimum Discord account age in days",
    )
    async def start(
        self,
        interaction: discord.Interaction,
        prize: str,
        duration: str,
        winners: app_commands.Range[int, 1, 20] = 1,
        channel: discord.TextChannel | None = None,
        description: str | None = None,
        required_role: discord.Role | None = None,
        bonus_role: discord.Role | None = None,
        bonus_entries: app_commands.Range[int, 1, 10] = 2,
        min_account_age_days: app_commands.Range[int, 0, 3650] = 0,
    ) -> None:
        guild = ensure_guild(interaction)
        ensure_permission(interaction, "manage_guild")
        try:
            delta = parse_duration(duration)
        except DurationError as exc:
            raise ActionRefused(str(exc)) from exc
        if delta.total_seconds() < 30:
            raise ActionRefused("Giveaways must run for at least 30 seconds.")
        if required_role and required_role.is_default():
            raise ActionRefused("@everyone cannot be used as a required giveaway role.")
        if bonus_role and bonus_role.is_default():
            raise ActionRefused("@everyone cannot be used as a bonus giveaway role.")

        target = channel or interaction.channel
        if not isinstance(target, discord.TextChannel):
            raise ActionRefused("Giveaways can only run in text channels.")
        me = guild.me
        if me and (not target.permissions_for(me).send_messages or not target.permissions_for(me).embed_links):
            raise ActionRefused("I need Send Messages and Embed Links in the giveaway channel.")

        await interaction.response.defer(ephemeral=True)
        ends_at = _utc() + delta
        prize_text = clean_text(prize, 200)
        detail = clean_text(description or "Enter below for your chance to win!", 1000)
        requirements: list[str] = []
        if required_role:
            requirements.append(f"Required role: {required_role.mention}")
        if min_account_age_days:
            requirements.append(f"Account age: {min_account_age_days}+ days")
        if bonus_role:
            requirements.append(f"Bonus: {bonus_role.mention} = {bonus_entries}x entry weight")
        requirement_text = "\n".join(requirements) if requirements else "No special requirements."

        embed = embeds.brand(
            f"🎁 Giveaway · {prize_text}",
            f"{detail}\n\n**Winners:** {winners}\n**Entries:** 0\n"
            f"**Ends:** {discord.utils.format_dt(ends_at, 'R')} ({discord.utils.format_dt(ends_at, 'f')})\n\n"
            f"**Requirements**\n{requirement_text}\n\nHosted by: {interaction.user.mention}",
        )
        try:
            message = await target.send(embed=embed)
        except discord.HTTPException as exc:
            raise ActionRefused("I could not post the giveaway in that channel.") from exc

        row = await self.bot.repo.create_giveaway({
            "guild_id": str(guild.id),
            "channel_id": str(target.id),
            "message_id": str(message.id),
            "prize": prize_text,
            "winner_count": int(winners),
            "ends_at": ends_at.isoformat(),
            "host_id": str(interaction.user.id),
            "host_name": str(interaction.user),
            "settings": {
                "description": detail,
                "required_role_id": str(required_role.id) if required_role else None,
                "bonus_role_id": str(bonus_role.id) if bonus_role else None,
                "bonus_entries": int(bonus_entries),
                "min_account_age_days": int(min_account_age_days),
                "entry_mode": "button",
            },
        })
        giveaway_id = str(row.get("id"))
        self.bot.add_view(GiveawayView(self, giveaway_id), message_id=message.id)
        try:
            await message.edit(view=GiveawayView(self, giveaway_id))
        except discord.HTTPException:
            pass
        await interaction.followup.send(
            embed=embeds.success("Giveaway started", f"**{prize_text}** in {target.mention}. Ends in **{humanize(int(delta.total_seconds()))}**."),
            ephemeral=True,
        )

    @group.command(name="end", description="End a running giveaway and draw winners now.")
    @app_commands.describe(message_id="Giveaway message ID; defaults to the latest giveaway")
    async def end(self, interaction: discord.Interaction, message_id: str | None = None) -> None:
        guild = ensure_guild(interaction); ensure_permission(interaction, "manage_guild")
        await interaction.response.defer(ephemeral=True)
        row = await self._find(str(guild.id), message_id)
        if row.get("status") != "running": raise ActionRefused("That giveaway has already ended.")
        await self._conclude(row)
        await interaction.followup.send(embed=embeds.success("Giveaway ended", "Winners have been announced."), ephemeral=True)

    @group.command(name="cancel", description="Cancel a running giveaway without selecting winners.")
    @app_commands.describe(message_id="Giveaway message ID; defaults to the latest giveaway")
    async def cancel(self, interaction: discord.Interaction, message_id: str | None = None) -> None:
        guild = ensure_guild(interaction); ensure_permission(interaction, "manage_guild")
        await interaction.response.defer(ephemeral=True)
        row = await self._find(str(guild.id), message_id)
        if row.get("status") != "running": raise ActionRefused("That giveaway is not running.")
        await self.bot.repo.update_giveaway(row["id"], {"status": "cancelled"})
        channel = self.bot.get_channel(int(row["channel_id"]))
        if isinstance(channel, discord.TextChannel):
            try:
                message = await channel.fetch_message(int(row["message_id"]))
                await message.edit(view=None, content="🎁 **Giveaway cancelled.**")
            except discord.HTTPException: pass
        await interaction.followup.send(embed=embeds.success("Giveaway cancelled", "No winner was selected."), ephemeral=True)

    @group.command(name="reroll", description="Reroll winners for a finished giveaway.")
    @app_commands.describe(message_id="Giveaway message ID; defaults to the latest giveaway")
    async def reroll(self, interaction: discord.Interaction, message_id: str | None = None) -> None:
        guild = ensure_guild(interaction); ensure_permission(interaction, "manage_guild")
        await interaction.response.defer(ephemeral=True)
        row = await self._find(str(guild.id), message_id)
        if row.get("status") == "running": raise ActionRefused("That giveaway is still running — use `/giveaway end` first.")
        if row.get("status") == "cancelled": raise ActionRefused("Cancelled giveaways cannot be rerolled.")
        await self._conclude(row, reroll=True)
        await interaction.followup.send(embed=embeds.success("Giveaway rerolled", "New eligible winners have been announced."), ephemeral=True)

    @group.command(name="list", description="List recent giveaways for this server.")
    async def list(self, interaction: discord.Interaction) -> None:
        guild = ensure_guild(interaction); ensure_permission(interaction, "manage_guild")
        rows = await self._list(str(guild.id))
        if not rows:
            await interaction.response.send_message(embed=embeds.info("Giveaways", "No giveaways have been created yet."), ephemeral=True); return
        lines = [f"• **{r.get('prize', 'Prize')}** — `{r.get('status', 'unknown')}` — {r.get('winner_count', 1)} winner(s) — `{r.get('message_id', 'n/a')}`" for r in rows[:10]]
        await interaction.response.send_message(embed=embeds.brand("🎁 Recent giveaways", "\n".join(lines)), ephemeral=True)

    async def handle_entry(self, interaction: discord.Interaction, giveaway_id: str, *, entering: bool) -> None:
        if interaction.guild is None or not isinstance(interaction.user, discord.Member):
            await interaction.response.send_message("This giveaway can only be entered from the server.", ephemeral=True); return
        row = await self._get_by_id(giveaway_id)
        if not row or row.get("status") != "running":
            await interaction.response.send_message("This giveaway is no longer running.", ephemeral=True); return
        if datetime.fromisoformat(str(row["ends_at"]).replace("Z", "+00:00")) <= _utc():
            await interaction.response.send_message("This giveaway has ended. The winner draw is being processed.", ephemeral=True); return
        settings = row.get("settings") or {}
        if entering:
            reason = self._eligibility_error(interaction.user, settings)
            if reason:
                await interaction.response.send_message(f"You cannot enter: {reason}", ephemeral=True); return
            bonus_role = settings.get("bonus_role_id")
            weight = int(settings.get("bonus_entries") or 2) if bonus_role and any(r.id == int(bonus_role) for r in interaction.user.roles) else 1
            await self._db_upsert_entry(giveaway_id, str(interaction.user.id), weight)
            await interaction.response.send_message(f"🎉 You are entered! Your winning weight is **{weight}x**.", ephemeral=True)
        else:
            await self._db_delete_entry(giveaway_id, str(interaction.user.id))
            await interaction.response.send_message("🚪 You have left the giveaway.", ephemeral=True)
        await self._refresh_message(row)

    @staticmethod
    def _eligibility_error(member: discord.Member, settings: dict[str, Any]) -> str | None:
        required = settings.get("required_role_id")
        if required and not any(r.id == int(required) for r in member.roles): return "you do not have the required role."
        minimum = int(settings.get("min_account_age_days") or 0)
        if minimum and (_utc() - member.created_at).total_seconds() < minimum * 86400: return f"your Discord account must be at least {minimum} days old."
        return None

    async def _find(self, guild_id: str, message_id: str | None) -> dict:
        row = await self.bot.repo.get_giveaway_by_message(message_id) if message_id else await self.bot.repo.latest_giveaway(guild_id)
        if not row or row.get("guild_id") != guild_id: raise ActionRefused("I could not find a giveaway for this server.")
        return row

    async def _get_by_id(self, giveaway_id: str) -> dict:
        result = await self.bot.db.try_run(lambda c: c.table("giveaways").select("*").eq("id", giveaway_id).limit(1).execute())
        rows = getattr(result, "data", None) or []; return rows[0] if rows else {}

    async def _list(self, guild_id: str) -> list[dict]:
        result = await self.bot.db.try_run(lambda c: c.table("giveaways").select("*").eq("guild_id", guild_id).order("created_at", desc=True).limit(20).execute())
        return getattr(result, "data", None) or []

    async def _db_upsert_entry(self, giveaway_id: str, user_id: str, weight: int) -> None:
        await self.bot.db.run(lambda c: c.table("giveaway_entries").upsert({"giveaway_id": giveaway_id, "user_id": user_id, "weight": max(1, min(weight, 10)), "updated_at": _utc().isoformat()}, on_conflict="giveaway_id,user_id").execute())

    async def _db_delete_entry(self, giveaway_id: str, user_id: str) -> None:
        await self.bot.db.try_run(lambda c: c.table("giveaway_entries").delete().eq("giveaway_id", giveaway_id).eq("user_id", user_id).execute())

    async def _db_entries(self, giveaway_id: str) -> list[dict]:
        result = await self.bot.db.try_run(lambda c: c.table("giveaway_entries").select("*").eq("giveaway_id", giveaway_id).limit(50000).execute())
        return getattr(result, "data", None) or []

    async def _refresh_message(self, row: dict) -> None:
        channel = self.bot.get_channel(int(row["channel_id"]))
        if not isinstance(channel, discord.TextChannel) or not row.get("message_id"): return
        try:
            message = await channel.fetch_message(int(row["message_id"]))
            embed = message.embeds[0].copy() if message.embeds else embeds.brand(f"🎁 Giveaway · {row.get('prize', 'Prize')}", "")
            entries = await self._db_entries(str(row["id"]))
            if embed.description:
                embed.description = re.sub(r"\*\*Entries:\*\* \d+", f"**Entries:** {len(entries)}", embed.description)
            await message.edit(embed=embed, view=GiveawayView(self, str(row["id"])))
        except discord.HTTPException: pass

    @tasks.loop(seconds=20)
    async def draw_due(self) -> None:
        repo = getattr(self.bot, "repo", None)
        if repo is None or not self.bot.db.connected: return
        try:
            for row in await repo.due_giveaways(): await self._conclude(row)
        except Exception as exc: log.exception("Giveaway draw failed: %s", exc)

    @draw_due.before_loop
    async def before_draw(self) -> None: await self.bot.wait_until_ready()

    @tasks.loop(count=1)
    async def restore_views(self) -> None:
        await self.bot.wait_until_ready()
        try:
            for row in await self._list_running_all():
                if row.get("message_id"): self.bot.add_view(GiveawayView(self, str(row["id"])), message_id=int(row["message_id"]))
        except Exception as exc: log.exception("Failed to restore giveaway buttons: %s", exc)

    @restore_views.before_loop
    async def before_restore_views(self) -> None: await self.bot.wait_until_ready()

    async def _list_running_all(self) -> list[dict]:
        result = await self.bot.db.try_run(lambda c: c.table("giveaways").select("*").eq("status", "running").limit(1000).execute())
        return getattr(result, "data", None) or []

    async def _conclude(self, row: dict, *, reroll: bool = False) -> None:
        repo = self.bot.repo
        channel = self.bot.get_channel(int(row["channel_id"]))
        if not isinstance(channel, discord.TextChannel):
            await repo.update_giveaway(row["id"], {"status": "cancelled"}); return
        entries = await self._db_entries(str(row["id"]))
        if not entries and row.get("message_id"): entries = await self._legacy_reaction_entries(channel, row)
        excluded = set(row.get("winner_ids") or []) if reroll else set()
        pool = [(str(e["user_id"]), max(1, int(e.get("weight") or 1))) for e in entries if str(e["user_id"]) not in excluded]
        count = min(int(row.get("winner_count", 1)), len(pool)); winners: list[str] = []
        for _ in range(count):
            if not pool: break
            total = sum(weight for _, weight in pool); pick = secrets.randbelow(total); selected = 0; chosen_index = 0
            for index, (_, weight) in enumerate(pool):
                selected += weight
                if pick < selected: chosen_index = index; break
            winners.append(pool.pop(chosen_index)[0])
        prize = row.get("prize", "a prize")
        if winners:
            mentions = ", ".join(f"<@{uid}>" for uid in winners)
            result_embed = embeds.brand(f"🎉 Giveaway {'rerolled' if reroll else 'ended'} · {prize}", f"**Winner{'s' if len(winners) > 1 else ''}:** {mentions}\n**Entries:** {len(entries)}")
        else:
            result_embed = embeds.warning(f"Giveaway ended · {prize}", "Nobody eligible entered, so there is no winner.")
        try:
            await channel.send(embed=result_embed)
            if row.get("message_id"):
                message = await channel.fetch_message(int(row["message_id"])); await message.edit(view=None)
        except discord.HTTPException as exc: log.warning("Could not announce giveaway %s: %s", row.get("id"), exc)
        await repo.update_giveaway(row["id"], {"status": "ended", "winner_ids": winners})

    async def _legacy_reaction_entries(self, channel: discord.TextChannel, row: dict) -> list[dict]:
        try: message = await channel.fetch_message(int(row["message_id"]))
        except discord.HTTPException: return []
        for reaction in message.reactions:
            if str(reaction.emoji) == ENTRY_EMOJI:
                return [{"user_id": str(user.id), "weight": 1} async for user in reaction.users() if not user.bot]
        return []


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Giveaways(bot))
