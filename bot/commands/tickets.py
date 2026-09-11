"""AHOY ticket system.

Supports:
- Per-panel ticket buttons
- Per-button Discord categories
- Per-button support roles
- Per-button member access roles
- Per-button Discord permissions
- Per-button modal forms
- Form answers stored with the ticket
- Support-role mentions when a ticket opens
- Per-button transcript channels
- Ticket-owner DM transcripts
- Persistent ticket controls
- Legacy /ticket support
"""

from __future__ import annotations

import io
import json
from typing import Any

import discord
from discord import app_commands
from discord.ext import commands

from ..services.ticket_panel_service import TicketPanelService
from ..utils import embeds
from ..utils.checks import (
    ActionRefused,
    ensure_bot_permission,
    ensure_guild,
)
from ..utils.logger import get_logger

log = get_logger("tickets")

BUTTON_PREFIX = "ahoy:ticket:btn:"

CATEGORIES = [
    (
        "general",
        "General Support",
        "Questions and general help",
    ),
    (
        "report",
        "Report",
        "Report a member or an issue",
    ),
    (
        "partnership",
        "Partnership",
        "Collaborations and partnerships",
    ),
    (
        "other",
        "Other",
        "Anything else",
    ),
]

BUTTON_STYLES = {
    "primary": discord.ButtonStyle.primary,
    "secondary": discord.ButtonStyle.secondary,
    "success": discord.ButtonStyle.success,
    "danger": discord.ButtonStyle.danger,
}

PERMISSION_NAMES = {
    "everyone": "Everyone",
    "manage_channels": "Manage Channels",
    "manage_guild": "Manage Server",
    "administrator": "Administrator",
}


# ---------------------------------------------------------------------------
# General helpers
# ---------------------------------------------------------------------------


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []

    if isinstance(value, list):
        return value

    if isinstance(value, tuple):
        return list(value)

    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return parsed
        except (TypeError, ValueError):
            pass

        return [
            item.strip()
            for item in value.split(",")
            if item.strip()
        ]

    return []


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value

    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, dict):
                return parsed
        except (TypeError, ValueError):
            pass

    return {}


def _normalise_questions(value: Any) -> list[dict[str, Any]]:
    questions = _as_list(value)

    result: list[dict[str, Any]] = []

    for index, raw in enumerate(questions[:5]):
        if not isinstance(raw, dict):
            continue

        label = str(
            raw.get("label")
            or raw.get("name")
            or ""
        ).strip()

        if not label:
            continue

        style = str(
            raw.get("style")
            or "short"
        ).lower()

        result.append(
            {
                "id": str(
                    raw.get("id")
                    or f"q{index + 1}"
                )[:80],
                "label": label[:45],
                "placeholder": (
                    str(raw["placeholder"])[:100]
                    if raw.get("placeholder")
                    else None
                ),
                "required": bool(
                    raw.get("required", True)
                ),
                "style": (
                    "paragraph"
                    if style == "paragraph"
                    else "short"
                ),
            }
        )

    return result


def _slugify(value: str) -> str:
    slug = "".join(
        ch.lower()
        if ch.isalnum()
        else "-"
        for ch in value
    ).strip("-")

    return (slug or "support")[:40]


async def _is_ticket_staff(
    bot: commands.Bot,
    member: discord.Member,
    ticket: dict[str, Any] | None = None,
) -> bool:
    """Return whether this member can manage the ticket."""

    if (
        member.guild_permissions.manage_channels
        or member.guild_permissions.administrator
    ):
        return True

    configured_roles: set[str] = set()

    if ticket:
        configured_roles.update(
            str(role_id)
            for role_id in _as_list(
                ticket.get("support_role_ids")
            )
        )

    if not configured_roles:
        settings = await bot.repo.get_settings(
            str(member.guild.id)
        )  # type: ignore[attr-defined]

        configured_roles.update(
            str(role_id)
            for role_id in _as_list(
                settings.get(
                    "ticket_support_role_ids"
                )
            )
        )

    if not configured_roles:
        return False

    return any(
        str(role.id) in configured_roles
        for role in member.roles
    )


async def _require_ticket_staff(
    bot: commands.Bot,
    interaction: discord.Interaction,
    ticket: dict[str, Any] | None = None,
) -> None:
    member = interaction.user

    if not isinstance(member, discord.Member):
        raise ActionRefused(
            "This only works inside a server."
        )

    if not await _is_ticket_staff(
        bot,
        member,
        ticket,
    ):
        raise ActionRefused(
            "Only the configured ticket support team "
            "can do that."
        )


