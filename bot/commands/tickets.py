"""AHOY ticket system with persistent panels, forms, routing and transcripts."""

from __future__ import annotations

import io
import json
from typing import Any

import discord
from discord import app_commands
from discord.ext import commands

from ..services.ticket_panel_service import TicketPanelService
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

BUTTON_PREFIX = "ahoy:ticket:btn:"

BUTTON_STYLES = {
    "primary": discord.ButtonStyle.primary,
    "secondary": discord.ButtonStyle.secondary,
    "success": discord.ButtonStyle.success,
    "danger": discord.ButtonStyle.danger,
}

VALID_PERMISSIONS = {
    "everyone",
    "manage_channels",
    "manage_guild",
    "administrator",
}


def _slugify(value: str) -> str:
    slug = "".join(
        ch.lower() if ch.isalnum() else "-"
        for ch in str(value)
    ).strip("-")
    return (slug or "support")[:40]


def _normalise_list(value: Any) -> list[str]:
    if value is None:
        return []

    if isinstance(value, str):
        try:
            decoded = json.loads(value)
            if isinstance(decoded, list):
                value = decoded
            else:
                value = [value]
        except (TypeError, ValueError):
            value = [
                item.strip()
                for item in value.split(",")
                if item.strip()
            ]

    if not isinstance(value, (list, tuple, set)):
        return []

    result: list[str] = []

    for item in value:
        text = str(item).strip()
        if text and text not in result:
            result.append(text)

    return result[:25]


def _normalise_questions(value: Any) -> list[dict[str, Any]]:
    if value is None:
        return []

    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (TypeError, ValueError):
            return []

    if not isinstance(value, list):
        return []

    questions: list[dict[str, Any]] = []

    for index, item in enumerate(value[:5]):
        if not isinstance(item, dict):
            continue

        label = str(item.get("label") or "").strip()

        if not label:
            continue

        style = str(item.get("style") or "short").lower()

        questions.append(
            {
                "id": str(
                    item.get("id")
                    or f"q{index + 1}"
                )[:80],
                "label": label[:45],
                "placeholder": (
                    str(item.get("placeholder"))[:100]
                    if item.get("placeholder")
                    else None
                ),
                "required": bool(
                    item.get("required", True)
                ),
                "style": (
                    "paragraph"
                    if style == "paragraph"
                    else "short"
                ),
            }
        )

    return questions


def _permission_allowed(
    member: discord.Member,
    required_permission: str,
) -> bool:
    permission = str(
        required_permission or "everyone"
    ).lower()

    if permission == "everyone":
        return True

    if permission == "manage_channels":
        return member.guild_permissions.manage_channels

    if permission == "manage_guild":
        return member.guild_permissions.manage_guild

    if permission == "administrator":
        return member.guild_permissions.administrator

    return False


def _button_access_allowed(
    member: discord.Member,
    button: dict[str, Any],
) -> tuple[bool, str]:
    required_permission = str(
        button.get("required_permission")
        or "everyone"
    ).lower()

    if required_permission not in VALID_PERMISSIONS:
        required_permission = "everyone"

    if not _permission_allowed(
        member,
        required_permission,
    ):
        labels = {
            "manage_channels": "Manage Channels",
            "manage_guild": "Manage Server",
            "administrator": "Administrator",
        }

        return (
            False,
            "You need the "
            f"**{labels.get(required_permission, required_permission)}** "
            "permission to use this ticket button.",
        )

    access_roles = _normalise_list(
        button.get("access_role_ids")
    )

    if access_roles:
        member_role_ids = {
            str(role.id)
            for role in member.roles
        }

        if not member_role_ids.intersection(
            set(access_roles)
        ):
            return (
                False,
                "You do not have one of the roles required "
                "to use this ticket button.",
            )

    return True, ""


async def _is_ticket_staff(
    bot: commands.Bot,
    member: discord.Member,
    ticket: dict[str, Any] | None = None,
) -> bool:
    """Check global or ticket-specific support staff permissions."""

    if (
        member.guild_permissions.manage_channels
        or member.guild_permissions.administrator
    ):
        return True

    role_ids: list[str] = []

    if ticket:
        role_ids = _normalise_list(
            ticket.get("support_role_ids")
        )

    if not role_ids:
        settings = await bot.repo.get_settings(
            str(member.guild.id)
        )  # type: ignore[attr-defined]

        role_ids = _normalise_list(
            settings.get("ticket_support_role_ids")
        )

    if not role_ids:
        return False

    member_role_ids = {
        str(role.id)
        for role in member.roles
    }

    return bool(
        member_role_ids.intersection(
            set(role_ids)
        )
    )


