"""AHOY ticket system.

Supports:
- Persistent dashboard-created ticket panels
- Per-button Discord category routing
- Per-button support roles
- Per-button access roles
- Per-button permission requirements
- Per-button Discord modal forms
- Form answers inside the ticket
- Automatic ticket message transcripts
- Transcript channel delivery
- Ticket-owner DM transcripts
- Claim / lock / transcript / close controls
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
from ..utils.checks import ActionRefused, ensure_bot_permission, ensure_guild
from ..utils.logger import get_logger

log = get_logger("tickets")

BUTTON_PREFIX = "ahoy:ticket:btn:"
MODAL_PREFIX = "ahoy:ticket:modal:"

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


def _safe_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _parse_json_object(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value

    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except (ValueError, TypeError):
            return {}

    return {}


def _normalise_questions(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            value = []

    if not isinstance(value, list):
        return []

    result: list[dict[str, Any]] = []

    for index, item in enumerate(value[:5]):
        if not isinstance(item, dict):
            continue

        label = str(item.get("label") or "").strip()
        if not label:
            continue

        question_id = str(item.get("id") or f"q{index + 1}")[:80]

        style = str(item.get("style") or "short").lower()
        if style not in {"short", "paragraph"}:
            style = "short"

        placeholder = item.get("placeholder")
        if placeholder is not None:
            placeholder = str(placeholder)[:100]

        result.append(
            {
                "id": question_id,
                "label": label[:45],
                "placeholder": placeholder,
                "required": bool(item.get("required", True)),
                "style": style,
            }
        )

    return result


def _member_has_required_permission(
    member: discord.Member,
    permission: str,
) -> bool:
    permission = str(permission or "everyone")

    if permission == "everyone":
        return True

    if permission == "administrator":
        return member.guild_permissions.administrator

    if permission == "manage_guild":
        return (
            member.guild_permissions.manage_guild
            or member.guild_permissions.administrator
        )

    if permission == "manage_channels":
        return (
            member.guild_permissions.manage_channels
            or member.guild_permissions.administrator
        )

    return True


def _member_has_access_roles(
    member: discord.Member,
    role_ids: list[str],
) -> bool:
    if not role_ids:
        return True

    member_role_ids = {str(role.id) for role in member.roles}

    return any(str(role_id) in member_role_ids for role_id in role_ids)


async def _is_ticket_staff(
    bot: commands.Bot,
    member: discord.Member,
    ticket: dict[str, Any] | None = None,
) -> bool:
    """Server managers or the configured support team can manage tickets."""

    if (
        member.guild_permissions.manage_channels
        or member.guild_permissions.administrator
    ):
        return True

    role_ids: list[str] = []

    if ticket:
        raw = ticket.get("support_role_ids") or []

        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except (ValueError, TypeError):
                raw = []

        if isinstance(raw, list):
            role_ids.extend(str(value) for value in raw)

    if not role_ids:
        settings = await bot.repo.get_settings(str(member.guild.id))  # type: ignore[attr-defined]

        raw = settings.get("ticket_support_role_ids") or []

        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except (ValueError, TypeError):
                raw = []

        if isinstance(raw, list):
            role_ids.extend(str(value) for value in raw)

    if not role_ids:
        return False

    member_roles = {str(role.id) for role in member.roles}

    return bool(member_roles.intersection(role_ids))


async def _require_ticket_staff(
    bot: commands.Bot,
    interaction: discord.Interaction,
    ticket: dict[str, Any] | None = None,
) -> None:
    member = interaction.user

    if not isinstance(member, discord.Member):
        raise ActionRefused("This only works inside a server.")

    if not await _is_ticket_staff(bot, member, ticket):
        raise ActionRefused(
            "Only the configured support team or server managers can do that."
        )


class TicketControls(discord.ui.View):
    """Persistent controls attached to every private ticket channel."""

    def __init__(self, bot: commands.Bot) -> None:
        super().__init__(timeout=None)
        self.bot = bot

    async def _ticket(self, interaction: discord.Interaction) -> dict[str, Any]:
        ticket = await self.bot.repo.get_ticket_by_channel(  # type: ignore[attr-defined]
            str(interaction.channel_id)
        )

        if not ticket:
            raise ActionRefused("This channel is not a tracked ticket.")

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
            raise ActionRefused("This ticket is already closed.")

        await self.bot.repo.update_ticket(  # type: ignore[attr-defined]
            ticket["id"],
            {
                "claimed_by": str(interaction.user.id),
                "status": "claimed",
            },
        )

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

        await interaction.response.defer(ephemeral=True)

        service = TicketPanelService(self.bot)
        body = await service.transcript_text(ticket)

        file = discord.File(
            io.BytesIO(body.encode("utf-8", errors="replace")),
            filename=f"ahoy-ticket-{ticket.get('ticket_number')}.txt",
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
        ticket = await self._ticket(interaction)

        await _require_ticket_staff(
            self.bot,
            interaction,
            ticket,
        )

        if ticket.get("status") == "closed":
            raise ActionRefused("This ticket is already closed.")

        channel = interaction.channel

        if not isinstance(channel, discord.TextChannel):
            raise ActionRefused(
                "This only works inside a ticket text channel."
            )

        opener_id = _safe_int(ticket.get("opener_id"))

        if opener_id is None:
            raise ActionRefused(
                "Could not determine who opened this ticket."
            )

        opener = channel.guild.get_member(opener_id)

        if opener is None:
            try:
                fetched = await self.bot.fetch_user(opener_id)
                opener = (
                    fetched
                    if isinstance(fetched, discord.Member)
                    else None
                )
            except discord.HTTPException:
                opener = None

        if opener is None:
            raise ActionRefused(
                "Could not find the person who opened this ticket."
            )

        overwrite = channel.overwrites_for(opener)

        currently_locked = overwrite.send_messages is False

        overwrite.send_messages = (
            None if currently_locked else False
        )

        await channel.set_permissions(
            opener,
            overwrite=overwrite,
            reason=(
                f"Ticket {'unlocked' if currently_locked else 'locked'} "
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
            raise ActionRefused("This ticket is already closed.")

        await interaction.response.defer(ephemeral=True)

        await self.bot.repo.update_ticket(  # type: ignore[attr-defined]
            ticket["id"],
            {
                "status": "closed",
                "closed_by": str(interaction.user.id),
                "closed_at": discord.utils.utcnow().isoformat(),
            },
        )

        channel = interaction.channel

        # Send the transcript BEFORE deleting the ticket channel.
        service = TicketPanelService(self.bot)

        try:
            if isinstance(channel, discord.TextChannel):
                await service.send_transcript(
                    ticket,
                    channel.guild,
                )
        except Exception:
            log.exception(
                "Transcript delivery failed during ticket closure."
            )

        await interaction.followup.send(
            embed=embeds.warning(
                "Ticket closing",
                "The ticket transcript has been processed. "
                "This channel will now be removed.",
            ),
            ephemeral=True,
        )

        if isinstance(channel, discord.TextChannel):
            try:
                await channel.delete(
                    reason=f"Ticket closed by {interaction.user}"
                )
            except discord.HTTPException as exc:
                log.warning(
                    "Failed to delete ticket channel: %s",
                    exc,
                )


class TicketFormModal(discord.ui.Modal):
    """Dynamic Discord modal generated from a panel button's form."""

    def __init__(
        self,
        cog: "Tickets",
        button: dict[str, Any],
        questions: list[dict[str, Any]],
    ) -> None:
        title = str(
            button.get("label")
            or "Ticket form"
        )[:45]

        super().__init__(
            title=title,
            custom_id=(
                f"{MODAL_PREFIX}"
                f"{str(button.get('id'))}"
            ),
            timeout=300,
        )

        self.cog = cog
        self.button = button
        self.questions = questions
        self.inputs: list[tuple[dict[str, Any], discord.ui.TextInput]] = []

        for index, question in enumerate(questions[:5]):
            style = (
                discord.TextStyle.paragraph
                if question.get("style") == "paragraph"
                else discord.TextStyle.short
            )

            text_input = discord.ui.TextInput(
                label=str(question.get("label") or f"Question {index + 1}")[:45],
                placeholder=(
                    str(question.get("placeholder"))[:100]
                    if question.get("placeholder")
                    else None
                ),
                required=bool(question.get("required", True)),
                style=style,
                custom_id=str(
                    question.get("id")
                    or f"q{index + 1}"
                )[:100],
                max_length=4000 if style == discord.TextStyle.paragraph else 1000,
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
            self.button,
            answers,
        )


