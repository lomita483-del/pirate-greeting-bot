import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{5,25}$/);

export const FEATURE_KEYS = [
  "moderation",
  "automod",
  "welcome",
  "logging",
  "levels",
  "economy",
  "tickets",
  "reminders",
  "custom_commands",
] as const;

const cookie = () => getRequestHeader("cookie") ?? null;

/* ---------------------------------------------------------------- */
/* Access                                                            */
/* ---------------------------------------------------------------- */

export const getAdminContext = createServerFn({ method: "GET" }).handler(async () => {
  const { sessionFromHeader } = await import("@/lib/discord.server");
  const session = await sessionFromHeader(cookie());
  if (!session) return { signedIn: false as const, role: null };
  const { adminRoleFor } = await import("@/lib/admin.server");
  const role = await adminRoleFor(session.userId);
  return {
    signedIn: true as const,
    role,
    user: { id: session.userId, username: session.username },
  };
});

/* ---------------------------------------------------------------- */
/* Overview                                                          */
/* ---------------------------------------------------------------- */

export const getAdminOverview = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/lib/admin.server");
  const { supabaseAdmin } = await requireAdmin(cookie());
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

  const [users, banned, active24h, servers, serverRows, mods, tickets, xp, recent, notifs] =
    await Promise.all([
      supabaseAdmin.from("platform_users").select("discord_user_id", { count: "exact", head: true }),
      supabaseAdmin
        .from("platform_users")
        .select("discord_user_id", { count: "exact", head: true })
        .eq("banned", true),
      supabaseAdmin
        .from("platform_users")
        .select("discord_user_id", { count: "exact", head: true })
        .gte("last_seen_at", dayAgo),
      supabaseAdmin.from("servers").select("guild_id", { count: "exact", head: true }),
      supabaseAdmin.from("servers").select("member_count, bot_present"),
      supabaseAdmin
        .from("moderation_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo),
      supabaseAdmin
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .neq("status", "closed"),
      supabaseAdmin.from("xp_profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("dashboard_access_log")
        .select("discord_user_id, discord_username, action, guild_id, created_at")
        .order("created_at", { ascending: false })
        .limit(25),
      supabaseAdmin
        .from("platform_notifications")
        .select("id", { count: "exact", head: true })
        .eq("delivery_status", "pending"),
    ]);

  const rows = serverRows.data ?? [];
  return {
    totalUsers: users.count ?? 0,
    bannedUsers: banned.count ?? 0,
    activeToday: active24h.count ?? 0,
    totalServers: servers.count ?? 0,
    liveServers: rows.filter((r) => r.bot_present).length,
    reachedMembers: rows.reduce((sum, r) => sum + (r.member_count ?? 0), 0),
    moderationLast7Days: mods.count ?? 0,
    openTickets: tickets.count ?? 0,
    trackedProfiles: xp.count ?? 0,
    pendingNotifications: notifs.count ?? 0,
    recentActivity: recent.data ?? [],
  };
});

/* ---------------------------------------------------------------- */
/* Users                                                             */
/* ---------------------------------------------------------------- */

export const listPlatformUsers = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ search: z.string().max(80).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { supabaseAdmin } = await requireAdmin(cookie());

    let query = supabaseAdmin
      .from("platform_users")
      .select(
        "discord_user_id, username, global_name, avatar, first_seen_at, last_seen_at, login_count, banned, ban_reason, bot_blocked, plan, feature_flags, max_servers, notes",
      )
      .order("last_seen_at", { ascending: false })
      .limit(200);

    const term = data.search?.trim();
    if (term) {
      const safe = term.replace(/[%,()]/g, "");
      query = query.or(
        `username.ilike.%${safe}%,global_name.ilike.%${safe}%,discord_user_id.ilike.%${safe}%`,
      );
    }
    const { data: rows, error } = await query;
    if (error) throw new Error("Could not load users.");
    return rows ?? [];
  });

