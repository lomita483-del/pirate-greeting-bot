"""Persistent ticket panel configuration and transcript delivery."""

from __future__ import annotations

import io
import json
from typing import Any, Optional

import discord

from ..utils.logger import get_logger

log = get_logger("ticket_panel_service")

VALID_STYLES = {
    "primary",
    "secondary",
    "success",
    "danger",
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
        for ch in value
    ).strip("-")

    return (slug or "support")[:40]


def _clean_questions(
    raw: Any,
) -> list[dict[str, Any]]:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except (ValueError, TypeError):
            raw = []

    if not isinstance(raw, list):
        return []

    questions: list[dict[str, Any]] = []

    for index, item in enumerate(raw[:5]):
        if not isinstance(item, dict):
            continue

        label = str(
            item.get("label")
            or ""
        ).strip()

        if not label:
            continue

        style = str(
            item.get("style")
            or "short"
        ).lower()

        if style not in {
            "short",
            "paragraph",
        }:
            style = "short"

        placeholder = item.get(
            "placeholder"
        )

        questions.append(
            {
                "id": str(
                    item.get("id")
                    or f"q{index + 1}"
                )[:80],
                "label": label[:45],
                "placeholder": (
                    str(placeholder)[:100]
                    if placeholder
                    else None
                ),
                "required": bool(
                    item.get(
                        "required",
                        True,
                    )
                ),
                "style": style,
            }
        )

    return questions