def _member_has_permission(
    member: discord.Member,
    required: str,
) -> bool:
    required = str(
        required or "everyone"
    ).lower()

    if required == "everyone":
        return True

    permissions = member.guild_permissions

    if required == "manage_channels":
        return permissions.manage_channels

    if required == "manage_guild":
        return permissions.manage_guild

    if required == "administrator":
        return permissions.administrator

    return False


def _member_has_access_roles(
    member: discord.Member,
    access_role_ids: Any,
) -> bool:
    role_ids = {
        str(role_id)
        for role_id in _as_list(
            access_role_ids
        )
    }

    if not role_ids:
        return True

    return any(
        str(role.id) in role_ids
        for role in member.roles
    )


def _role_mentions(
    guild: discord.Guild,
    role_ids: Any,
) -> list[str]:
    mentions: list[str] = []

    for raw_role_id in _as_list(role_ids):
        try:
            role_id = int(raw_role_id)
        except (TypeError, ValueError):
            continue

        role = guild.get_role(role_id)

        if role is not None:
            mentions.append(role.mention)

    return mentions


# ---------------------------------------------------------------------------
# Ticket controls
# ---------------------------------------------------------------------------


class TicketControls(discord.ui.View):
    """Persistent controls attached to every ticket."""

    def __init__(self, bot: commands.Bot) -> None:
        super().__init__(timeout=None)
        self.bot = bot

    async def _ticket(
        self,
        interaction: discord.Interaction,
    ) -> dict[str, Any]:
        ticket = await self.bot.repo.get_ticket_by_channel(
            str(interaction.channel_id)
        )  # type: ignore[attr-defined]

        if not ticket:
            raise ActionRefused(
                "This channel is not a tracked ticket."
            )

        return ticket

    @discord.ui.button(
        label="Claim",
        style=discord.ButtonStyle.primary,
        custom_id="ahoy:ticket:claim",
    )
    async def claim(
        self,
        interaction: discord.Interaction,
        _: discord.ui.Button,
    ) -> None:
        ticket = await self._ticket(interaction)

        await _require_ticket_staff(
            self.bot,
            interaction,
            ticket,
        )

        if ticket.get("status") == "closed":
            raise ActionRefused(
                "This ticket is already closed."
            )

        await self.bot.repo.update_ticket(
            ticket["id"],
            {
                "claimed_by": str(
                    interaction.user.id
                ),
                "status": "claimed",
            },
        )  # type: ignore[attr-defined]

        await interaction.response.send_message(
            embed=embeds.success(
                "Ticket claimed",
                f"{interaction.user.mention} is handling this ticket.",
            )
        )

    @discord.ui.button(
        label="Transcript",
        style=discord.ButtonStyle.secondary,
        custom_id="ahoy:ticket:transcript",
    )
    async def transcript(
        self,
        interaction: discord.Interaction,
        _: discord.ui.Button,
    ) -> None:
        ticket = await self._ticket(interaction)

        await _require_ticket_staff(
            self.bot,
            interaction,
            ticket,
        )

        await interaction.response.defer(
            ephemeral=True
        )

        service = getattr(
            self.bot,
            "ticket_panels",
            None,
        ) or TicketPanelService(self.bot)

        try:
            guild = ensure_guild(interaction)
            body = await service.transcript_text(
                ticket
            )

            file = discord.File(
                io.BytesIO(
                    body.encode(
                        "utf-8",
                        errors="replace",
                    )
                ),
                filename=(
                    f"ahoy-ticket-"
                    f"{ticket.get('ticket_number')}.txt"
                ),
            )

            await interaction.followup.send(
                file=file,
                ephemeral=True,
            )

        except Exception as exc:
            log.exception(
                "Could not generate ticket transcript: %s",
                exc,
            )

            await interaction.followup.send(
                embed=embeds.warning(
                    "Transcript unavailable",
                    "I could not generate the transcript right now.",
                ),
                ephemeral=True,
            )

    @discord.ui.button(
        label="Lock",
        style=discord.ButtonStyle.secondary,
        emoji="🔒",
        custom_id="ahoy:ticket:lock",
    )
    async def lock(
        self,
        interaction: discord.Interaction,
        _: discord.ui.Button,
    ) -> None:
        ticket = await self._ticket(interaction)

        await _require_ticket_staff(
            self.bot,
            interaction,
            ticket,
        )

        if ticket.get("status") == "closed":
            raise ActionRefused(
                "This ticket is already closed."
            )

        channel = interaction.channel

        if not isinstance(
            channel,
            discord.TextChannel,
        ):
            raise ActionRefused(
                "This only works inside a ticket channel."
            )

        opener_id = ticket.get(
            "opener_id"
        )

        if not opener_id:
            raise ActionRefused(
                "The ticket owner could not be identified."
            )

        opener = channel.guild.get_member(
            int(opener_id)
        )

        if opener is None:
            raise ActionRefused(
                "Could not find the person who opened this ticket."
            )

        overwrite = channel.overwrites_for(
            opener
        )

        currently_locked = (
            overwrite.send_messages is False
        )

        overwrite.send_messages = (
            None
            if currently_locked
            else False
        )

        await channel.set_permissions(
            opener,
            overwrite=overwrite,
            reason=(
                f"Ticket "
                f"{'unlocked' if currently_locked else 'locked'} "
                f"by {interaction.user}"
            ),
        )

        if currently_locked:
            await interaction.response.send_message(
                embed=embeds.success(
                    "Ticket unlocked",
                    f"{opener.mention} can send messages again.",
                )
            )
        else:
            await interaction.response.send_message(
                embed=embeds.warning(
                    "Ticket locked",
                    f"{opener.mention} can no longer send messages here.",
                )
            )

    @discord.ui.button(
        label="Close",
        style=discord.ButtonStyle.danger,
        custom_id="ahoy:ticket:close",
    )
    async def close(
        self,
        interaction: discord.Interaction,
        _: discord.ui.Button,
    ) -> None:
        ticket = await self._ticket(interaction)

        await _require_ticket_staff(
            self.bot,
            interaction,
            ticket,
        )

        if ticket.get("status") == "closed":
            raise ActionRefused(
                "This ticket is already closed."
            )

        await interaction.response.send_message(
            embed=embeds.warning(
                "Ticket closing",
                "This ticket will be closed and its transcript will be delivered.",
            )
        )

        await self.bot.repo.update_ticket(
            ticket["id"],
            {
                "status": "closed",
                "closed_by": str(
                    interaction.user.id
                ),
                "closed_at": discord.utils.utcnow().isoformat(),
            },
        )  # type: ignore[attr-defined]

        channel = interaction.channel

        if isinstance(
            channel,
            discord.TextChannel,
        ):
            service = getattr(
                self.bot,
                "ticket_panels",
                None,
            ) or TicketPanelService(self.bot)

            try:
                await service.send_transcript(
                    ticket,
                    channel.guild,
                )
            except Exception:
                log.exception(
                    "Ticket transcript delivery failed."
                )

            try:
                await channel.delete(
                    reason=(
                        f"Ticket closed by "
                        f"{interaction.user}"
                    )
                )
            except discord.HTTPException as exc:
                log.warning(
                    "Failed to delete ticket channel: %s",
                    exc,
                )


