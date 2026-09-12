import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const daysInput = z.object({
  guildId: z.string().regex(/^\d{5,25}$/),
  days: z.number().int().min(1).max(90).default(14),
});

const userActivityInput = z.object({
  guildId: z.string().regex(/^\d{5,25}$/),
  search: z.string().trim().max(100).default(""),
  sort: z.enum(["last_seen", "messages", "commands", "voice"]).default("last_seen"),
  limit: z.number().int().min(1).max(100).default(50),
});

async function authorize(guildId: string) {
  const { sessionFromHeader, assertGuildAccess } = await import("@/lib/discord.server");
  const session = await sessionFromHeader(getRequestHeader("cookie") ?? null);
  if (!session) throw new Error("Please sign in with Discord.");
  const { isBanned } = await import("@/lib/admin.server");
  if ((await isBanned(session.userId)).banned) throw new Error("Your access to Statahoy has been revoked.");
  const guild = await assertGuildAccess(session, guildId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { guild, supabaseAdmin };
}

function since(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
}

export const getStatahoyGuilds = createServerFn({ method: "GET" }).handler(async () => {
  const { sessionFromHeader, fetchUserGuilds, canManage } = await import("@/lib/discord.server");
  const session = await sessionFromHeader(getRequestHeader("cookie") ?? null);
  if (!session) return { signedIn: false as const, guilds: [] };

  let guilds: Array<{ id: string; name: string; icon: string | null }> = [];
  try {
    guilds = (await fetchUserGuilds(session)).filter(canManage).map((g) => ({ id: g.id, name: g.name, icon: g.icon }));
  } catch (error) {
    console.error("Statahoy: failed to load Discord guilds", error);
    return { signedIn: true as const, guilds: [] };
  }

  const token = process.env["DISCORD_TOKEN"];
  const present = new Set<string>();
  if (token && guilds.length) {
    try {
      const res = await fetch("https://discord.com/api/v10/users/@me/guilds?limit=200", {
        headers: { authorization: `Bot ${token}` },
      });
      if (res.ok) for (const g of (await res.json()) as Array<{ id: string }>) present.add(g.id);
    } catch (error) {
      console.error("Statahoy: failed to read bot guild list", error);
    }
  }

  return {
    signedIn: true as const,
    guilds: guilds.filter((g) => present.has(g.id)).map((g) => ({
      ...g,
      iconUrl: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null,
    })),
  };
});

export const getStatahoyOverview = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => daysInput.parse(data))
  .handler(async ({ data }) => {
    const { guild, supabaseAdmin } = await authorize(data.guildId);
    const sinceDay = since(data.days);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;

    const [server, messages, voice, members, topUsers, topVoice, topChannels] = await Promise.all([
      supabaseAdmin.from("servers").select("*").eq("guild_id", data.guildId).maybeSingle(),
      db.from("message_activity").select("day, count").eq("guild_id", data.guildId).gte("day", sinceDay).limit(20000),
      db.from("voice_activity").select("day, seconds").eq("guild_id", data.guildId).gte("day", sinceDay).limit(20000),
      db.from("member_count_daily").select("day, member_count").eq("guild_id", data.guildId).gte("day", sinceDay).order("day", { ascending: true }).limit(400),
      db.from("message_activity").select("user_id, count").eq("guild_id", data.guildId).gte("day", sinceDay).limit(20000),
      db.from("voice_activity").select("user_id, seconds").eq("guild_id", data.guildId).gte("day", sinceDay).limit(20000),
      db.from("message_activity").select("channel_id, count").eq("guild_id", data.guildId).gte("day", sinceDay).limit(20000),
    ]);

    const byDay = (rows: Array<{ day: string }> | null, field: string) => {
      const totals = new Map<string, number>();
      for (const row of rows ?? []) {
        const r = row as Record<string, unknown>;
        const day = String(r.day);
        totals.set(day, (totals.get(day) ?? 0) + Number(r[field] ?? 0));
      }
      return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ day, value }));
    };

    const rankBy = (rows: Array<Record<string, unknown>> | null, idField: string, valueField: string) => {
      const totals = new Map<string, number>();
      for (const row of rows ?? []) {
        const id = String(row[idField]);
        totals.set(id, (totals.get(id) ?? 0) + Number(row[valueField] ?? 0));
      }
      return [...totals.entries()].sort(([, a], [, b]) => b - a).slice(0, 10).map(([id, value]) => ({ id, value }));
    };

    const messageSeries = byDay(messages.data as Array<{ day: string }> | null, "count");
    const voiceSeries = byDay(voice.data as Array<{ day: string }> | null, "seconds");
    const rankedUsers = rankBy(topUsers.data as Array<Record<string, unknown>> | null, "user_id", "count");
    const rankedVoice = rankBy(topVoice.data as Array<Record<string, unknown>> | null, "user_id", "seconds");
    const rankedChannels = rankBy(topChannels.data as Array<Record<string, unknown>> | null, "channel_id", "count");

    const userIds = [...new Set([...rankedUsers, ...rankedVoice].map((r) => r.id))];
    const names = new Map<string, string>();
    if (userIds.length) {
      const { data: memberRows } = await supabaseAdmin.from("members").select("user_id, display_name, username").eq("guild_id", data.guildId).in("user_id", userIds);
      for (const row of memberRows ?? []) names.set(row.user_id, row.display_name || row.username || row.user_id);
    }

    return {
      guild: { id: data.guildId, name: guild.name, icon: guild.icon },
      memberCount: server.data?.member_count ?? null,
      totalMessages: messageSeries.reduce((sum, r) => sum + r.value, 0),
      totalVoiceSeconds: voiceSeries.reduce((sum, r) => sum + r.value, 0),
      messageSeries,
      voiceSeries,
      memberSeries: ((members.data ?? []) as Array<Record<string, unknown>>).map((r) => ({ day: String(r.day), value: Number(r.member_count ?? 0) })),
      topUsers: rankedUsers.map((r) => ({ ...r, name: names.get(r.id) ?? r.id })),
      topVoiceUsers: rankedVoice.map((r) => ({ ...r, name: names.get(r.id) ?? r.id })),
      topChannels: rankedChannels,
    };
  });

