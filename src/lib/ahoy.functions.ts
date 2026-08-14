import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const guildInput = z.object({ guildId: z.string().regex(/^\d{5,25}$/) });

/* ---------------------------------------------------------------- */
/* Session                                                           */
/* ---------------------------------------------------------------- */

export const getViewer = createServerFn({ method: "GET" }).handler(async () => {
  const { sessionFromHeader, fetchUserGuilds, canManage } = await import("@/lib/discord.server");
  const session = await sessionFromHeader(getRequestHeader("cookie") ?? null);
  if (!session) return { signedIn: false as const };

  const { adminRoleFor, isBanned } = await import("@/lib/admin.server");
  const [adminRole, ban] = await Promise.all([adminRoleFor(session.userId), isBanned(session.userId)]);
  if (ban.banned) {
    return {
      signedIn: true as const,
      user: publicUser(session),
      guilds: [],
      guildsError: false,
      adminRole: null,
      banned: true as const,
      banReason: ban.reason,
    };
  }

  let guilds: Array<{ id: string; name: string; icon: string | null; owner: boolean }> = [];
  try {
    guilds = (await fetchUserGuilds(session))
      .filter(canManage)
      .map((g) => ({ id: g.id, name: g.name, icon: g.icon, owner: g.owner }));
  } catch (error) {
    console.error("Failed to load Discord guilds", error);
    return {
      signedIn: true as const,
      user: publicUser(session),
      guilds: [],
      guildsError: true,
      adminRole,
      banned: false as const,
      banReason: null,
    };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("servers")
    .select("guild_id, member_count, bot_present")
    .in("guild_id", guilds.length ? guilds.map((g) => g.id) : ["0"]);

  const known = new Map((data ?? []).map((row) => [row.guild_id, row]));
  return {
    signedIn: true as const,
    user: publicUser(session),
    guildsError: false,
    adminRole,
    banned: false as const,
    banReason: null,
    guilds: guilds.map((g) => ({
      ...g,
      botPresent: Boolean(known.get(g.id)?.bot_present),
      memberCount: known.get(g.id)?.member_count ?? null,
    })),
  };
});

function publicUser(session: { userId: string; username: string; globalName: string | null; avatar: string | null }) {
  return {
    id: session.userId,
    username: session.username,
    displayName: session.globalName ?? session.username,
    avatarUrl: session.avatar
      ? `https://cdn.discordapp.com/avatars/${session.userId}/${session.avatar}.png?size=128`
      : null,
  };
}

/* ---------------------------------------------------------------- */
/* Shared guards                                                     */
/* ---------------------------------------------------------------- */

async function authorize(guildId: string) {
  const { sessionFromHeader, assertGuildAccess } = await import("@/lib/discord.server");
  const session = await sessionFromHeader(getRequestHeader("cookie") ?? null);
  if (!session) throw new Error("Please sign in with Discord.");
  const { isBanned } = await import("@/lib/admin.server");
  if ((await isBanned(session.userId)).banned) {
    throw new Error("Your access to the AHOY control center has been revoked.");
  }
  const guild = await assertGuildAccess(session, guildId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { session, guild, supabaseAdmin };
}

/** Settings tables reference `servers`, so make sure the row exists before writing. */
async function ensureServerRow(
  supabaseAdmin: Awaited<ReturnType<typeof authorize>>["supabaseAdmin"],
  guild: { id: string; name: string; icon: string | null },
) {
  const { error } = await supabaseAdmin
    .from("servers")
    .upsert({ guild_id: guild.id, name: guild.name, icon: guild.icon }, { onConflict: "guild_id" });
  if (error) console.error("Failed to ensure server row", error);
}



/** Discord guild channels/roles, read with the bot token (server-only). */
async function fetchGuildStructure(guildId: string) {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) return { channels: [], roles: [], botInGuild: false };
  const headers = { authorization: `Bot ${token}` };
  const [channelsRes, rolesRes] = await Promise.all([
    fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers }),
    fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers }),
  ]);
  if (!channelsRes.ok || !rolesRes.ok) return { channels: [], roles: [], botInGuild: false };

  const channels = (await channelsRes.json()) as Array<{ id: string; name: string; type: number }>;
  const roles = (await rolesRes.json()) as Array<{
    id: string;
    name: string;
    managed: boolean;
    position: number;
  }>;
  return {
    botInGuild: true,
    channels: channels
      .filter((c) => c.type === 0 || c.type === 4)
      .map((c) => ({ id: c.id, name: c.name, kind: c.type === 4 ? "category" : "text" })),
    roles: roles
      .filter((r) => !r.managed && r.name !== "@everyone")
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name })),
  };
}

