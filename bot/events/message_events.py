"""Welcome / goodbye messages, auto-role and member logging."""

from __future__ import annotations

import discord
from discord.ext import commands

from ..services.card_service import render_welcome_card
from ..utils import embeds
from ..utils.logger import get_logger
from ..utils.parsing import render_template

log = get_logger("members")


async def _fetch_bytes(url: str | None) -> bytes | None:
    if not url:
        return None
    import aiohttp

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                if resp.status == 200:
                    return await resp.read()
    except Exception:  # noqa: BLE001 - never let a bad URL break welcome
        return None
    return None


def _build_welcome_message_embed(
    data: dict, placeholders: dict[str, str], member: discord.Member
) -> discord.Embed | None:
    """Render one welcome_messages.embed row (same shape as the website's
    Discohook-style builder / send.functions.ts EmbedShape) into a real
    discord.Embed, with {placeholder} substitution applied to text fields."""

    def r(value: str | None) -> str | None:
        return render_template(value, **placeholders) if value else value

    color = None
    if data.get("color"):
        try:
            color = discord.Color(int(str(data["color"]).lstrip("#"), 16))
        except (TypeError, ValueError):
            color = None

    embed = discord.Embed(
        title=r(data.get("title")),
        description=r(data.get("description")),
        url=data.get("url") or None,
        color=color,
    )
    if data.get("authorName"):
        embed.set_author(
            name=r(data["authorName"]),
            url=data.get("authorUrl") or None,
            icon_url=data.get("authorIconUrl") or member.display_avatar.url,
        )
    if data.get("footerText"):
        embed.set_footer(text=r(data["footerText"]), icon_url=data.get("footerIconUrl") or None)
    if data.get("imageUrl"):
        embed.set_image(url=data["imageUrl"])
    if data.get("thumbnailUrl"):
        embed.set_thumbnail(url=data["thumbnailUrl"])
    elif data.get("useMemberAvatarAsThumbnail"):
        embed.set_thumbnail(url=member.display_avatar.url)
    if data.get("timestamp"):
        import datetime as _dt

        embed.timestamp = _dt.datetime.now(_dt.timezone.utc)
    for field in (data.get("fields") or [])[:25]:
        embed.add_field(
            name=(r(field.get("name")) or "\u200b")[:256],
            value=(r(field.get("value")) or "\u200b")[:1024],
            inline=bool(field.get("inline")),
        )

    if not any(
        [embed.title, embed.description, embed.fields, embed.image, embed.thumbnail, embed.author, embed.footer]
    ):
        return None
    return embed


