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
  const live = await botMembership(guilds.map((g) => g.id));
  return {
    signedIn: true as const,
    user: publicUser(session),
    guildsError: false,
    adminRole,
    banned: false as const,
    banReason: null,
    guilds: guilds.map((g) => ({
      ...g,
      botPresent: live.get(g.id) ?? Boolean(known.get(g.id)?.bot_present),
      memberCount: known.get(g.id)?.member_count ?? null,
    })),
  };
});

/** Ask Discord which of these guilds the bot is actually a member of. */
async function botMembership(guildIds: string[]): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  const token = process.env["DISCORD_TOKEN"];
  if (!token || guildIds.length === 0) return result;
  try {
    const res = await fetch("https://discord.com/api/v10/users/@me/guilds?limit=200", {
      headers: { authorization: `Bot ${token}` },
    });
    if (!res.ok) return result;
    const botGuilds = (await res.json()) as Array<{ id: string }>;
    const ids = new Set(botGuilds.map((g) => g.id));
    for (const id of guildIds) result.set(id, ids.has(id));
  } catch (error) {
    console.error("Failed to read bot guild list", error);
  }
  return result;
}


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
  const empty = {
    channels: [] as Array<{ id: string; name: string; kind: string }>,
    voiceChannels: [] as Array<{ id: string; name: string }>,
    roles: [] as Array<{ id: string; name: string }>,
  };
  const token = process.env["DISCORD_TOKEN"];
  if (!token) return { ...empty, botStatus: "unknown" as const, botInGuild: false };
  const headers = { authorization: `Bot ${token}` };

  // Membership is decided by the guild lookup: Discord answers 404 (Unknown
  // Guild) when the bot is not a member, and 401 when the token is bad.
  const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, { headers });
  if (!guildRes.ok) {
    const status = guildRes.status === 404 || guildRes.status === 403 ? "absent" : "unknown";
    return { ...empty, botStatus: status as "absent" | "unknown", botInGuild: false };
  }

  const [channelsRes, rolesRes] = await Promise.all([
    fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers }),
    fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers }),
  ]);
  if (!channelsRes.ok || !rolesRes.ok) {
    return { ...empty, botStatus: "present" as const, botInGuild: true };
  }

  const channels = (await channelsRes.json()) as Array<{ id: string; name: string; type: number }>;
  const roles = (await rolesRes.json()) as Array<{
    id: string;
    name: string;
    managed: boolean;
    position: number;
  }>;
  return {
    botStatus: "present" as const,
    botInGuild: true,
    channels: channels
      .filter((c) => c.type === 0 || c.type === 4)
      .map((c) => ({ id: c.id, name: c.name, kind: c.type === 4 ? "category" : "text" })),
    voiceChannels: channels
      .filter((c) => c.type === 2)
      .map((c) => ({ id: c.id, name: c.name })),
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
  starboard: "starboard_settings",
} as const;

/* ---------------------------------------------------------------- */
/* Reads                                                             */
/* ---------------------------------------------------------------- */

