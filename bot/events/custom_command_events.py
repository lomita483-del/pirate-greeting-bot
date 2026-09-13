"""Execute server-specific custom commands created in the web dashboard."""
from __future__ import annotations
import re
import discord
from discord.ext import commands
from ..utils.parsing import render_template
from ..utils.logger import get_logger

log = get_logger("custom_commands")

class CustomCommandEvents(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message) -> None:
        if message.author.bot or not message.guild or not message.content:
            return
        repo = self.bot.repo  # type: ignore[attr-defined]
        settings = await repo.roll_call_settings(str(message.guild.id)) if False else None
        try:
            rows = await repo.custom_commands(str(message.guild.id))
        except Exception:
            log.exception("Failed to load custom commands for guild %s", message.guild.id)
            return
        if not rows:
            return
        # The dashboard's server settings use ! as the default prefix. Respect a
        # configured prefix when available, while accepting ! for compatibility.
        prefix = "!"
        try:
            result = await repo.db.try_run(lambda c: c.table("server_settings").select("prefix").eq("guild_id", str(message.guild.id)).limit(1).execute())
            prefix = str(((getattr(result, "data", None) or [{}])[0].get("prefix") or "!")).strip() or "!"
        except Exception:
            pass
        content = message.content.strip()
        if not content.startswith(prefix):
            return
        body = content[len(prefix):].strip()
        if not body:
            return
        parts = body.split(maxsplit=1)
        name = parts[0].lower()
        row = next((r for r in rows if r.get("enabled", True) and str(r.get("name", "")).lower() == name), None)
        if not row:
            return
        values = {"user": message.author.mention, "username": message.author.display_name, "server": message.guild.name, "command": name, "value": parts[1] if len(parts) > 1 else ""}
        response = render_template(str(row.get("response") or ""), **values).strip()
        if not response:
            return
        try:
            if row.get("is_embed"):
                color = discord.Color.blurple()
                raw_color = row.get("embed_color")
                if raw_color:
                    try: color = discord.Color.from_str(str(raw_color))
                    except ValueError: pass
                embed = discord.Embed(title=render_template(str(row.get("embed_title") or name), **values), description=response, color=color)
                await message.channel.send(embed=embed)
            else:
                await message.channel.send(response)
            await repo.db.try_run(lambda c: c.table("custom_commands").update({"uses": int(row.get("uses") or 0) + 1}).eq("id", row["id"]).execute())
        except discord.HTTPException:
            log.exception("Custom command '%s' failed in guild %s", name, message.guild.id)

async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(CustomCommandEvents(bot))