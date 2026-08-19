"""/send — post a message to any channel, optionally pinging a role and/or
attaching a rich embed. Works two ways:

1. Directly from Discord via the /send slash command (quick, manual use).
2. Queued from the website's Discohook-style embed builder — this cog polls
   `bot_action_queue` for `send_message` actions and executes them, the same
   pattern already used for dashboard-triggered unban/untimeout actions.
"""

from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands, tasks

from ..utils import embeds
from ..utils.checks import ActionRefused
from ..utils.logger import get_logger

log = get_logger("send")


def _parse_color(value: str | None) -> discord.Color | None:
    if not value:
        return None
    try:
        return discord.Color(int(str(value).lstrip("#"), 16))
    except (TypeError, ValueError):
        return None


def _build_embed(data: dict) -> discord.Embed | None:
    """Shared embed builder — used for both saved templates and website-queued sends."""
    if not data:
        return None

    embed = discord.Embed(
        title=(data.get("title") or None),
        description=(data.get("description") or None),
        url=(data.get("url") or None),
        color=_parse_color(data.get("color")),
    )
    if data.get("author_name"):
        embed.set_author(
            name=data["author_name"],
            url=data.get("author_url") or None,
            icon_url=data.get("author_icon_url") or None,
        )
    if data.get("footer_text"):
        embed.set_footer(text=data["footer_text"], icon_url=data.get("footer_icon_url") or None)
    if data.get("image_url"):
        embed.set_image(url=data["image_url"])
    if data.get("thumbnail_url"):
        embed.set_thumbnail(url=data["thumbnail_url"])
    if data.get("timestamp"):
        import datetime as _dt

        embed.timestamp = _dt.datetime.now(_dt.timezone.utc)
    for field in (data.get("fields") or [])[:25]:
        name = (field.get("name") or "\u200b")[:256]
        value = (field.get("value") or "\u200b")[:1024]
        embed.add_field(name=name, value=value, inline=bool(field.get("inline")))

    if not any(
        [
            embed.title,
            embed.description,
            embed.fields,
            embed.image,
            embed.thumbnail,
            embed.author,
            embed.footer,
        ]
    ):
        return None
    return embed


class SendCommands(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self._poll_queue.start()

    def cog_unload(self) -> None:
        self._poll_queue.cancel()

    @app_commands.command(name="send", description="Send a message to a channel as AHOY.")
    @app_commands.describe(
        channel="Channel to send the message to",
        message_title="Title shown at the top of the embed",
        message_content="Message text or embed description",
        mention_role="Role to ping alongside the message",
        embed="Send the title and content as a rich embed",
        embed_color="Color used when embed is enabled",
    )
    @app_commands.choices(
        embed_color=[
            app_commands.Choice(name="AHOY Gold", value="D4AF37"),
            app_commands.Choice(name="Discord Blurple", value="5865F2"),
            app_commands.Choice(name="Ocean Blue", value="3498DB"),
            app_commands.Choice(name="Emerald Green", value="2ECC71"),
            app_commands.Choice(name="Sunset Orange", value="E67E22"),
            app_commands.Choice(name="Signal Red", value="E74C3C"),
        ]
    )
    @app_commands.default_permissions(manage_messages=True)
    @app_commands.guild_only()
    async def send(
        self,
        interaction: discord.Interaction,
        channel: discord.TextChannel,
        message_content: str,
        message_title: str | None = None,
        mention_role: discord.Role | None = None,
        embed: bool = False,
        embed_color: app_commands.Choice[str] | None = None,
    ) -> None:
        guild = interaction.guild
        assert guild is not None

        rich_embed: discord.Embed | None = None
        if embed:
            rich_embed = _build_embed(
                {
                    "title": message_title,
                    "description": message_content,
                    "color": embed_color.value if embed_color else "D4AF37",
                }
            )

        perms = channel.permissions_for(guild.me)
        if not perms.send_messages:
            raise ActionRefused(f"AHOY can't send messages in {channel.mention}.")

        content_parts = []
        if mention_role:
            content_parts.append(mention_role.mention)
        if not embed:
            if message_title:
                content_parts.append(f"**{message_title}**")
            content_parts.append(message_content)
        content = " ".join(content_parts) if content_parts else None

        allowed_mentions = discord.AllowedMentions(
            everyone=False, roles=bool(mention_role), users=True
        )

        try:
            await channel.send(content=content, embed=rich_embed, allowed_mentions=allowed_mentions)
        except discord.HTTPException as exc:
            raise ActionRefused(f"Discord rejected that message: {exc}") from exc

        await self.bot.repo.log_activity(  # type: ignore[attr-defined]
            {
                "guild_id": str(guild.id),
                "kind": "message_sent",
                "summary": f"{interaction.user} sent a message to #{channel.name} via /send",
                "metadata": {"channel_id": str(channel.id)},
            }
        )

        await interaction.response.send_message(
            embed=embeds.success("Message sent", f"Posted to {channel.mention}."), ephemeral=True
        )

    # -- website-initiated sends (from the Discohook-style builder) --------
    @tasks.loop(seconds=10)
    async def _poll_queue(self) -> None:
        try:
            actions = await self.bot.repo.pending_bot_actions()  # type: ignore[attr-defined]
        except Exception:
            log.exception("Failed to poll bot_action_queue")
            return

        for action in actions:
            if action.get("action") != "send_message":
                continue
            await self._process_send_action(action)

    async def _process_send_action(self, action: dict) -> None:
        payload = action.get("payload") or {}
        guild_id = action.get("guild_id")
        error: str | None = None
        try:
            guild = self.bot.get_guild(int(guild_id)) if guild_id else None
            if guild is None:
                raise ActionRefused("AHOY is not in that server (or lost access).")
            channel = guild.get_channel(int(payload["channel_id"]))
            if not isinstance(channel, (discord.TextChannel, discord.Thread)):
                raise ActionRefused("That channel no longer exists or isn't a text channel.")

            mention_role = None
            if payload.get("mention_role_id"):
                mention_role = guild.get_role(int(payload["mention_role_id"]))

            everyone = bool(payload.get("mention_everyone"))
            content = payload.get("content") or ""
            prefix = "@everyone" if everyone else (mention_role.mention if mention_role else "")
            content = f"{prefix} {content}".strip() if prefix else content

            embed = _build_embed(payload.get("embed") or {})
            allowed_mentions = discord.AllowedMentions(
                everyone=everyone, roles=[mention_role] if mention_role else []
            )
            if not content and embed is None:
                raise ActionRefused("Empty message — nothing to send.")

            perms = channel.permissions_for(guild.me)
            if not perms.send_messages:
                raise ActionRefused(f"AHOY can't send messages in #{channel.name}.")

            await channel.send(content=content or None, embed=embed, allowed_mentions=allowed_mentions)
            await self.bot.repo.log_activity(  # type: ignore[attr-defined]
                {
                    "guild_id": str(guild.id),
                    "kind": "message_sent",
                    "summary": f"Message sent to #{channel.name} from the website",
                    "metadata": {"channel_id": str(channel.id)},
                }
            )
        except ActionRefused as exc:
            error = str(exc)
        except discord.HTTPException as exc:
            error = f"Discord rejected that message: {exc}"
        except Exception as exc:  # noqa: BLE001
            log.exception("send_message action failed")
            error = str(exc)

        await self.bot.repo.finish_bot_action(  # type: ignore[attr-defined]
            action["id"], "failed" if error else "done", error
        )

    @_poll_queue.before_loop
    async def _before_poll(self) -> None:
        await self.bot.wait_until_ready()


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(SendCommands(bot))