class MultiTicketPanel(discord.ui.View):
    """Persistent dashboard-created panel.

    Every button contains its database button UUID.

    Therefore:
        Discord button
          -> exact DB button row
          -> exact category
          -> exact support roles
          -> exact access roles
          -> exact form
          -> exact transcript configuration
    """

    def __init__(
        self,
        buttons: list[dict[str, Any]],
    ) -> None:
        super().__init__(timeout=None)

        for spec in buttons[:20]:
            button_id = str(spec.get("id") or "")

            if not button_id:
                continue

            label = str(
                spec.get("label")
                or "Create a ticket"
            )[:80]

            style = BUTTON_STYLES.get(
                str(spec.get("style") or "primary"),
                discord.ButtonStyle.primary,
            )

            self.add_item(
                discord.ui.Button(
                    label=label,
                    style=style,
                    emoji=spec.get("emoji") or None,
                    custom_id=f"{BUTTON_PREFIX}{button_id}",
                )
            )


async def post_ticket_panel(
    bot: commands.Bot,
    channel: discord.TextChannel,
    title: str | None,
    description: str | None,
    button_label: str | None,
    buttons: list[dict[str, Any]] | None = None,
    created_by: str | None = None,
) -> discord.Message:
    """Persist a dashboard panel and publish it to Discord."""

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
            "Pick the option that matches your request. "
            "A private channel will be created for you "
            "and the crew only."
        ),
    )

    if not specs:
        # Legacy fallback.
        view = TicketPanel(bot.get_cog("Tickets"))

        if button_label and view.children:
            child = view.children[0]

            if isinstance(child, discord.ui.Button):
                child.label = button_label[:80]

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
        service = TicketPanelService(bot)
        bot.ticket_panels = service

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
        view=MultiTicketPanel(rows),
    )

    await service.set_message_id(
        saved["panel"]["id"],
        str(message.id),
    )

    return message


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

        guild = ensure_guild(interaction)

        settings = await interaction.client.repo.get_settings(  # type: ignore[attr-defined]
            str(guild.id)
        )

        if not settings.get("tickets_enabled"):
            raise ActionRefused(
                "Tickets are disabled in this server."
            )

        await cog.open_ticket(
            interaction,
            {
                "id": None,
                "label": "General Support",
                "category": "general",
                "category_id": settings.get(
                    "ticket_category_id"
                ),
                "support_role_ids": settings.get(
                    "ticket_support_role_ids"
                ) or [],
                "access_role_ids": [],
                "required_permission": "everyone",
                "form_questions": [],
                "transcript_enabled": settings.get(
                    "ticket_transcripts_enabled",
                    True,
                ),
                "transcript_channel_id": settings.get(
                    "ticket_transcript_channel_id"
                ),
                "dm_transcript_enabled": settings.get(
                    "ticket_dm_transcript_enabled",
                    False,
                ),
            },
            {},
        )


