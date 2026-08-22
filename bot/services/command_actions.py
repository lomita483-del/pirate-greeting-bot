"""Real Discord behaviour for the generated AHOY command library.

``bot/command_library.py`` produces ~950 subcommands. Historically every one of
them ran through the generic engine in :mod:`bot.services.feature_service`,
which only stored a row and echoed the same "Area / State / Times used" embed —
so most commands did nothing and all looked identical.

This module supplies genuine implementations for the high-traffic families
(roles, channels/categories, moderation extras, message cleanup, member and
server information, voice moderation, utilities). ``FeatureService.execute``
looks a command up here first and only falls back to the generic engine when no
real handler exists.

Handlers are registered under ``"<category>:<sub>"`` for a specific command, or
``"*:<sub>"`` to cover the same subcommand name in every category.
"""

from __future__ import annotations

import random
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable, Optional

import discord

from ..utils import embeds
from ..utils.checks import ActionRefused, ensure_actionable, ensure_assignable_role

MAX_PURGE = 200


@dataclass
class Ctx:
    interaction: discord.Interaction
    guild: discord.Guild
    actor: discord.Member
    command: str
    category: str
    sub: str
    description: str
    member: Optional[discord.Member]
    role: Optional[discord.Role]
    channel: Optional[discord.abc.GuildChannel]
    amount: Optional[int]
    value: Optional[str]
    repo: object

    # -- small helpers -------------------------------------------------
    def require(self, permission: str) -> None:
        if not getattr(self.actor.guild_permissions, permission, False):
            raise ActionRefused(
                f"You need the **{permission.replace('_', ' ').title()}** permission for that."
            )

    def bot_requires(self, permission: str) -> None:
        me = self.guild.me
        if me is None or not getattr(me.guild_permissions, permission, False):
            raise ActionRefused(
                f"AHOY is missing the **{permission.replace('_', ' ').title()}** permission."
            )

    def need_member(self) -> discord.Member:
        if self.member is None:
            raise ActionRefused("Pick a **member** for this command.")
        return self.member

    def need_role(self) -> discord.Role:
        if self.role is None:
            raise ActionRefused("Pick a **role** for this command.")
        return self.role

    def need_value(self, what: str = "value") -> str:
        text = (self.value or "").strip()
        if not text:
            raise ActionRefused(f"Provide a **{what}** for this command.")
        return text

    def text_channel(self) -> discord.TextChannel:
        target = self.channel or self.interaction.channel
        if not isinstance(target, discord.TextChannel):
            raise ActionRefused("Pick a text channel for this command.")
        return target

    @property
    def reason(self) -> str:
        base = (self.value or "").strip() or "No reason given"
        return f"{base} — /{self.command} by {self.actor}"[:400]


Handler = Callable[[Ctx], Awaitable[discord.Embed]]
HANDLERS: dict[str, Handler] = {}


def handles(*keys: str) -> Callable[[Handler], Handler]:
    def decorator(func: Handler) -> Handler:
        for key in keys:
            HANDLERS[key] = func
        return func

    return decorator


def lookup(category: str, sub: str) -> Optional[Handler]:
    return HANDLERS.get(f"{category}:{sub}") or HANDLERS.get(f"*:{sub}")


def _ts(moment: Optional[datetime]) -> str:
    if moment is None:
        return "—"
    return f"<t:{int(moment.timestamp())}:F> (<t:{int(moment.timestamp())}:R>)"


def _parse_duration(text: Optional[str], default_minutes: int = 10) -> timedelta:
    match = re.search(r"(\d+)\s*(s|m|h|d|w)?", text or "")
    if not match:
        return timedelta(minutes=default_minutes)
    amount = int(match.group(1))
    unit = match.group(2) or "m"
    factor = {"s": 1, "m": 60, "h": 3600, "d": 86400, "w": 604800}[unit]
    return timedelta(seconds=min(amount * factor, 28 * 86400))


# ======================================================================
# Information
# ======================================================================


@handles(
    "*:userinfo",
    "*:userprofile",
    "*:lookup",
    "investigate:userscan",
    "investigate:userstatus",
)
async def user_info(ctx: Ctx) -> discord.Embed:
    member = ctx.member or ctx.actor
    embed = embeds.brand(str(member), member.mention)
    embed.set_thumbnail(url=member.display_avatar.url)
    embed.add_field(name="User ID", value=f"`{member.id}`", inline=True)
    embed.add_field(name="Bot", value="Yes" if member.bot else "No", inline=True)
    embed.add_field(
        name="Top role",
        value=member.top_role.mention if member.top_role else "—",
        inline=True,
    )
    embed.add_field(name="Account created", value=_ts(member.created_at), inline=False)
    embed.add_field(name="Joined server", value=_ts(member.joined_at), inline=False)
    roles = [r.mention for r in reversed(member.roles) if not r.is_default()]
    embed.add_field(
        name=f"Roles ({len(roles)})",
        value=", ".join(roles[:20]) or "None",
        inline=False,
    )
    if member.premium_since:
        embed.add_field(name="Boosting since", value=_ts(member.premium_since), inline=False)
    if member.is_timed_out():
        embed.add_field(name="Timed out until", value=_ts(member.timed_out_until), inline=False)
    return embed


@handles("*:avatar", "*:avatarinfo")
async def avatar(ctx: Ctx) -> discord.Embed:
    member = ctx.member or ctx.actor
    url = member.display_avatar.replace(size=1024).url
    embed = embeds.brand(f"Avatar — {member}", f"[Open full size]({url})")
    embed.set_image(url=url)
    return embed


@handles("*:banner", "*:bannerinfo")
async def banner(ctx: Ctx) -> discord.Embed:
    member = ctx.member or ctx.actor
    user = await ctx.interaction.client.fetch_user(member.id)
    if user.banner is None:
        return embeds.info(f"Banner — {member}", "That user has no profile banner.")
    embed = embeds.brand(f"Banner — {member}", f"[Open full size]({user.banner.url})")
    embed.set_image(url=user.banner.url)
    return embed


@handles("investigate:roles", "*:userroles")
async def user_roles(ctx: Ctx) -> discord.Embed:
    member = ctx.member or ctx.actor
    roles = [r for r in reversed(member.roles) if not r.is_default()]
    body = "\n".join(f"{r.mention} · `{r.id}`" for r in roles[:30]) or "No roles."
    return embeds.brand(f"Roles — {member}", body)


