"""Ticket system with private channels, claiming, transcripts and storage."""

from __future__ import annotations

import io

import discord
from discord import app_commands
from discord.ext import commands

from ..utils import embeds
from ..utils.checks import ActionRefused, ensure_bot_permission, ensure_guild
from ..utils.logger import get_logger

log = get_logger("tickets")

CATEGORIES = [
    ("general", "General Support", "Questions and general help"),
    ("report", "Report", "Report a member or an issue"),
    ("partnership", "Partnership", "Collaborations and partnerships"),
    ("other", "Other", "Anything else"),
]


class TicketControls(discord.ui.View):
    """Persistent controls attached to every ticket channel."""

    def __init__(self, bot: commands.Bot) -> None:
        super().__init__(timeout=None)
        self.bot = bot

    async def _ticket(self, interaction: discord.Interaction) -> dict:
        ticket = await self.bot.repo.get_ticket_by_channel(str(interaction.channel_id))  # type: ignore[attr-defined]
        if not ticket:
            raise ActionRefused("This channel is not a tracked ticket.")
        return ticket

    @discord.ui.button(
        label="Claim", style=discord.ButtonStyle.primary, custom_id="ahoy:ticket:claim"
    )
    async def claim(self, interaction: discord.Interaction, _: discord.ui.Button) -> None:
        ticket = await self._ticket(interaction)
        if ticket.get("status") == "closed":
            raise ActionRefused("This ticket is already closed.")
        await self.bot.repo.update_ticket(  # type: ignore[attr-defined]
            ticket["id"], {"claimed_by": str(interaction.user.id), "status": "claimed"}
        )
        await interaction.response.send_message(
            embed=embeds.success("Ticket claimed", f"{interaction.user.mention} is handling this.")
        )

    @discord.ui.button(
        label="Transcript", style=discord.ButtonStyle.secondary, custom_id="ahoy:ticket:transcript"
    )
    async def transcript(self, interaction: discord.Interaction, _: discord.ui.Button) -> None:
        ticket = await self._ticket(interaction)
        await interaction.response.defer(ephemeral=True)
        rows = await self.bot.repo.ticket_transcript(ticket["id"])  # type: ignore[attr-defined]
        if not rows:
            await interaction.followup.send(
                embed=embeds.info("No transcript", "No messages have been stored yet."),
                ephemeral=True,
            )
            return
        body = "\n".join(
            f"[{r.get('sent_at', '')[:19]}] {r.get('author_name')}: {r.get('content')}"
            for r in rows
        )
        file = discord.File(
            io.BytesIO(body.encode("utf-8")),
            filename=f"ahoy-ticket-{ticket.get('ticket_number')}.txt",
        )
        await interaction.followup.send(file=file, ephemeral=True)

    @discord.ui.button(
        label="Close", style=discord.ButtonStyle.danger, custom_id="ahoy:ticket:close"
    )
    async def close(self, interaction: discord.Interaction, _: discord.ui.Button) -> None:
        ticket = await self._ticket(interaction)
        if ticket.get("status") == "closed":
            raise ActionRefused("This ticket is already closed.")
        await interaction.response.send_message(
            embed=embeds.warning("Ticket closing", "This channel will be removed in a moment.")
        )
        await self.bot.repo.update_ticket(  # type: ignore[attr-defined]
            ticket["id"],
            {
                "status": "closed",
                "closed_by": str(interaction.user.id),
                "closed_at": discord.utils.utcnow().isoformat(),
            },
        )
        channel = interaction.channel
        if isinstance(channel, discord.TextChannel):
            try:
                await channel.delete(reason=f"Ticket closed by {interaction.user}")
            except discord.HTTPException as exc:
                log.warning("Failed to delete ticket channel: %s", exc)


class TicketOpener(discord.ui.View):
    def __init__(self, cog: "Tickets") -> None:
        super().__init__(timeout=120)
        self.cog = cog
        self.add_item(TicketCategorySelect(cog))


class TicketCategorySelect(discord.ui.Select):
    def __init__(self, cog: "Tickets") -> None:
        super().__init__(
            placeholder="Choose a ticket category…",
            options=[
                discord.SelectOption(label=label, value=value, description=desc)
                for value, label, desc in CATEGORIES
            ],
        )
        self.cog = cog

    async def callback(self, interaction: discord.Interaction) -> None:
        await self.cog.open_ticket(interaction, self.values[0])


class Tickets(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name="ticket", description="Open a private support ticket.")
    @app_commands.guild_only()
    async def ticket(self, interaction: discord.Interaction) -> None:
        guild = ensure_guild(interaction)
        settings = await self.bot.repo.get_settings(str(guild.id))  # type: ignore[attr-defined]
        if not settings.get("tickets_enabled"):
            raise ActionRefused(
                "Tickets are disabled here. An administrator can enable them in the "
                "AHOY Control Center."
            )
        await interaction.response.send_message(
            embed=embeds.brand(
                "Open a ticket",
                "Pick the category that best matches your request. A private channel "
                "will be created for you.",
            ),
            view=TicketOpener(self),
            ephemeral=True,
        )

    async def open_ticket(self, interaction: discord.Interaction, category: str) -> None:
        guild = ensure_guild(interaction)
        ensure_bot_permission(guild, "manage_channels")
        repo = self.bot.repo  # type: ignore[attr-defined]
        settings = await repo.get_settings(str(guild.id))

        await interaction.response.defer(ephemeral=True)
        number = await repo.next_ticket_number(str(guild.id))

        overwrites = {
            guild.default_role: discord.PermissionOverwrite(view_channel=False),
            guild.me: discord.PermissionOverwrite(
                view_channel=True, send_messages=True, manage_channels=True
            ),
            interaction.user: discord.PermissionOverwrite(
                view_channel=True, send_messages=True, attach_files=True
            ),
        }
        for role_id in settings.get("ticket_support_role_ids") or []:
            role = guild.get_role(int(role_id))
            if role is not None:
                overwrites[role] = discord.PermissionOverwrite(
                    view_channel=True, send_messages=True
                )

        parent = None
        if settings.get("ticket_category_id"):
            maybe = guild.get_channel(int(settings["ticket_category_id"]))
            parent = maybe if isinstance(maybe, discord.CategoryChannel) else None

        channel = await guild.create_text_channel(
            name=f"ticket-{number:04d}",
            overwrites=overwrites,
            category=parent,
            reason=f"AHOY ticket opened by {interaction.user}",
        )

        ticket = await repo.create_ticket(
            {
                "guild_id": str(guild.id),
                "ticket_number": number,
                "channel_id": str(channel.id),
                "category": category,
                "opener_id": str(interaction.user.id),
                "opener_name": str(interaction.user),
                "status": "open",
            }
        )

        label = next((lbl for val, lbl, _ in CATEGORIES if val == category), "Support")
        embed = embeds.brand(
            f"Ticket #{number:04d} · {label}",
            settings.get("ticket_welcome_message")
            or "Ahoy! A crew member will be with you shortly. ⚓",
        )
        embed.add_field(name="Opened by", value=interaction.user.mention)
        await channel.send(
            content=interaction.user.mention, embed=embed, view=TicketControls(self.bot)
        )
        await interaction.followup.send(
            embed=embeds.success("Ticket created", f"Your ticket: {channel.mention}"),
            ephemeral=True,
        )
        log.info("Ticket %s opened in guild %s", ticket.get("id"), guild.id)


async def setup(bot: commands.Bot) -> None:
    bot.add_view(TicketControls(bot))
    await bot.add_cog(Tickets(bot))