class Tickets(commands.Cog):
    def __init__(
        self,
        bot: commands.Bot,
    ) -> None:
        self.bot = bot

        if not hasattr(bot, "ticket_panels"):
            bot.ticket_panels = TicketPanelService(bot)

    @commands.Cog.listener()
    async def on_message(
        self,
        message: discord.Message,
    ) -> None:
        """Record messages belonging to tracked tickets."""

        if message.author.bot:
            return

        if not message.guild:
            return

        if not message.channel:
            return

        try:
            ticket = await self.bot.repo.get_ticket_by_channel(  # type: ignore[attr-defined]
                str(message.channel.id)
            )
        except Exception:
            return

        if not ticket:
            return

        content = message.content or ""

        if message.attachments:
            attachment_lines = "\n".join(
                attachment.url
                for attachment in message.attachments
            )

            if content:
                content = (
                    f"{content}\n\n"
                    f"Attachments:\n{attachment_lines}"
                )
            else:
                content = (
                    f"Attachments:\n{attachment_lines}"
                )

        if not content:
            content = "[Embed / non-text message]"

        try:
            await self.bot.repo.add_ticket_message(  # type: ignore[attr-defined]
                ticket["id"],
                message.author,
                content,
            )
        except Exception:
            log.exception(
                "Could not record ticket message for channel %s",
                message.channel.id,
            )

    @commands.Cog.listener()
    async def on_interaction(
        self,
        interaction: discord.Interaction,
    ) -> None:
        """Handle dashboard-created ticket buttons."""

        data = interaction.data or {}

        custom_id = str(
            data.get("custom_id")
            or ""
        )

        if not custom_id.startswith(BUTTON_PREFIX):
            return

        button_id = custom_id[len(BUTTON_PREFIX):]

        if not button_id:
            raise ActionRefused(
                "This ticket button is invalid."
            )

        guild = ensure_guild(interaction)

        settings = await self.bot.repo.get_settings(  # type: ignore[attr-defined]
            str(guild.id)
        )

        if not settings.get("tickets_enabled"):
            raise ActionRefused(
                "Tickets are disabled in this server."
            )

        button = await self.bot.repo.get_ticket_panel_button(  # type: ignore[attr-defined]
            button_id
        )

        if not button:
            raise ActionRefused(
                "This ticket button is no longer configured."
            )

        member = interaction.user

        if not isinstance(member, discord.Member):
            raise ActionRefused(
                "This ticket button can only be used inside a server."
            )

        required_permission = str(
            button.get("required_permission")
            or "everyone"
        )

        if required_permission not in VALID_PERMISSIONS:
            required_permission = "everyone"

        if not _member_has_required_permission(
            member,
            required_permission,
        ):
            raise ActionRefused(
                "You do not have the required Discord permission "
                "to use this ticket option."
            )

        access_role_ids = button.get(
            "access_role_ids"
        ) or []

        if isinstance(access_role_ids, str):
            try:
                access_role_ids = json.loads(
                    access_role_ids
                )
            except (ValueError, TypeError):
                access_role_ids = []

        if not isinstance(access_role_ids, list):
            access_role_ids = []

        access_role_ids = [
            str(value)
            for value in access_role_ids
        ]

        if not _member_has_access_roles(
            member,
            access_role_ids,
        ):
            raise ActionRefused(
                "You do not have one of the roles required "
                "to use this ticket option."
            )

        questions = _normalise_questions(
            button.get("form_questions")
            or button.get("form_fields")
            or []
        )

        if questions:
            modal = TicketFormModal(
                self,
                button,
                questions,
            )

            await interaction.response.send_modal(
                modal
            )

            return

        await self.open_ticket(
            interaction,
            button,
            {},
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
        guild = ensure_guild(interaction)

        settings = await self.bot.repo.get_settings(  # type: ignore[attr-defined]
            str(guild.id)
        )

        if not settings.get("tickets_enabled"):
            raise ActionRefused(
                "Tickets are disabled here. "
                "An administrator can enable them in "
                "the AHOY Control Center."
            )

        await interaction.response.send_message(
            embed=embeds.brand(
                "Open a ticket",
                "Choose the type of request you need help with.",
            ),
            view=TicketOpener(self),
            ephemeral=True,
        )

    async def open_ticket(
        self,
        interaction: discord.Interaction,
        button: dict[str, Any],
        answers: dict[str, str] | None = None,
    ) -> None:
        guild = ensure_guild(interaction)

        ensure_bot_permission(
            guild,
            "manage_channels",
        )

        repo = self.bot.repo  # type: ignore[attr-defined]

        settings = await repo.get_settings(
            str(guild.id)
        )

        answers = answers or {}

        await interaction.response.defer(
            ephemeral=True
        )

        number = await repo.next_ticket_number(
            str(guild.id)
        )

        button_label = str(
            button.get("label")
            or "Support"
        )[:80]

        internal_category = str(
            button.get("category")
            or button_label
        ).strip()

        if not internal_category:
            internal_category = "support"

        support_role_ids = button.get(
            "support_role_ids"
        ) or []

        if isinstance(support_role_ids, str):
            try:
                support_role_ids = json.loads(
                    support_role_ids
                )
            except (ValueError, TypeError):
                support_role_ids = []

        if not isinstance(support_role_ids, list):
            support_role_ids = []

        support_role_ids = [
            str(value)
            for value in support_role_ids
            if str(value).strip()
        ]

        access_role_ids = button.get(
            "access_role_ids"
        ) or []

        if isinstance(access_role_ids, str):
            try:
                access_role_ids = json.loads(
                    access_role_ids
                )
            except (ValueError, TypeError):
                access_role_ids = []

        if not isinstance(access_role_ids, list):
            access_role_ids = []

        access_role_ids = [
            str(value)
            for value in access_role_ids
            if str(value).strip()
        ]

        # IMPORTANT:
        # The button's category_id wins.
        # The old global ticket_category_id is only used as a fallback
        # for legacy buttons that have no per-button category configured.
        category_id = (
            button.get("category_id")
            or button.get("category_channel_id")
            or settings.get("ticket_category_id")
        )

        parent: discord.CategoryChannel | None = None

        if category_id:
            category_channel = guild.get_channel(
                int(category_id)
            )

            if isinstance(
                category_channel,
                discord.CategoryChannel,
            ):
                parent = category_channel

        overwrites: dict[
            discord.Role | discord.Member,
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

        if guild.me is not None:
            overwrites[guild.me] = discord.PermissionOverwrite(
                view_channel=True,
                send_messages=True,
                manage_channels=True,
                read_message_history=True,
                attach_files=True,
            )

        support_mentions: list[str] = []

        for role_id in support_role_ids:
            role = guild.get_role(
                int(role_id)
            )

            if role is None:
                continue

            overwrites[role] = discord.PermissionOverwrite(
                view_channel=True,
                send_messages=True,
                read_message_history=True,
                attach_files=True,
            )

            support_mentions.append(
                role.mention
            )

        try:
            channel = await guild.create_text_channel(
                name=f"ticket-{number:04d}",
                overwrites=overwrites,
                category=parent,
                reason=(
                    f"AHOY ticket '{button_label}' "
                    f"opened by {interaction.user}"
                ),
            )
        except discord.HTTPException:
            log.exception(
                "Could not create ticket channel."
            )
            raise

        transcript_enabled = bool(
            button.get(
                "transcript_enabled",
                settings.get(
                    "ticket_transcripts_enabled",
                    True,
                ),
            )
        )

        transcript_channel_id = (
            button.get("transcript_channel_id")
            or settings.get(
                "ticket_transcript_channel_id"
            )
        )

        dm_transcript_enabled = bool(
            button.get(
                "dm_transcript_enabled",
                settings.get(
                    "ticket_dm_transcript_enabled",
                    False,
                ),
            )
        )

        ticket_payload = {
            "guild_id": str(guild.id),
            "ticket_number": number,
            "channel_id": str(channel.id),
            "category": internal_category,
            "subject": button_label,
            "button_id": (
                str(button.get("id"))
                if button.get("id")
                else None
            ),
            "button_label": button_label,
            "opener_id": str(
                interaction.user.id
            ),
            "opener_name": str(
                interaction.user
            ),
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
                str(transcript_channel_id)
                if transcript_channel_id
                else None
            ),
            "dm_transcript_enabled": dm_transcript_enabled,
            "status": "open",
        }

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
                    reason="AHOY ticket database save failed"
                )
            except discord.HTTPException:
                pass

            raise

        welcome_message = (
            settings.get(
                "ticket_welcome_message"
            )
            or "Ahoy! A crew member will be with you shortly. ⚓"
        )

        embed = embeds.brand(
            f"Ticket #{number:04d} · {button_label}",
            welcome_message,
        )

        embed.add_field(
            name="Opened by",
            value=interaction.user.mention,
            inline=True,
        )

        if parent is not None:
            embed.add_field(
                name="Category",
                value=parent.name,
                inline=True,
            )

        if answers:
            answer_lines: list[str] = []

            for key, value in answers.items():
                clean_key = str(key).replace(
                    "_",
                    " ",
                ).title()

                answer_lines.append(
                    f"**{clean_key}:**\n"
                    f"{str(value)[:1000]}"
                )

            answer_text = "\n\n".join(
                answer_lines
            )

            embed.add_field(
                name="Form answers",
                value=answer_text[:1024],
                inline=False,
            )

        mention_content = interaction.user.mention

        if support_mentions:
            mention_content += (
                "\n"
                + " ".join(support_mentions)
            )

        allowed_mentions = discord.AllowedMentions(
            users=True,
            roles=True,
            everyone=False,
        )

        await channel.send(
            content=mention_content,
            embed=embed,
            view=TicketControls(self.bot),
            allowed_mentions=allowed_mentions,
        )

        if answers:
            # Store the submitted form as the first transcript entry.
            form_text = "\n".join(
                f"{key}: {value}"
                for key, value in answers.items()
            )

            try:
                await repo.add_ticket_message(
                    str(ticket["id"]),
                    interaction.user,
                    "[FORM SUBMISSION]\n"
                    + form_text,
                )
            except Exception:
                log.exception(
                    "Could not store ticket form submission."
                )

        await interaction.followup.send(
            embed=embeds.success(
                "Ticket created",
                f"Your ticket: {channel.mention}",
            ),
            ephemeral=True,
        )

        log.info(
            "Ticket #%s opened in guild %s using button '%s' "
            "and category %s",
            number,
            guild.id,
            button_label,
            category_id or "default",
        )


