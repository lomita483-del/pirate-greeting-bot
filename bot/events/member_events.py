"""Welcome / goodbye messages, auto-role and member logging."""

from __future__ import annotations

import discord
from discord.ext import commands

from ..utils import embeds
from ..utils.logger import get_logger
from ..utils.parsing import render_template

log = get_logger("members")


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
        await self.bot.logs.send(  # type: ignore[attr-defined]
            guild,
            "member_join",
            embeds.info(
                "Member joined",
                f"{member.mention} · `{member.id}`\nMembers: {guild.member_count}",
            ),
        )

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

        text = render_template(
            config.get("welcome_message", "Welcome {user} to {server}! ⚓"),
            user=member.mention,
            username=member.name,
            server=guild.name,
            member_count=str(guild.member_count or 0),
        )
        try:
            if config.get("use_embed", True):
                color = config.get("embed_color") or "#1FB6A6"
                embed = discord.Embed(
                    title=config.get("embed_title") or "Ahoy, new crew member!",
                    description=text,
                    color=discord.Color.from_str(color),
                )
                embed.set_thumbnail(url=member.display_avatar.url)
                if config.get("embed_image_url"):
                    embed.set_image(url=config["embed_image_url"])
                embed.set_footer(text="AHOY ⚓")
                await channel.send(embed=embed)
            else:
                await channel.send(text)
        except (discord.HTTPException, ValueError) as exc:
            log.warning("Welcome message failed in %s: %s", guild_id, exc)

    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member) -> None:
        guild = member.guild
        guild_id = str(guild.id)
        await self.bot.repo.mark_member_left(guild_id, str(member.id))  # type: ignore[attr-defined]
        await self.bot.logs.send(  # type: ignore[attr-defined]
            guild,
            "member_leave",
            embeds.info("Member left", f"{member} · `{member.id}`"),
        )

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
            )
            try:
                await channel.send(text)
            except discord.HTTPException:
                pass

    @commands.Cog.listener()
    async def on_member_update(self, before: discord.Member, after: discord.Member) -> None:
        if before.roles == after.roles:
            return
        added = [r.name for r in after.roles if r not in before.roles]
        removed = [r.name for r in before.roles if r not in after.roles]
        detail = ""
        if added:
            detail += f"**Added:** {', '.join(added)}\n"
        if removed:
            detail += f"**Removed:** {', '.join(removed)}"
        await self.bot.logs.send(  # type: ignore[attr-defined]
            after.guild, "role_changes", embeds.info(f"Roles updated · {after}", detail)
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
        elif after.channel is None:
            text = f"{member.mention} left **{before.channel.name}**"  # type: ignore[union-attr]
        else:
            text = f"{member.mention} moved to **{after.channel.name}**"
        await self.bot.logs.send(  # type: ignore[attr-defined]
            member.guild, "voice_activity", embeds.info("Voice activity", text)
        )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(MemberEvents(bot))