class MemberEvents(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member) -> None:
        guild = member.guild
        guild_id = str(guild.id)
        repo = self.bot.repo  # type: ignore[attr-defined]
        settings_service = self.bot.settings  # type: ignore[attr-defined]

        await repo.upsert_member(guild_id, member)
        join_embed = embeds.info(
            "Member joined",
            f"{member.mention} · `{member.id}`\nMembers: {guild.member_count}",
        )
        await self.bot.logs.send(guild, "member_join", join_embed)  # type: ignore[attr-defined]
        await self.bot.logs.log(guild, "user_join", join_embed)  # type: ignore[attr-defined]

        config = await settings_service.get(guild_id, "welcome_settings")
        if not config or not config.get("enabled"):
            return

        role_id = config.get("auto_role_id")
        if role_id and guild.me.guild_permissions.manage_roles:
            role = guild.get_role(int(role_id))
            if role and role < guild.me.top_role and not role.managed:
                try:
                    await member.add_roles(role, reason="AHOY auto-role")
                except discord.HTTPException as exc:
                    log.warning("Auto-role failed in %s: %s", guild_id, exc)

        channel_id = config.get("welcome_channel_id")
        if not channel_id:
            return
        channel = guild.get_channel(int(channel_id))
        if not isinstance(channel, discord.TextChannel):
            return

        # Multi-message system (Sapphire-style, up to 3 messages built on the
        # website). If any are configured, they replace the single legacy
        # welcome_message/embed_* fields below entirely.
        messages = await repo.list_welcome_messages(guild_id)
        if messages:
            placeholders = dict(
                user=member.mention,
                username=member.display_name,
                server=guild.name,
                member_count=str(guild.member_count or 0),
                membercount=str(guild.member_count or 0),
            )
            for row in messages:
                content = render_template(row.get("content") or "", **placeholders) or None
                embed = None
                embed_data = row.get("embed") or {}
                if embed_data:
                    embed = _build_welcome_message_embed(embed_data, placeholders, member)
                if not content and embed is None:
                    continue
                try:
                    await channel.send(content=content, embed=embed)
                except discord.HTTPException as exc:
                    log.warning("Welcome message send failed in %s: %s", guild_id, exc)
            return

        text = render_template(
            config.get("welcome_message", "Welcome {user} to {server}! ⚓"),
            user=member.mention,
            username=member.name,
            server=guild.name,
            member_count=str(guild.member_count or 0),
            membercount=str(guild.member_count or 0),
        )

        dynamic_image_file: discord.File | None = None
        if config.get("dynamic_image_enabled"):
            try:
                import asyncio

                avatar_bytes = await member.display_avatar.replace(size=256, format="png").read()
                bg_bytes = await _fetch_bytes(config.get("dynamic_image_background_url"))
                title = render_template(
                    config.get("dynamic_image_title") or "Welcome {username}!",
                    user=member.mention,
                    username=member.display_name,
                    server=guild.name,
                    member_count=str(guild.member_count or 0),
                    membercount=str(guild.member_count or 0),
                )
                subtitle = render_template(
                    config.get("dynamic_image_subtitle") or "to {server} · member #{membercount}",
                    user=member.mention,
                    username=member.display_name,
                    server=guild.name,
                    member_count=str(guild.member_count or 0),
                    membercount=str(guild.member_count or 0),
                )
                buffer = await asyncio.to_thread(
                    render_welcome_card,
                    username=member.display_name,
                    avatar_bytes=avatar_bytes,
                    title=title,
                    subtitle=subtitle,
                    background_bytes=bg_bytes,
                )
                dynamic_image_file = discord.File(buffer, filename="welcome-card.png")
            except Exception as exc:  # pragma: no cover - Pillow/runtime issues
                log.warning("Welcome dynamic image render failed in %s: %s", guild_id, exc)
                dynamic_image_file = None

        try:
            if config.get("use_embed", True):
                color = config.get("embed_color") or "#1FB6A6"
                embed = discord.Embed(
                    title=config.get("embed_title") or "Ahoy, new crew member!",
                    description=text,
                    color=discord.Color.from_str(color),
                )
                embed.set_thumbnail(url=member.display_avatar.url)
                if dynamic_image_file:
                    embed.set_image(url="attachment://welcome-card.png")
                elif config.get("embed_image_url"):
                    embed.set_image(url=config["embed_image_url"])
                embed.set_footer(text="AHOY ⚓")
                if dynamic_image_file:
                    await channel.send(embed=embed, file=dynamic_image_file)
                else:
                    await channel.send(embed=embed)
            elif dynamic_image_file:
                await channel.send(content=text, file=dynamic_image_file)
            else:
                await channel.send(text)
        except (discord.HTTPException, ValueError) as exc:
            log.warning("Welcome message failed in %s: %s", guild_id, exc)

    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member) -> None:
        guild = member.guild
        guild_id = str(guild.id)
        await self.bot.repo.mark_member_left(guild_id, str(member.id))  # type: ignore[attr-defined]
        leave_embed = embeds.info("Member left", f"{member} · `{member.id}`")
        await self.bot.logs.send(guild, "member_leave", leave_embed)  # type: ignore[attr-defined]
        await self.bot.logs.log(guild, "user_leave", leave_embed)  # type: ignore[attr-defined]

        config = await self.bot.settings.get(guild_id, "welcome_settings")  # type: ignore[attr-defined]
        if not config or not config.get("goodbye_enabled"):
            return
        channel_id = config.get("goodbye_channel_id") or config.get("welcome_channel_id")
        if not channel_id:
            return
        channel = guild.get_channel(int(channel_id))
        if isinstance(channel, discord.TextChannel):
            text = render_template(
                config.get("goodbye_message", "Fair winds, {username}. ⚓"),
                user=member.mention,
                username=member.name,
                server=guild.name,
                member_count=str(guild.member_count or 0),
                membercount=str(guild.member_count or 0),
            )
            try:
                await channel.send(text)
            except discord.HTTPException:
                pass

    @commands.Cog.listener()
    async def on_member_update(self, before: discord.Member, after: discord.Member) -> None:
        # Roles changed
        if before.roles != after.roles:
            added = [r for r in after.roles if r not in before.roles]
            removed = [r for r in before.roles if r not in after.roles]
            detail = ""
            if added:
                detail += f"**Added:** {', '.join(r.name for r in added)}\n"
            if removed:
                detail += f"**Removed:** {', '.join(r.name for r in removed)}"
            await self.bot.logs.send(  # type: ignore[attr-defined]
                after.guild, "role_changes", embeds.info(f"Roles updated · {after}", detail)
            )
            if added:
                await self.bot.logs.log(  # type: ignore[attr-defined]
                    after.guild,
                    "user_roles_add",
                    embeds.info(f"Roles added · {after}", ", ".join(r.name for r in added)),
                )
            if removed:
                await self.bot.logs.log(  # type: ignore[attr-defined]
                    after.guild,
                    "user_roles_remove",
                    embeds.info(f"Roles removed · {after}", ", ".join(r.name for r in removed)),
                )

        # Nickname changed
        if before.nick != after.nick:
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after.guild,
                "user_name_update",
                embeds.info(f"Nickname changed · {after}", f"**{before.nick or before.name}** → **{after.nick or after.name}**"),
            )

        # Server-specific avatar changed
        if before.guild_avatar != after.guild_avatar:
            await self.bot.logs.log(  # type: ignore[attr-defined]
                after.guild, "user_avatar_update", embeds.info(f"Avatar changed · {after}", "")
            )

        # Timeout applied / removed
        before_until = before.timed_out_until
        after_until = after.timed_out_until
        if before_until != after_until:
            if after_until:
                await self.bot.logs.log(  # type: ignore[attr-defined]
                    after.guild,
                    "user_timed_out",
                    embeds.info(f"Timed out · {after}", f"Until <t:{int(after_until.timestamp())}:R>"),
                )
            elif before_until:
                await self.bot.logs.log(  # type: ignore[attr-defined]
                    after.guild, "user_timeout_removed", embeds.info(f"Timeout removed · {after}", "")
                )

    @commands.Cog.listener()
    async def on_voice_state_update(
        self,
        member: discord.Member,
        before: discord.VoiceState,
        after: discord.VoiceState,
    ) -> None:
        if before.channel == after.channel:
            return
        if after.channel is not None and before.channel is None:
            text = f"{member.mention} joined **{after.channel.name}**"
            event_type = "voice_user_join"
        elif after.channel is None:
            text = f"{member.mention} left **{before.channel.name}**"  # type: ignore[union-attr]
            event_type = "voice_user_leave"
        else:
            text = f"{member.mention} moved to **{after.channel.name}**"
            event_type = "voice_user_switch"
        embed = embeds.info("Voice activity", text)
        await self.bot.logs.send(member.guild, "voice_activity", embed)  # type: ignore[attr-defined]
        await self.bot.logs.log(member.guild, event_type, embed)  # type: ignore[attr-defined]


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(MemberEvents(bot))
