"""Legacy public statistics command removed.

Analytics remain available to authorized dashboard operators; this module is
kept as a no-op extension so older deployments do not fail on import.
"""
from discord.ext import commands
async def setup(bot: commands.Bot) -> None:
    return None