# ---------------------------------------------------------------------------
# Ticket form modal
# ---------------------------------------------------------------------------


class TicketFormModal(discord.ui.Modal):
    """Discord modal shown before a configured ticket is created."""

    def __init__(
        self,
        cog: "Tickets",
        button: dict[str, Any],
        questions: list[dict[str, Any]],
    ) -> None:
        title = str(
            button.get("label")
            or "Open a ticket"
        )

        super().__init__(
            title=title[:45],
            timeout=300,
        )

        self.cog = cog
        self.button = button
        self.questions = questions

        self.inputs: list[
            tuple[
                dict[str, Any],
                discord.ui.TextInput,
            ]
        ] = []

        for question in questions[:5]:
            style = (
                discord.TextStyle.paragraph
                if question.get("style")
                == "paragraph"
                else discord.TextStyle.short
            )

            text_input = discord.ui.TextInput(
                label=str(
                    question.get("label")
                    or "Answer"
                )[:45],
                placeholder=(
                    str(
                        question.get(
                            "placeholder"
                        )
                    )[:100]
                    if question.get(
                        "placeholder"
                    )
                    else None
                ),
                required=bool(
                    question.get(
                        "required",
                        True,
                    )
                ),
                style=style,
                max_length=4000,
            )

            self.inputs.append(
                (
                    question,
                    text_input,
                )
            )

            self.add_item(text_input)

    async def on_submit(
        self,
        interaction: discord.Interaction,
    ) -> None:
        answers: dict[str, str] = {}

        for question, text_input in self.inputs:
            question_id = str(
                question.get("id")
                or question.get("label")
                or "question"
            )

            answers[question_id] = str(
                text_input.value
            ).strip()

        await self.cog.open_ticket(
            interaction,
            category=str(
                self.button.get(
                    "category"
                )
                or self.button.get(
                    "label"
                )
                or "support"
            ),
            button=self.button,
            form_answers=answers,
        )