const userUpdate = z.object({
  userId: snowflake,
  banned: z.boolean().optional(),
  ban_reason: z.string().max(300).nullable().optional(),
  bot_blocked: z.boolean().optional(),
  plan: z.enum(["free", "plus", "pro", "staff"]).optional(),
  max_servers: z.number().int().min(0).max(1000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  feature_flags: z.record(z.enum(FEATURE_KEYS), z.boolean()).optional(),
});

export const updatePlatformUser = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => userUpdate.parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin, bootstrapOwnerIds } = await import("@/lib/admin.server");
    const { session, supabaseAdmin } = await requireAdmin(cookie());
    if (bootstrapOwnerIds().includes(data.userId) && (data.banned || data.bot_blocked)) {
      throw new Error("You cannot ban a platform owner.");
    }

    const patch = {
      ...(data.banned === undefined
        ? {}
        : {
            banned: data.banned,
            banned_at: data.banned ? new Date().toISOString() : null,
            banned_by: data.banned ? session.userId : null,
            ban_reason: data.banned ? (data.ban_reason ?? null) : null,
          }),
      ...(data.bot_blocked === undefined ? {} : { bot_blocked: data.bot_blocked }),
      ...(data.plan === undefined ? {} : { plan: data.plan }),
      ...(data.max_servers === undefined ? {} : { max_servers: data.max_servers }),
      ...(data.notes === undefined ? {} : { notes: data.notes }),
      ...(data.feature_flags === undefined ? {} : { feature_flags: data.feature_flags }),
    };



    const { error } = await supabaseAdmin
      .from("platform_users")
      .update(patch)
      .eq("discord_user_id", userId);
    if (error) throw new Error("Could not update that user.");

    await supabaseAdmin.from("dashboard_access_log").insert({
      discord_user_id: session.userId,
      discord_username: session.username,
      action: `admin:update_user:${userId}`,
    });
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* Servers                                                           */
/* ---------------------------------------------------------------- */

export const listPlatformServers = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/lib/admin.server");
  const { supabaseAdmin } = await requireAdmin(cookie());
  const { data: servers } = await supabaseAdmin
    .from("servers")
    .select("guild_id, name, icon, owner_id, member_count, bot_present, joined_at")
    .order("member_count", { ascending: false })
    .limit(200);

  const ids = (servers ?? []).map((s) => s.guild_id);
  const [mods, tickets] = await Promise.all([
    supabaseAdmin.from("moderation_logs").select("guild_id").in("guild_id", ids.length ? ids : ["0"]),
    supabaseAdmin
      .from("tickets")
      .select("guild_id")
      .neq("status", "closed")
      .in("guild_id", ids.length ? ids : ["0"]),
  ]);

  const tally = (rows: Array<{ guild_id: string }> | null) => {
    const map = new Map<string, number>();
    for (const row of rows ?? []) map.set(row.guild_id, (map.get(row.guild_id) ?? 0) + 1);
    return map;
  };
  const modMap = tally(mods.data);
  const ticketMap = tally(tickets.data);

  return (servers ?? []).map((s) => ({
    ...s,
    moderationActions: modMap.get(s.guild_id) ?? 0,
    openTickets: ticketMap.get(s.guild_id) ?? 0,
  }));
});

/* ---------------------------------------------------------------- */
/* Notifications                                                     */
/* ---------------------------------------------------------------- */

const notificationInput = z
  .object({
    title: z.string().min(2).max(120),
    body: z.string().min(2).max(2000),
    level: z.enum(["info", "success", "warning", "critical"]),
    target_type: z.enum(["all", "user", "guild"]),
    target_user_id: snowflake.nullable().optional(),
    target_guild_id: snowflake.nullable().optional(),
    via_inbox: z.boolean(),
    via_dm: z.boolean(),
    via_announcement: z.boolean(),
    announcement_channel_id: snowflake.nullable().optional(),
  })
  .refine((v) => v.via_inbox || v.via_dm || v.via_announcement, {
    message: "Pick at least one delivery channel.",
  })
  .refine((v) => v.target_type !== "user" || Boolean(v.target_user_id), {
    message: "Enter the Discord user id to notify.",
  })
  .refine((v) => v.target_type !== "guild" || Boolean(v.target_guild_id), {
    message: "Pick the server to notify.",
  });

