"""Async-friendly wrapper around the Supabase/PostgreSQL client.

The Supabase Python SDK is synchronous, so every call is dispatched to a
worker thread to keep the Discord event loop responsive. All database errors
are logged technically and surfaced as ``DatabaseError`` so command handlers
can show a friendly message.
"""
from __future__ import annotations
import asyncio
from typing import Any, Callable, Optional
from supabase import Client, create_client
from ..utils.logger import get_logger
log = get_logger("database")
class DatabaseError(RuntimeError):
    """Raised when a database operation fails."""
class Database:
    def __init__(self, url: str, key: str) -> None:
        self._url=url; self._key=key; self._client:Optional[Client]=None
    @property
    def enabled(self)->bool: return bool(self._url and self._key)
    async def connect(self)->bool:
        if not self.enabled:
            log.warning("SUPABASE_URL / key missing - AHOY runs in memory-only mode; persistence is disabled."); return False
        try:
            self._client=await asyncio.to_thread(create_client,self._url,self._key); await self.run(lambda c:c.table("servers").select("guild_id").limit(1).execute()); log.info("Connected to the AHOY database."); return True
        except Exception as exc:
            self._client=None; log.exception("Database connection failed: %s",exc); return False
    @property
    def connected(self)->bool: return self._client is not None
    async def run(self,fn:Callable[[Client],Any])->Any:
        if self._client is None: raise DatabaseError("Database is not connected.")
        try: return await asyncio.to_thread(fn,self._client)
        except Exception as exc:
            log.exception("Database operation failed: %s",exc); raise DatabaseError(str(exc)) from exc
    async def try_run(self,fn:Callable[[Client],Any],default:Any=None)->Any:
        if self._client is None:return default
        try:return await self.run(fn)
        except DatabaseError:return default

# NOTE: Repository compatibility installers (repository_compat,
# ticket_repository_compat, and the recent_cases shim) used to be installed
# here as an import-time side effect. That created a fragile circular
# import: if anything imported bot.database.repository before
# bot.database.client had ever been imported, the install would silently
# fail (swallowed by a bare except) and Repository would end up missing
# methods like log_command_usage and active_ticket_panels at runtime.
# That installation now lives at the bottom of repository.py instead,
# where it is safe regardless of import order. client.py no longer reaches
# into Repository at all.