# ---------------------------------------------------------------------------
# Dynamic panel button
# ---------------------------------------------------------------------------


class TicketPanelButton(
    discord.ui.Button
):
    """One persisted dashboard button."""

    def __init__(
        self,
        bot: commands.Bot,
        spec: dict[str, Any],
    ) -> None:
        button_id = str(
            spec.get("id")
            or ""
        )

        label = str(
            spec.get("label")
            or "Create a ticket"
        )[:80]

        style = BUTTON_STYLES.get(
            str(
                spec.get("style")
                or "primary"
            ),
            discord.ButtonStyle.primary,
        )

        super().__init__(
            label=label,
            style=style,
            emoji=(
                str(spec.get("emoji"))
                if spec.get("emoji")
                else None
            ),
            custom_id=(
                f"{BUTTON_PREFIX}{button_id}"
            ),
            row=int(
                spec.get("position")
                or 0
            ) // 5,
        )

        self.bot = bot
        self.button_id = button_id

    async def callback(
        self,
        interaction: discord.Interaction,
    ) -> None:
        cog = interaction.client.get_cog(
            "Tickets"
        )

        if cog is None:
            raise ActionRefused(
                "The ticket system is unavailable right now."
            )

        if not isinstance(
            cog,
            Tickets,
        ):
            raise ActionRefused(
                "The ticket system is unavailable right now."
            )

        guild = ensure_guild(
            interaction
        )

        settings = await self.bot.repo.get_settings(
            str(guild.id)
        )  # type: ignore[attr-defined]

        if not settings.get(
            "tickets_enabled"
        ):
            raise ActionRefused(
                "Tickets are disabled in this server."
            )

        /*
         * Always reload the button from the database.
         *
         * This is critical. It prevents an old in-memory
         * button configuration from sending members to
         * an old category.
         */
        button = await self.bot.repo.get_ticket_panel_button(
            self.button_id
        )  # type: ignore[attr-defined]

        if not button:
            raise ActionRefused(
                "This ticket option no longer exists."
            )

        if not button.get(
            "enabled",
            True,
        ):
            raise ActionRefused(
                "This ticket option is currently disabled."
            )

        member = interaction.user

        if not isinstance(
            member,
            discord.Member,
        ):
            raise ActionRefused(
                "This only works inside a server."
            )

        required_permission = str(
            button.get(
                "required_permission"
            )
            or "everyone"
        ).lower()

        if not _member_has_permission(
            member,
            required_permission,
        ):
            raise ActionRefused(
                "You do not have the required Discord permission "
                f"({PERMISSION_NAMES.get(required_permission, required_permission)})."
            )

        if not _member_has_access_roles(
            member,
            button.get(
                "access_role_ids"
            ),
        ):
            raise ActionRefused(
                "You do not have a role that is allowed to use this ticket option."
            )

        questions = _normalise_questions(
            button.get(
                "form_questions"
            )
            or button.get(
                "form_fields"
            )
        )

        if questions:
            await interaction.response.send_modal(
                TicketFormModal(
                    cog,
                    button,
                    questions,
                )
            )
            return

        await cog.open_ticket(
            interaction,
            category=str(
                button.get(
                    "category"
                )
                or button.get(
                    "label"
                )
                or "support"
            ),
            button=button,
            form_answers={},
        )


# ---------------------------------------------------------------------------
# Multi-button persistent panel
# ---------------------------------------------------------------------------


class MultiTicketPanel(
    discord.ui.View
):
    """Persistent view containing dashboard-configured buttons."""

    def __init__(
        self,
        bot: commands.Bot,
        buttons: list[dict[str, Any]],
    ) -> None:
        super().__init__(
            timeout=None
        )

        for spec in buttons[:20]:
            button_id = str(
                spec.get("id")
                or ""
            )

            if not button_id:
                continue

            self.add_item(
                TicketPanelButton(
                    bot,
                    spec,
                )
            )


# ---------------------------------------------------------------------------
# Legacy ticket panel
# ---------------------------------------------------------------------------