async def _require_ticket_staff(
    bot: commands.Bot,
    interaction: discord.Interaction,
) -> dict[str, Any]:
    member = interaction.user

    if not isinstance(member, discord.Member):
        raise ActionRefused(
            "This only works inside a server."
        )

    ticket = await bot.repo.get_ticket_by_channel(
        str(interaction.channel_id)
    )  # type: ignore[attr-defined]

    if not ticket:
        raise ActionRefused(
            "This channel is not a tracked ticket."
        )

    if not await _is_ticket_staff(
        bot,
        member,
        ticket,
    ):
        raise ActionRefused(
            "Only the support team can perform that action."
        )

    return ticket


def _ticket_label(
    button: dict[str, Any] | None,
    category: str | None,
) -> str:
    if button:
        label = str(
            button.get("label") or ""
        ).strip()

        if label:
            return label

    if category:
        for value, label, _ in CATEGORIES:
            if value == category:
                return label

        return str(category).replace(
            "-",
            " ",
        ).title()

    return "Support"


def _ticket_support_roles(
    button: dict[str, Any],
    settings: dict[str, Any],
) -> list[str]:
    """Use button roles when configured; otherwise preserve legacy behavior."""

    if "support_role_ids" in button:
        return _normalise_list(
            button.get("support_role_ids")
        )

    return _normalise_list(
        settings.get("ticket_support_role_ids")
    )


