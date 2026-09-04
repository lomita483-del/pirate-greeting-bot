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


class TicketPanel(discord.ui.View):
    """Persistent panel posted in a public channel from the dashboard."""

    def __init__(self, cog: "Tickets | None" = None) -> None:
        super().__init__(timeout=None)
        self.cog = cog

    @discord.ui.button(
        label="Create a ticket",
        style=discord.ButtonStyle.primary,
        emoji="🎫",
        custom_id="ahoy:ticket:panel:open",
    )
    async def open(self, interaction: discord.Interaction, _: discord.ui.Button) -> None:
        cog = self.cog or interaction.client.get_cog("Tickets")
        if cog is None:
            raise ActionRefused("The ticket system is unavailable right now.")
        guild = ensure_guild(interaction)
        settings = await interaction.client.repo.get_settings(str(guild.id))  # type: ignore[attr-defined]
        if not settings.get("tickets_enabled"):
            raise ActionRefused("Tickets are disabled in this server.")
        await interaction.response.send_message(
            embed=embeds.brand(
                "Open a ticket",
                "Pick the category that best matches your request. A private channel "
                "will be created for you.",
            ),
            view=TicketOpener(cog),  # type: ignore[arg-type]
            ephemeral=True,
        )


BUTTON_STYLES = {
    "primary": discord.ButtonStyle.primary,
    "secondary": discord.ButtonStyle.secondary,
    "success": discord.ButtonStyle.success,
    "danger": discord.ButtonStyle.danger,
}


def _slugify(value: str) -> str:
    slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in value).strip("-")
    return (slug or "support")[:40]


class MultiTicketPanel(discord.ui.View):
    """Panel with one button per ticket topic — persistent via custom_id prefix."""

    def __init__(self, buttons: list[dict]) -> None:
        super().__init__(timeout=None)
        for index, spec in enumerate(buttons[:20]):
            label = str(spec.get("label") or "Create a ticket")[:80]
            category = _slugify(str(spec.get("category") or label))
            style = BUTTON_STYLES.get(str(spec.get("style") or "primary"), discord.ButtonStyle.primary)
            emoji = spec.get("emoji") or None
            self.add_item(
                discord.ui.Button(
                    label=label,
                    style=style,
                    emoji=emoji,
                    custom_id=f"ahoy:ticket:open:{index}:{category}",
                )
            )


async def post_ticket_panel(
    bot: commands.Bot,
    channel: discord.TextChannel,
    title: str | None,
    description: str | None,
    button_label: str | None,
    buttons: list[dict] | None = None,
) -> discord.Message:
    """Post the public ticket panel — used by the dashboard action queue."""
    specs = [b for b in (buttons or []) if isinstance(b, dict) and b.get("label")]

    embed = embeds.brand(
        title or "Need a hand?",
        description
        or "Pick the option that matches your request. A private channel will be "
        "created for you and the crew only.",
    )

    if not specs:
        view: discord.ui.View = TicketPanel(bot.get_cog("Tickets"))  # type: ignore[arg-type]
        if button_label:
            view.children[0].label = button_label[:80]  # type: ignore[attr-defined]
        return await channel.send(embed=embed, view=view)

    for spec in specs[:20]:
        if spec.get("description"):
            embed.add_field(
                name=f"{spec.get('emoji') or '🎫'} {str(spec['label'])[:80]}",
                value=str(spec["description"])[:1024],
                inline=False,
            )
    return await channel.send(embed=embed, view=MultiTicketPanel(specs))


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

    @commands.Cog.listener()
    async def on_interaction(self, interaction: discord.Interaction) -> None:
        """Handle dashboard-authored ticket panel buttons (any number of them)."""
        data = interaction.data or {}
        custom_id = str(data.get("custom_id") or "")
        if not custom_id.startswith("ahoy:ticket:open:"):
            return
        guild = ensure_guild(interaction)
        settings = await self.bot.repo.get_settings(str(guild.id))  # type: ignore[attr-defined]
        if not settings.get("tickets_enabled"):
            raise ActionRefused("Tickets are disabled in this server.")
        category = custom_id.split(":")[-1] or "support"
        await self.open_ticket(interaction, category)


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

        label = next(
            (lbl for val, lbl, _ in CATEGORIES if val == category),
            category.replace("-", " ").title(),
        )
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
    bot.add_view(TicketPanel())
    await bot.add_cog(Tickets(bot))
