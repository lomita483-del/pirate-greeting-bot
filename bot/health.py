"""Tiny HTTP health endpoint.

Some hosts (Render web services, Fly, Koyeb…) kill a process that never binds
a port. When ``PORT`` is set we expose ``/`` and ``/health`` reporting whether
AHOY is connected to Discord. Purely optional — the bot runs fine without it.
"""

from __future__ import annotations

import os
from typing import Optional

from aiohttp import web

from .utils.logger import get_logger

log = get_logger("health")


async def start_health_server(bot) -> Optional[web.AppRunner]:
    port = os.getenv("PORT", "").strip()
    if not port.isdigit():
        return None

    async def handler(_request: web.Request) -> web.Response:
        ready = bot.is_ready() and not bot.is_closed()
        return web.json_response(
            {
                "service": "ahoy-bot",
                "status": "ok" if ready else "starting",
                "user": str(bot.user) if bot.user else None,
                "guilds": len(bot.guilds),
                "latency_ms": round(bot.latency * 1000) if bot.latency == bot.latency else None,
            },
            status=200 if ready else 503,
        )

    app = web.Application()
    app.router.add_get("/", handler)
    app.router.add_get("/health", handler)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", int(port))
    await site.start()
    log.info("Health endpoint listening on port %s", port)
    return runner
