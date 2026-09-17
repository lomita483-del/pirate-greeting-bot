"""Ticket persistence compatibility helpers for older Repository deployments."""
from __future__ import annotations

from .repository import Repository


async def active_ticket_panels(self):
    rows = await self.db.try_run(
        lambda c: c.table("ticket_panels")
        .select("*")
        .eq("enabled", True)
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )
    return getattr(rows, "data", None) or []


async def active_ticket_panel_buttons(self):
    rows = await self.db.try_run(
        lambda c: c.table("ticket_panel_buttons")
        .select("*")
        .eq("enabled", True)
        .order("position")
        .limit(1000)
        .execute()
    )
    return getattr(rows, "data", None) or []


def install_ticket_repository_compat() -> None:
    if not hasattr(Repository, "active_ticket_panels"):
        setattr(Repository, "active_ticket_panels", active_ticket_panels)
    if not hasattr(Repository, "active_ticket_panel_buttons"):
        setattr(Repository, "active_ticket_panel_buttons", active_ticket_panel_buttons)
