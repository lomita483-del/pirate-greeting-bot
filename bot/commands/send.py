"""/send plus website action-queue delivery for messages, reaction panels, Roll Calls and giveaways."""
from __future__ import annotations
import datetime as _dt
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
    if data.get("timestamp"): embed.timestamp = _dt.datetime.now(_dt.timezone.utc)
    for field in (data.get("fields") or [])[:25]: embed.add_field(name=(field.get("name") or "\u200b")[:256], value=(field.get("value") or "\u200b")[:1024], inline=bool(field.get("inline")))
    return embed if any([embed.title, embed.description, embed.fields, embed.image, embed.thumbnail, embed.author, embed.footer]) else None

def _build_link_view(data: dict) -> discord.ui.View | None:
    buttons = data.get("buttons") or []
    if not buttons: return None
    view = discord.ui.View(timeout=None)
    for item in buttons[:5]:
        label = str(item.get("label") or "Open")[:80]
        target = str(item.get("url") or "").strip()
        if not target: continue
        emoji = item.get("emoji") or None
        view.add_item(discord.ui.Button(label=label, emoji=emoji, style=discord.ButtonStyle.link, url=target, row=min(4, len(view.children) // 5)))
    return view if view.children else None

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
        await self.bot.repo.log_activity({"guild_id": str(guild.id), "kind": "message_sent", "summary": f"{interaction.user} sent a message to #{channel.name} via /send", "metadata": {"channel_id": str(channel.id)}})
        await interaction.response.send_message(embed=embeds.success("Message sent", f"Posted to {channel.mention}."), ephemeral=True)

    @tasks.loop(seconds=10)
    async def _poll_queue(self) -> None:
        try: actions = await self.bot.repo.pending_bot_actions()
        except Exception: log.exception("Failed to poll bot_action_queue"); return
        supported = {"send_message", "reaction_role_panel", "rollcall_start", "rollcall_close", "giveaway_create", "giveaway_edit", "giveaway_end", "giveaway_cancel", "giveaway_reroll"}
        for action in actions:
            kind = action.get("action")
            if kind not in supported: continue
            claimed = await self.bot.repo.db.try_run(lambda c: c.table("bot_action_queue").update({"status": "processing"}).eq("id", action["id"]).eq("status", "pending").select("id").execute())
            if not (getattr(claimed, "data", None) or []): continue
            try:
                if kind == "send_message": await self._process_send_action(action)
                elif kind == "reaction_role_panel": await self._process_reaction_role_panel(action)
                elif kind == "rollcall_start": await self._process_rollcall_start(action)
                elif kind == "rollcall_close": await self._process_rollcall_close(action)
                elif kind == "giveaway_create": await self._process_giveaway_create(action)
                elif kind == "giveaway_edit": await self._process_giveaway_edit(action)
                elif kind == "giveaway_end": await self._process_giveaway_end(action)
                elif kind == "giveaway_cancel": await self._process_giveaway_cancel(action)
                elif kind == "giveaway_reroll": await self._process_giveaway_reroll(action)
            except Exception:
                log.exception("Dashboard action %s failed", kind); await self.bot.repo.finish_bot_action(action["id"], "failed", "Action failed")

    async def _giveaway_cog(self):
        from .giveaways import Giveaways
        cog = self.bot.get_cog("Giveaways")
        if not isinstance(cog, Giveaways): raise ActionRefused("Giveaway service is not ready.")
        return cog

    def _giveaway_embed(self, prize: str, description: str, winners: int, ends_at: str, settings: dict, host_id: str | None) -> discord.Embed:
        requirements = []
        if settings.get("required_role_id"): requirements.append(f"Required role: <@&{settings['required_role_id']}>")
        minimum = int(settings.get("min_account_age_days") or 0)
        if minimum: requirements.append(f"Account age: {minimum}+ days")
        if settings.get("bonus_role_id"): requirements.append(f"Bonus: <@&{settings['bonus_role_id']}> = {int(settings.get('bonus_entries') or 2)}x entry weight")
        requirement_text = "\n".join(requirements) if requirements else "No special requirements."
        end = _dt.datetime.fromisoformat(str(ends_at).replace("Z", "+00:00"))
        return embeds.brand(f"🎁 Giveaway · {prize}", f"{description or 'Enter below for your chance to win!'}\n\n**Winners:** {winners}\n**Entries:** 0\n**Ends:** {discord.utils.format_dt(end, 'R')} ({discord.utils.format_dt(end, 'f')})\n\n**Requirements**\n{requirement_text}\n\nHosted by: <@{host_id}>" if host_id else f"{description or 'Enter below for your chance to win!'}\n\n**Winners:** {winners}\n**Entries:** 0\n**Ends:** {discord.utils.format_dt(end, 'R')} ({discord.utils.format_dt(end, 'f')})\n\n**Requirements**\n{requirement_text}")

    async def _process_giveaway_create(self, action: dict) -> None:
        payload = action.get("payload") or {}; guild = self.bot.get_guild(int(action["guild_id"]))
        if guild is None: raise ActionRefused("AHOY is not in that server.")
        channel = guild.get_channel(int(payload["channel_id"]))
        if not isinstance(channel, discord.TextChannel): raise ActionRefused("Giveaway channel no longer exists.")
        me = guild.me
        if me and not channel.permissions_for(me).send_messages: raise ActionRefused(f"AHOY can't send messages in #{channel.name}.")
        settings = payload.get("settings") or {}
        embed = self._giveaway_embed(str(payload["prize"])[:200], str(settings.get("description") or "Enter below for your chance to win!"), int(payload.get("winner_count") or 1), str(payload["ends_at"]), settings, str(action.get("requested_by") or ""))
        message = await channel.send(embed=embed)
        cog = await self._giveaway_cog()
        row = await self.bot.repo.create_giveaway({"guild_id": str(guild.id), "channel_id": str(channel.id), "message_id": str(message.id), "prize": str(payload["prize"])[:200], "winner_count": int(payload.get("winner_count") or 1), "ends_at": str(payload["ends_at"]), "host_id": str(action.get("requested_by") or ""), "host_name": "Dashboard", "settings": settings})
        giveaway_id = str(row.get("id")); view = cog.__class__.__dict__.get("__name__") and __import__("bot.commands.giveaways", fromlist=["GiveawayView"]).GiveawayView(cog, giveaway_id)
        self.bot.add_view(view, message_id=message.id)
        await message.edit(view=view)
        await self.bot.repo.finish_bot_action(action["id"], "done")

    async def _process_giveaway_edit(self, action: dict) -> None:
        cog = await self._giveaway_cog(); row = await cog._get_by_id(str(action.get("target_id")))
        if not row or row.get("status") != "running": raise ActionRefused("That giveaway is no longer running.")
        payload = action.get("payload") or {}; settings = payload.get("settings") or row.get("settings") or {}
        channel = self.bot.get_channel(int(row["channel_id"]))
        if not isinstance(channel, discord.TextChannel): raise ActionRefused("Giveaway channel no longer exists.")
        message = await channel.fetch_message(int(row["message_id"]))
        embed = self._giveaway_embed(str(payload["prize"])[:200], str(settings.get("description") or "Enter below for your chance to win!"), int(payload.get("winner_count") or 1), str(payload["ends_at"]), settings, str(row.get("host_id") or ""))
        view = __import__("bot.commands.giveaways", fromlist=["GiveawayView"]).GiveawayView(cog, str(row["id"]))
        await message.edit(embed=embed, view=view)
        await self.bot.repo.update_giveaway(row["id"], {"prize": str(payload["prize"])[:200], "winner_count": int(payload.get("winner_count") or 1), "ends_at": str(payload["ends_at"]), "settings": settings})
        await self.bot.repo.finish_bot_action(action["id"], "done")

    async def _process_giveaway_end(self, action: dict) -> None:
        cog = await self._giveaway_cog(); row = await cog._get_by_id(str(action.get("target_id")))
        if not row or row.get("status") != "running": raise ActionRefused("That giveaway is not running.")
        await cog._conclude(row)
        await self.bot.repo.finish_bot_action(action["id"], "done")

    async def _process_giveaway_cancel(self, action: dict) -> None:
        cog = await self._giveaway_cog(); row = await cog._get_by_id(str(action.get("target_id")))
        if not row or row.get("status") != "running": raise ActionRefused("That giveaway is not running.")
        await self.bot.repo.update_giveaway(row["id"], {"status": "cancelled"})
        channel = self.bot.get_channel(int(row["channel_id"]))
        if isinstance(channel, discord.TextChannel):
            try:
                message = await channel.fetch_message(int(row["message_id"])); await message.edit(view=None, content="🎁 **Giveaway cancelled.**")
            except discord.HTTPException: pass
        await self.bot.repo.finish_bot_action(action["id"], "done")

    async def _process_giveaway_reroll(self, action: dict) -> None:
        cog = await self._giveaway_cog(); row = await cog._get_by_id(str(action.get("target_id")))
        if not row or row.get("status") != "ended": raise ActionRefused("Only ended giveaways can be rerolled.")
        await cog._conclude(row, reroll=True)
        await self.bot.repo.finish_bot_action(action["id"], "done")

    async def _process_rollcall_start(self, action: dict) -> None:
        from .rollcall import RollCallView, _open_embed, _buttons
        repo = self.bot.repo; payload = action.get("payload") or {}
        roll_call = await repo.get_roll_call(str(payload.get("roll_call_id") or action.get("target_id")))
        if not roll_call or roll_call.get("status") != "open": raise ActionRefused("Roll call no longer exists or is already closed.")
        guild = self.bot.get_guild(int(action["guild_id"]))
        if guild is None: raise ActionRefused("AHOY is not in that server.")
        channel = guild.get_channel(int(roll_call["channel_id"]))
        if not isinstance(channel, discord.TextChannel): raise ActionRefused("Roll call channel no longer exists.")
        roles = [guild.get_role(int(x)) for x in roll_call.get("target_role_ids") or []]; roles = [r for r in roles if r is not None]
        view = RollCallView(self.bot, str(roll_call["id"]), _buttons(roll_call)); self.bot.add_view(view)
        message = await channel.send(content=" ".join(r.mention for r in roles) or None, embed=_open_embed(roll_call, roles), view=view, allowed_mentions=discord.AllowedMentions(roles=True, users=False, everyone=False))
        await repo.set_roll_call_message(roll_call["id"], str(message.id)); await repo.finish_bot_action(action["id"], "done")
    async def _process_rollcall_close(self, action: dict) -> None:
        from .rollcall import RollCall
        repo = self.bot.repo; roll_call_id = str((action.get("payload") or {}).get("roll_call_id") or action.get("target_id")); roll_call = await repo.get_roll_call(roll_call_id)
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
            if guild is None: raise ActionRefused("AHOY is not in that server (or lost access).")
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
                await self.bot.repo.add_reaction_role({"guild_id": str(guild.id), "channel_id": str(channel.id), "message_id": str(message.id), "emoji": opt["emoji"], "role_id": str(opt["role_id"]), "description": opt.get("description") or None})
        except ActionRefused as exc: error = str(exc)
        except discord.HTTPException as exc: error = f"Discord rejected that panel: {exc}"
        except Exception as exc: log.exception("reaction_role_panel action failed"); error = str(exc)
        await self.bot.repo.finish_bot_action(action["id"], "failed" if error else "done", error)
    async def _process_send_action(self, action: dict) -> None:
        payload = action.get("payload") or {}; guild_id = action.get("guild_id"); error = None
        try:
            guild = self.bot.get_guild(int(guild_id)) if guild_id else None
            if guild is None: raise ActionRefused("AHOY is not in that server (or lost access).")
            channel = guild.get_channel(int(payload["channel_id"]))
            if not isinstance(channel, (discord.TextChannel, discord.Thread)): raise ActionRefused("That channel no longer exists or isn't a text channel.")
            mention_role = guild.get_role(int(payload["mention_role_id"])) if payload.get("mention_role_id") else None; everyone = bool(payload.get("mention_everyone")); content = payload.get("content") or ""; prefix = "@everyone" if everyone else (mention_role.mention if mention_role else ""); content = f"{prefix} {content}".strip() if prefix else content
            embed_data = payload.get("embed") or {}; embed = _build_embed(embed_data); view = _build_link_view(embed_data)
            allowed_mentions = discord.AllowedMentions(everyone=everyone, roles=[mention_role] if mention_role else [])
            if not content and embed is None: raise ActionRefused("Empty message — nothing to send.")
            if not channel.permissions_for(guild.me).send_messages: raise ActionRefused(f"AHOY can't send messages in #{channel.name}.")
            await channel.send(content=content or None, embed=embed, view=view, allowed_mentions=allowed_mentions)
            await self.bot.repo.log_activity({"guild_id": str(guild.id), "kind": "message_sent", "summary": f"Message sent to #{channel.name} from the website", "metadata": {"channel_id": str(channel.id), "button_count": len(embed_data.get("buttons") or [])}})
        except ActionRefused as exc: error = str(exc)
        except discord.HTTPException as exc: error = f"Discord rejected that message: {exc}"
        except Exception as exc: log.exception("send_message action failed"); error = str(exc)
        await self.bot.repo.finish_bot_action(action["id"], "failed" if error else "done", error)
    @_poll_queue.before_loop
    async def _before_poll(self) -> None: await self.bot.wait_until_ready()

async def setup(bot: commands.Bot) -> None: await bot.add_cog(SendCommands(bot))