export const getGuildConfig = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => guildInput.parse(data))
  .handler(async ({ data }) => {
    const { guild, supabaseAdmin } = await authorize(data.guildId);
    const [server, settings, welcome, logging, automod, roles, starboard, commands, structure] =
      await Promise.all([
        supabaseAdmin.from("servers").select("*").eq("guild_id", data.guildId).maybeSingle(),
        supabaseAdmin.from("server_settings").select("*").eq("guild_id", data.guildId).maybeSingle(),
        supabaseAdmin.from("welcome_settings").select("*").eq("guild_id", data.guildId).maybeSingle(),
        supabaseAdmin.from("logging_settings").select("*").eq("guild_id", data.guildId).maybeSingle(),
        supabaseAdmin.from("automod_settings").select("*").eq("guild_id", data.guildId).maybeSingle(),
        supabaseAdmin.from("role_settings").select("*").eq("guild_id", data.guildId).maybeSingle(),
        supabaseAdmin
          .from("starboard_settings")
          .select("*")
          .eq("guild_id", data.guildId)
          .maybeSingle(),
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
      starboard: starboard.data,
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
      botPresent: structure.botStatus === "present",
      botStatus: structure.botStatus,

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
  starboard: z.object({
    enabled: z.boolean(),
    channel_id: snowflake,
    emoji: z.string().min(1).max(64),
    threshold: z.number().int().min(1).max(100),
    allow_self_star: z.boolean(),
    ignored_channel_ids: z.array(z.string().regex(/^\d{5,25}$/)).max(25),
  }).partial(),
} as const;

const updateInput = z.object({
  guildId: z.string().regex(/^\d{5,25}$/),
  section: z.enum(["general", "welcome", "logging", "automod", "roles", "starboard"]),
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

/* ---------------------------------------------------------------- */
/* Reaction roles & giveaways                                        */
/* ---------------------------------------------------------------- */

export const getCommunityFeatures = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => guildInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const [reactionRoles, giveaways] = await Promise.all([
      supabaseAdmin
        .from("reaction_roles")
        .select("id, channel_id, message_id, emoji, role_id, description, created_at")
        .eq("guild_id", data.guildId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("giveaways")
        .select("id, channel_id, message_id, prize, winner_count, ends_at, status, winner_ids, host_name")
        .eq("guild_id", data.guildId)
        .order("ends_at", { ascending: false })
        .limit(50),
    ]);
    return {
      reactionRoles: reactionRoles.data ?? [],
      giveaways: giveaways.data ?? [],
    };
  });

const rowInput = z.object({
  guildId: z.string().regex(/^\d{5,25}$/),
  id: z.string().uuid(),
});

export const deleteReactionRole = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => rowInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { error } = await supabaseAdmin
      .from("reaction_roles")
      .delete()
      .eq("id", data.id)
      .eq("guild_id", data.guildId);
    if (error) throw new Error("Could not remove that reaction role.");
    return { ok: true };
  });

export const cancelGiveaway = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => rowInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { error } = await supabaseAdmin
      .from("giveaways")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("guild_id", data.guildId)
      .eq("status", "running");
    if (error) throw new Error("Could not cancel that giveaway.");
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* Polls                                                             */
/* ---------------------------------------------------------------- */

export const getPolls = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => guildInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { data: polls } = await supabaseAdmin
      .from("polls")
      .select("id, channel_id, message_id, question, options, votes, ends_at, status, created_by_name, created_at")
      .eq("guild_id", data.guildId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { polls: polls ?? [] };
  });

export const closePoll = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => rowInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { error } = await supabaseAdmin
      .from("polls")
      .update({ status: "closed" })
      .eq("id", data.id)
      .eq("guild_id", data.guildId)
      .eq("status", "open");
    if (error) throw new Error("Could not close that poll.");
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* Scheduled announcements & stat channels                           */
/* ---------------------------------------------------------------- */

/** Mirrors bot/services/schedule_service.compute_next_run (UTC). */
function computeNextRun(
  recurrence: "once" | "hourly" | "daily" | "weekly",
  timeOfDay: string,
  weekday: number | null,
  runAt?: string | null,
): string {
  const now = new Date();
  const [hourRaw, minuteRaw] = timeOfDay.split(":");
  const hour = Math.min(23, Math.max(0, Number(hourRaw) || 0));
  const minute = Math.min(59, Math.max(0, Number(minuteRaw) || 0));

  if (recurrence === "once") {
    const at = runAt ? new Date(runAt) : new Date(now.getTime() + 60_000);
    return (Number.isNaN(at.getTime()) ? new Date(now.getTime() + 60_000) : at).toISOString();
  }

  const candidate = new Date(now);
  candidate.setUTCSeconds(0, 0);
  if (recurrence === "hourly") {
    candidate.setUTCMinutes(minute);
    if (candidate <= now) candidate.setUTCHours(candidate.getUTCHours() + 1);
    return candidate.toISOString();
  }

  candidate.setUTCHours(hour, minute, 0, 0);
  if (recurrence === "weekly") {
    const target = Math.min(6, Math.max(0, weekday ?? 0));
    // JS: 0 = Sunday, Python: 0 = Monday — align to Python's weekday numbering.
    const currentPy = (candidate.getUTCDay() + 6) % 7;
    candidate.setUTCDate(candidate.getUTCDate() + ((target - currentPy + 7) % 7));
    if (candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + 7);
    return candidate.toISOString();
  }

  if (candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + 1);
  return candidate.toISOString();
}

export const getAutomation = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => guildInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const [announcements, statChannels] = await Promise.all([
      supabaseAdmin
        .from("scheduled_announcements")
        .select("*")
        .eq("guild_id", data.guildId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("stat_channels")
        .select("*")
        .eq("guild_id", data.guildId)
        .order("created_at", { ascending: true })
        .limit(25),
    ]);
    return {
      announcements: announcements.data ?? [],
      statChannels: statChannels.data ?? [],
    };
  });