@handles("investigate:permissions", "util:permissions-check", "xyz-general:permissions")
async def user_permissions(ctx: Ctx) -> discord.Embed:
    member = ctx.member or ctx.actor
    perms = [
        name.replace("_", " ").title()
        for name, value in member.guild_permissions
        if value
    ]
    return embeds.brand(
        f"Permissions — {member}",
        ", ".join(perms[:40]) or "No permissions.",
    )


@handles("*:joinedat")
async def joined_at(ctx: Ctx) -> discord.Embed:
    member = ctx.member or ctx.actor
    return embeds.brand(f"Joined — {member}", _ts(member.joined_at))


@handles("*:createdat", "*:accountage")
async def account_age(ctx: Ctx) -> discord.Embed:
    member = ctx.member or ctx.actor
    age = datetime.now(timezone.utc) - member.created_at
    return embeds.brand(
        f"Account age — {member}",
        f"{_ts(member.created_at)}\n**{age.days}** days old.",
    )


@handles("*:serverinfo", "*:guildinfo", "servercfg:info", "analytics:analytics")
async def server_info(ctx: Ctx) -> discord.Embed:
    guild = ctx.guild
    humans = sum(1 for m in guild.members if not m.bot)
    bots = guild.member_count - humans if guild.member_count else 0
    embed = embeds.brand(guild.name, guild.description or "Server overview")
    if guild.icon:
        embed.set_thumbnail(url=guild.icon.url)
    embed.add_field(name="Server ID", value=f"`{guild.id}`", inline=True)
    embed.add_field(name="Owner", value=f"<@{guild.owner_id}>", inline=True)
    embed.add_field(name="Created", value=_ts(guild.created_at), inline=False)
    embed.add_field(name="Members", value=str(guild.member_count or 0), inline=True)
    embed.add_field(name="Humans", value=str(humans), inline=True)
    embed.add_field(name="Bots", value=str(bots), inline=True)
    embed.add_field(name="Text channels", value=str(len(guild.text_channels)), inline=True)
    embed.add_field(name="Voice channels", value=str(len(guild.voice_channels)), inline=True)
    embed.add_field(name="Categories", value=str(len(guild.categories)), inline=True)
    embed.add_field(name="Roles", value=str(len(guild.roles)), inline=True)
    embed.add_field(name="Emojis", value=str(len(guild.emojis)), inline=True)
    embed.add_field(name="Boosts", value=f"{guild.premium_subscription_count} (tier {guild.premium_tier})", inline=True)
    return embed


@handles("*:guildmembercount", "member:members", "analytics:members")
async def member_count(ctx: Ctx) -> discord.Embed:
    guild = ctx.guild
    humans = [m for m in guild.members if not m.bot]
    bots = [m for m in guild.members if m.bot]
    online = [m for m in guild.members if m.status is not discord.Status.offline]
    week = datetime.now(timezone.utc) - timedelta(days=7)
    new = [m for m in guild.members if m.joined_at and m.joined_at > week]
    embed = embeds.brand("Member count", f"**{guild.member_count or len(guild.members)}** total members.")
    embed.add_field(name="Humans", value=str(len(humans)), inline=True)
    embed.add_field(name="Bots", value=str(len(bots)), inline=True)
    embed.add_field(name="Online now", value=str(len(online)), inline=True)
    embed.add_field(name="Joined this week", value=str(len(new)), inline=True)
    embed.add_field(name="Boosters", value=str(len(guild.premium_subscribers)), inline=True)
    return embed


def _member_list(ctx: Ctx, title: str, members: list[discord.Member]) -> discord.Embed:
    body = "\n".join(f"{m.mention} · `{m.id}`" for m in members[:25]) or "Nobody matched."
    return embeds.brand(f"{title} ({len(members)})", body)


@handles("member:s-online")
async def members_online(ctx: Ctx) -> discord.Embed:
    return _member_list(
        ctx, "Online members", [m for m in ctx.guild.members if m.status is not discord.Status.offline]
    )


@handles("member:s-offline")
async def members_offline(ctx: Ctx) -> discord.Embed:
    return _member_list(
        ctx, "Offline members", [m for m in ctx.guild.members if m.status is discord.Status.offline]
    )


@handles("member:s-bots")
async def members_bots(ctx: Ctx) -> discord.Embed:
    return _member_list(ctx, "Bots", [m for m in ctx.guild.members if m.bot])


@handles("member:s-humans")
async def members_humans(ctx: Ctx) -> discord.Embed:
    return _member_list(ctx, "Humans", [m for m in ctx.guild.members if not m.bot])


@handles("member:s-new")
async def members_new(ctx: Ctx) -> discord.Embed:
    cutoff = datetime.now(timezone.utc) - _parse_duration(ctx.value, default_minutes=60 * 24 * 7)
    found = [m for m in ctx.guild.members if m.joined_at and m.joined_at > cutoff]
    found.sort(key=lambda m: m.joined_at or datetime.now(timezone.utc), reverse=True)
    return _member_list(ctx, "Recently joined", found)


@handles("member:s-role", "rolemgmt:rolemembers")
async def role_members(ctx: Ctx) -> discord.Embed:
    role = ctx.need_role()
    return _member_list(ctx, f"Members with {role.name}", list(role.members))


@handles("member:s-search")
async def member_search(ctx: Ctx) -> discord.Embed:
    needle = ctx.need_value("search term").lower()
    found = [
        m
        for m in ctx.guild.members
        if needle in m.name.lower() or needle in m.display_name.lower()
    ]
    return _member_list(ctx, f"Search “{needle}”", found)


@handles("*:roleinfo")
async def role_info(ctx: Ctx) -> discord.Embed:
    role = ctx.need_role()
    perms = [n.replace("_", " ").title() for n, v in role.permissions if v]
    embed = embeds.brand(f"Role — {role.name}", role.mention)
    embed.add_field(name="Role ID", value=f"`{role.id}`", inline=True)
    embed.add_field(name="Members", value=str(len(role.members)), inline=True)
    embed.add_field(name="Colour", value=str(role.colour), inline=True)
    embed.add_field(name="Position", value=str(role.position), inline=True)
    embed.add_field(name="Mentionable", value="Yes" if role.mentionable else "No", inline=True)
    embed.add_field(name="Hoisted", value="Yes" if role.hoist else "No", inline=True)
    embed.add_field(name="Created", value=_ts(role.created_at), inline=False)
    embed.add_field(name="Key permissions", value=", ".join(perms[:20]) or "None", inline=False)
    return embed