class TicketPanel(
    discord.ui.View
):
    """Legacy one-button panel."""

    def __init__(
        self,
        cog: "Tickets | None" = None,
    ) -> None:
        super().__init__(
            timeout=None
        )

        self.cog = cog

    @discord.ui.button(
        label="Create a ticket",
        style=discord.ButtonStyle.primary,
        emoji="🎫",
        custom_id="ahoy:ticket:panel:open",
    )
    async def open(
        self,
        interaction: discord.Interaction,
        _: discord.ui.Button,
    ) -> None:
        cog = (
            self.cog
            or interaction.client.get_cog(
                "Tickets"
            )
        )

        if cog is None:
            raise ActionRefused(
                "The ticket system is unavailable right now."
            )

        guild = ensure_guild(
            interaction
        )

        settings = await interaction.client.repo.get_settings(
            str(guild.id)
        )  # type: ignore[attr-defined]

        if not settings.get(
            "tickets_enabled"
        ):
            raise ActionRefused(
                "Tickets are disabled in this server."
            )

        await interaction.response.send_message(
            embed=embeds.brand(
                "Open a ticket",
                "Pick the category that best matches your request. "
                "A private channel will be created for you.",
            ),
            view=TicketOpener(cog),
            ephemeral=True,
        )


# ---------------------------------------------------------------------------
# Legacy category picker
# ---------------------------------------------------------------------------


class TicketOpener(
    discord.ui.View
):
    def __init__(
        self,
        cog: "Tickets",
    ) -> None:
        super().__init__(
            timeout=120
        )

        self.add_item(
            TicketCategorySelect(cog)
        )


class TicketCategorySelect(
    discord.ui.Select
):
    def __init__(
        self,
        cog: "Tickets",
    ) -> None:
        super().__init__(
            placeholder="Choose a ticket category…",
            options=[
                discord.SelectOption(
                    label=label,
                    value=value,
                    description=description,
                )
                for value, label, description
                in CATEGORIES
            ],
        )

        self.cog = cog

    async def callback(
        self,
        interaction: discord.Interaction,
    ) -> None:
        await self.cog.open_ticket(
            interaction,
            self.values[0],
            button=None,
            form_answers={},
        )


# ---------------------------------------------------------------------------
# Dashboard panel publishing
# ---------------------------------------------------------------------------


async def post_ticket_panel(
    bot: commands.Bot,
    channel: discord.TextChannel,
    title: str | None,
    description: str | None,
    button_label: str | None,
    buttons: list[dict[str, Any]] | None = None,
    created_by: str | None = None,
) -> discord.Message:
    """Persist and publish a dashboard-created ticket panel."""

    specs = [
        button
        for button in (
            buttons or []
        )
        if isinstance(button, dict)
        and str(
            button.get("label")
            or ""
        ).strip()
    ]

    embed = embeds.brand(
        title or "Need a hand?",
        description
        or (
            "Pick the option that matches your request. "
            "A private channel will be created for you "
            "and the crew only."
        ),
    )

    if not specs:
        view = TicketPanel(
            bot.get_cog(
                "Tickets"
            )
        )

        if button_label:
            first = view.children[0]

            if isinstance(
                first,
                discord.ui.Button,
            ):
                first.label = (
                    str(button_label)[:80]
                )

        return await channel.send(
            embed=embed,
            view=view,
        )

    service = getattr(
        bot,
        "ticket_panels",
        None,
    ) or TicketPanelService(bot)

    saved = await service.create_panel(
        str(channel.guild.id),
        str(channel.id),
        title,
        description,
        created_by,
        specs,
    )

    rows = saved.get(
        "buttons"
    ) or []

    for row in rows:
        row_description = row.get(
            "description"
        )

        if row_description:
            embed.add_field(
                name=(
                    f"{row.get('emoji') or '🎫'} "
                    f"{str(row.get('label') or 'Ticket')[:80]}"
                ),
                value=str(
                    row_description
                )[:1024],
                inline=False,
            )

    message = await channel.send(
        embed=embed,
        view=MultiTicketPanel(
            bot,
            rows,
        ),
    )

    await service.set_message_id(
        saved["panel"]["id"],
        str(message.id),
    )

    return message


# ---------------------------------------------------------------------------
# Tickets cog
# ---------------------------------------------------------------------------