const announcementInput = z.object({
  guildId: z.string().regex(/^\d{5,25}$/),
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  channel_id: z.string().regex(/^\d{5,25}$/),
  message: z.string().min(1).max(2000),
  use_embed: z.boolean(),
  embed_title: z.string().max(200).nullable().optional(),
  recurrence: z.enum(["once", "hourly", "daily", "weekly"]),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  time_of_day: z.string().regex(/^\d{1,2}:\d{2}$/),
  enabled: z.boolean(),
  run_at: z.string().datetime().nullable().optional(),
});

export const saveAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => announcementInput.parse(data))
  .handler(async ({ data }) => {
    const { session, guild, supabaseAdmin } = await authorize(data.guildId);
    await ensureServerRow(supabaseAdmin, guild);
    const payload = {
      guild_id: data.guildId,
      name: data.name,
      channel_id: data.channel_id,
      message: data.message,
      use_embed: data.use_embed,
      embed_title: data.embed_title ?? null,
      recurrence: data.recurrence,
      weekday: data.recurrence === "weekly" ? (data.weekday ?? 0) : null,
      time_of_day: data.time_of_day,
      enabled: data.enabled,
      next_run_at: computeNextRun(
        data.recurrence,
        data.time_of_day,
        data.weekday ?? null,
        data.run_at ?? null,
      ),
      created_by: session.userId,
    };
    const { error } = data.id
      ? await supabaseAdmin
          .from("scheduled_announcements")
          .update(payload)
          .eq("id", data.id)
          .eq("guild_id", data.guildId)
      : await supabaseAdmin.from("scheduled_announcements").insert(payload);
    if (error) {
      console.error("Announcement save failed", error);
      throw new Error("Could not save that announcement.");
    }
    return { ok: true };
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => rowInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { error } = await supabaseAdmin
      .from("scheduled_announcements")
      .delete()
      .eq("id", data.id)
      .eq("guild_id", data.guildId);
    if (error) throw new Error("Could not delete that announcement.");
    return { ok: true };
  });

const statChannelInput = z.object({
  guildId: z.string().regex(/^\d{5,25}$/),
  id: z.string().uuid().optional(),
  channel_id: z.string().regex(/^\d{5,25}$/),
  kind: z.enum(["members", "humans", "bots", "online", "boosters"]),
  name_template: z.string().min(1).max(90),
  enabled: z.boolean(),
});

export const saveStatChannel = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => statChannelInput.parse(data))
  .handler(async ({ data }) => {
    const { session, guild, supabaseAdmin } = await authorize(data.guildId);
    await ensureServerRow(supabaseAdmin, guild);
    const payload = {
      guild_id: data.guildId,
      channel_id: data.channel_id,
      kind: data.kind,
      name_template: data.name_template,
      enabled: data.enabled,
      last_value: null,
      created_by: session.userId,
    };
    const { error } = data.id
      ? await supabaseAdmin
          .from("stat_channels")
          .update(payload)
          .eq("id", data.id)
          .eq("guild_id", data.guildId)
      : await supabaseAdmin.from("stat_channels").insert(payload);
    if (error) {
      console.error("Stat channel save failed", error);
      throw new Error(
        error.code === "23505"
          ? "That voice channel is already used for a stat counter."
          : "Could not save that stat channel.",
      );
    }
    return { ok: true };
  });

export const deleteStatChannel = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => rowInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { error } = await supabaseAdmin
      .from("stat_channels")
      .delete()
      .eq("id", data.id)
      .eq("guild_id", data.guildId);
    if (error) throw new Error("Could not remove that stat channel.");
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* Moderation cases                                                  */
/* ---------------------------------------------------------------- */

const CASE_ACTIONS = [
  "warn",
  "timeout",
  "untimeout",
  "kick",
  "ban",
  "unban",
  "mute",
  "unmute",
  "purge",
  "note",
] as const;

export const getCases = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
        action: z.string().max(30).optional(),
        userId: z.string().max(25).optional(),
        page: z.number().int().min(0).max(500).default(0),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const pageSize = 25;
    let query = supabaseAdmin
      .from("moderation_cases")
      .select("*", { count: "exact" })
      .eq("guild_id", data.guildId);
    if (data.action && data.action !== "all") query = query.eq("action", data.action);
    if (data.userId) query = query.eq("target_id", data.userId);

    const { data: rows, count } = await query
      .order("case_number", { ascending: false })
      .range(data.page * pageSize, data.page * pageSize + pageSize - 1);

    return { cases: rows ?? [], total: count ?? 0, page: data.page, pageSize };
  });

