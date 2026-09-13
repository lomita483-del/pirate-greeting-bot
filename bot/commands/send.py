"""/send plus website action-queue delivery for messages, reaction panels and Roll Calls."""
from __future__ import annotations
import discord
from discord import app_commands
from discord.ext import commands, tasks
from ..utils import embeds
from ..utils.checks import ActionRefused
from ..utils.logger import get_logger
log = get_logger("send")

def _parse_color(value: str | None) -> discord.Color | None:
    if not value: return None
    try: return discord.Color(int(str(value).lstrip("#"), 16))
    except (TypeError, ValueError): return None

def _build_embed(data: dict) -> discord.Embed | None:
    if not data: return None
    embed = discord.Embed(title=data.get("title") or None, description=data.get("description") or None, url=data.get("url") or None, color=_parse_color(data.get("color")))
    if data.get("author_name"): embed.set_author(name=data["author_name"], url=data.get("author_url") or None, icon_url=data.get("author_icon_url") or None)
    if data.get("footer_text"): embed.set_footer(text=data["footer_text"], icon_url=data.get("footer_icon_url") or None)
    if data.get("image_url"): embed.set_image(url=data["image_url"])
    if data.get("thumbnail_url"): embed.set_thumbnail(url=data["thumbnail_url"])
    if data.get("timestamp"):
        import datetime as _dt
        embed.timestamp = _dt.datetime.now(_dt.timezone.utc)
    for field in (data.get("fields") or [])[:25]: embed.add_field(name=(field.get("name") or "\u200b")[:256], value=(field.get("value") or "\u200b")[:1024], inline=bool(field.get("inline")))
    return embed if any([embed.title, embed.description, embed.fields, embed.image, embed.thumbnail, embed.author, embed.footer]) else None