@handles("rolemgmt:rolehierarchy", "*:rolelist")
async def role_hierarchy(ctx: Ctx) -> discord.Embed:
    roles = [r for r in reversed(ctx.guild.roles) if not r.is_default()]
    body = "\n".join(f"`{r.position:>3}` {r.mention} — {len(r.members)} members" for r in roles[:30])
    return embeds.brand(f"Role hierarchy ({len(roles)})", body or "No roles.")


@handles("rolemgmt:adminroles", "rolemgmt:dangerousroles", "rolemgmt:modroles")
async def sensitive_roles(ctx: Ctx) -> discord.Embed:
    if ctx.sub == "modroles":
        wanted = ("kick_members", "ban_members", "manage_messages", "moderate_members")
        title = "Moderator roles"
    elif ctx.sub == "adminroles":
        wanted = ("administrator",)
        title = "Administrator roles"
    else:
        wanted = ("administrator", "manage_guild", "manage_roles", "manage_channels", "manage_webhooks")
        title = "Dangerous roles"
    found = [
        r
        for r in reversed(ctx.guild.roles)
        if not r.is_default() and any(getattr(r.permissions, p, False) for p in wanted)
    ]
    body = "\n".join(
        f"{r.mention} — "
        + ", ".join(p.replace("_", " ").title() for p in wanted if getattr(r.permissions, p, False))
        for r in found[:25]
    )
    return embeds.brand(title, body or "No roles hold those permissions.")


@handles("*:channelinfo", "channel:info")
async def channel_info(ctx: Ctx) -> discord.Embed:
    target = ctx.channel or ctx.interaction.channel
    if target is None:
        raise ActionRefused("Pick a channel for this command.")
    embed = embeds.brand(f"Channel — #{target.name}", getattr(target, "topic", None) or "")
    embed.add_field(name="Channel ID", value=f"`{target.id}`", inline=True)
    embed.add_field(name="Type", value=str(target.type).replace("_", " ").title(), inline=True)
    embed.add_field(
        name="Category", value=target.category.name if target.category else "None", inline=True
    )
    embed.add_field(name="Created", value=_ts(target.created_at), inline=False)
    if isinstance(target, discord.TextChannel):
        embed.add_field(name="Slowmode", value=f"{target.slowmode_delay}s", inline=True)
        embed.add_field(name="NSFW", value="Yes" if target.nsfw else "No", inline=True)
        embed.add_field(name="Threads", value=str(len(target.threads)), inline=True)
    if isinstance(target, discord.VoiceChannel):
        embed.add_field(name="Connected", value=str(len(target.members)), inline=True)
        embed.add_field(name="Limit", value=str(target.user_limit or "∞"), inline=True)
    return embed


@handles("*:guildchannelcount")
async def channel_count(ctx: Ctx) -> discord.Embed:
    guild = ctx.guild
    embed = embeds.brand("Channel count", f"**{len(guild.channels)}** channels in total.")
    embed.add_field(name="Text", value=str(len(guild.text_channels)), inline=True)
    embed.add_field(name="Voice", value=str(len(guild.voice_channels)), inline=True)
    embed.add_field(name="Stage", value=str(len(guild.stage_channels)), inline=True)
    embed.add_field(name="Forum", value=str(len(guild.forums)), inline=True)
    embed.add_field(name="Categories", value=str(len(guild.categories)), inline=True)
    return embed


@handles("*:guildiconinfo")
async def guild_icon(ctx: Ctx) -> discord.Embed:
    if ctx.guild.icon is None:
        return embeds.info("Server icon", "This server has no icon.")
    embed = embeds.brand("Server icon", f"[Open full size]({ctx.guild.icon.url})")
    embed.set_image(url=ctx.guild.icon.url)
    return embed


@handles("*:guildbannerinfo", "*:guildsplashinfo")
async def guild_banner(ctx: Ctx) -> discord.Embed:
    asset = ctx.guild.banner if ctx.sub == "guildbannerinfo" else ctx.guild.splash
    if asset is None:
        return embeds.info("Server artwork", "This server has no banner/splash set.")
    embed = embeds.brand("Server artwork", f"[Open full size]({asset.url})")
    embed.set_image(url=asset.url)
    return embed


@handles("*:emojiinfo", "*:emojis")
async def emoji_info(ctx: Ctx) -> discord.Embed:
    emojis = ctx.guild.emojis
    if not emojis:
        return embeds.info("Emojis", "This server has no custom emojis.")
    body = " ".join(str(e) for e in emojis[:60])
    return embeds.brand(f"Emojis ({len(emojis)})", body)


@handles("*:stickerinfo", "*:stickerpackinfo")
async def sticker_info(ctx: Ctx) -> discord.Embed:
    stickers = ctx.guild.stickers
    if not stickers:
        return embeds.info("Stickers", "This server has no custom stickers.")
    body = "\n".join(f"• **{s.name}** · `{s.id}`" for s in stickers[:25])
    return embeds.brand(f"Stickers ({len(stickers)})", body)


@handles("*:ping")
async def ping(ctx: Ctx) -> discord.Embed:
    latency = ctx.interaction.client.latency * 1000
    return embeds.brand("Pong", f"Gateway latency: **{latency:.0f} ms**")


@handles("util:serverid")
async def server_id(ctx: Ctx) -> discord.Embed:
    return embeds.brand("Server ID", f"`{ctx.guild.id}`")


@handles("util:botid")
async def bot_id(ctx: Ctx) -> discord.Embed:
    return embeds.brand("Bot ID", f"`{ctx.interaction.client.user.id}`")


@handles("util:id")
async def target_id(ctx: Ctx) -> discord.Embed:
    member = ctx.member or ctx.actor
    return embeds.brand("User ID", f"{member.mention} — `{member.id}`")