export const getStatahoyUserActivity = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => userActivityInput.parse(data))
  .handler(async ({ data }) => {
    const { guild, supabaseAdmin } = await authorize(data.guildId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;

    const { data: rows, error } = await db
      .from("user_activity")
      .select("*")
      .eq("guild_id", data.guildId)
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .limit(1000);

    if (error) throw new Error(error.message);

    const { data: memberRows } = await supabaseAdmin
      .from("members")
      .select("user_id, username, display_name, avatar, joined_at, left_at")
      .eq("guild_id", data.guildId)
      .limit(1000);

    const members = new Map<string, Record<string, unknown>>();
    for (const member of memberRows ?? []) members.set(String(member.user_id), member as Record<string, unknown>);

    let users = (rows ?? []).map((row: Record<string, unknown>) => {
      const id = String(row.user_id);
      const member = members.get(id) ?? {};
      return {
        userId: id,
        username: String(row.username || member.username || id),
        displayName: String(member.display_name || row.username || id),
        avatar: member.avatar || null,
        joinedAt: member.joined_at || null,
        leftAt: member.left_at || null,
        lastSeenAt: row.last_seen_at || null,
        lastOnlineAt: row.last_online_at || null,
        lastOnlineStatus: String(row.last_online_status || "unknown"),
        messageCount: Number(row.message_count || 0),
        lastMessageAt: row.last_message_at || null,
        lastMessageContent: row.last_message_content || null,
        lastMessageChannelId: row.last_message_channel_id || null,
        lastCommandAt: row.last_command_at || null,
        lastCommandName: row.last_command_name || null,
        commandCount: Number(row.command_count || 0),
        voiceSeconds: Number(row.voice_seconds || 0),
        voiceSessions: Number(row.voice_session_count || 0),
        lastVoiceJoinAt: row.last_voice_join_at || null,
        lastVoiceLeaveAt: row.last_voice_leave_at || null,
      };
    });

    const q = data.search.toLowerCase();
    if (q) users = users.filter((u) => `${u.displayName} ${u.username} ${u.userId}`.toLowerCase().includes(q));

    if (data.sort === "messages") users.sort((a, b) => b.messageCount - a.messageCount);
    else if (data.sort === "commands") users.sort((a, b) => b.commandCount - a.commandCount);
    else if (data.sort === "voice") users.sort((a, b) => b.voiceSeconds - a.voiceSeconds);
    else users.sort((a, b) => new Date(String(b.lastSeenAt || 0)).getTime() - new Date(String(a.lastSeenAt || 0)).getTime());

    return {
      guild: { id: data.guildId, name: guild.name, icon: guild.icon },
      users: users.slice(0, data.limit),
    };
  });
