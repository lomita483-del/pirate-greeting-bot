"""Persistent ticket panel configuration and transcript helpers."""

from __future__ import annotations

from typing import Any, Optional

import discord

from ..utils.logger import get_logger

log = get_logger("ticket_panel_service")


class TicketPanelService:
    def __init__(self, bot) -> None:
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

        result = await self.repo.db.run(
            lambda c: c.table("ticket_panels")
            .insert(
                {
                    "guild_id": guild_id,
                    "channel_id": channel_id,
                    "title": title,
                    "description": description,
                    "created_by": created_by,
                    "enabled": True,
                }
            )
            .execute()
        )

        rows = getattr(result, "data", None) or []

        if not rows:
            raise RuntimeError(
                "The ticket panel could not be saved."
            )

        panel = rows[0]

        button_rows: list[dict[str, Any]] = []

        for position, button in enumerate(buttons[:20]):
            result = await self.repo.db.run(
                lambda c, b=button, p=position: c
                .table("ticket_panel_buttons")
                .insert(
                    {
                        "panel_id": panel["id"],
                        "position": p,
                        "label": str(
                            b.get("label")
                            or "Create a ticket"
                        )[:80],
                        "description": (
                            str(
                                b.get("description")
                            )[:200]
                            if b.get("description")
                            else None
                        ),
                        "emoji": (
                            str(b["emoji"])[:8]
                            if b.get("emoji")
                            else None
                        ),
                        "style": str(
                            b.get("style")
                            or "primary"
                        ),
                        "category_id": (
                            str(b["category_id"])
                            if b.get("category_id")
                            else None
                        ),
                        "category_key": (
                            str(b["category"])
                            if b.get("category")
                            else None
                        ),
                        "support_role_ids": [
                            str(x)
                            for x in (
                                b.get(
                                    "support_role_ids"
                                )
                                or []
                            )
                        ],
                        "access_role_ids": [
                            str(x)
                            for x in (
                                b.get(
                                    "access_role_ids"
                                )
                                or []
                            )
                        ],
                        "required_permission": str(
                            b.get(
                                "required_permission"
                            )
                            or "everyone"
                        ),
                        "form_questions": (
                            b.get(
                                "form_questions"
                            )
                            or []
                        )[:5],
                        "transcript_enabled": bool(
                            b.get(
                                "transcript_enabled",
                                True,
                            )
                        ),
                        "transcript_channel_id": (
                            str(
                                b[
                                    "transcript_channel_id"
                                ]
                            )
                            if b.get(
                                "transcript_channel_id"
                            )
                            else None
                        ),
                        "dm_transcript_enabled": bool(
                            b.get(
                                "dm_transcript_enabled",
                                False,
                            )
                        ),
                    }
                )
                .execute()
            )

            rows = getattr(
                result,
                "data",
                None,
            ) or []

            if rows:
                button_rows.append(rows[0])

        return {
            "panel": panel,
            "buttons": button_rows,
        }

    async def set_message_id(
        self,
        panel_id: str,
        message_id: str,
    ) -> None:
        await self.repo.db.try_run(
            lambda c: c.table("ticket_panels")
            .update(
                {
                    "message_id": message_id,
                }
            )
            .eq("id", panel_id)
            .execute()
        )

    async def get_button(
        self,
        button_id: str,
    ) -> dict[str, Any]:
        rows = await self.repo.db.try_run(
            lambda c: c.table(
                "ticket_panel_buttons"
            )
            .select("*")
            .eq("id", button_id)
            .limit(1)
            .execute()
        )

        data = getattr(
            rows,
            "data",
            None,
        ) or []

        return data[0] if data else {}

    async def transcript_text(
        self,
        ticket_id: str,
    ) -> str:
        rows = await self.repo.ticket_transcript(
            ticket_id
        )

        if not rows:
            return "No messages were recorded."

        lines = []

        for row in rows:
            sent_at = str(
                row.get("sent_at")
                or ""
            )

            author = str(
                row.get("author_name")
                or row.get("author_id")
                or "Unknown"
            )

            content = str(
                row.get("content")
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
        settings = await self.repo.get_settings(
            str(guild.id)
        )

        transcript_enabled = bool(
            ticket.get(
                "transcript_enabled",
                settings.get(
                    "ticket_transcripts_enabled",
                    True,
                ),
            )
        )

        if not transcript_enabled:
            return

        body = await self.transcript_text(
            ticket["id"]
        )

        filename = (
            f"ahoy-ticket-"
            f"{ticket.get('ticket_number')}"
            f".txt"
        )

        file_bytes = body.encode(
            "utf-8",
            errors="replace",
        )

        file = discord.File(
            __import__("io").BytesIO(
                file_bytes
            ),
            filename=filename,
        )

        transcript_channel_id = (
            ticket.get(
                "transcript_channel_id"
            )
            or settings.get(
                "ticket_transcript_channel_id"
            )
        )

        if transcript_channel_id:
            channel = guild.get_channel(
                int(transcript_channel_id)
            )

            if isinstance(
                channel,
                discord.TextChannel,
            ):
                try:
                    await channel.send(
                        content=(
                            "📄 **AHOY Ticket Transcript**\n"
                            f"Ticket: "
                            f"`#{ticket.get('ticket_number')}`\n"
                            f"Opened by: "
                            f"<@{ticket.get('opener_id')}>"
                        ),
                        file=file,
                    )
                except discord.HTTPException as exc:
                    log.warning(
                        "Failed sending ticket transcript "
                        "to channel: %s",
                        exc,
                    )

        dm_enabled = bool(
            ticket.get(
                "dm_transcript_enabled",
                settings.get(
                    "ticket_dm_transcript_enabled",
                    False,
                ),
            )
        )

        if dm_enabled:
            try:
                user = guild.get_member(
                    int(ticket["opener_id"])
                )

                if user is None:
                    user = await self.bot.fetch_user(
                        int(ticket["opener_id"])
                    )

                dm_file = discord.File(
                    __import__("io").BytesIO(
                        file_bytes
                    ),
                    filename=filename,
                )

                await user.send(
                    content=(
                        "📄 **Your AHOY ticket transcript**\n"
                        f"Ticket: "
                        f"`#{ticket.get('ticket_number')}`\n\n"
                        "Your ticket has been closed. "
                        "The transcript is attached below."
                    ),
                    file=dm_file,
                )

            except (
                discord.Forbidden,
                discord.HTTPException,
            ) as exc:
                # DM failure must NEVER prevent the ticket
                # from closing.
                log.warning(
                    "Could not DM ticket transcript "
                    "to opener: %s",
                    exc,
                )


__all__ = [
    "TicketPanelService",
]
