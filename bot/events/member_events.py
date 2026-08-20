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

        messages = await repo.list_welcome_messages(guild_id)
        if not messages:
            return

        def _fill(template: str) -> str:
            return render_template(
                template,
                user=member.mention,
                username=member.display_name,
                server=guild.name,
                member_count=str(guild.member_count or 0),
                membercount=str(guild.member_count or 0),
            )

        dynamic_image_bytes: bytes | None = None
        needs_dynamic_image = config.get("dynamic_image_enabled") and any(
            m.get("attach_dynamic_image") for m in messages
        )
        if needs_dynamic_image:
            try:
                import asyncio

                avatar_bytes = await member.display_avatar.replace(size=256, format="png").read()
                bg_bytes = await _fetch_bytes(config.get("dynamic_image_background_url"))
                title = _fill(config.get("dynamic_image_title") or "Welcome {username}!")
                subtitle = _fill(
                    config.get("dynamic_image_subtitle") or "to {server} · member #{membercount}"
                )
                buffer = await asyncio.to_thread(
                    render_welcome_card,
                    username=member.display_name,
                    avatar_bytes=avatar_bytes,
                    title=title,
                    subtitle=subtitle,
                    background_bytes=bg_bytes,
                )
                dynamic_image_bytes = buffer.getvalue() if hasattr(buffer, "getvalue") else buffer
            except Exception as exc:  # pragma: no cover - Pillow/runtime issues
                log.warning("Welcome dynamic image render failed in %s: %s", guild_id, exc)
                dynamic_image_bytes = None

        for message in messages:
            content = _fill(message.get("content") or "")
            use_embed = message.get("use_embed", True)
            attach_image = bool(message.get("attach_dynamic_image")) and dynamic_image_bytes is not None

            image_file: discord.File | None = None
            if attach_image and dynamic_image_bytes is not None:
                import io

                image_file = discord.File(io.BytesIO(dynamic_image_bytes), filename="welcome-card.png")

            try:
                if use_embed and message.get("embed"):
                    e = message["embed"] or {}
                    embed = discord.Embed(
                        title=_fill(e.get("title")) if e.get("title") else None,
                        description=_fill(e.get("description")) if e.get("description") else None,
                        url=e.get("url") or None,
                        color=discord.Color.from_str(f"#{e['color'].lstrip('#')}")
                        if e.get("color")
                        else discord.Color.from_str("#1FB6A6"),
                    )
                    if e.get("authorName"):
                        embed.set_author(name=e["authorName"], url=e.get("authorUrl") or None, icon_url=e.get("authorIconUrl") or None)
                    if e.get("footerText"):
                        embed.set_footer(text=e["footerText"], icon_url=e.get("footerIconUrl") or None)
                    if e.get("useMemberAvatarAsThumbnail"):
                        embed.set_thumbnail(url=member.display_avatar.url)
                    elif e.get("thumbnailUrl"):
                        embed.set_thumbnail(url=e["thumbnailUrl"])
                    if image_file:
                        embed.set_image(url="attachment://welcome-card.png")
                    elif e.get("imageUrl"):
                        embed.set_image(url=e["imageUrl"])
                    for field in (e.get("fields") or [])[:25]:
                        embed.add_field(
                            name=field.get("name") or "\u200b",
                            value=field.get("value") or "\u200b",
                            inline=bool(field.get("inline")),
                        )
                    if image_file:
                        await channel.send(content=content or None, embed=embed, file=image_file)
                    else:
                        await channel.send(content=content or None, embed=embed)
                elif image_file:
                    await channel.send(content=content or None, file=image_file)
                else:
                    await channel.send(content or "\u200b")
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