class Tickets(
    commands.Cog
):
    def __init__(
        self,
        bot: commands.Bot,
    ) -> None:
        self.bot = bot

    @commands.Cog.listener()
    async def on_interaction(
        self,
        interaction: discord.Interaction,
    ) -> None:
        """Fallback handler for old panel custom IDs."""

        data = interaction.data or {}

        custom_id = str(
            data.get("custom_id")
            or ""
        )

        if not custom_id.startswith(
            "ahoy:ticket:open:"
        ):
            return

        guild = ensure_guild(
            interaction
        )

        settings = await self.bot.repo.get_settings(
            str(guild.id)
        )  # type: ignore[attr-defined]

        if not settings.get(
            "tickets_enabled"
        ):
            raise ActionRefused(
                "Tickets are disabled in this server."
            )

        category = (
            custom_id.split(":")[-1]
            or "support"
        )

        await self.open_ticket(
            interaction,
            category,
            button=None,
            form_answers={},
        )

    @app_commands.command(
        name="ticket",
        description="Open a private support ticket.",
    )
    @app_commands.guild_only()
    async def ticket(
        self,
        interaction: discord.Interaction,
    ) -> None:
        guild = ensure_guild(
            interaction
        )

        settings = await self.bot.repo.get_settings(
            str(guild.id)
        )  # type: ignore[attr-defined]

        if not settings.get(
            "tickets_enabled"
        ):
            raise ActionRefused(
                "Tickets are disabled here. "
                "An administrator can enable them in the AHOY Control Center."
            )

        await interaction.response.send_message(
            embed=embeds.brand(
                "Open a ticket",
                "Pick the category that best matches your request. "
                "A private channel will be created for you.",
            ),
            view=TicketOpener(self),
            ephemeral=True,
        )

    async def open_ticket(
        self,
        interaction: discord.Interaction,
        category: str,
        button: dict[str, Any] | None = None,
        form_answers: dict[str, str] | None = None,
    ) -> None:
        guild = ensure_guild(
            interaction
        )

        ensure_bot_permission(
            guild,
            "manage_channels",
        )

        repo = self.bot.repo  # type: ignore[attr-defined]

        settings = await repo.get_settings(
            str(guild.id)
        )

        form_answers = form_answers or {}

        await interaction.response.defer(
            ephemeral=True
        )

        # ---------------------------------------------------------------
        # Resolve configuration.
        #
        # For dashboard buttons, NEVER use the old global category.
        # The selected button's category_id wins.
        # ---------------------------------------------------------------

        button_id = None
        button_label = None

        if button:
            button_id = button.get(
                "id"
            )

            button_label = str(
                button.get(
                    "label"
                )
                or category
            )

        category_id = None

        if button:
            raw_category_id = (
                button.get(
                    "category_id"
                )
                or button.get(
                    "category_channel_id"
                )
            )

            if raw_category_id:
                try:
                    category_id = int(
                        raw_category_id
                    )
                except (
                    TypeError,
                    ValueError,
                ):
                    category_id = None

        # Legacy /ticket behavior uses the global category.
        if category_id is None:
            raw_global_category = settings.get(
                "ticket_category_id"
            )

            if raw_global_category:
                try:
                    category_id = int(
                        raw_global_category
                    )
                except (
                    TypeError,
                    ValueError,
                ):
                    category_id = None

        parent = None

        if category_id:
            maybe_parent = guild.get_channel(
                category_id
            )

            if isinstance(
                maybe_parent,
                discord.CategoryChannel,
            ):
                parent = maybe_parent

        # ---------------------------------------------------------------
        # Resolve support roles.
        # ---------------------------------------------------------------

        if button:
            support_role_ids = _as_list(
                button.get(
                    "support_role_ids"
                )
            )
        else:
            support_role_ids = _as_list(
                settings.get(
                    "ticket_support_role_ids"
                )
            )

        # ---------------------------------------------------------------
        # Resolve transcript configuration.
        # ---------------------------------------------------------------

        transcript_enabled = (
            bool(
                button.get(
                    "transcript_enabled",
                    True,
                )
            )
            if button
            else bool(
                settings.get(
                    "ticket_transcripts_enabled",
                    True,
                )
            )
        )

        transcript_channel_id = None

        if button:
            transcript_channel_id = (
                button.get(
                    "transcript_channel_id"
                )
            )

        if not transcript_channel_id:
            transcript_channel_id = settings.get(
                "ticket_transcript_channel_id"
            )

        if transcript_channel_id:
            transcript_channel_id = str(
                transcript_channel_id
            )

        dm_transcript_enabled = (
            bool(
                button.get(
                    "dm_transcript_enabled",
                    False,
                )
            )
            if button
            else bool(
                settings.get(
                    "ticket_dm_transcript_enabled",
                    False,
                )
            )
        )

        # ---------------------------------------------------------------
        # Build private-channel permissions.
        # ---------------------------------------------------------------

        overwrites: dict[
            discord.abc.Snowflake,
            discord.PermissionOverwrite,
        ] = {
            guild.default_role: discord.PermissionOverwrite(
                view_channel=False
            ),
            guild.me: discord.PermissionOverwrite(
                view_channel=True,
                send_messages=True,
                read_message_history=True,
                manage_channels=True,
                manage_messages=True,
                attach_files=True,
            ),
            interaction.user: discord.PermissionOverwrite(
                view_channel=True,
                send_messages=True,
                read_message_history=True,
                attach_files=True,
                embed_links=True,
            ),
        }

        for raw_role_id in support_role_ids:
            try:
                role = guild.get_role(
                    int(raw_role_id)
                )
            except (
                TypeError,
                ValueError,
            ):
                role = None

            if role is None:
                continue

            overwrites[role] = discord.PermissionOverwrite(
                view_channel=True,
                send_messages=True,
                read_message_history=True,
                attach_files=True,
                embed_links=True,
            )

        number = await repo.next_ticket_number(
            str(guild.id)
        )

        channel_name = (
            f"ticket-{number:04d}"
        )

        try:
            channel = await guild.create_text_channel(
                name=channel_name,
                overwrites=overwrites,
                category=parent,
                reason=(
                    f"AHOY ticket opened by "
                    f"{interaction.user}"
                ),
            )
        except discord.HTTPException as exc:
            log.exception(
                "Failed to create ticket channel: %s",
                exc,
            )

            raise ActionRefused(
                "I could not create the ticket channel. "
                "Please check AHOY's Manage Channels permission "
                "and make sure the selected category still exists."
            ) from exc

        # ---------------------------------------------------------------
        # Save ticket record.
        # ---------------------------------------------------------------

        ticket_payload: dict[str, Any] = {
            "guild_id": str(
                guild.id
            ),
            "ticket_number": number,
            "channel_id": str(
                channel.id
            ),
            "category": str(
                button.get(
                    "category"
                )
                if button
                else category
            )[:80],
            "opener_id": str(
                interaction.user.id
            ),
            "opener_name": str(
                interaction.user
            ),
            "status": "open",
        }

        if button_id:
            ticket_payload[
                "button_id"
            ] = str(button_id)

        if button_label:
            ticket_payload[
                "button_label"
            ] = button_label[:80]

        ticket_payload[
            "support_role_ids"
        ] = [
            str(role_id)
            for role_id in support_role_ids
        ][:25]

        if button:
            ticket_payload[
                "access_role_ids"
            ] = [
                str(role_id)
                for role_id in _as_list(
                    button.get(
                        "access_role_ids"
                    )
                )
            ][:25]

            ticket_payload[
                "required_permission"
            ] = str(
                button.get(
                    "required_permission"
                )
                or "everyone"
            )

        ticket_payload[
            "form_answers"
        ] = form_answers

        ticket_payload[
            "transcript_enabled"
        ] = transcript_enabled

        ticket_payload[
            "transcript_channel_id"
        ] = transcript_channel_id

        ticket_payload[
            "dm_transcript_enabled"
        ] = dm_transcript_enabled

        try:
            ticket = await repo.create_ticket(
                ticket_payload
            )
        except Exception:
            log.exception(
                "create_ticket failed for guild %s",
                guild.id,
            )

            try:
                await channel.delete(
                    reason=(
                        "AHOY ticket database save failed"
                    )
                )
            except discord.HTTPException:
                pass

            raise ActionRefused(
                "The ticket channel could not be saved. "
                "The channel was removed so you are not left with a broken ticket."
            )

        # ---------------------------------------------------------------
        # Build opening embed.
        # ---------------------------------------------------------------

        display_label = (
            button_label
            or next(
                (
                    label
                    for value, label, _
                    in CATEGORIES
                    if value == category
                ),
                str(
                    category
                )
                .replace(
                    "-",
                    " ",
                )
                .title(),
            )
        )

        welcome_message = (
            settings.get(
                "ticket_welcome_message"
            )
            or (
                "Ahoy! A crew member will be with you shortly. ⚓"
            )
        )

        embed = embeds.brand(
            (
                f"Ticket #{number:04d} · "
                f"{display_label}"
            ),
            welcome_message,
        )

        embed.add_field(
            name="Opened by",
            value=interaction.user.mention,
            inline=True,
        )

        if parent is not None:
            embed.add_field(
                name="Ticket category",
                value=parent.mention,
                inline=True,
            )

        # ---------------------------------------------------------------
        # Add form answers visibly inside the ticket.
        # ---------------------------------------------------------------

        if form_answers:
            answer_lines: list[str] = []

            questions = _normalise_questions(
                button.get(
                    "form_questions"
                )
                if button
                else []
            )

            labels_by_id = {
                str(
                    question.get(
                        "id"
                    )
                ): str(
                    question.get(
                        "label"
                    )
                )
                for question in questions
            }

            for key, value in form_answers.items():
                label = (
                    labels_by_id.get(
                        str(key)
                    )
                    or str(key)
                )

                answer = str(
                    value
                ).strip()

                if not answer:
                    answer = "*No answer provided*"

                answer_lines.append(
                    f"**{label[:45]}**\n"
                    f"{answer[:1000]}"
                )

            if answer_lines:
                embed.add_field(
                    name="📋 Form responses",
                    value="\n\n".join(
                        answer_lines
                    )[:1024],
                    inline=False,
                )

        # ---------------------------------------------------------------
        # Mention support roles.
        # ---------------------------------------------------------------

        role_mentions = _role_mentions(
            guild,
            support_role_ids,
        )

        support_text = ""

        if role_mentions:
            support_text = (
                " ".join(
                    role_mentions
                )
                + "\n\n"
            )

        try:
            await channel.send(
                content=(
                    f"{interaction.user.mention}"
                    + (
                        f" {support_text}"
                        if support_text
                        else ""
                    )
                ),
                embed=embed,
                view=TicketControls(
                    self.bot
                ),
                allowed_mentions=discord.AllowedMentions(
                    users=True,
                    roles=True,
                    everyone=False,
                ),
            )
        except discord.HTTPException as exc:
            log.warning(
                "Failed to send ticket opening message: %s",
                exc,
            )

        # ---------------------------------------------------------------
        # Send an explicit form-answer message too.
        #
        # This makes the answers impossible for staff to miss.
        # ---------------------------------------------------------------

        if form_answers:
            lines = [
                "📋 **Ticket form submission**",
                f"**Member:** {interaction.user.mention}",
            ]

            questions = _normalise_questions(
                button.get(
                    "form_questions"
                )
                if button
                else []
            )

            labels_by_id = {
                str(
                    question.get(
                        "id"
                    )
                ): str(
                    question.get(
                        "label"
                    )
                )
                for question in questions
            }

            for key, value in form_answers.items():
                label = (
                    labels_by_id.get(
                        str(key)
                    )
                    or str(key)
                )

                lines.append(
                    f"\n**{label[:45]}**\n"
                    f"{str(value)[:1500]}"
                )

            try:
                await channel.send(
                    "\n".join(
                        lines
                    )[:6000]
                )
            except discord.HTTPException as exc:
                log.warning(
                    "Failed to send ticket form answers: %s",
                    exc,
                )

        # ---------------------------------------------------------------
        # Confirmation to member.
        # ---------------------------------------------------------------

        await interaction.followup.send(
            embed=embeds.success(
                "Ticket created",
                f"Your private ticket is ready: {channel.mention}",
            ),
            ephemeral=True,
        )

        log.info(
            "Ticket %s opened in guild %s "
            "using button %s and category %s",
            ticket.get("id"),
            guild.id,
            button_id or "legacy",
            parent.id if parent else "default",
        )