export const sendNotification = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => notificationInput.parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { session, supabaseAdmin } = await requireAdmin(cookie());
    const needsBot = data.via_dm || data.via_announcement;

    const { error } = await supabaseAdmin.from("platform_notifications").insert({
      ...data,
      target_user_id: data.target_user_id ?? null,
      target_guild_id: data.target_guild_id ?? null,
      announcement_channel_id: data.announcement_channel_id ?? null,
      created_by: session.userId,
      delivery_status: needsBot ? "pending" : "sent",
      delivered_at: needsBot ? null : new Date().toISOString(),
    });
    if (error) {
      console.error("Notification insert failed", error);
      throw new Error("Could not queue that notification.");
    }
    return { ok: true, queued: needsBot };
  });

export const listNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/lib/admin.server");
  const { supabaseAdmin } = await requireAdmin(cookie());
  const { data } = await supabaseAdmin
    .from("platform_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
});

export const deleteNotification = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { supabaseAdmin } = await requireAdmin(cookie());
    await supabaseAdmin.from("platform_notifications").delete().eq("id", data.id);
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* Staff                                                             */
/* ---------------------------------------------------------------- */

export const listAdmins = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, bootstrapOwnerIds } = await import("@/lib/admin.server");
  const { supabaseAdmin } = await requireAdmin(cookie());
  const { data } = await supabaseAdmin
    .from("platform_admins")
    .select("*")
    .order("created_at", { ascending: true });
  return { owners: bootstrapOwnerIds(), staff: data ?? [] };
});

export const setAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: snowflake,
        role: z.enum(["admin", "owner"]).nullable(),
        username: z.string().max(80).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, requireOwner, bootstrapOwnerIds } = await import("@/lib/admin.server");
    const { session, role, supabaseAdmin } = await requireAdmin(cookie());
    requireOwner(role);
    if (bootstrapOwnerIds().includes(data.userId)) {
      throw new Error("That account is a bootstrapped owner and cannot be changed here.");
    }
    if (data.role === null) {
      await supabaseAdmin.from("platform_admins").delete().eq("discord_user_id", data.userId);
    } else {
      await supabaseAdmin.from("platform_admins").upsert(
        {
          discord_user_id: data.userId,
          role: data.role,
          username: data.username ?? null,
          added_by: session.userId,
        },
        { onConflict: "discord_user_id" },
      );
    }
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* User-facing inbox                                                 */
/* ---------------------------------------------------------------- */

export const getMyNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const { sessionFromHeader } = await import("@/lib/discord.server");
  const session = await sessionFromHeader(cookie());
  if (!session) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("platform_notifications")
    .select("id, title, body, level, created_at, target_type, target_user_id")
    .eq("via_inbox", true)
    .in("target_type", ["all", "user"])
    .order("created_at", { ascending: false })
    .limit(30);

  const mine = (data ?? []).filter(
    (n) => n.target_type === "all" || n.target_user_id === session.userId,
  );
  if (!mine.length) return [];

  const { data: reads } = await supabaseAdmin
    .from("notification_reads")
    .select("notification_id")
    .eq("discord_user_id", session.userId)
    .in("notification_id", mine.map((n) => n.id));
  const readIds = new Set((reads ?? []).map((r) => r.notification_id));

  return mine.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    level: n.level,
    created_at: n.created_at,
    read: readIds.has(n.id),
  }));
});

export const markNotificationRead = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { sessionFromHeader } = await import("@/lib/discord.server");
    const session = await sessionFromHeader(cookie());
    if (!session) throw new Error("Please sign in with Discord.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("notification_reads")
      .upsert(
        { notification_id: data.id, discord_user_id: session.userId },
        { onConflict: "notification_id,discord_user_id" },
      );
    return { ok: true };
  });
