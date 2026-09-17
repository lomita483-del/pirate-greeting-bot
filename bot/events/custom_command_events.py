"""Execute dashboard custom commands and answer direct !HOY mentions."""
from __future__ import annotations

import discord
from discord.ext import commands

from ..utils.parsing import render_template
from ..utils import embeds
from ..utils.logger import get_logger

log = get_logger("custom_commands")


class CustomCommandEvents(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    async def _prefixes(self, guild_id: str) -> list[str]:
        prefixes = ["!"]
        try:
            result = await self.bot.repo.db.try_run(  # type: ignore[attr-defined]
                lambda c: c.table("server_settings").select("prefix").eq("guild_id", guild_id).limit(1).execute()
            )
            configured = str(((getattr(result, "data", None) or [{}])[0].get("prefix") or "!")).strip()
            if configured:
                prefixes.insert(0, configured)
        except Exception:
            pass
        prefixes.extend(["!HOY", "!hoy", "!PIRATE", "!pirate"])
        return list(dict.fromkeys(prefixes))

    async def _respond_to_mention(self, message: discord.Message) -> None:
        if self.bot.user is None or self.bot.user not in message.mentions:
            return

        content = message.content
        for token in (f"<@{self.bot.user.id}>", f"<@!{self.bot.user.id}>"):
            content = content.replace(token, " ")
        request = " ".join(content.split()).strip().lower()

        if any(word in request for word in ("help", "command", "commands", "what can you do")):
            description = (
                f"Ahoy, {message.author.mention}. I'm on deck.\n\n"
                "Try `/help` for the command navigator, `/profile` for your crew profile, "
                "or `/stats` for live bot status. Server managers can use the web control center "
                "for configuration and advanced controls."
            )
        elif any(word in request for word in ("ping", "online", "alive", "status")):
            description = (
                f"Ahoy, {message.author.mention}. **!HOY is online and listening.**\n\n"
                f"Gateway latency: `{round(self.bot.latency * 1000)} ms`\n"
                f"Servers: `{len(self.bot.guilds)}`"
            )
        elif any(word in request for word in ("thank", "thanks", "thx")):
            description = f"You're welcome, {message.author.mention}. The crew is at your service."
        elif any(word in request for word in ("hello", "hi", "hey", "ahoy")) or not request:
            description = (
                f"Ahoy, {message.author.mention}! ⚓\n"
                "!HOY is on deck and ready. Ask for **help**, **status**, or use `/help` to see the command navigator."
            )
        else:
            description = (
                f"Ahoy, {message.author.mention}. I heard you.\n\n"
                "I can respond to **help**, **status**, and common greetings here. For commands, try `/help`."
            )

        try:
            await message.channel.send(
                embed=embeds.brand("!HOY · On Deck", description),
                reference=message,
                mention_author=False,
            )
        except discord.HTTPException:
            log.warning("Could not respond to mention in guild %s", message.guild.id, exc_info=True)

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message) -> None:
        if message.author.bot or not message.guild or not message.content:
            return

        if self.bot.user is not None and self.bot.user in message.mentions:
            await self._respond_to_mention(message)
            # A direct mention is a conversational interaction, not a custom-command invocation.
            return

        repo = self.bot.repo  # type: ignore[attr-defined]
        try:
            rows = await repo.custom_commands(str(message.guild.id))
        except Exception:
            log.exception("Failed to load custom commands for guild %s", message.guild.id)
            return
        if not rows:
            return

        content = message.content.strip()
        matched_prefix = next((prefix for prefix in await self._prefixes(str(message.guild.id)) if content.lower().startswith(prefix.lower())), None)
        if matched_prefix is None:
            return

        body = content[len(matched_prefix):].strip()
        if not body:
            return
        parts = body.split(maxsplit=1)
        name = parts[0].lower()
        row = next((r for r in rows if r.get("enabled", True) and str(r.get("name", "")).strip().lower() == name), None)
        if not row:
            return

        values = {
            "user": message.author.mention,
            "username": message.author.display_name,
            "server": message.guild.name,
            "command": name,
            "value": parts[1] if len(parts) > 1 else "",
        }
        response = render_template(str(row.get("response") or ""), **values).strip()
        if not response:
            return

        try:
            if row.get("is_embed"):
                color = discord.Color.blurple()
                raw_color = row.get("embed_color")
                if raw_color:
                    try:
                        color = discord.Color.from_str(str(raw_color))
                    except ValueError:
                        pass
                embed = discord.Embed(
                    title=render_template(str(row.get("embed_title") or name), **values),
                    description=response,
                    color=color,
                )
                await message.channel.send(embed=embed)
            else:
                await message.channel.send(response)

            await repo.bump_custom_command(str(row["id"]), int(row.get("uses") or 0))
        except Exception:
            log.exception("Custom command '%s' failed in guild %s", name, message.guild.id)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(CustomCommandEvents(bot))