const SECTION_TABLES = {
  general: "server_settings",
  welcome: "welcome_settings",
  logging: "logging_settings",
  automod: "automod_settings",
  roles: "role_settings",
} as const;

/* ---------------------------------------------------------------- */
/* Reads                                                             */
/* ---------------------------------------------------------------- */

export const getGuildConfig = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => guildInput.parse(data))
  .handler(async ({ data }) => {
    const { guild, supabaseAdmin } = await authorize(data.guildId);
    const [server, settings, welcome, logging, automod, roles, commands, structure] =
      await Promise.all([
        supabaseAdmin.from("servers").select("*").eq("guild_id", data.guildId).maybeSingle(),
        supabaseAdmin.from("server_settings").select("*").eq("guild_id", data.guildId).maybeSingle(),
        supabaseAdmin.from("welcome_settings").select("*").eq("guild_id", data.guildId).maybeSingle(),
        supabaseAdmin.from("logging_settings").select("*").eq("guild_id", data.guildId).maybeSingle(),
        supabaseAdmin.from("automod_settings").select("*").eq("guild_id", data.guildId).maybeSingle(),
        supabaseAdmin.from("role_settings").select("*").eq("guild_id", data.guildId).maybeSingle(),
        supabaseAdmin
          .from("custom_commands")
          .select("*")
          .eq("guild_id", data.guildId)
          .order("name"),
        fetchGuildStructure(data.guildId),
      ]);

    return {
      guild: { id: guild.id, name: guild.name, icon: guild.icon },
      server: server.data,
      settings: settings.data,
      welcome: welcome.data,
      logging: logging.data,
      automod: automod.data,
      roles: roles.data,
      commands: commands.data ?? [],
      structure,
    };
  });