class TicketControls(discord.ui.View):
    """Persistent controls attached to every ticket channel."""

    def __init__(
        self,
        bot: commands.Bot,
    ) -> None:
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
        ticket = await _require_ticket_staff(
            self.bot,
            interaction,
        )

        if ticket.get("status") == "closed":
            raise ActionRefused(
                "This ticket is already closed."
            )

        await self.bot.repo.update_ticket(  # type: ignore[attr-defined]
            ticket["id"],
            {
                "claimed_by": str(
                    interaction.user.id
                ),
                "status": "claimed",
            },
        )

        await interaction.response.send_message(
            embed=embeds.success(
                "Ticket claimed",
                (
                    f"{interaction.user.mention} "
                    "is now handling this ticket."
                ),
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
        ticket = await self._ticket(
            interaction
        )

        await interaction.response.defer(
            ephemeral=True
        )

        rows = await self.bot.repo.ticket_transcript(
            ticket["id"]
        )  # type: ignore[attr-defined]

        service = TicketPanelService(
            self.bot
        )

        try:
            body = await service.transcript_text(
                ticket
            )
        except Exception:
            log.exception(
                "Failed to generate transcript for ticket %s",
                ticket.get("id"),
            )

            if rows:
                body = "\n".join(
                    (
                        f"[{str(row.get('sent_at') or '')[:19]}] "
                        f"{row.get('author_name') or row.get('author_id')}: "
                        f"{row.get('content') or ''}"
                    )
                    for row in rows
                )
            else:
                body = "No messages were recorded."

        file = discord.File(
            io.BytesIO(
                body.encode(
                    "utf-8",
                    errors="replace",
                )
            ),
            filename=(
                f"ahoy-ticket-"
                f"{ticket.get('ticket_number', 'unknown')}.txt"
            ),
        )

        await interaction.followup.send(
            file=file,
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
        ticket = await _require_ticket_staff(
            self.bot,
            interaction,
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
                "Could not find the ticket owner."
            )

        opener = channel.guild.get_member(
            int(opener_id)
        )

        if opener is None:
            try:
                fetched = await channel.guild.fetch_member(
                    int(opener_id)
                )
                opener = fetched
            except (
                discord.NotFound,
                discord.HTTPException,
                ValueError,
            ):
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
                "Ticket unlocked by "
                if currently_locked
                else "Ticket locked by "
            )
            + str(interaction.user),
        )

        if currently_locked:
            await interaction.response.send_message(
                embed=embeds.success(
                    "Ticket unlocked",
                    (
                        f"{opener.mention} "
                        "can send messages again."
                    ),
                )
            )
        else:
            await interaction.response.send_message(
                embed=embeds.warning(
                    "Ticket locked",
                    (
                        f"{opener.mention} "
                        "can no longer send messages here."
                    ),
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
        ticket = await _require_ticket_staff(
            self.bot,
            interaction,
        )

        if ticket.get("status") == "closed":
            raise ActionRefused(
                "This ticket is already closed."
            )

        channel = interaction.channel

        await interaction.response.send_message(
            embed=embeds.warning(
                "Ticket closing",
                (
                    "The transcript is being saved. "
                    "This channel will be removed shortly."
                ),
            )
        )

        # Send transcript BEFORE deleting the channel.
        service = TicketPanelService(
            self.bot
        )

        try:
            await service.send_transcript(
                ticket,
                interaction.guild,
            )
        except Exception:
            log.exception(
                "Transcript delivery failed for ticket %s",
                ticket.get("id"),
            )

        await self.bot.repo.update_ticket(  # type: ignore[attr-defined]
            ticket["id"],
            {
                "status": "closed",
                "closed_by": str(
                    interaction.user.id
                ),
                "closed_at": discord.utils.utcnow().isoformat(),
            },
        )

        if isinstance(
            channel,
            discord.TextChannel,
        ):
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


class TicketPanel(discord.ui.View):
    """Legacy single-button ticket panel."""

    def __init__(
        self,
        cog: "Tickets | None" = None,
    ) -> None:
        super().__init__(timeout=None)
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
            or interaction.client.get_cog("Tickets")
        )

        if cog is None:
            raise ActionRefused(
                "The ticket system is unavailable right now."
            )

        guild = ensure_guild(
            interaction
        )

        settings = await interaction.client.repo.get_settings(  # type: ignore[attr-defined]
            str(guild.id)
        )

        if not settings.get(
            "tickets_enabled"
        ):
            raise ActionRefused(
                "Tickets are disabled in this server."
            )

        await interaction.response.send_message(
            embed=embeds.brand(
                "Open a ticket",
                (
                    "Pick the category that best "
                    "matches your request. A private "
                    "channel will be created for you."
                ),
            ),
            view=TicketOpener(
                cog
            ),
            ephemeral=True,
        )


class TicketFormModal(discord.ui.Modal):
    """Dynamic Discord modal generated from a panel button's form."""

    def __init__(
        self,
        cog: "Tickets",
        button: dict[str, Any],
        questions: list[dict[str, Any]],
    ) -> None:
        label = str(
            button.get("label")
            or "Ticket"
        )

        super().__init__(
            title=f"{label[:39]} Form"
        )

        self.cog = cog
        self.button = button
        self.questions = questions
        self.inputs: list[
            discord.ui.TextInput
        ] = []

        for index, question in enumerate(
            questions[:5]
        ):
            text_input = discord.ui.TextInput(
                label=str(
                    question.get("label")
                    or f"Question {index + 1}"
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
                style=(
                    discord.TextStyle.paragraph
                    if question.get(
                        "style"
                    )
                    == "paragraph"
                    else discord.TextStyle.short
                ),
                custom_id=str(
                    question.get("id")
                    or f"q{index + 1}"
                )[:100],
            )

            self.inputs.append(
                text_input
            )

            self.add_item(
                text_input
            )

    async def on_submit(
        self,
        interaction: discord.Interaction,
    ) -> None:
        answers: dict[str, str] = {}

        for index, text_input in enumerate(
            self.inputs
        ):
            question = self.questions[index]

            answer = str(
                text_input.value or ""
            ).strip()

            answers[
                str(
                    question.get("label")
                    or f"Question {index + 1}"
                )
            ] = answer

        await self.cog.open_configured_ticket(
            interaction,
            self.button,
            answers,
        )


class TicketPanelButton(
    discord.ui.Button
):
    """A persisted dashboard ticket button with a real callback."""

    def __init__(
        self,
        bot: commands.Bot,
        spec: dict[str, Any],
    ) -> None:
        button_id = str(
            spec.get("id")
            or ""
        )

        if not button_id:
            raise ValueError(
                "Ticket panel button is missing its database ID."
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
                str(spec.get("emoji"))[:8]
                if spec.get("emoji")
                else None
            ),
            custom_id=(
                f"{BUTTON_PREFIX}"
                f"{button_id}"
            ),
            row=(
                int(spec.get("position", 0))
                // 5
            ),
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

        await cog.handle_panel_button(
            interaction,
            self.button_id,
        )


class MultiTicketPanel(
    discord.ui.View
):
    """Persistent panel containing database-backed ticket buttons."""

    def __init__(
        self,
        bot: commands.Bot,
        buttons: list[dict[str, Any]],
    ) -> None:
        super().__init__(
            timeout=None
        )

        for spec in buttons[:20]:
            if not spec.get("id"):
                continue

            self.add_item(
                TicketPanelButton(
                    bot,
                    spec,
                )
            )


async def post_ticket_panel(
    bot: commands.Bot,
    channel: discord.TextChannel,
    title: str | None,
    description: str | None,
    button_label: str | None,
    buttons: list[dict] | None = None,
    created_by: str | None = None,
) -> discord.Message:
    """Persist and post a dashboard-created ticket panel."""

    specs = [
        button
        for button in (buttons or [])
        if isinstance(button, dict)
        and button.get("label")
    ]

    embed = embeds.brand(
        title or "Need a hand?",
        description
        or (
            "Pick the option that matches "
            "your request. A private channel "
            "will be created for you and the "
            "crew only."
        ),
    )

    if not specs:
        view: discord.ui.View = TicketPanel(
            bot.get_cog("Tickets")
        )

        if button_label:
            first = view.children[0]

            if isinstance(
                first,
                discord.ui.Button,
            ):
                first.label = button_label[:80]

        return await channel.send(
            embed=embed,
            view=view,
        )

    service = getattr(
        bot,
        "ticket_panels",
        None,
    )

    if service is None:
        service = TicketPanelService(
            bot
        )
        bot.ticket_panels = service

    saved = await service.create_panel(
        str(channel.guild.id),
        str(channel.id),
        title,
        description,
        created_by,
        specs,
    )

    rows = saved.get(
        "buttons",
        [],
    )

    for spec in rows:
        if spec.get(
            "description"
        ):
            embed.add_field(
                name=(
                    f"{spec.get('emoji') or '🎫'} "
                    f"{str(spec.get('label') or '')[:80]}"
                ),
                value=str(
                    spec.get(
                        "description"
                    )
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
        self.cog = cog

        self.add_item(
            TicketCategorySelect(
                cog
            )
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
        )


class Tickets(commands.Cog):
    def __init__(
        self,
        bot: commands.Bot,
    ) -> None:
        self.bot = bot

        if not hasattr(
            bot,
            "ticket_panels",
        ):
            bot.ticket_panels = TicketPanelService(
                bot
            )

    async def handle_panel_button(
        self,
        interaction: discord.Interaction,
        button_id: str,
    ) -> None:
        """Handle a dashboard button using fresh database configuration."""

        guild = ensure_guild(
            interaction
        )

        settings = await self.bot.repo.get_settings(  # type: ignore[attr-defined]
            str(guild.id)
        )

        if not settings.get(
            "tickets_enabled"
        ):
            raise ActionRefused(
                "Tickets are disabled in this server."
            )

        member = interaction.user

        if not isinstance(
            member,
            discord.Member,
        ):
            raise ActionRefused(
                "This only works inside a server."
            )

        button = await self.bot.repo.get_ticket_panel_button(  # type: ignore[attr-defined]
            str(button_id)
        )

        if not button:
            raise ActionRefused(
                "This ticket button no longer exists."
            )

        if str(
            button.get("guild_id")
        ) != str(guild.id):
            raise ActionRefused(
                "This ticket button does not belong to this server."
            )

        if button.get(
            "enabled"
        ) is False:
            raise ActionRefused(
                "This ticket option is currently disabled."
            )

        allowed, reason = _button_access_allowed(
            member,
            button,
        )

        if not allowed:
            raise ActionRefused(
                reason
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
                    self,
                    button,
                    questions,
                )
            )
            return

        await self.open_configured_ticket(
            interaction,
            button,
            {},
        )

    async def open_configured_ticket(
        self,
        interaction: discord.Interaction,
        button: dict[str, Any],
        answers: dict[str, str],
    ) -> None:
        guild = ensure_guild(
            interaction
        )

        member = interaction.user

        if not isinstance(
            member,
            discord.Member,
        ):
            raise ActionRefused(
                "This only works inside a server."
            )

        # Reload the button again after a modal submission.
        # This prevents stale category/role/form settings.
        button_id = button.get(
            "id"
        )

        if button_id:
            fresh_button = await self.bot.repo.get_ticket_panel_button(  # type: ignore[attr-defined]
                str(button_id)
            )

            if fresh_button:
                button = fresh_button

        allowed, reason = _button_access_allowed(
            member,
            button,
        )

        if not allowed:
            raise ActionRefused(
                reason
            )

        category = str(
            button.get("category")
            or button.get("category_key")
            or _slugify(
                str(
                    button.get("label")
                    or "support"
                )
            )
        )

        await self._create_ticket(
            interaction,
            category=category,
            button=button,
            answers=answers,
        )

    async def _create_ticket(
        self,
        interaction: discord.Interaction,
        category: str,
        button: dict[str, Any] | None,
        answers: dict[str, str],
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

        if not settings.get(
            "tickets_enabled"
        ):
            raise ActionRefused(
                "Tickets are disabled in this server."
            )

        await interaction.response.defer(
            ephemeral=True
        )

        number = await repo.next_ticket_number(
            str(guild.id)
        )

        support_role_ids = (
            _ticket_support_roles(
                button or {},
                settings,
            )
        )

        access_role_ids = _normalise_list(
            (button or {}).get(
                "access_role_ids"
            )
        )

        required_permission = str(
            (button or {}).get(
                "required_permission"
            )
            or "everyone"
        )

        if required_permission not in VALID_PERMISSIONS:
            required_permission = "everyone"

        transcript_enabled = (
            (button or {}).get(
                "transcript_enabled"
            )
        )

        if transcript_enabled is None:
            transcript_enabled = settings.get(
                "ticket_transcripts_enabled",
                True,
            )

        transcript_channel_id = (
            (button or {}).get(
                "transcript_channel_id"
            )
        )

        if not transcript_channel_id:
            transcript_channel_id = settings.get(
                "ticket_transcript_channel_id"
            )

        dm_transcript_enabled = (
            (button or {}).get(
                "dm_transcript_enabled"
            )
        )

        if dm_transcript_enabled is None:
            dm_transcript_enabled = settings.get(
                "ticket_dm_transcript_enabled",
                False,
            )

        button_id = (
            str(
                button.get("id")
            )
            if button and button.get("id")
            else None
        )

        button_label = (
            str(
                button.get("label")
            )[:80]
            if button and button.get("label")
            else None
        )

        # ------------------------------------------------------------
        # Resolve the Discord category.
        #
        # IMPORTANT:
        # If a dashboard button explicitly has a category ID,
        # never silently fall back to the old global category.
        # ------------------------------------------------------------

        parent: discord.CategoryChannel | None = None

        explicit_category_id = None

        if button:
            explicit_category_id = (
                button.get("category_id")
                or button.get(
                    "category_channel_id"
                )
            )

        if explicit_category_id:
            try:
                category_channel = guild.get_channel(
                    int(explicit_category_id)
                )
            except (
                TypeError,
                ValueError,
            ):
                category_channel = None

            if not isinstance(
                category_channel,
                discord.CategoryChannel,
            ):
                raise ActionRefused(
                    "The Discord category configured for "
                    f"**{button_label or 'this ticket button'}** "
                    "is missing or is not a category channel. "
                    "Please select a valid category in the dashboard."
                )

            parent = category_channel

        elif settings.get(
            "ticket_category_id"
        ):
            try:
                global_category = guild.get_channel(
                    int(
                        settings[
                            "ticket_category_id"
                        ]
                    )
                )
            except (
                TypeError,
                ValueError,
            ):
                global_category = None

            if isinstance(
                global_category,
                discord.CategoryChannel,
            ):
                parent = global_category

        # ------------------------------------------------------------
        # Permission overwrites
        # ------------------------------------------------------------

        overwrites: dict[
            discord.abc.Snowflake,
            discord.PermissionOverwrite,
        ] = {
            guild.default_role: discord.PermissionOverwrite(
                view_channel=False
            ),
            interaction.user: discord.PermissionOverwrite(
                view_channel=True,
                send_messages=True,
                attach_files=True,
                read_message_history=True,
            ),
        }

        bot_member = guild.me

        if bot_member is not None:
            overwrites[
                bot_member
            ] = discord.PermissionOverwrite(
                view_channel=True,
                send_messages=True,
                attach_files=True,
                read_message_history=True,
                manage_channels=True,
                manage_messages=True,
            )

        support_roles: list[discord.Role] = []

        for role_id in support_role_ids:
            try:
                role = guild.get_role(
                    int(role_id)
                )
            except (
                TypeError,
                ValueError,
            ):
                role = None

            if role is None:
                continue

            support_roles.append(
                role
            )

            overwrites[
                role
            ] = discord.PermissionOverwrite(
                view_channel=True,
                send_messages=True,
                read_message_history=True,
                attach_files=True,
            )

        # ------------------------------------------------------------
        # Create the private channel.
        # ------------------------------------------------------------

        channel = await guild.create_text_channel(
            name=f"ticket-{number:04d}",
            overwrites=overwrites,
            category=parent,
            reason=(
                f"AHOY ticket opened by "
                f"{interaction.user}"
            ),
        )

        # ------------------------------------------------------------
        # Save the ticket.
        # ------------------------------------------------------------

        payload: dict[str, Any] = {
            "guild_id": str(
                guild.id
            ),
            "ticket_number": number,
            "channel_id": str(
                channel.id
            ),
            "category": category,
            "opener_id": str(
                interaction.user.id
            ),
            "opener_name": str(
                interaction.user
            ),
            "status": "open",
        }

        if button_id is not None:
            payload[
                "button_id"
            ] = button_id

        if button_label is not None:
            payload[
                "button_label"
            ] = button_label

        payload[
            "support_role_ids"
        ] = support_role_ids

        payload[
            "access_role_ids"
        ] = access_role_ids

        payload[
            "required_permission"
        ] = required_permission

        payload[
            "form_answers"
        ] = answers

        payload[
            "transcript_enabled"
        ] = bool(
            transcript_enabled
        )

        if transcript_channel_id:
            payload[
                "transcript_channel_id"
            ] = str(
                transcript_channel_id
            )

        payload[
            "dm_transcript_enabled"
        ] = bool(
            dm_transcript_enabled
        )

        try:
            ticket = await repo.create_ticket(
                payload
            )
        except Exception:
            log.exception(
                "Failed to save ticket row for guild %s",
                guild.id,
            )

            try:
                await channel.delete(
                    reason=(
                        "Ticket database creation failed"
                    ),
                )
            except discord.HTTPException:
                log.exception(
                    "Failed to clean up unsaved ticket channel %s",
                    channel.id,
                )

            raise ActionRefused(
                "The ticket could not be saved. "
                "Please try again or contact an administrator."
            )

        # ------------------------------------------------------------
        # Build opening message.
        # ------------------------------------------------------------

        label = _ticket_label(
            button,
            category,
        )

        welcome_message = settings.get(
            "ticket_welcome_message"
        ) or (
            "Ahoy! A crew member will be "
            "with you shortly. ⚓"
        )

        embed = embeds.brand(
            (
                f"Ticket #{number:04d} · "
                f"{label}"
            ),
            welcome_message,
        )

        embed.add_field(
            name="Opened by",
            value=interaction.user.mention,
            inline=True,
        )

        if parent:
            embed.add_field(
                name="Category",
                value=parent.mention,
                inline=True,
            )

        # ------------------------------------------------------------
        # Add form answers to opening embed.
        # ------------------------------------------------------------

        if answers:
            answer_lines: list[str] = []

            for question, answer in answers.items():
                clean_answer = str(
                    answer
                ).strip()

                if len(clean_answer) > 900:
                    clean_answer = (
                        clean_answer[:897]
                        + "..."
                    )

                answer_lines.append(
                    f"**{question}**\n"
                    f"{clean_answer or 'No answer provided.'}"
                )

            form_text = "\n\n".join(
                answer_lines
            )

            if len(form_text) > 3900:
                form_text = (
                    form_text[:3897]
                    + "..."
                )

            embed.add_field(
                name="📋 Form Answers",
                value=form_text,
                inline=False,
            )

        # ------------------------------------------------------------
        # Mention configured support roles.
        # ------------------------------------------------------------

        role_mentions = " ".join(
            role.mention
            for role in support_roles
        )

        content_parts: list[str] = [
            interaction.user.mention
        ]

        if role_mentions:
            content_parts.append(
                role_mentions
            )

        opening_content = " ".join(
            content_parts
        )

        allowed_mentions = discord.AllowedMentions(
            users=True,
            roles=True,
            everyone=False,
            replied_user=False,
        )

        await channel.send(
            content=opening_content,
            embed=embed,
            view=TicketControls(
                self.bot
            ),
            allowed_mentions=allowed_mentions,
        )

        await interaction.followup.send(
            embed=embeds.success(
                "Ticket created",
                (
                    f"Your ticket is ready: "
                    f"{channel.mention}"
                ),
            ),
            ephemeral=True,
        )

        log.info(
            "Ticket %s opened in guild %s using button %s",
            ticket.get("id"),
            guild.id,
            button_id or "legacy",
        )

    async def open_ticket(
        self,
        interaction: discord.Interaction,
        category: str,
    ) -> None:
        """Legacy /ticket flow using the global configuration."""

        await self._create_ticket(
            interaction,
            category=category,
            button=None,
            answers={},
        )

    @commands.Cog.listener()
    async def on_interaction(
        self,
        interaction: discord.Interaction,
    ) -> None:
        """
        Compatibility handler for older dashboard panels.

        New dashboard buttons are handled by TicketPanelButton.callback.
        """

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

        settings = await self.bot.repo.get_settings(  # type: ignore[attr-defined]
            str(guild.id)
        )

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

        settings = await self.bot.repo.get_settings(  # type: ignore[attr-defined]
            str(guild.id)
        )

        if not settings.get(
            "tickets_enabled"
        ):
            raise ActionRefused(
                "Tickets are disabled here. "
                "An administrator can enable "
                "them in the AHOY Control Center."
            )

        await interaction.response.send_message(
            embed=embeds.brand(
                "Open a ticket",
                (
                    "Pick the category that best "
                    "matches your request. A private "
                    "channel will be created for you."
                ),
            ),
            view=TicketOpener(
                self
            ),
            ephemeral=True,
        )

    async def restore_persistent_panels(
        self,
    ) -> None:
        """
        Restore all saved dashboard ticket panels
        after a bot restart.
        """

        try:
            panels = await self.bot.repo.active_ticket_panels()  # type: ignore[attr-defined]
            buttons = await self.bot.repo.active_ticket_panel_buttons()  # type: ignore[attr-defined]
        except Exception:
            log.exception(
                "Failed to load saved ticket panels during startup."
            )
            return

        buttons_by_panel: dict[
            str,
            list[dict[str, Any]],
        ] = {}

        for button in buttons:
            panel_id = str(
                button.get("panel_id")
                or ""
            )

            if not panel_id:
                continue

            buttons_by_panel.setdefault(
                panel_id,
                [],
            ).append(
                button
            )

        restored = 0

        for panel in panels:
            panel_id = str(
                panel.get("id")
                or ""
            )

            if not panel_id:
                continue

            panel_buttons = buttons_by_panel.get(
                panel_id,
                [],
            )

            if not panel_buttons:
                continue

            channel_id = str(
                panel.get("channel_id")
                or ""
            )

            if not channel_id:
                continue

            try:
                channel = self.bot.get_channel(
                    int(channel_id)
                )
            except (
                TypeError,
                ValueError,
            ):
                channel = None

            if not isinstance(
                channel,
                discord.TextChannel,
            ):
                continue

            # Discord persistent views do not require the original
            # message object. Registering the view makes its custom
            # IDs active again after restart.
            try:
                self.bot.add_view(
                    MultiTicketPanel(
                        self.bot,
                        panel_buttons[:20],
                    )
                )
                restored += 1
            except Exception:
                log.exception(
                    "Failed restoring ticket panel %s",
                    panel_id,
                )

        log.info(
            "Restored %s persistent ticket panel(s).",
            restored,
        )


async def setup(
    bot: commands.Bot,
) -> None:
    """Register persistent ticket controls and restore saved panels."""

    tickets = Tickets(
        bot
    )

    await bot.add_cog(
        tickets
    )

    # Persistent controls used inside ticket channels.
    bot.add_view(
        TicketControls(
            bot
        )
    )

    # Legacy single-button panel.
    bot.add_view(
        TicketPanel(
            tickets
        )
    )

    # Restore every dashboard-created panel and its buttons.
    await tickets.restore_persistent_panels()
