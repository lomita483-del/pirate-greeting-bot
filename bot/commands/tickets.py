"""Ticket system with private channels, configurable panel buttons,
forms, per-button routing, support-role mentions, transcripts and storage.
"""

from __future__ import annotations

import io
import json
from typing import Any

import discord
from discord import app_commands
from discord.ext import commands

from ..utils import embeds
from ..utils.checks import ActionRefused, ensure_bot_permission, ensure_guild
from ..utils.logger import get_logger

log = get_logger("tickets")

BUTTON_PREFIX = "ahoy:ticket:btn:"

CATEGORIES = [
    ("general", "General Support", "Questions and general help"),
    ("report", "Report", "Report a member or an issue"),
    ("partnership", "Partnership", "Collaborations and partnerships"),
    ("other", "Other", "Anything else"),
]

BUTTON_STYLES = {
    "primary": discord.ButtonStyle.primary,
    "secondary": discord.ButtonStyle.secondary,
    "success": discord.ButtonStyle.success,
    "danger": discord.ButtonStyle.danger,
}

PERMISSIONS = {
    "everyone": None,
    "manage_channels": "manage_channels",
    "manage_guild": "manage_guild",
    "administrator": "administrator",
}


def _slugify(value: str) -> str:
    slug = "".join(
        ch.lower() if ch.isalnum() else "-"
        for ch in value
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
        except (ValueError, TypeError):
            value = [value]

    if not isinstance(value, (list, tuple, set)):
        return []

    return [
        str(item)
        for item in value
        if item is not None and str(item).strip()
    ]


def _normalise_questions(value: Any) -> list[dict[str, Any]]:
    if value is None:
        return []

    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            return []

    if not isinstance(value, list):
        return []

    questions: list[dict[str, Any]] = []

    for index, question in enumerate(value[:5]):
        if not isinstance(question, dict):
            continue

        label = str(question.get("label") or "").strip()

        if not label:
            continue

        style = str(
            question.get("style") or "short"
        ).lower()

        questions.append(
            {
                "id": str(
                    question.get("id")
                    or f"q{index + 1}"
                ),
                "label": label[:45],
                "placeholder": (
                    str(question.get("placeholder"))[:100]
                    if question.get("placeholder")
                    else None
                ),
                "required": bool(
                    question.get("required", True)
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

    return True


async def _button_access_allowed(
    member: discord.Member,
    button: dict[str, Any],
) -> tuple[bool, str | None]:
    required_permission = str(
        button.get("required_permission")
        or "everyone"
    )

    if not _permission_allowed(
        member,
        required_permission,
    ):
        permission_labels = {
            "manage_channels": "Manage Channels",
            "manage_guild": "Manage Server",
            "administrator": "Administrator",
        }

        return (
            False,
            "You need the **"
            + permission_labels.get(
                required_permission,
                required_permission,
            )
            + "** permission to use this ticket option.",
        )

    access_role_ids = {
        str(role_id)
        for role_id in _normalise_list(
            button.get("access_role_ids")
        )
    }

    if access_role_ids:
        member_role_ids = {
            str(role.id)
            for role in member.roles
        }

        if not access_role_ids.intersection(
            member_role_ids
        ):
            return (
                False,
                "You do not have a role that is allowed to use this ticket option.",
            )

    return True, None


async def _is_ticket_staff(
    bot: commands.Bot,
    member: discord.Member,
) -> bool:
    """Server managers or anyone holding a configured ticket support role."""

    if (
        member.guild_permissions.manage_channels
        or member.guild_permissions.administrator
    ):
        return True

    settings = await bot.repo.get_settings(
        str(member.guild.id)
    )  # type: ignore[attr-defined]

    support_role_ids = {
        str(role_id)
        for role_id in _normalise_list(
            settings.get(
                "ticket_support_role_ids"
            )
        )
    }

    if not support_role_ids:
        return False

    return any(
        str(role.id) in support_role_ids
        for role in member.roles
    )


async def _require_ticket_staff(
    bot: commands.Bot,
    interaction: discord.Interaction,
) -> None:
    member = interaction.user

    if not isinstance(member, discord.Member):
        raise ActionRefused(
            "This only works inside a server."
        )

    if not await _is_ticket_staff(
        bot,
        member,
    ):
        raise ActionRefused(
            "Only the support team "
            "(server managers or a configured ticket support role) "
            "can do that."
        )


def _ticket_label(ticket: dict[str, Any]) -> str:
    return str(
        ticket.get("button_label")
        or ticket.get("category")
        or "Support"
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
        await _require_ticket_staff(
            self.bot,
            interaction,
        )

        ticket = await self._ticket(
            interaction
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
                f"{interaction.user.mention} is handling this.",
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

        if not rows:
            await interaction.followup.send(
                embed=embeds.info(
                    "No transcript",
                    "No messages have been stored yet.",
                ),
                ephemeral=True,
            )
            return

        body_lines = [
            f"Ticket #{ticket.get('ticket_number')}",
            f"Type: {_ticket_label(ticket)}",
            f"Opened by: {ticket.get('opener_name') or ticket.get('opener_id')}",
            "",
        ]

        for row in rows:
            body_lines.append(
                "["
                + str(
                    row.get("sent_at") or ""
                )[:19]
                + "] "
                + str(
                    row.get("author_name")
                    or row.get("author_id")
                    or "Unknown"
                )
                + ": "
                + str(row.get("content") or "")
            )

        file = discord.File(
            io.BytesIO(
                "\n".join(body_lines).encode(
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
        await _require_ticket_staff(
            self.bot,
            interaction,
        )

        ticket = await self._ticket(
            interaction
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

        opener_id = ticket.get("opener_id")

        opener = (
            channel.guild.get_member(
                int(opener_id)
            )
            if opener_id
            else None
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
        await _require_ticket_staff(
            self.bot,
            interaction,
        )

        ticket = await self._ticket(
            interaction
        )

        if ticket.get("status") == "closed":
            raise ActionRefused(
                "This ticket is already closed."
            )

        await interaction.response.send_message(
            embed=embeds.warning(
                "Ticket closing",
                "The transcript is being prepared and this channel will be removed shortly.",
            )
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

        service = getattr(
            self.bot,
            "ticket_panels",
            None,
        )

        if service is None:
            from ..services.ticket_panel_service import (
                TicketPanelService,
            )

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
                "Failed to send transcript for ticket %s",
                ticket.get("id"),
            )

        channel = interaction.channel

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


class TicketFormModal(discord.ui.Modal):
    """Discord modal displayed before a configured ticket is created."""

    def __init__(
        self,
        cog: "Tickets",
        button: dict[str, Any],
        questions: list[dict[str, Any]],
    ) -> None:
        title = str(
            button.get("label")
            or "Ticket request"
        )[:45]

        super().__init__(
            title=title,
            timeout=300,
        )

        self.cog = cog
        self.button = button
        self.questions = questions

        for index, question in enumerate(
            questions[:5]
        ):
            style = (
                discord.TextStyle.paragraph
                if question.get("style")
                == "paragraph"
                else discord.TextStyle.short
            )

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
                style=style,
                custom_id=str(
                    question.get("id")
                    or f"q{index + 1}"
                )[:100],
                max_length=4000,
            )

            self.add_item(text_input)

    async def on_submit(
        self,
        interaction: discord.Interaction,
    ) -> None:
        answers: dict[str, str] = {}

        for index, question in enumerate(
            self.questions[:5]
        ):
            question_id = str(
                question.get("id")
                or f"q{index + 1}"
            )

            value = ""

            for child in self.children:
                if (
                    isinstance(
                        child,
                        discord.ui.TextInput,
                    )
                    and child.custom_id
                    == question_id
                ):
                    value = str(
                        child.value or ""
                    ).strip()
                    break

            answers[
                str(
                    question.get("label")
                    or question_id
                )
            ] = value

        await self.cog.open_configured_ticket(
            interaction,
            self.button,
            answers,
        )


class TicketPanelButton(
    discord.ui.Button
):
    """One persisted dashboard button."""

    def __init__(
        self,
        bot: commands.Bot,
        spec: dict[str, Any],
        position: int,
    ) -> None:
        self.bot = bot
        self.spec = spec

        style = BUTTON_STYLES.get(
            str(
                spec.get("style")
                or "primary"
            ),
            discord.ButtonStyle.primary,
        )

        super().__init__(
            label=str(
                spec.get("label")
                or "Create a ticket"
            )[:80],
            style=style,
            emoji=(
                str(spec.get("emoji"))
                if spec.get("emoji")
                else None
            ),
            custom_id=(
                f"{BUTTON_PREFIX}"
                f"{spec.get('id')}"
            ),
            row=min(
                position // 5,
                4,
            ),
        )

    async def callback(
        self,
        interaction: discord.Interaction,
    ) -> None:
        cog = self.bot.get_cog(
            "Tickets"
        )

        if cog is None:
            raise ActionRefused(
                "The ticket system is unavailable right now."
            )

        await cog.handle_panel_button(
            interaction,
            self.spec,
        )


class MultiTicketPanel(
    discord.ui.View
):
    """Persistent dashboard ticket panel."""

    def __init__(
        self,
        bot: commands.Bot,
        buttons: list[dict[str, Any]],
    ) -> None:
        super().__init__(timeout=None)

        for position, spec in enumerate(
            buttons[:20]
        ):
            button_id = str(
                spec.get("id") or ""
            )

            if not button_id:
                continue

            if not bool(
                spec.get(
                    "enabled",
                    True,
                )
            ):
                continue

            self.add_item(
                TicketPanelButton(
                    bot,
                    spec,
                    position,
                )
            )


class TicketPanel(discord.ui.View):
    """Legacy one-button ticket panel."""

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
                "Pick the option that best matches your request. "
                "A private channel will be created for you.",
            ),
            view=TicketOpener(cog),
            ephemeral=True,
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
    """Persist the dashboard panel and publish it to Discord."""

    specs = [
        button
        for button in (
            buttons or []
        )
        if isinstance(
            button,
            dict,
        )
        and button.get("label")
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
            bot.get_cog("Tickets")
        )

        if button_label:
            view.children[0].label = (
                str(button_label)[:80]
            )

        return await channel.send(
            embed=embed,
            view=view,
        )

    from ..services.ticket_panel_service import (
        TicketPanelService,
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

    saved = await service.create_panel(
        str(channel.guild.id),
        str(channel.id),
        title,
        description,
        created_by,
        specs,
    )

    rows = saved["buttons"]

    for spec in rows:
        if spec.get("description"):
            embed.add_field(
                name=(
                    f"{spec.get('emoji') or '🎫'} "
                    f"{str(spec['label'])[:80]}"
                ),
                value=str(
                    spec["description"]
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
        )


class Tickets(
    commands.Cog
):
    def __init__(
        self,
        bot: commands.Bot,
    ) -> None:
        self.bot = bot

    async def handle_panel_button(
        self,
        interaction: discord.Interaction,
        button: dict[str, Any],
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

        allowed, reason = (
            await _button_access_allowed(
                member,
                button,
            )
        )

        if not allowed:
            raise ActionRefused(
                reason
                or "You are not allowed to use this ticket option."
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
        member = interaction.user

        if not isinstance(
            member,
            discord.Member,
        ):
            raise ActionRefused(
                "This only works inside a server."
            )

        allowed, reason = (
            await _button_access_allowed(
                member,
                button,
            )
        )

        if not allowed:
            raise ActionRefused(
                reason
                or "You are not allowed to use this ticket option."
            )

        await self._create_ticket(
            interaction,
            category_key=(
                str(
                    button.get(
                        "category_key"
                    )
                    or button.get(
                        "category"
                    )
                    or button.get(
                        "label"
                    )
                    or "support"
                )
            ),
            button=button,
            answers=answers,
        )

    async def open_ticket(
        self,
        interaction: discord.Interaction,
        category: str,
    ) -> None:
        button = {
            "id": None,
            "label": next(
                (
                    label
                    for value, label, _
                    in CATEGORIES
                    if value == category
                ),
                category.replace(
                    "-",
                    " ",
                ).title(),
            ),
            "category": category,
            "category_key": category,
            "category_id": None,
            "support_role_ids": [],
            "access_role_ids": [],
            "required_permission": "everyone",
            "form_questions": [],
            "transcript_enabled": True,
            "transcript_channel_id": None,
            "dm_transcript_enabled": False,
        }

        await self._create_ticket(
            interaction,
            category_key=category,
            button=button,
            answers={},
        )

    async def _create_ticket(
        self,
        interaction: discord.Interaction,
        category_key: str,
        button: dict[str, Any],
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

        await interaction.response.defer(
            ephemeral=True
        )

        number = await repo.next_ticket_number(
            str(guild.id)
        )

        support_role_ids = _normalise_list(
            button.get(
                "support_role_ids"
            )
        )

        access_role_ids = _normalise_list(
            button.get(
                "access_role_ids"
            )
        )

        configured_category_id = (
            button.get(
                "category_id"
            )
            or button.get(
                "category_channel_id"
            )
        )

        parent: discord.CategoryChannel | None = None

        if configured_category_id:
            try:
                configured_channel = (
                    guild.get_channel(
                        int(
                            configured_category_id
                        )
                    )
                )
            except (
                TypeError,
                ValueError,
            ):
                configured_channel = None

            if not isinstance(
                configured_channel,
                discord.CategoryChannel,
            ):
                raise ActionRefused(
                    "The Discord category configured for this ticket button "
                    "no longer exists. Please update the button settings."
                )

            parent = configured_channel

        elif settings.get(
            "ticket_category_id"
        ):
            try:
                configured_channel = (
                    guild.get_channel(
                        int(
                            settings[
                                "ticket_category_id"
                            ]
                        )
                    )
                )
            except (
                TypeError,
                ValueError,
            ):
                configured_channel = None

            if isinstance(
                configured_channel,
                discord.CategoryChannel,
            ):
                parent = configured_channel

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
                manage_channels=True,
                read_message_history=True,
                attach_files=True,
            )

        support_mentions: list[str] = []

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

            overwrites[
                role
            ] = discord.PermissionOverwrite(
                view_channel=True,
                send_messages=True,
                read_message_history=True,
            )

            support_mentions.append(
                role.mention
            )

        channel = await guild.create_text_channel(
            name=f"ticket-{number:04d}",
            overwrites=overwrites,
            category=parent,
            reason=(
                f"AHOY ticket opened by "
                f"{interaction.user}"
            ),
        )

        transcript_enabled = bool(
            button.get(
                "transcript_enabled",
                True,
            )
        )

        transcript_channel_id = (
            button.get(
                "transcript_channel_id"
            )
            or settings.get(
                "ticket_transcript_channel_id"
            )
        )

        dm_transcript_enabled = button.get(
            "dm_transcript_enabled"
        )

        if dm_transcript_enabled is None:
            dm_transcript_enabled = settings.get(
                "ticket_dm_transcript_enabled",
                False,
            )

        ticket_payload = {
            "guild_id": str(
                guild.id
            ),
            "ticket_number": number,
            "channel_id": str(
                channel.id
            ),
            "category": category_key,
            "opener_id": str(
                interaction.user.id
            ),
            "opener_name": str(
                interaction.user
            ),
            "status": "open",
            "button_id": (
                str(button["id"])
                if button.get("id")
                else None
            ),
            "button_label": str(
                button.get("label")
                or category_key
            )[:80],
            "support_role_ids": support_role_ids,
            "access_role_ids": access_role_ids,
            "required_permission": str(
                button.get(
                    "required_permission"
                )
                or "everyone"
            ),
            "form_answers": answers,
            "transcript_enabled": transcript_enabled,
            "transcript_channel_id": (
                str(
                    transcript_channel_id
                )
                if transcript_channel_id
                else None
            ),
            "dm_transcript_enabled": bool(
                dm_transcript_enabled
            ),
        }

        try:
            ticket = await repo.create_ticket(
                ticket_payload
            )
        except Exception:
            log.exception(
                "create_ticket failed for guild %s, category %s",
                guild.id,
                category_key,
            )

            try:
                await channel.delete(
                    reason=(
                        "Ticket database record "
                        "could not be created"
                    )
                )
            except discord.HTTPException:
                pass

            raise ActionRefused(
                "The ticket channel could not be saved. "
                "Please try again."
            )

        label = str(
            button.get(
                "label"
            )
            or next(
                (
                    lbl
                    for val, lbl, _
                    in CATEGORIES
                    if val == category_key
                ),
                category_key.replace(
                    "-",
                    " ",
                ).title(),
            )
        )

        description = (
            settings.get(
                "ticket_welcome_message"
            )
            or "Ahoy! A crew member will be with you shortly. ⚓"
        )

        embed = embeds.brand(
            f"Ticket #{number:04d} · {label}",
            description,
        )

        embed.add_field(
            name="Opened by",
            value=interaction.user.mention,
            inline=True,
        )

        if parent is not None:
            embed.add_field(
                name="Ticket category",
                value=parent.name,
                inline=True,
            )

        if answers:
            answer_lines = []

            for question, answer in answers.items():
                answer_lines.append(
                    f"**{question}**\n"
                    f"{answer or 'No answer provided.'}"
                )

            answer_text = "\n\n".join(
                answer_lines
            )

            if len(answer_text) > 3900:
                answer_text = (
                    answer_text[:3897]
                    + "..."
                )

            embed.add_field(
                name="Form responses",
                value=answer_text,
                inline=False,
            )

        mention_content = " ".join(
            [
                interaction.user.mention,
                *support_mentions,
            ]
        ).strip()

        allowed_mentions = discord.AllowedMentions(
            users=True,
            roles=True,
            everyone=False,
        )

        await channel.send(
            content=mention_content or None,
            embed=embed,
            view=TicketControls(
                self.bot
            ),
            allowed_mentions=allowed_mentions,
        )

        await interaction.followup.send(
            embed=embeds.success(
                "Ticket created",
                f"Your ticket: {channel.mention}",
            ),
            ephemeral=True,
        )

        log.info(
            "Ticket %s opened in guild %s using button %s",
            ticket.get("id"),
            guild.id,
            button.get("id")
            or category_key,
        )

    @commands.Cog.listener()
    async def on_interaction(
        self,
        interaction: discord.Interaction,
    ) -> None:
        """Compatibility handler for older dashboard-created button IDs."""

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


async def setup(
    bot: commands.Bot,
) -> None:
    bot.add_view(
        TicketControls(bot)
    )

    bot.add_view(
        TicketPanel(
            bot.get_cog("Tickets")
        )
    )

    await bot.add_cog(
        Tickets(bot)
    )