export const getGuildOverview = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => guildInput.parse(data))
  .handler(async ({ data }) => {
    const { guild, supabaseAdmin } = await authorize(data.guildId);
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();

    const [server, structure, modCount, warnCount, xpCount, tickets, recent] = await Promise.all([
      supabaseAdmin.from("servers").select("*").eq("guild_id", data.guildId).maybeSingle(),
      fetchGuildStructure(data.guildId),
      supabaseAdmin
        .from("moderation_logs")
        .select("id", { count: "exact", head: true })
        .eq("guild_id", data.guildId)
        .gte("created_at", since),
      supabaseAdmin
        .from("warnings")
        .select("id", { count: "exact", head: true })
        .eq("guild_id", data.guildId)
        .eq("active", true),
      supabaseAdmin
        .from("xp_profiles")
        .select("id", { count: "exact", head: true })
        .eq("guild_id", data.guildId),
      supabaseAdmin
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("guild_id", data.guildId)
        .neq("status", "closed"),
      supabaseAdmin
        .from("moderation_logs")
        .select("action, target_name, moderator_name, reason, created_at")
        .eq("guild_id", data.guildId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    return {
      guild: { id: guild.id, name: guild.name, icon: guild.icon },
      botPresent: structure.botInGuild,
      memberCount: server.data?.member_count ?? null,
      channels: structure.channels.length,
      roles: structure.roles.length,
      moderationLast7Days: modCount.count ?? 0,
      activeWarnings: warnCount.count ?? 0,
      trackedMembers: xpCount.count ?? 0,
      openTickets: tickets.count ?? 0,
      recent: recent.data ?? [],
    };
  });

export const getModerationHistory = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => guildInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const [logs, warnings, tickets] = await Promise.all([
      supabaseAdmin
        .from("moderation_logs")
        .select("*")
        .eq("guild_id", data.guildId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("warnings")
        .select("*")
        .eq("guild_id", data.guildId)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("tickets")
        .select("*")
        .eq("guild_id", data.guildId)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);
    return {
      logs: logs.data ?? [],
      warnings: warnings.data ?? [],
      tickets: tickets.data ?? [],
    };
  });

/* ---------------------------------------------------------------- */
/* Writes                                                            */
/* ---------------------------------------------------------------- */

const snowflake = z.string().regex(/^\d{5,25}$/).nullable().optional();
const action = z.enum(["delete", "warn", "timeout"]);

const sectionSchemas = {
  general: z.object({
    prefix: z.string().min(1).max(5),
    currency_name: z.string().min(1).max(24),
    currency_symbol: z.string().min(1).max(8),
    timezone: z.string().min(1).max(64),
    mod_log_channel_id: snowflake,
    xp_enabled: z.boolean(),
    xp_per_message: z.number().int().min(1).max(500),
    xp_cooldown_seconds: z.number().int().min(0).max(3600),
    level_up_message: z.string().max(500),
    level_up_channel_id: snowflake,
    economy_enabled: z.boolean(),
    daily_reward: z.number().int().min(0).max(1_000_000),
    starting_balance: z.number().int().min(0).max(1_000_000),
    tickets_enabled: z.boolean(),
    ticket_category_id: snowflake,
    ticket_panel_channel_id: snowflake,
    ticket_support_role_ids: z.array(z.string().regex(/^\d{5,25}$/)).max(10),
    ticket_welcome_message: z.string().max(1000),
    ticket_transcripts_enabled: z.boolean(),
  }).partial(),
  welcome: z.object({
    enabled: z.boolean(),
    welcome_channel_id: snowflake,
    welcome_message: z.string().max(1500),
    goodbye_enabled: z.boolean(),
    goodbye_channel_id: snowflake,
    goodbye_message: z.string().max(1500),
    auto_role_id: snowflake,
    use_embed: z.boolean(),
    embed_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    embed_title: z.string().max(200),
    embed_image_url: z.string().url().max(500).nullable().optional(),
  }).partial(),
  logging: z.object({
    enabled: z.boolean(),
    log_channel_id: snowflake,
    member_join: z.boolean(),
    member_leave: z.boolean(),
    message_delete: z.boolean(),
    message_edit: z.boolean(),
    moderation_actions: z.boolean(),
    role_changes: z.boolean(),
    channel_changes: z.boolean(),
    server_changes: z.boolean(),
    voice_activity: z.boolean(),
  }).partial(),
  automod: z.object({
    enabled: z.boolean(),
    anti_spam_enabled: z.boolean(),
    anti_spam_messages: z.number().int().min(2).max(30),
    anti_spam_seconds: z.number().int().min(1).max(120),
    anti_spam_action: action,
    mention_limit_enabled: z.boolean(),
    mention_limit: z.number().int().min(1).max(50),
    mention_action: action,
    invite_filter_enabled: z.boolean(),
    invite_action: action,
    word_filter_enabled: z.boolean(),
    blocked_words: z.array(z.string().min(1).max(50)).max(200),
    word_action: action,
    duplicate_filter_enabled: z.boolean(),
    duplicate_action: action,
    timeout_seconds: z.number().int().min(60).max(2_419_200),
    ignored_role_ids: z.array(z.string().regex(/^\d{5,25}$/)).max(25),
    ignored_channel_ids: z.array(z.string().regex(/^\d{5,25}$/)).max(25),
  }).partial(),
  roles: z.object({
    auto_role_ids: z.array(z.string().regex(/^\d{5,25}$/)).max(10),
    level_roles: z
      .array(z.object({ level: z.number().int().min(1).max(500), role_id: z.string().regex(/^\d{5,25}$/) }))
      .max(50),
  }).partial(),
} as const;

const updateInput = z.object({
  guildId: z.string().regex(/^\d{5,25}$/),
  section: z.enum(["general", "welcome", "logging", "automod", "roles"]),
  values: z.record(z.string(), z.unknown()),
});

export const updateGuildSection = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateInput.parse(data))
  .handler(async ({ data }) => {
    const { session, guild, supabaseAdmin } = await authorize(data.guildId);
    await ensureServerRow(supabaseAdmin, guild);
    const parsed = sectionSchemas[data.section].parse(data.values);
    const table = SECTION_TABLES[data.section];

    const { error } = await supabaseAdmin
      .from(table)
      .upsert({ guild_id: data.guildId, ...parsed }, { onConflict: "guild_id" });
    if (error) {
      console.error("Failed to save settings", table, error);
      throw new Error("Could not save those settings. Please try again.");
    }

    await supabaseAdmin.from("dashboard_access_log").insert({
      discord_user_id: session.userId,
      discord_username: session.username,
      guild_id: data.guildId,
      action: `update:${data.section}`,
    });

    return { ok: true };
  });

const commandInput = z.object({
  guildId: z.string().regex(/^\d{5,25}$/),
  id: z.string().uuid().optional(),
  name: z.string().regex(/^[a-z0-9_-]{1,32}$/, "Use lowercase letters, numbers, - or _"),
  response: z.string().min(1).max(2000),
  is_embed: z.boolean(),
  embed_title: z.string().max(200).nullable().optional(),
  enabled: z.boolean(),
});

export const saveCustomCommand = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => commandInput.parse(data))
  .handler(async ({ data }) => {
    const { session, guild, supabaseAdmin } = await authorize(data.guildId);
    await ensureServerRow(supabaseAdmin, guild);
    const payload = {
      guild_id: data.guildId,
      name: data.name,
      response: data.response,
      is_embed: data.is_embed,
      embed_title: data.embed_title ?? null,
      enabled: data.enabled,
      created_by: session.userId,
    };
    const { error } = data.id
      ? await supabaseAdmin.from("custom_commands").update(payload).eq("id", data.id).eq("guild_id", data.guildId)
      : await supabaseAdmin.from("custom_commands").insert(payload);
    if (error) {
      console.error("Custom command save failed", error);
      throw new Error(
        error.code === "23505"
          ? "A command with that name already exists."
          : "Could not save that command.",
      );
    }
    return { ok: true };
  });

export const deleteCustomCommand = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ guildId: z.string().regex(/^\d{5,25}$/), id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    await supabaseAdmin
      .from("custom_commands")
      .delete()
      .eq("id", data.id)
      .eq("guild_id", data.guildId);
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* Leaderboards & reminders                                          */
/* ---------------------------------------------------------------- */

export const getEngagement = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => guildInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const [xp, economy, reminders] = await Promise.all([
      supabaseAdmin
        .from("xp_profiles")
        .select("user_id, username, xp, level, messages")
        .eq("guild_id", data.guildId)
        .order("xp", { ascending: false })
        .limit(25),
      supabaseAdmin
        .from("economy_profiles")
        .select("user_id, username, balance, bank, daily_streak")
        .eq("guild_id", data.guildId)
        .order("balance", { ascending: false })
        .limit(25),
      supabaseAdmin
        .from("reminders")
        .select("id, user_id, message, remind_at, delivered, channel_id, created_at")
        .eq("guild_id", data.guildId)
        .order("remind_at", { ascending: true })
        .limit(50),
    ]);
    return {
      xp: xp.data ?? [],
      economy: economy.data ?? [],
      reminders: reminders.data ?? [],
    };
  });

export const deleteReminder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ guildId: z.string().regex(/^\d{5,25}$/), id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { error } = await supabaseAdmin
      .from("reminders")
      .delete()
      .eq("id", data.id)
      .eq("guild_id", data.guildId);
    if (error) throw new Error("Could not cancel that reminder.");
    return { ok: true };
  });