export const createCase = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
        action: z.enum(CASE_ACTIONS),
        target_id: z.string().regex(/^\d{5,25}$/),
        target_name: z.string().max(120).optional(),
        reason: z.string().min(1).max(1000),
        duration_seconds: z.number().int().min(0).max(2419200).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { session, guild, supabaseAdmin } = await authorize(data.guildId);
    await ensureServerRow(supabaseAdmin, guild);

    const { data: caseNumber, error: numberError } = await supabaseAdmin.rpc(
      "next_case_number",
      { _guild_id: data.guildId },
    );
    if (numberError) {
      console.error("Case number lookup failed", numberError);
      throw new Error("Could not open a new case.");
    }

    const { error } = await supabaseAdmin.from("moderation_cases").insert({
      guild_id: data.guildId,
      case_number: caseNumber as number,
      action: data.action,
      target_id: data.target_id,
      target_name: data.target_name ?? null,
      moderator_id: session.userId,
      moderator_name: session.username ?? "Dashboard",
      reason: data.reason,
      duration_seconds: data.duration_seconds ?? null,
      active: ["timeout", "ban", "mute"].includes(data.action),
      metadata: { source: "dashboard" },
    });
    if (error) {
      console.error("Case insert failed", error);
      throw new Error("Could not create that case.");
    }
    return { ok: true, caseNumber };
  });

export const updateCase = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
        id: z.string().uuid(),
        reason: z.string().min(1).max(1000).optional(),
        voided: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { session, supabaseAdmin } = await authorize(data.guildId);
    const payload: {
      reason?: string;
      voided?: boolean;
      voided_by?: string | null;
      voided_at?: string | null;
      active?: boolean;
    } = {};
    if (data.reason !== undefined) payload.reason = data.reason;
    if (data.voided !== undefined) {
      payload.voided = data.voided;
      payload.voided_by = data.voided ? session.userId : null;
      payload.voided_at = data.voided ? new Date().toISOString() : null;
      if (data.voided) payload.active = false;
    }

    const { error } = await supabaseAdmin
      .from("moderation_cases")
      .update(payload)
      .eq("id", data.id)
      .eq("guild_id", data.guildId);
    if (error) throw new Error("Could not update that case.");
    return { ok: true };
  });

export const deleteCase = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => rowInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { error } = await supabaseAdmin
      .from("moderation_cases")
      .delete()
      .eq("id", data.id)
      .eq("guild_id", data.guildId);
    if (error) throw new Error("Could not delete that case.");
    return { ok: true };
  });

/** Queue an action for the bot's dashboard-action loop (runs every 20s). */
export const requestBotAction = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
        action: z.enum(["unban", "untimeout", "kick"]),
        target_id: z.string().regex(/^\d{5,25}$/),
        reason: z.string().max(500).optional(),
        caseId: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { session, guild, supabaseAdmin } = await authorize(data.guildId);
    await ensureServerRow(supabaseAdmin, guild);
    const { error } = await supabaseAdmin.from("bot_action_queue").insert({
      guild_id: data.guildId,
      action: data.action,
      target_id: data.target_id,
      payload: {
        reason: data.reason ?? "Requested from the AHOY dashboard",
        moderator_name: session.username ?? session.userId,
        case_id: data.caseId ?? null,
      },
      requested_by: session.userId,
      requested_by_name: session.username ?? null,
    });
    if (error) {
      console.error("Bot action queue insert failed", error);
      throw new Error("Could not queue that action.");
    }
    if (data.caseId) {
      await supabaseAdmin
        .from("moderation_cases")
        .update({ active: false })
        .eq("id", data.caseId)
        .eq("guild_id", data.guildId);
    }
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* Activity log                                                      */
/* ---------------------------------------------------------------- */

export const getActivityLog = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
        category: z.string().max(40).optional(),
        userId: z.string().max(25).optional(),
        page: z.number().int().min(0).max(500).default(0),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const pageSize = 50;
    let query = supabaseAdmin
      .from("activity_logs")
      .select("*", { count: "exact" })
      .eq("guild_id", data.guildId);
    if (data.category && data.category !== "all") query = query.eq("category", data.category);
    if (data.userId) query = query.eq("actor_id", data.userId);

    const { data: rows, count } = await query
      .order("created_at", { ascending: false })
      .range(data.page * pageSize, data.page * pageSize + pageSize - 1);

    return { entries: rows ?? [], total: count ?? 0, page: data.page, pageSize };
  });

/* ---------------------------------------------------------------- */
/* Server stats, ranks and member profiles                           */
/* ---------------------------------------------------------------- */