class SendCommands(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot; self._poll_queue.start()
    def cog_unload(self) -> None: self._poll_queue.cancel()

    @app_commands.command(name="send", description="Send a message to a channel as AHOY.")
    @app_commands.describe(channel="Channel to send the message to", message_title="Title shown at the top of the embed", message_content="Message text or embed description", mention_role="Role to ping alongside the message", embed="Send the title and content as a rich embed", embed_color="Color used when embed is enabled")
    @app_commands.choices(embed_color=[app_commands.Choice(name="AHOY Gold", value="D4AF37"), app_commands.Choice(name="Discord Blurple", value="5865F2"), app_commands.Choice(name="Ocean Blue", value="3498DB"), app_commands.Choice(name="Emerald Green", value="2ECC71"), app_commands.Choice(name="Sunset Orange", value="E67E22"), app_commands.Choice(name="Signal Red", value="E74C3C")])
    @app_commands.default_permissions(manage_messages=True)
    @app_commands.guild_only()
    async def send(self, interaction: discord.Interaction, channel: discord.TextChannel, message_content: str, message_title: str | None = None, mention_role: discord.Role | None = None, embed: bool = False, embed_color: app_commands.Choice[str] | None = None) -> None:
        guild = interaction.guild; assert guild is not None
        rich_embed = _build_embed({"title": message_title, "description": message_content, "color": embed_color.value if embed_color else "D4AF37"}) if embed else None
        if not channel.permissions_for(guild.me).send_messages: raise ActionRefused(f"AHOY can't send messages in {channel.mention}.")
        content_parts = [mention_role.mention] if mention_role else []
        if not embed:
            if message_title: content_parts.append(f"**{message_title}**")
            content_parts.append(message_content)
        try: await channel.send(content=" ".join(content_parts) if content_parts else None, embed=rich_embed, allowed_mentions=discord.AllowedMentions(everyone=False, roles=bool(mention_role), users=True))
        except discord.HTTPException as exc: raise ActionRefused(f"Discord rejected that message: {exc}") from exc
        await self.bot.repo.log_activity({"guild_id": str(guild.id), "kind": "message_sent", "summary": f"{interaction.user} sent a message to #{channel.name} via /send", "metadata": {"channel_id": str(channel.id)}})  # type: ignore[attr-defined]
        await interaction.response.send_message(embed=embeds.success("Message sent", f"Posted to {channel.mention}."), ephemeral=True)

    @tasks.loop(seconds=10)
    async def _poll_queue(self) -> None:
        try: actions = await self.bot.repo.pending_bot_actions()  # type: ignore[attr-defined]
        except Exception: log.exception("Failed to poll bot_action_queue"); return
        supported = {"send_message", "reaction_role_panel", "rollcall_start", "rollcall_close"}
        for action in actions:
            kind = action.get("action")
            if kind not in supported: continue
            claimed = await self.bot.repo.db.try_run(lambda c: c.table("bot_action_queue").update({"status": "processing"}).eq("id", action["id"]).eq("status", "pending").select("id").execute())  # type: ignore[attr-defined]
            if not (getattr(claimed, "data", None) or []): continue
            try:
                if kind == "send_message": await self._process_send_action(action)
                elif kind == "reaction_role_panel": await self._process_reaction_role_panel(action)
                elif kind == "rollcall_start": await self._process_rollcall_start(action)
                elif kind == "rollcall_close": await self._process_rollcall_close(action)
            except Exception as exc:
                log.exception("Dashboard action %s failed", kind); await self.bot.repo.finish_bot_action(action["id"], "failed", str(exc)[:400])  # type: ignore[attr-defined]

    async def _process_rollcall_start(self, action: dict) -> None:
        from .rollcall import RollCallView, _open_embed
        repo = self.bot.repo  # type: ignore[attr-defined]
        payload = action.get("payload") or {}
        roll_call = await repo.get_roll_call(str(payload.get("roll_call_id") or action.get("target_id")))
        if not roll_call or roll_call.get("status") != "open": raise ActionRefused("Roll call no longer exists or is already closed.")
        guild = self.bot.get_guild(int(action["guild_id"]))
        if guild is None: raise ActionRefused("AHOY is not in that server.")
        channel = guild.get_channel(int(roll_call["channel_id"]))
        if not isinstance(channel, discord.TextChannel): raise ActionRefused("Roll call channel no longer exists.")
        roles = [guild.get_role(int(x)) for x in roll_call.get("target_role_ids") or []]; roles = [r for r in roles if r is not None]
        view = RollCallView(self.bot, str(roll_call["id"])); self.bot.add_view(view)
        message = await channel.send(content=" ".join(r.mention for r in roles) or None, embed=_open_embed(roll_call, roles), view=view, allowed_mentions=discord.AllowedMentions(roles=True, users=False, everyone=False))
        await repo.set_roll_call_message(roll_call["id"], str(message.id)); await repo.finish_bot_action(action["id"], "done")

    async def _process_rollcall_close(self, action: dict) -> None:
        from .rollcall import RollCall
        repo = self.bot.repo  # type: ignore[attr-defined]
        roll_call_id = str((action.get("payload") or {}).get("roll_call_id") or action.get("target_id"))
        roll_call = await repo.get_roll_call(roll_call_id)
        if not roll_call or roll_call.get("status") != "open": await repo.finish_bot_action(action["id"], "done"); return
        guild = self.bot.get_guild(int(action["guild_id"]))
        if guild is None: raise ActionRefused("AHOY is not in that server.")
        cog = self.bot.get_cog("RollCall")
        if not isinstance(cog, RollCall): raise ActionRefused("Roll Call service is not ready.")
        await cog._close_roll_call(guild, roll_call); await repo.finish_bot_action(action["id"], "done")

    async def _process_reaction_role_panel(self, action: dict) -> None:
        payload = action.get("payload") or {}; guild_id = action.get("guild_id"); error = None
        try:
            guild = self.bot.get_guild(int(guild_id)) if guild_id else None
            if guild is None: raise ActionRefused("!PIRATE is not in that server (or lost access).")
            channel = guild.get_channel(int(payload["channel_id"]))
            if not isinstance(channel, discord.TextChannel): raise ActionRefused("That channel no longer exists or isn't a text channel.")
            options = payload.get("options") or []
            if not options: raise ActionRefused("Add at least one emoji/role pair.")
            lines = []
            for opt in options:
                role = guild.get_role(int(opt["role_id"])); label = opt.get("description") or (role.name if role else opt["role_id"]); lines.append(f"{opt['emoji']} — {label}")
            embed = discord.Embed(title=payload.get("title") or "Pick your roles", description=(payload.get("description") or "React below to grant yourself a role.") + "\n\n" + "\n".join(lines), color=discord.Color.from_str("#D4AF37")); message = await channel.send(embed=embed)
            for opt in options:
                try: await message.add_reaction(opt["emoji"])
                except discord.HTTPException: continue
                await self.bot.repo.add_reaction_role({"guild_id": str(guild.id), "channel_id": str(channel.id), "message_id": str(message.id), "emoji": opt["emoji"], "role_id": str(opt["role_id"]), "description": opt.get("description") or None})  # type: ignore[attr-defined]
        except ActionRefused as exc: error = str(exc)
        except discord.HTTPException as exc: error = f"Discord rejected that panel: {exc}"
        except Exception as exc: log.exception("reaction_role_panel action failed"); error = str(exc)
        await self.bot.repo.finish_bot_action(action["id"], "failed" if error else "done", error)  # type: ignore[attr-defined]

    async def _process_send_action(self, action: dict) -> None:
        payload = action.get("payload") or {}; guild_id = action.get("guild_id"); error = None
        try:
            guild = self.bot.get_guild(int(guild_id)) if guild_id else None
            if guild is None: raise ActionRefused("AHOY is not in that server (or lost access).")
            channel = guild.get_channel(int(payload["channel_id"]))
            if not isinstance(channel, (discord.TextChannel, discord.Thread)): raise ActionRefused("That channel no longer exists or isn't a text channel.")
            mention_role = guild.get_role(int(payload["mention_role_id"])) if payload.get("mention_role_id") else None; everyone = bool(payload.get("mention_everyone")); content = payload.get("content") or ""; prefix = "@everyone" if everyone else (mention_role.mention if mention_role else ""); content = f"{prefix} {content}".strip() if prefix else content
            embed = _build_embed(payload.get("embed") or {}); allowed_mentions = discord.AllowedMentions(everyone=everyone, roles=[mention_role] if mention_role else [])
            if not content and embed is None: raise ActionRefused("Empty message — nothing to send.")
            if not channel.permissions_for(guild.me).send_messages: raise ActionRefused(f"AHOY can't send messages in #{channel.name}.")
            await channel.send(content=content or None, embed=embed, allowed_mentions=allowed_mentions)
            await self.bot.repo.log_activity({"guild_id": str(guild.id), "kind": "message_sent", "summary": f"Message sent to #{channel.name} from the website", "metadata": {"channel_id": str(channel.id)}})  # type: ignore[attr-defined]
        except ActionRefused as exc: error = str(exc)
        except discord.HTTPException as exc: error = f"Discord rejected that message: {exc}"
        except Exception as exc: log.exception("send_message action failed"); error = str(exc)
        await self.bot.repo.finish_bot_action(action["id"], "failed" if error else "done", error)  # type: ignore[attr-defined]

    @_poll_queue.before_loop
    async def _before_poll(self) -> None: await self.bot.wait_until_ready()

async def setup(bot: commands.Bot) -> None: await bot.add_cog(SendCommands(bot))