# ---------------------------------------------------------------------------
# Cog setup
# ---------------------------------------------------------------------------


async def setup(
    bot: commands.Bot,
) -> None:
    bot.add_view(
        TicketControls(bot)
    )

    tickets_cog = Tickets(bot)

    await bot.add_cog(
        tickets_cog
    )

    # ---------------------------------------------------------------
    # Re-register every saved dashboard panel on startup.
    #
    # This is what makes the buttons continue working after the bot
    # restarts instead of becoming dead Discord components.
    # ---------------------------------------------------------------

    try:
        panels = await bot.repo.active_ticket_panels()
        buttons = await bot.repo.active_ticket_panel_buttons()

        buttons_by_panel: dict[
            str,
            list[dict[str, Any]],
        ] = {}

        for button in buttons:
            panel_id = str(
                button.get(
                    "panel_id"
                )
            )

            buttons_by_panel.setdefault(
                panel_id,
                [],
            ).append(button)

        for panel in panels:
            panel_id = str(
                panel.get(
                    "id"
                )
            )

            panel_buttons = buttons_by_panel.get(
                panel_id,
                [],
            )

            if not panel_buttons:
                continue

            bot.add_view(
                MultiTicketPanel(
                    bot,
                    panel_buttons,
                )
            )

        log.info(
            "Registered %s persistent ticket panels.",
            len(panels),
        )

    except Exception:
        log.exception(
            "Could not restore persistent ticket panels on startup."
        )