class TicketOpener(discord.ui.View):
    def __init__(
        self,
        cog: "Tickets",
    ) -> None:
        super().__init__(timeout=120)
        self.cog = cog

        self.add_item(
            TicketCategorySelect(cog)
        )


class TicketCategorySelect(discord.ui.Select):
    def __init__(
        self,
        cog: "Tickets",
    ) -> None:
        super().__init__(
            placeholder="Choose a ticket category…",
            options=[
                discord.SelectOption(
                    label="General Support",
                    value="general",
                    description="Questions and general help",
                ),
                discord.SelectOption(
                    label="Report",
                    value="report",
                    description="Report a member or issue",
                ),
                discord.SelectOption(
                    label="Partnership",
                    value="partnership",
                    description="Collaborations and partnerships",
                ),
                discord.SelectOption(
                    label="Other",
                    value="other",
                    description="Anything else",
                ),
            ],
        )

        self.cog = cog

    async def callback(
        self,
        interaction: discord.Interaction,
    ) -> None:
        category = self.values[0]

        await self.cog.open_ticket(
            interaction,
            {
                "id": None,
                "label": category.title(),
                "category": category,
                "category_id": None,
                "support_role_ids": [],
                "access_role_ids": [],
                "required_permission": "everyone",
                "form_questions": [],
                "transcript_enabled": True,
                "transcript_channel_id": None,
                "dm_transcript_enabled": False,
            },
            {},
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