type DiscordGuildPreview = {
  approximate_member_count?: number;
  approximate_presence_count?: number;
  premium_subscription_count?: number;
  premium_tier?: number;
  created_at?: string;
};

export const getServerStats = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => guildInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const token = process.env["DISCORD_TOKEN"];
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const week = new Date(Date.now() - 7 * 86400_000).toISOString();

    let live: DiscordGuildPreview = {};
    let channelCounts = { text: 0, voice: 0, category: 0, stage: 0 };
    let roleCount = 0;
    if (token) {
      const headers = { authorization: `Bot ${token}` };
      const [guildRes, channelsRes, rolesRes] = await Promise.all([
        fetch(
          `https://discord.com/api/v10/guilds/${data.guildId}?with_counts=true`,
          { headers },
        ),
        fetch(`https://discord.com/api/v10/guilds/${data.guildId}/channels`, { headers }),
        fetch(`https://discord.com/api/v10/guilds/${data.guildId}/roles`, { headers }),
      ]);
      if (guildRes.ok) live = (await guildRes.json()) as DiscordGuildPreview;
      if (channelsRes.ok) {
        const channels = (await channelsRes.json()) as Array<{ type: number }>;
        channelCounts = {
          text: channels.filter((c) => c.type === 0 || c.type === 5).length,
          voice: channels.filter((c) => c.type === 2).length,
          category: channels.filter((c) => c.type === 4).length,
          stage: channels.filter((c) => c.type === 13).length,
        };
      }
      if (rolesRes.ok) roleCount = ((await rolesRes.json()) as unknown[]).length - 1;
    }

    const [joins, leaves, messages, cases, voiceRows, activity] = await Promise.all([
      supabaseAdmin
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("guild_id", data.guildId)
        .eq("category", "member_join")
        .gte("created_at", since),
      supabaseAdmin
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("guild_id", data.guildId)
        .eq("category", "member_leave")
        .gte("created_at", since),
      supabaseAdmin
        .from("xp_profiles")
        .select("messages")
        .eq("guild_id", data.guildId)
        .limit(1000),
      supabaseAdmin
        .from("moderation_cases")
        .select("id", { count: "exact", head: true })
        .eq("guild_id", data.guildId)
        .gte("created_at", week),
      supabaseAdmin
        .from("voice_stats")
        .select("voice_seconds, sessions")
        .eq("guild_id", data.guildId)
        .limit(1000),
      supabaseAdmin
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("guild_id", data.guildId)
        .gte("created_at", week),
    ]);

    return {
      members: live.approximate_member_count ?? null,
      online: live.approximate_presence_count ?? null,
      boosts: live.premium_subscription_count ?? 0,
      boostTier: live.premium_tier ?? 0,
      channels: channelCounts,
      roles: Math.max(0, roleCount),
      joins30d: joins.count ?? 0,
      leaves30d: leaves.count ?? 0,
      trackedMessages: (messages.data ?? []).reduce(
        (sum, row) => sum + Number(row.messages ?? 0),
        0,
      ),
      casesThisWeek: cases.count ?? 0,
      activityThisWeek: activity.count ?? 0,
      voiceSeconds: (voiceRows.data ?? []).reduce(
        (sum, row) => sum + Number(row.voice_seconds ?? 0),
        0,
      ),
      voiceSessions: (voiceRows.data ?? []).reduce(
        (sum, row) => sum + Number(row.sessions ?? 0),
        0,
      ),
      hasToken: Boolean(token),
    };
  });

export const getRanks = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
        page: z.number().int().min(0).max(200).default(0),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const pageSize = 25;
    const [{ data: rows, count }, voice] = await Promise.all([
      supabaseAdmin
        .from("xp_profiles")
        .select("user_id, username, xp, level, messages", { count: "exact" })
        .eq("guild_id", data.guildId)
        .order("xp", { ascending: false })
        .range(data.page * pageSize, data.page * pageSize + pageSize - 1),
      supabaseAdmin
        .from("voice_stats")
        .select("user_id, voice_seconds")
        .eq("guild_id", data.guildId)
        .limit(1000),
    ]);
    const voiceByUser = new Map(
      (voice.data ?? []).map((row) => [row.user_id, Number(row.voice_seconds ?? 0)]),
    );
    return {
      ranks: (rows ?? []).map((row, index) => ({
        ...row,
        rank: data.page * pageSize + index + 1,
        voice_seconds: voiceByUser.get(row.user_id) ?? 0,
      })),
      total: count ?? 0,
      page: data.page,
      pageSize,
    };
  });

