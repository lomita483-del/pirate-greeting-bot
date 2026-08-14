"""Optional virtual-currency economy. No real money is ever involved."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import discord
from discord import app_commands
from discord.ext import commands

from ..utils import embeds
from ..utils.checks import ActionRefused, ensure_guild


class Economy(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    async def _config(self, guild_id: str) -> dict:
        settings = await self.bot.repo.get_settings(guild_id)  # type: ignore[attr-defined]
        if not settings.get("economy_enabled"):
            raise ActionRefused(
                "The economy is disabled in this server. An administrator can enable "
                "it in the AHOY Control Center."
            )
        return settings

    async def _wallet(self, guild_id: str, user: discord.abc.User, settings: dict) -> dict:
        repo = self.bot.repo  # type: ignore[attr-defined]
        wallet = await repo.get_wallet(guild_id, str(user.id))
        if not wallet:
            wallet = {
                "guild_id": guild_id,
                "user_id": str(user.id),
                "username": user.name,
                "balance": int(settings.get("starting_balance", 100)),
                "bank": 0,
                "daily_streak": 0,
            }
            await repo.save_wallet(wallet)
        return wallet

    @app_commands.command(name="balance", description="Check a wallet balance.")
    @app_commands.guild_only()
    async def balance(
        self, interaction: discord.Interaction, member: discord.Member | None = None
    ) -> None:
        guild = ensure_guild(interaction)
        settings = await self._config(str(guild.id))
        target = member or interaction.user
        await interaction.response.defer()
        wallet = await self._wallet(str(guild.id), target, settings)
        currency = settings.get("currency_name", "Coins")
        symbol = settings.get("currency_symbol", "🪙")
        await interaction.followup.send(
            embed=embeds.brand(
                f"{target.display_name}'s wallet",
                f"{symbol} **{int(wallet.get('balance', 0)):,}** {currency}",
            )
        )

    @app_commands.command(name="daily", description="Claim your daily reward.")
    @app_commands.guild_only()
    async def daily(self, interaction: discord.Interaction) -> None:
        guild = ensure_guild(interaction)
        settings = await self._config(str(guild.id))
        await interaction.response.defer()

        repo = self.bot.repo  # type: ignore[attr-defined]
        wallet = await self._wallet(str(guild.id), interaction.user, settings)
        now = datetime.now(timezone.utc)
        last_raw = wallet.get("last_daily_at")
        streak = int(wallet.get("daily_streak", 0))

        if last_raw:
            last = datetime.fromisoformat(str(last_raw).replace("Z", "+00:00"))
            if now - last < timedelta(hours=24):
                remaining = timedelta(hours=24) - (now - last)
                hours, rem = divmod(int(remaining.total_seconds()), 3600)
                raise ActionRefused(
                    f"You already claimed today. Come back in {hours}h {rem // 60}m."
                )
            streak = streak + 1 if now - last < timedelta(hours=48) else 1
        else:
            streak = 1

        reward = int(settings.get("daily_reward", 250)) + min(streak, 7) * 10
        wallet.update(
            {
                "balance": int(wallet.get("balance", 0)) + reward,
                "daily_streak": streak,
                "last_daily_at": now.isoformat(),
                "username": interaction.user.name,
            }
        )
        await repo.save_wallet(wallet)

        currency = settings.get("currency_name", "Coins")
        await interaction.followup.send(
            embed=embeds.success(
                "Daily reward claimed",
                f"You received **{reward:,} {currency}**.\n"
                f"Streak: **{streak}** day(s) · Balance: **{int(wallet['balance']):,}**",
            )
        )

    @app_commands.command(name="give", description="Send currency to another member.")
    @app_commands.guild_only()
    async def give(
        self, interaction: discord.Interaction, member: discord.Member, amount: int
    ) -> None:
        guild = ensure_guild(interaction)
        settings = await self._config(str(guild.id))
        if member.bot:
            raise ActionRefused("You cannot send currency to a bot.")
        if member.id == interaction.user.id:
            raise ActionRefused("You cannot send currency to yourself.")
        if amount <= 0:
            raise ActionRefused("Amount must be greater than zero.")

        await interaction.response.defer()
        repo = self.bot.repo  # type: ignore[attr-defined]
        sender = await self._wallet(str(guild.id), interaction.user, settings)
        if int(sender.get("balance", 0)) < amount:
            raise ActionRefused("You do not have enough to send that amount.")
        receiver = await self._wallet(str(guild.id), member, settings)

        sender["balance"] = int(sender["balance"]) - amount
        receiver["balance"] = int(receiver.get("balance", 0)) + amount
        await repo.save_wallet(sender)
        await repo.save_wallet(receiver)

        currency = settings.get("currency_name", "Coins")
        await interaction.followup.send(
            embed=embeds.success(
                "Transfer complete",
                f"{interaction.user.mention} sent **{amount:,} {currency}** to {member.mention}.",
            )
        )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Economy(bot))