class TicketPanelService:
    def __init__(
        self,
        bot,
    ) -> None:
        self.bot = bot

    @property
    def repo(self):
        return self.bot.repo

    async def create_panel(
        self,
        guild_id: str,
        channel_id: str,
        title: Optional[str],
        description: Optional[str],
        created_by: Optional[str],
        buttons: list[dict[str, Any]],
    ) -> dict[str, Any]:
        panel = await self.repo.create_ticket_panel(
            {
                "guild_id": str(guild_id),
                "channel_id": str(channel_id),
                "title": title,
                "description": description,
                "created_by": created_by,
                "enabled": True,
            }
        )

        if not panel or not panel.get("id"):
            raise RuntimeError(
                "The ticket panel could not be saved."
            )

        button_rows: list[
            dict[str, Any]
        ] = []

        for position, button in enumerate(
            buttons[:20]
        ):
            label = str(
                button.get("label")
                or "Create a ticket"
            )[:80]

            style = str(
                button.get("style")
                or "primary"
            )

            permission = str(
                button.get(
                    "required_permission"
                )
                or "everyone"
            )

            category_id = (
                str(
                    button["category_id"]
                )
                if button.get("category_id")
                else None
            )

            category = _slugify(
                str(
                    button.get("category")
                    or label
                )
            )

            support_role_ids = [
                str(value)
                for value in (
                    button.get(
                        "support_role_ids"
                    )
                    or []
                )
            ][:25]

            access_role_ids = [
                str(value)
                for value in (
                    button.get(
                        "access_role_ids"
                    )
                    or []
                )
            ][:25]

            questions = _clean_questions(
                button.get(
                    "form_questions"
                )
                or button.get(
                    "form_fields"
                )
                or []
            )

            transcript_channel_id = (
                str(
                    button[
                        "transcript_channel_id"
                    ]
                )
                if button.get(
                    "transcript_channel_id"
                )
                else None
            )

            payload = {
                "panel_id": panel["id"],
                "guild_id": str(guild_id),
                "position": position,
                "label": label,
                "description": (
                    str(
                        button["description"]
                    )[:200]
                    if button.get(
                        "description"
                    )
                    else None
                ),
                "emoji": (
                    str(
                        button["emoji"]
                    )[:8]
                    if button.get("emoji")
                    else None
                ),
                "style": (
                    style
                    if style in VALID_STYLES
                    else "primary"
                ),
                "category_id": category_id,
                "category_channel_id": category_id,
                "category": category,
                "category_key": category,
                "support_role_ids": support_role_ids,
                "access_role_ids": access_role_ids,
                "required_permission": (
                    permission
                    if permission
                    in VALID_PERMISSIONS
                    else "everyone"
                ),
                "form_questions": questions,
                "form_fields": questions,
                "transcript_enabled": bool(
                    button.get(
                        "transcript_enabled",
                        True,
                    )
                ),
                "transcript_channel_id": (
                    transcript_channel_id
                ),
                "dm_transcript_enabled": bool(
                    button.get(
                        "dm_transcript_enabled",
                        False,
                    )
                ),
                "enabled": True,
            }

            row = await self.repo.create_ticket_panel_button(
                payload
            )

            if row:
                button_rows.append(row)

        if not button_rows:
            raise RuntimeError(
                "None of the panel buttons could be saved."
            )

        return {
            "panel": panel,
            "buttons": button_rows,
        }

    async def set_message_id(
        self,
        panel_id: str,
        message_id: str,
    ) -> None:
        await self.repo.update_ticket_panel_message(
            str(panel_id),
            str(message_id),
        )

    async def get_button(
        self,
        button_id: str,
    ) -> dict[str, Any]:
        return await self.repo.get_ticket_panel_button(
            str(button_id)
        )

    def _answers_block(
        self,
        ticket: dict[str, Any],
    ) -> list[str]:
        answers = ticket.get(
            "form_answers"
        ) or {}

        if isinstance(answers, str):
            try:
                answers = json.loads(
                    answers
                )
            except (
                ValueError,
                TypeError,
            ):
                answers = {}

        if (
            not isinstance(
                answers,
                dict,
            )
            or not answers
        ):
            return []

        lines = [
            "--- Form answers ---"
        ]

        for key, value in answers.items():
            lines.append(
                f"{key}: {value}"
            )

        lines.append(
            "--- Conversation ---"
        )

        return lines

    async def transcript_text(
        self,
        ticket: dict[str, Any],
    ) -> str:
        kind = (
            ticket.get("button_label")
            or ticket.get("category")
            or "Support"
        )

        opener = (
            ticket.get("opener_name")
            or ticket.get("opener_id")
        )

        lines = [
            f"Ticket #{ticket.get('ticket_number')}",
            f"Type: {kind}",
            f"Opened by: {opener}",
            "",
        ]

        lines.extend(
            self._answers_block(
                ticket
            )
        )

        rows = await self.repo.ticket_transcript(
            ticket["id"]
        )

        if not rows:
            lines.append(
                "No messages were recorded."
            )
        else:
            for row in rows:
                sent_at = str(
                    row.get("sent_at")
                    or ""
                )[:19]

                author = str(
                    row.get(
                        "author_name"
                    )
                    or row.get(
                        "author_id"
                    )
                    or "Unknown"
                )

                content = str(
                    row.get(
                        "content"
                    )
                    or ""
                )

                lines.append(
                    f"[{sent_at}] "
                    f"{author}: "
                    f"{content}"
                )

        return "\n".join(lines)

    async def send_transcript(
        self,
        ticket: dict[str, Any],
        guild: discord.Guild,
    ) -> None:
        """Send transcript to configured channel and/or ticket owner's DM."""

        try:
            settings = await self.repo.get_settings(
                str(guild.id)
            )
        except Exception:
            log.exception(
                "Could not load ticket transcript settings."
            )
            settings = {}

        transcript_enabled = ticket.get(
            "transcript_enabled"
        )

        if transcript_enabled is None:
            transcript_enabled = settings.get(
                "ticket_transcripts_enabled",
                True,
            )

        if not bool(
            transcript_enabled
        ):
            return

        try:
            body = await self.transcript_text(
                ticket
            )
        except Exception:
            log.exception(
                "Could not build transcript for ticket %s",
                ticket.get("id"),
            )
            return

        file_bytes = body.encode(
            "utf-8",
            errors="replace",
        )

        filename = (
            f"ahoy-ticket-"
            f"{ticket.get('ticket_number')}.txt"
        )

        channel_id = (
            ticket.get(
                "transcript_channel_id"
            )
            or settings.get(
                "ticket_transcript_channel_id"
            )
        )

        if channel_id:
            try:
                channel = guild.get_channel(
                    int(channel_id)
                )

                if isinstance(
                    channel,
                    discord.TextChannel,
                ):
                    kind = (
                        ticket.get("button_label")
                        or ticket.get("category")
                        or "Support"
                    )

                    await channel.send(
                        content=(
                            "📄 **Ticket transcript**\n"
                            f"Ticket: `#{ticket.get('ticket_number')}`\n"
                            f"Type: `{kind}`\n"
                            "Opened by: "
                            f"<@{ticket.get('opener_id')}>"
                        ),
                        file=discord.File(
                            io.BytesIO(
                                file_bytes
                            ),
                            filename=filename,
                        ),
                        allowed_mentions=discord.AllowedMentions(
                            users=True,
                            roles=False,
                            everyone=False,
                        ),
                    )

            except (
                discord.HTTPException,
                ValueError,
                TypeError,
            ) as exc:
                log.warning(
                    "Failed sending ticket transcript "
                    "to channel: %s",
                    exc,
                )

        dm_enabled = ticket.get(
            "dm_transcript_enabled"
        )

        if dm_enabled is None:
            dm_enabled = settings.get(
                "ticket_dm_transcript_enabled",
                False,
            )

        if not bool(dm_enabled):
            return

        try:
            opener_id = int(
                ticket["opener_id"]
            )

            user = (
                guild.get_member(opener_id)
                or await self.bot.fetch_user(
                    opener_id
                )
            )

            await user.send(
                content=(
                    "📄 **Your ticket transcript**\n"
                    f"Ticket: `#{ticket.get('ticket_number')}`\n\n"
                    "Your ticket has been closed. "
                    "The transcript is attached below."
                ),
                file=discord.File(
                    io.BytesIO(
                        file_bytes
                    ),
                    filename=filename,
                ),
            )

        except (
            discord.Forbidden,
            discord.HTTPException,
            KeyError,
            TypeError,
            ValueError,
        ) as exc:
            log.warning(
                "Could not DM ticket transcript "
                "to opener: %s",
                exc,
            )


__all__ = [
    "TicketPanelService",
    "_clean_questions",
    "_slugify",
]