/** Everything the /profile card shows, for the dashboard's member view. */
export const getMemberProfile = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
        userId: z.string().regex(/^\d{5,25}$/),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const [xp, voice, member, wallet, cases] = await Promise.all([
      supabaseAdmin
        .from("xp_profiles")
        .select("*")
        .eq("guild_id", data.guildId)
        .eq("user_id", data.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("voice_stats")
        .select("*")
        .eq("guild_id", data.guildId)
        .eq("user_id", data.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("members")
        .select("*")
        .eq("guild_id", data.guildId)
        .eq("user_id", data.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("economy_profiles")
        .select("balance, bank")
        .eq("guild_id", data.guildId)
        .eq("user_id", data.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("moderation_cases")
        .select("*")
        .eq("guild_id", data.guildId)
        .eq("target_id", data.userId)
        .order("case_number", { ascending: false })
        .limit(10),
    ]);

    const totalXp = Number(xp.data?.xp ?? 0);
    const level = Number(xp.data?.level ?? 0);
    // Mirrors bot/services/level_service: level n needs 5n^2 + 50n + 100 XP.
    const xpForLevel = (n: number) => (n <= 0 ? 0 : 5 * n * n + 50 * n + 100);
    const floor = xpForLevel(level);
    const ceiling = xpForLevel(level + 1);

    const { count: ahead } = await supabaseAdmin
      .from("xp_profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("guild_id", data.guildId)
      .gt("xp", totalXp);

    return {
      userId: data.userId,
      member: member.data,
      level,
      totalXp,
      xpCurrent: Math.max(0, totalXp - floor),
      xpNeeded: Math.max(1, ceiling - floor),
      rank: (ahead ?? 0) + 1,
      messages: Number(xp.data?.messages ?? 0),
      voiceSeconds: Number(voice.data?.voice_seconds ?? 0),
      voiceSessions: Number(voice.data?.sessions ?? 0),
      balance: Number(wallet.data?.balance ?? 0),
      bank: Number(wallet.data?.bank ?? 0),
      cases: cases.data ?? [],
    };
  });

/* ---------------------------------------------------------------- */
/* Command library configuration                                     */
/* ---------------------------------------------------------------- */

export const COMMAND_PERMISSION_LEVELS = [
  "none",
  "manage_messages",
  "kick_members",
  "ban_members",
  "manage_roles",
  "manage_channels",
  "manage_guild",
  "administrator",
] as const;

export const RESPONSE_VISIBILITY = ["inherit", "private", "public"] as const;

const snowflakes = (max: number) => z.array(z.string().regex(/^\d{5,25}$/)).max(max);

const commandConfigInput = z.object({
  guildId: z.string().regex(/^\d{5,25}$/),
  command: z.string().min(1).max(120),
  enabled: z.boolean().optional(),
  allowedRoleIds: snowflakes(25).optional(),
  deniedRoleIds: snowflakes(25).optional(),
  allowedChannelIds: snowflakes(25).optional(),
  blockedChannelIds: snowflakes(25).optional(),
  allowedCategoryIds: snowflakes(25).optional(),
  protectedRoleIds: snowflakes(25).optional(),
  protectedUserIds: snowflakes(25).optional(),
  outputChannelId: z.string().regex(/^\d{5,25}$/).nullable().optional(),
  requiredPermission: z.enum(COMMAND_PERMISSION_LEVELS).optional(),
  cooldownSeconds: z.number().int().min(0).max(86400).optional(),
  rateLimitPerMinute: z.number().int().min(0).max(600).optional(),
  requireReason: z.boolean().optional(),
  requireConfirmation: z.boolean().optional(),
  responseVisibility: z.enum(RESPONSE_VISIBILITY).optional(),
  ephemeral: z.boolean().optional(),
  customResponse: z.string().max(1500).nullable().optional(),
  errorResponse: z.string().max(1500).nullable().optional(),
  logEvent: z.boolean().optional(),
  logChannelId: z.string().regex(/^\d{5,25}$/).nullable().optional(),
  notifyRoleId: z.string().regex(/^\d{5,25}$/).nullable().optional(),
  notifyChannelId: z.string().regex(/^\d{5,25}$/).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  options: z.record(z.string(), z.string().max(500)).optional(),
});

export type CommandConfig = {
  command: string;
  enabled: boolean;
  allowedRoleIds: string[];
  deniedRoleIds: string[];
  allowedChannelIds: string[];
  blockedChannelIds: string[];
  allowedCategoryIds: string[];
  protectedRoleIds: string[];
  protectedUserIds: string[];
  outputChannelId: string | null;
  requiredPermission: (typeof COMMAND_PERMISSION_LEVELS)[number];
  cooldownSeconds: number;
  rateLimitPerMinute: number;
  requireReason: boolean;
  requireConfirmation: boolean;
  responseVisibility: (typeof RESPONSE_VISIBILITY)[number];
  ephemeral: boolean;
  customResponse: string | null;
  errorResponse: string | null;
  logEvent: boolean;
  logChannelId: string | null;
  notifyRoleId: string | null;
  notifyChannelId: string | null;
  notes: string | null;
  options: Record<string, string>;
};

/** Column mapping shared by the single-command and bulk writers. */
const COMMAND_COLUMNS: Array<[keyof CommandConfig, string]> = [
  ["enabled", "enabled"],
  ["allowedRoleIds", "allowed_role_ids"],
  ["deniedRoleIds", "denied_role_ids"],
  ["allowedChannelIds", "allowed_channel_ids"],
  ["blockedChannelIds", "blocked_channel_ids"],
  ["allowedCategoryIds", "allowed_category_ids"],
  ["protectedRoleIds", "protected_role_ids"],
  ["protectedUserIds", "protected_user_ids"],
  ["outputChannelId", "output_channel_id"],
  ["requiredPermission", "required_permission"],
  ["cooldownSeconds", "cooldown_seconds"],
  ["rateLimitPerMinute", "rate_limit_per_minute"],
  ["requireReason", "require_reason"],
  ["requireConfirmation", "require_confirmation"],
  ["responseVisibility", "response_visibility"],
  ["ephemeral", "ephemeral"],
  ["customResponse", "custom_response"],
  ["errorResponse", "error_response"],
  ["logEvent", "log_event"],
  ["logChannelId", "log_channel_id"],
  ["notifyRoleId", "notify_role_id"],
  ["notifyChannelId", "notify_channel_id"],
  ["notes", "notes"],
  ["options", "options"],
];

function commandRow(
  guildId: string,
  command: string,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    guild_id: guildId,
    command,
    updated_at: new Date().toISOString(),
  };
  for (const [key, column] of COMMAND_COLUMNS) {
    const value = patch[key as string];
    if (value !== undefined) row[column] = value;
  }
  return row;
}


export const getCommandSettings = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => guildInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const [settings, usage] = await Promise.all([
      supabaseAdmin.from("guild_command_settings").select("*").eq("guild_id", data.guildId),
      supabaseAdmin.from("command_usage").select("command").eq("guild_id", data.guildId).limit(2000),
    ]);
    const counts: Record<string, number> = {};
    for (const row of usage.data ?? []) counts[row.command] = (counts[row.command] ?? 0) + 1;

    const configs: Record<string, CommandConfig> = {};
    for (const row of settings.data ?? []) {
      const r = row as Record<string, unknown>;
      configs[row.command] = {
        command: row.command,
        enabled: Boolean(row.enabled),
        allowedRoleIds: (r["allowed_role_ids"] as string[] | null) ?? [],
        deniedRoleIds: (r["denied_role_ids"] as string[] | null) ?? [],
        allowedChannelIds: (r["allowed_channel_ids"] as string[] | null) ?? [],
        blockedChannelIds: (r["blocked_channel_ids"] as string[] | null) ?? [],
        allowedCategoryIds: (r["allowed_category_ids"] as string[] | null) ?? [],
        protectedRoleIds: (r["protected_role_ids"] as string[] | null) ?? [],
        protectedUserIds: (r["protected_user_ids"] as string[] | null) ?? [],
        outputChannelId: (r["output_channel_id"] as string | null) ?? null,
        requiredPermission:
          ((r["required_permission"] as CommandConfig["requiredPermission"]) ?? "none"),
        cooldownSeconds: Number(r["cooldown_seconds"] ?? 0),
        rateLimitPerMinute: Number(r["rate_limit_per_minute"] ?? 0),
        requireReason: Boolean(r["require_reason"]),
        requireConfirmation: Boolean(r["require_confirmation"]),
        responseVisibility:
          ((r["response_visibility"] as CommandConfig["responseVisibility"]) ?? "inherit"),
        ephemeral: r["ephemeral"] === undefined ? true : Boolean(r["ephemeral"]),
        customResponse: (r["custom_response"] as string | null) ?? null,
        errorResponse: (r["error_response"] as string | null) ?? null,
        logEvent: r["log_event"] === undefined ? true : Boolean(r["log_event"]),
        logChannelId: (r["log_channel_id"] as string | null) ?? null,
        notifyRoleId: (r["notify_role_id"] as string | null) ?? null,
        notifyChannelId: (r["notify_channel_id"] as string | null) ?? null,
        notes: (r["notes"] as string | null) ?? null,
        options: ((r["options"] as Record<string, string> | null) ?? {}) as Record<string, string>,
      };
    }

    return {
      disabled: (settings.data ?? []).filter((r) => !r.enabled).map((r) => r.command),
      configs,
      usage: counts,
    };
  });