@handles("util:channelid")
async def channel_id(ctx: Ctx) -> discord.Embed:
    target = ctx.channel or ctx.interaction.channel
    return embeds.brand("Channel ID", f"<#{target.id}> — `{target.id}`")


@handles("util:roleid")
async def role_id(ctx: Ctx) -> discord.Embed:
    role = ctx.need_role()
    return embeds.brand("Role ID", f"{role.mention} — `{role.id}`")


@handles("util:snowflake", "util:timestamp")
async def snowflake(ctx: Ctx) -> discord.Embed:
    raw = ctx.need_value("snowflake ID")
    if not raw.isdigit():
        raise ActionRefused("Snowflakes are numeric IDs.")
    created = discord.utils.snowflake_time(int(raw))
    return embeds.brand(f"Snowflake `{raw}`", f"Created {_ts(created)}")


# ======================================================================
# Role management
# ======================================================================


@handles("*:roleadd", "*:giverole")
async def role_add(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_roles")
    ctx.bot_requires("manage_roles")
    member, role = ctx.need_member(), ctx.need_role()
    ensure_assignable_role(ctx.guild, role)
    if role in member.roles:
        raise ActionRefused(f"{member.mention} already has {role.mention}.")
    await member.add_roles(role, reason=ctx.reason)
    return embeds.success("Role added", f"{role.mention} → {member.mention}")


@handles("*:roleremove", "*:takerole")
async def role_remove(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_roles")
    ctx.bot_requires("manage_roles")
    member, role = ctx.need_member(), ctx.need_role()
    ensure_assignable_role(ctx.guild, role)
    if role not in member.roles:
        raise ActionRefused(f"{member.mention} does not have {role.mention}.")
    await member.remove_roles(role, reason=ctx.reason)
    return embeds.success("Role removed", f"{role.mention} removed from {member.mention}")


@handles("*:rolecreate")
async def role_create(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_roles")
    ctx.bot_requires("manage_roles")
    name = ctx.need_value("role name")
    colour = discord.Colour.default()
    match = re.search(r"#([0-9a-fA-F]{6})", name)
    if match:
        colour = discord.Colour(int(match.group(1), 16))
        name = name.replace(match.group(0), "").strip()
    role = await ctx.guild.create_role(name=name[:100], colour=colour, reason=ctx.reason)
    return embeds.success("Role created", f"{role.mention} · `{role.id}`")


@handles("*:roledelete")
async def role_delete(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_roles")
    ctx.bot_requires("manage_roles")
    role = ctx.need_role()
    ensure_assignable_role(ctx.guild, role)
    name = role.name
    await role.delete(reason=ctx.reason)
    return embeds.success("Role deleted", f"**{name}** is gone.")


@handles("*:rolerename")
async def role_rename(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_roles")
    ctx.bot_requires("manage_roles")
    role = ctx.need_role()
    ensure_assignable_role(ctx.guild, role)
    old = role.name
    await role.edit(name=ctx.need_value("new name")[:100], reason=ctx.reason)
    return embeds.success("Role renamed", f"**{old}** → {role.mention}")


@handles("*:rolecolor", "*:rolecolour")
async def role_colour(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_roles")
    ctx.bot_requires("manage_roles")
    role = ctx.need_role()
    ensure_assignable_role(ctx.guild, role)
    raw = ctx.need_value("hex colour, e.g. #E0B15C").lstrip("#")
    if not re.fullmatch(r"[0-9a-fA-F]{6}", raw):
        raise ActionRefused("Give a 6-digit hex colour such as `#E0B15C`.")
    await role.edit(colour=discord.Colour(int(raw, 16)), reason=ctx.reason)
    return embeds.success("Role colour updated", f"{role.mention} is now `#{raw.upper()}`.")


@handles("*:roleclone")
async def role_clone(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_roles")
    ctx.bot_requires("manage_roles")
    role = ctx.need_role()
    clone = await ctx.guild.create_role(
        name=(ctx.value or f"{role.name} copy")[:100],
        colour=role.colour,
        hoist=role.hoist,
        mentionable=role.mentionable,
        permissions=role.permissions,
        reason=ctx.reason,
    )
    return embeds.success("Role cloned", f"{role.mention} → {clone.mention}")


@handles("*:rolepermissions")
async def role_permissions(ctx: Ctx) -> discord.Embed:
    role = ctx.need_role()
    perms = [n.replace("_", " ").title() for n, v in role.permissions if v]
    return embeds.brand(
        f"Permissions — {role.name}", ", ".join(perms) or "This role has no permissions."
    )


@handles("*:temprole")
async def temp_role(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_roles")
    ctx.bot_requires("manage_roles")
    member, role = ctx.need_member(), ctx.need_role()
    ensure_assignable_role(ctx.guild, role)
    duration = _parse_duration(ctx.value, default_minutes=60)
    await member.add_roles(role, reason=ctx.reason)
    expires = datetime.now(timezone.utc) + duration
    await ctx.repo.add_command_record(  # type: ignore[attr-defined]
        {
            "guild_id": str(ctx.guild.id),
            "namespace": "rolemgmt:temprole",
            "command": ctx.command,
            "label": f"{member.id}:{role.id}",
            "payload": {"expires_at": expires.isoformat(), "role_id": str(role.id)},
            "created_by": str(ctx.actor.id),
        }
    )
    return embeds.success(
        "Temporary role granted",
        f"{role.mention} → {member.mention}, expires {_ts(expires)}.",
    )


# ======================================================================
# Channel & category management
# ======================================================================


async def _set_channel_permission(
    ctx: Ctx, channel: discord.abc.GuildChannel, **overwrites: Optional[bool]
) -> None:
    everyone = ctx.guild.default_role
    overwrite = channel.overwrites_for(everyone)
    for key, val in overwrites.items():
        setattr(overwrite, key, val)
    await channel.set_permissions(everyone, overwrite=overwrite, reason=ctx.reason)


@handles("channel:lock", "*:lockchannel")
async def channel_lock(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_channels")
    ctx.bot_requires("manage_channels")
    channel = ctx.channel or ctx.interaction.channel
    await _set_channel_permission(ctx, channel, send_messages=False)
    return embeds.success("Channel locked", f"<#{channel.id}> is now read-only.")


@handles("channel:unlock", "*:unlockchannel")
async def channel_unlock(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_channels")
    ctx.bot_requires("manage_channels")
    channel = ctx.channel or ctx.interaction.channel
    await _set_channel_permission(ctx, channel, send_messages=None)
    return embeds.success("Channel unlocked", f"<#{channel.id}> is open again.")


@handles("channel:hide")
async def channel_hide(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_channels")
    ctx.bot_requires("manage_channels")
    channel = ctx.channel or ctx.interaction.channel
    await _set_channel_permission(ctx, channel, view_channel=False)
    return embeds.success("Channel hidden", f"<#{channel.id}> is hidden from @everyone.")


@handles("channel:unhide")
async def channel_unhide(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_channels")
    ctx.bot_requires("manage_channels")
    channel = ctx.channel or ctx.interaction.channel
    await _set_channel_permission(ctx, channel, view_channel=None)
    return embeds.success("Channel visible", f"<#{channel.id}> is visible again.")


@handles("channel:slowmode", "xyz-moderation:setslowmode", "*:setslowmode")
async def slowmode(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_channels")
    ctx.bot_requires("manage_channels")
    channel = ctx.text_channel()
    seconds = ctx.amount if ctx.amount is not None else int(_parse_duration(ctx.value, 0).total_seconds())
    seconds = max(0, min(seconds, 21600))
    await channel.edit(slowmode_delay=seconds, reason=ctx.reason)
    return embeds.success(
        "Slowmode updated",
        f"{channel.mention} → **{seconds}s** between messages." if seconds else f"Slowmode off in {channel.mention}.",
    )


@handles("channel:settopic")
async def set_topic(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_channels")
    ctx.bot_requires("manage_channels")
    channel = ctx.text_channel()
    await channel.edit(topic=ctx.need_value("topic")[:1024], reason=ctx.reason)
    return embeds.success("Topic updated", f"{channel.mention} — {channel.topic}")


@handles("channel:cleartopic")
async def clear_topic(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_channels")
    ctx.bot_requires("manage_channels")
    channel = ctx.text_channel()
    await channel.edit(topic=None, reason=ctx.reason)
    return embeds.success("Topic cleared", f"{channel.mention} has no topic now.")


@handles("channel:renamechannel", "*:renamechannel")
async def rename_channel(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_channels")
    ctx.bot_requires("manage_channels")
    channel = ctx.channel or ctx.interaction.channel
    old = channel.name
    await channel.edit(name=ctx.need_value("new name")[:100], reason=ctx.reason)
    return embeds.success("Channel renamed", f"**#{old}** → <#{channel.id}>")


@handles("channel:clonechannel")
async def clone_channel(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_channels")
    ctx.bot_requires("manage_channels")
    channel = ctx.channel or ctx.interaction.channel
    clone = await channel.clone(name=(ctx.value or None), reason=ctx.reason)
    return embeds.success("Channel cloned", f"<#{channel.id}> → <#{clone.id}>")


@handles("channel:stats", "channel:activity")
async def channel_stats(ctx: Ctx) -> discord.Embed:
    channel = ctx.text_channel()
    ctx.bot_requires("read_message_history")
    authors: dict[int, int] = {}
    total = 0
    async for message in channel.history(limit=200):
        total += 1
        authors[message.author.id] = authors.get(message.author.id, 0) + 1
    top = sorted(authors.items(), key=lambda kv: kv[1], reverse=True)[:10]
    body = "\n".join(f"<@{uid}> — **{count}** messages" for uid, count in top) or "No messages found."
    embed = embeds.brand(f"Activity — #{channel.name}", body)
    embed.add_field(name="Sampled", value=f"Last {total} messages", inline=True)
    embed.add_field(name="Unique authors", value=str(len(authors)), inline=True)
    return embed


@handles("category:create")
async def category_create(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_channels")
    ctx.bot_requires("manage_channels")
    category = await ctx.guild.create_category(ctx.need_value("category name")[:100], reason=ctx.reason)
    return embeds.success("Category created", f"**{category.name}** · `{category.id}`")


def _category_of(ctx: Ctx) -> discord.CategoryChannel:
    target = ctx.channel or getattr(ctx.interaction.channel, "category", None)
    if isinstance(target, discord.CategoryChannel):
        return target
    if target is not None and getattr(target, "category", None):
        return target.category  # type: ignore[return-value]
    raise ActionRefused("Pick a category channel for this command.")


@handles("category:delete")
async def category_delete(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_channels")
    ctx.bot_requires("manage_channels")
    category = _category_of(ctx)
    name = category.name
    await category.delete(reason=ctx.reason)
    return embeds.success("Category deleted", f"**{name}** removed (its channels were kept).")


@handles("category:rename")
async def category_rename(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_channels")
    ctx.bot_requires("manage_channels")
    category = _category_of(ctx)
    old = category.name
    await category.edit(name=ctx.need_value("new name")[:100], reason=ctx.reason)
    return embeds.success("Category renamed", f"**{old}** → **{category.name}**")


@handles("category:channels", "category:info")
async def category_channels(ctx: Ctx) -> discord.Embed:
    category = _category_of(ctx)
    body = "\n".join(f"<#{c.id}> · {c.type}" for c in category.channels) or "No channels."
    embed = embeds.brand(f"Category — {category.name}", body)
    embed.add_field(name="Category ID", value=f"`{category.id}`", inline=True)
    embed.add_field(name="Channels", value=str(len(category.channels)), inline=True)
    return embed


@handles("category:lock", "category:unlock", "category:hide", "category:unhide")
async def category_permissions(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_channels")
    ctx.bot_requires("manage_channels")
    category = _category_of(ctx)
    field = "send_messages" if ctx.sub in ("lock", "unlock") else "view_channel"
    state = False if ctx.sub in ("lock", "hide") else None
    changed = 0
    for channel in [category, *category.channels]:
        await _set_channel_permission(ctx, channel, **{field: state})
        changed += 1
    return embeds.success(
        f"Category {ctx.sub}ed", f"**{category.name}** — updated {changed} channel(s)."
    )


# ======================================================================
# Emergency lockdown
# ======================================================================


@handles("emergency:lockdown", "channel:lockdown", "*:serverlockdown")
async def server_lockdown(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_channels")
    ctx.bot_requires("manage_channels")
    changed = 0
    for channel in ctx.guild.text_channels:
        try:
            await _set_channel_permission(ctx, channel, send_messages=False)
            changed += 1
        except discord.HTTPException:
            continue
    return embeds.warning("Server lockdown active", f"Locked **{changed}** text channel(s).")


@handles("emergency:unlock", "channel:unlockdown", "*:serverunlock")
async def server_unlock(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_channels")
    ctx.bot_requires("manage_channels")
    changed = 0
    for channel in ctx.guild.text_channels:
        try:
            await _set_channel_permission(ctx, channel, send_messages=None)
            changed += 1
        except discord.HTTPException:
            continue
    return embeds.success("Lockdown lifted", f"Unlocked **{changed}** text channel(s).")


# ======================================================================
# Message cleanup
# ======================================================================


async def _purge(ctx: Ctx, predicate, label: str) -> discord.Embed:
    ctx.require("manage_messages")
    ctx.bot_requires("manage_messages")
    channel = ctx.text_channel()
    limit = max(1, min(ctx.amount or 50, MAX_PURGE))
    deleted = await channel.purge(limit=limit, check=predicate, reason=ctx.reason)
    return embeds.success(
        "Messages cleaned",
        f"Removed **{len(deleted)}** {label} from {channel.mention} (scanned {limit}).",
    )


@handles("cleanup:purge", "cleanup:cleanup", "xyz-moderation:purge", "xyz-moderation:prune", "cleanup:prune")
async def purge_all(ctx: Ctx) -> discord.Embed:
    return await _purge(ctx, lambda m: True, "messages")


@handles("cleanup:purgeuser", "cleanup:user")
async def purge_user(ctx: Ctx) -> discord.Embed:
    member = ctx.need_member()
    return await _purge(ctx, lambda m: m.author.id == member.id, f"messages from {member}")


@handles("cleanup:purgebots", "cleanup:bots", "cleanup:prunebots")
async def purge_bots(ctx: Ctx) -> discord.Embed:
    return await _purge(ctx, lambda m: m.author.bot, "bot messages")


@handles("cleanup:purge-links", "cleanup:links")
async def purge_links(ctx: Ctx) -> discord.Embed:
    return await _purge(ctx, lambda m: "http://" in m.content or "https://" in m.content, "messages with links")


@handles("cleanup:purgeinvites", "cleanup:invites")
async def purge_invites(ctx: Ctx) -> discord.Embed:
    pattern = re.compile(r"(discord\.gg|discord\.com/invite)/", re.I)
    return await _purge(ctx, lambda m: bool(pattern.search(m.content or "")), "invite links")


@handles("cleanup:purge-images", "cleanup:images")
async def purge_images(ctx: Ctx) -> discord.Embed:
    return await _purge(
        ctx,
        lambda m: any((a.content_type or "").startswith("image") for a in m.attachments),
        "image messages",
    )


@handles("cleanup:purge-files", "cleanup:files", "cleanup:purge-attachments")
async def purge_files(ctx: Ctx) -> discord.Embed:
    return await _purge(ctx, lambda m: bool(m.attachments), "messages with attachments")


@handles("cleanup:purge-embeds")
async def purge_embeds(ctx: Ctx) -> discord.Embed:
    return await _purge(ctx, lambda m: bool(m.embeds), "messages with embeds")


@handles("cleanup:purge-mentions")
async def purge_mentions(ctx: Ctx) -> discord.Embed:
    return await _purge(
        ctx,
        lambda m: bool(m.mentions or m.role_mentions or m.mention_everyone),
        "messages with mentions",
    )


@handles("cleanup:purge-keyword", "cleanup:keyword")
async def purge_keyword(ctx: Ctx) -> discord.Embed:
    needle = ctx.need_value("keyword").lower()
    return await _purge(ctx, lambda m: needle in (m.content or "").lower(), f"messages containing “{needle}”")


@handles("cleanup:purgecommands", "cleanup:commands")
async def purge_commands(ctx: Ctx) -> discord.Embed:
    prefixes = ("!", "?", ".", "/", "-", "$")
    return await _purge(
        ctx, lambda m: (m.content or "").startswith(prefixes) or m.author.bot, "command messages"
    )


# ======================================================================
# Message investigation
# ======================================================================


@handles("msg:search", "msg:searchkeyword")
async def message_search(ctx: Ctx) -> discord.Embed:
    needle = ctx.need_value("search term").lower()
    channel = ctx.text_channel()
    hits = []
    async for message in channel.history(limit=300):
        if needle in (message.content or "").lower():
            hits.append(message)
        if len(hits) >= 10:
            break
    body = "\n".join(
        f"[{m.author.display_name}]({m.jump_url}) · <t:{int(m.created_at.timestamp())}:R>\n> {(m.content or '')[:120]}"
        for m in hits
    )
    return embeds.brand(f"Search “{needle}”", body or "No matching messages in the last 300.")


@handles("msg:lastmessage")
async def last_message(ctx: Ctx) -> discord.Embed:
    channel = ctx.text_channel()
    target = ctx.member
    async for message in channel.history(limit=200):
        if target is None or message.author.id == target.id:
            return embeds.brand(
                "Latest message",
                f"[Jump to message]({message.jump_url}) by {message.author.mention}\n> {(message.content or '*no text*')[:500]}",
            )
    return embeds.info("Latest message", "Nothing found in the last 200 messages.")


@handles("msg:messagecount", "investigate:messagecount")
async def message_count(ctx: Ctx) -> discord.Embed:
    channel = ctx.text_channel()
    target = ctx.member
    count = 0
    async for message in channel.history(limit=500):
        if target is None or message.author.id == target.id:
            count += 1
    who = target.mention if target else "everyone"
    return embeds.brand(
        "Message count", f"{who} sent **{count}** of the last 500 messages in {channel.mention}."
    )


# ======================================================================
# Moderation extras
# ======================================================================


@handles("*:softban")
async def softban(ctx: Ctx) -> discord.Embed:
    ctx.require("ban_members")
    ctx.bot_requires("ban_members")
    member = ctx.need_member()
    ensure_actionable(ctx.interaction, member)
    await ctx.guild.ban(member, reason=ctx.reason, delete_message_days=1)
    await ctx.guild.unban(member, reason="Softban — immediate unban")
    return embeds.success("Softban complete", f"{member} was kicked and their recent messages cleared.")


@handles("*:mute", "*:timemute", "*:namemute")
async def mute(ctx: Ctx) -> discord.Embed:
    ctx.require("moderate_members")
    ctx.bot_requires("moderate_members")
    member = ctx.need_member()
    ensure_actionable(ctx.interaction, member)
    duration = _parse_duration(ctx.value, default_minutes=10)
    await member.timeout(duration, reason=ctx.reason)
    until = datetime.now(timezone.utc) + duration
    return embeds.success("Member muted", f"{member.mention} is muted until {_ts(until)}.")


@handles("*:unmute")
async def unmute(ctx: Ctx) -> discord.Embed:
    ctx.require("moderate_members")
    ctx.bot_requires("moderate_members")
    member = ctx.need_member()
    await member.timeout(None, reason=ctx.reason)
    return embeds.success("Member unmuted", f"{member.mention} can speak again.")


@handles("*:deafen")
async def deafen(ctx: Ctx) -> discord.Embed:
    ctx.require("deafen_members")
    ctx.bot_requires("deafen_members")
    member = ctx.need_member()
    if member.voice is None:
        raise ActionRefused("That member is not in a voice channel.")
    await member.edit(deafen=True, reason=ctx.reason)
    return embeds.success("Member deafened", f"{member.mention} is deafened.")


@handles("*:undeafen")
async def undeafen(ctx: Ctx) -> discord.Embed:
    ctx.require("deafen_members")
    ctx.bot_requires("deafen_members")
    member = ctx.need_member()
    await member.edit(deafen=False, reason=ctx.reason)
    return embeds.success("Member undeafened", f"{member.mention} can hear again.")


@handles("*:voicemute")
async def voice_mute(ctx: Ctx) -> discord.Embed:
    ctx.require("mute_members")
    ctx.bot_requires("mute_members")
    member = ctx.need_member()
    if member.voice is None:
        raise ActionRefused("That member is not in a voice channel.")
    await member.edit(mute=True, reason=ctx.reason)
    return embeds.success("Voice muted", f"{member.mention} is muted in voice.")


@handles("*:voiceunmute")
async def voice_unmute(ctx: Ctx) -> discord.Embed:
    ctx.require("mute_members")
    ctx.bot_requires("mute_members")
    member = ctx.need_member()
    await member.edit(mute=False, reason=ctx.reason)
    return embeds.success("Voice unmuted", f"{member.mention} can talk again.")


@handles("*:voicekick")
async def voice_kick(ctx: Ctx) -> discord.Embed:
    ctx.require("move_members")
    ctx.bot_requires("move_members")
    member = ctx.need_member()
    if member.voice is None:
        raise ActionRefused("That member is not in a voice channel.")
    await member.move_to(None, reason=ctx.reason)
    return embeds.success("Disconnected", f"{member.mention} was removed from voice.")


@handles("voicemod:move")
async def voice_move(ctx: Ctx) -> discord.Embed:
    ctx.require("move_members")
    ctx.bot_requires("move_members")
    member = ctx.need_member()
    if not isinstance(ctx.channel, discord.VoiceChannel):
        raise ActionRefused("Pick the destination **voice channel**.")
    await member.move_to(ctx.channel, reason=ctx.reason)
    return embeds.success("Member moved", f"{member.mention} → {ctx.channel.mention}")


@handles("voicemod:moveall")
async def voice_move_all(ctx: Ctx) -> discord.Embed:
    ctx.require("move_members")
    ctx.bot_requires("move_members")
    if not isinstance(ctx.channel, discord.VoiceChannel):
        raise ActionRefused("Pick the destination **voice channel**.")
    source = ctx.actor.voice.channel if ctx.actor.voice else None
    if source is None:
        raise ActionRefused("Join a voice channel first — everyone there will be moved.")
    moved = 0
    for member in list(source.members):
        try:
            await member.move_to(ctx.channel, reason=ctx.reason)
            moved += 1
        except discord.HTTPException:
            continue
    return embeds.success("Members moved", f"Moved **{moved}** member(s) to {ctx.channel.mention}.")


@handles("voicemod:voiceusers", "voicemod:voiceinfo")
async def voice_users(ctx: Ctx) -> discord.Embed:
    channels = [c for c in ctx.guild.voice_channels if c.members]
    if not channels:
        return embeds.info("Voice activity", "Nobody is in voice right now.")
    body = "\n".join(
        f"**{c.name}** — " + ", ".join(m.display_name for m in c.members) for c in channels[:15]
    )
    return embeds.brand("Voice activity", body)


@handles("voicemod:voicechannels")
async def voice_channels(ctx: Ctx) -> discord.Embed:
    body = "\n".join(
        f"{c.mention} — {len(c.members)}/{c.user_limit or '∞'}" for c in ctx.guild.voice_channels[:25]
    )
    return embeds.brand("Voice channels", body or "No voice channels.")


@handles("*:tempban", "*:timeban")
async def temp_ban(ctx: Ctx) -> discord.Embed:
    ctx.require("ban_members")
    ctx.bot_requires("ban_members")
    member = ctx.need_member()
    ensure_actionable(ctx.interaction, member)
    duration = _parse_duration(ctx.value, default_minutes=60 * 24)
    expires = datetime.now(timezone.utc) + duration
    await ctx.guild.ban(member, reason=ctx.reason, delete_message_days=0)
    await ctx.repo.add_command_record(  # type: ignore[attr-defined]
        {
            "guild_id": str(ctx.guild.id),
            "namespace": "mod:tempban",
            "command": ctx.command,
            "label": str(member.id),
            "payload": {"expires_at": expires.isoformat()},
            "created_by": str(ctx.actor.id),
        }
    )
    return embeds.success("Temporary ban", f"{member} is banned until {_ts(expires)}.")


@handles("*:nickname", "*:setnick")
async def set_nickname(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_nicknames")
    ctx.bot_requires("manage_nicknames")
    member = ctx.need_member()
    await member.edit(nick=(ctx.value or None), reason=ctx.reason)
    return embeds.success("Nickname updated", f"{member.mention} is now **{member.display_name}**.")


@handles("*:warninglist", "*:warns", "*:userwarnings", "mod:warning")
async def warning_list(ctx: Ctx) -> discord.Embed:
    member = ctx.need_member()
    rows = await ctx.repo.list_warnings(str(ctx.guild.id), str(member.id))  # type: ignore[attr-defined]
    if not rows:
        return embeds.info("No warnings", f"{member.mention} has a clean record.")
    body = "\n".join(
        f"• {(r.get('reason') or 'No reason')[:120]} — <@{r.get('moderator_id')}>" for r in rows[:15]
    )
    return embeds.brand(f"Warnings — {member} ({len(rows)})", body)


@handles("mod:history", "investigate:userhistory", "investigate:usercases")
async def mod_history(ctx: Ctx) -> discord.Embed:
    member = ctx.need_member()
    warnings = await ctx.repo.list_warnings(str(ctx.guild.id), str(member.id))  # type: ignore[attr-defined]
    embed = embeds.brand(f"History — {member}", member.mention)
    embed.add_field(name="Warnings", value=str(len(warnings)), inline=True)
    embed.add_field(name="Joined", value=_ts(member.joined_at), inline=False)
    if warnings:
        embed.add_field(
            name="Latest warnings",
            value="\n".join(f"• {(w.get('reason') or 'No reason')[:100]}" for w in warnings[:5]),
            inline=False,
        )
    return embed


@handles("investigate:mutualroles")
async def mutual_roles(ctx: Ctx) -> discord.Embed:
    member = ctx.need_member()
    shared = [r.mention for r in member.roles if r in ctx.actor.roles and not r.is_default()]
    return embeds.brand(
        f"Shared roles with {member}", ", ".join(shared) or "You share no roles."
    )


# ======================================================================
# Invites & webhooks
# ======================================================================


@handles("invite:list", "analytics:invites", "*:invites")
async def invite_list(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_guild")
    ctx.bot_requires("manage_guild")
    invites = await ctx.guild.invites()
    if not invites:
        return embeds.info("Invites", "This server has no active invites.")
    body = "\n".join(
        f"`{i.code}` — {i.uses} uses · by {i.inviter.mention if i.inviter else '—'}"
        for i in invites[:20]
    )
    return embeds.brand(f"Invites ({len(invites)})", body)


@handles("webhook:list", "*:webhooks")
async def webhook_list(ctx: Ctx) -> discord.Embed:
    ctx.require("manage_webhooks")
    ctx.bot_requires("manage_webhooks")
    hooks = await ctx.guild.webhooks()
    if not hooks:
        return embeds.info("Webhooks", "No webhooks exist in this server.")
    body = "\n".join(f"**{h.name}** — <#{h.channel_id}>" for h in hooks[:20])
    return embeds.brand(f"Webhooks ({len(hooks)})", body)


# ======================================================================
# Analytics
# ======================================================================


@handles("analytics:channels")
async def analytics_channels(ctx: Ctx) -> discord.Embed:
    body = "\n".join(
        f"{c.mention} — slowmode {c.slowmode_delay}s" for c in ctx.guild.text_channels[:25]
    )
    return embeds.brand(f"Text channels ({len(ctx.guild.text_channels)})", body or "None")


@handles("analytics:roles")
async def analytics_roles(ctx: Ctx) -> discord.Embed:
    roles = sorted(
        [r for r in ctx.guild.roles if not r.is_default()],
        key=lambda r: len(r.members),
        reverse=True,
    )
    body = "\n".join(f"{r.mention} — **{len(r.members)}** members" for r in roles[:20])
    return embeds.brand("Roles by size", body or "No roles.")


@handles("analytics:joins", "analytics:growth")
async def analytics_joins(ctx: Ctx) -> discord.Embed:
    now = datetime.now(timezone.utc)
    buckets = {"24 hours": 1, "7 days": 7, "30 days": 30, "90 days": 90}
    embed = embeds.brand("Membership growth", "New members joining over time.")
    for label, days in buckets.items():
        cutoff = now - timedelta(days=days)
        count = sum(1 for m in ctx.guild.members if m.joined_at and m.joined_at > cutoff)
        embed.add_field(name=f"Last {label}", value=str(count), inline=True)
    return embed


@handles("inactive:list", "member:s-inactive")
async def inactive_members(ctx: Ctx) -> discord.Embed:
    ctx.require("kick_members")
    days = ctx.amount or 30
    count = await ctx.guild.estimate_pruned_members(days=min(days, 30))
    return embeds.brand(
        "Inactive members",
        f"**{count}** member(s) have been inactive for {min(days, 30)} days and would be pruned.",
    )


# ======================================================================
# Fun & engagement
# ======================================================================

EIGHTBALL = [
    "It is certain, matey.",
    "Signs point to aye.",
    "The tides say yes.",
    "Ask again after the storm.",
    "Doubtful waters ahead.",
    "Nay, not this voyage.",
    "Without a doubt.",
    "My compass says no.",
]


@handles("*:8ball", "*:eightball")
async def eight_ball(ctx: Ctx) -> discord.Embed:
    question = ctx.need_value("question")
    return embeds.brand("🎱 Magic 8-ball", f"**{question}**\n\n{random.choice(EIGHTBALL)}")


@handles("*:coinflip", "*:flip")
async def coinflip(ctx: Ctx) -> discord.Embed:
    return embeds.brand("Coin flip", f"It landed on **{random.choice(('Heads', 'Tails'))}**.")


@handles("*:dice", "*:roll")
async def dice(ctx: Ctx) -> discord.Embed:
    sides = ctx.amount or 6
    sides = max(2, min(sides, 1000))
    return embeds.brand("Dice roll", f"🎲 You rolled a **{random.randint(1, sides)}** (d{sides}).")


@handles("*:choose", "*:pick")
async def choose(ctx: Ctx) -> discord.Embed:
    options = [o.strip() for o in re.split(r"[,|]", ctx.need_value("options")) if o.strip()]
    if len(options) < 2:
        raise ActionRefused("Give at least two options separated by commas.")
    return embeds.brand("I choose…", f"**{random.choice(options)}**")


__all__ = ["Ctx", "lookup", "HANDLERS"]