export const setCommandEnabled = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
        command: z.string().min(1).max(120),
        enabled: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { guild, supabaseAdmin } = await authorize(data.guildId);
    await ensureServerRow(supabaseAdmin, guild);
    const { error } = await supabaseAdmin
      .from("guild_command_settings")
      .upsert(
        {
          guild_id: data.guildId,
          command: data.command,
          enabled: data.enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "guild_id,command" },
      );
    if (error) {
      console.error("Command toggle failed", error);
      throw new Error("Could not update that command.");
    }
    return { ok: true };
  });

export const saveCommandConfig = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => commandConfigInput.parse(data))
  .handler(async ({ data }) => {
    const { guild, supabaseAdmin } = await authorize(data.guildId);
    await ensureServerRow(supabaseAdmin, guild);

    const row: Record<string, unknown> = {
      guild_id: data.guildId,
      command: data.command,
      updated_at: new Date().toISOString(),
    };
    if (data.enabled !== undefined) row["enabled"] = data.enabled;
    if (data.allowedRoleIds) row["allowed_role_ids"] = data.allowedRoleIds;
    if (data.deniedRoleIds) row["denied_role_ids"] = data.deniedRoleIds;
    if (data.allowedChannelIds) row["allowed_channel_ids"] = data.allowedChannelIds;
    if (data.outputChannelId !== undefined) row["output_channel_id"] = data.outputChannelId;
    if (data.requiredPermission) row["required_permission"] = data.requiredPermission;
    if (data.cooldownSeconds !== undefined) row["cooldown_seconds"] = data.cooldownSeconds;
    if (data.ephemeral !== undefined) row["ephemeral"] = data.ephemeral;
    if (data.customResponse !== undefined) row["custom_response"] = data.customResponse;
    if (data.notes !== undefined) row["notes"] = data.notes;
    if (data.options) row["options"] = data.options;

    const { error } = await supabaseAdmin
      .from("guild_command_settings")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(row as any, { onConflict: "guild_id,command" });
    if (error) {
      console.error("Command config save failed", error);
      throw new Error("Could not save that command's settings.");
    }
    return { ok: true };
  });

/** Apply one set of settings to many commands at once (category mass edit). */
export const saveCommandConfigBulk = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
        commands: z.array(z.string().min(1).max(120)).min(1).max(400),
        patch: commandConfigInput.omit({ guildId: true, command: true }),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { guild, supabaseAdmin } = await authorize(data.guildId);
    await ensureServerRow(supabaseAdmin, guild);
    const now = new Date().toISOString();
    const p = data.patch;

    const rows = data.commands.map((command) => {
      const row: Record<string, unknown> = {
        guild_id: data.guildId,
        command,
        updated_at: now,
      };
      if (p.enabled !== undefined) row["enabled"] = p.enabled;
      if (p.allowedRoleIds) row["allowed_role_ids"] = p.allowedRoleIds;
      if (p.deniedRoleIds) row["denied_role_ids"] = p.deniedRoleIds;
      if (p.allowedChannelIds) row["allowed_channel_ids"] = p.allowedChannelIds;
      if (p.outputChannelId !== undefined) row["output_channel_id"] = p.outputChannelId;
      if (p.requiredPermission) row["required_permission"] = p.requiredPermission;
      if (p.cooldownSeconds !== undefined) row["cooldown_seconds"] = p.cooldownSeconds;
      if (p.ephemeral !== undefined) row["ephemeral"] = p.ephemeral;
      if (p.customResponse !== undefined) row["custom_response"] = p.customResponse;
      if (p.notes !== undefined) row["notes"] = p.notes;
      if (p.options) row["options"] = p.options;
      return row;
    });

    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabaseAdmin
        .from("guild_command_settings")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(rows.slice(i, i + 100) as any, { onConflict: "guild_id,command" });
      if (error) {
        console.error("Bulk command save failed", error);
        throw new Error("Could not apply those settings to every command.");
      }
    }
    return { ok: true, updated: rows.length };
  });


