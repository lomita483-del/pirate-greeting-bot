import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{5,25}$/);
const guildInput = z.object({ guildId: snowflake });

async function authorize(guildId: string) {
  const { sessionFromHeader, assertGuildAccess } = await import("@/lib/discord.server");
  const session = await sessionFromHeader(getRequestHeader("cookie") ?? null);
  if (!session) throw new Error("Please sign in with Discord.");
  const { isBanned } = await import("@/lib/admin.server");
  if ((await isBanned(session.userId)).banned) throw new Error("Your access to the control center has been revoked.");
  const guild = await assertGuildAccess(session, guildId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { session, guild, supabaseAdmin };
}

async function assertRollCallManager(guildId: string, userId: string, supabaseAdmin: any, guild: any) {
  const { canManage } = await import("@/lib/discord.server");
  if (guild && canManage(guild)) return;
  const { data: settings } = await supabaseAdmin.from("roll_call_settings").select("enabled, manager_role_ids").eq("guild_id", guildId).maybeSingle();
  if (!settings?.enabled) throw new Error("Roll Call is disabled for this server.");
  const allowed = new Set<string>((settings.manager_role_ids ?? []).map(String));
  if (!allowed.size) throw new Error("No Roll Call Manager roles are configured.");
  const token = process.env["DISCORD_TOKEN"];
  if (!token) throw new Error("The bot token is not configured.");
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, { headers: { authorization: `Bot ${token}` } });
  if (!response.ok) throw new Error("Could not verify your Discord server roles.");
  const member = await response.json() as { roles?: string[] };
  if (!(member.roles ?? []).some((roleId) => allowed.has(String(roleId)))) throw new Error("You do not have a configured Roll Call Manager role.");
}

async function fetchStructure(guildId: string) {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) return { channels: [], roles: [] };
  const headers = { authorization: `Bot ${token}` };
  const [channelsRes, rolesRes] = await Promise.all([fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers }), fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers })]);
  const channels = channelsRes.ok ? await channelsRes.json() as Array<{ id: string; name: string; type: number }> : [];
  const roles = rolesRes.ok ? await rolesRes.json() as Array<{ id: string; name: string; managed: boolean; position: number }> : [];
  return { channels: channels.filter((c) => c.type === 0 || c.type === 4).map((c) => ({ id: c.id, name: c.name, kind: c.type === 4 ? "category" : "text" })), roles: roles.filter((r) => !r.managed && r.name !== "@everyone").sort((a, b) => b.position - a.position).map((r) => ({ id: r.id, name: r.name })) };
}

type DiscordMember = { user: { id: string; username: string; global_name?: string | null; bot?: boolean }; nick?: string | null; roles?: string[] };

async function fetchGuildMembers(guildId: string, targetRoleIds: string[]) {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) return { members: [] as DiscordMember[], error: "The bot token is not configured." };
  const headers = { authorization: `Bot ${token}` };
  const target = new Set(targetRoleIds.map(String));
  const members: DiscordMember[] = [];
  let after = "0";
  try {
    for (let page = 0; page < 1000; page += 1) {
      const url = new URL(`https://discord.com/api/v10/guilds/${guildId}/members`);
      url.searchParams.set("limit", "1000");
      if (after !== "0") url.searchParams.set("after", after);
      const response = await fetch(url, { headers });
      if (!response.ok) return { members: [], error: `Discord member list unavailable (${response.status}).` };
      const pageMembers = await response.json() as DiscordMember[];
      if (!pageMembers.length) break;
      for (const member of pageMembers) {
        if (member.user.bot) continue;
        if (!target.size || (member.roles ?? []).some((roleId) => target.has(String(roleId)))) members.push(member);
      }
      if (pageMembers.length < 1000) break;
      const last = pageMembers[pageMembers.length - 1];
      if (!last?.user?.id || last.user.id === after) break;
      after = last.user.id;
    }
    return { members, error: null };
  } catch (error) {
    return { members: [], error: error instanceof Error ? error.message : "Could not load Discord members." };
  }
}

export const getRollCallDashboard = createServerFn({ method: "GET" }).inputValidator((data: unknown) => guildInput.parse(data)).handler(async ({ data }) => {
  const { guild, supabaseAdmin } = await authorize(data.guildId);
  const [settings, calls, structure] = await Promise.all([
    supabaseAdmin.from("roll_call_settings").select("*").eq("guild_id", data.guildId).maybeSingle(),
    supabaseAdmin.from("roll_calls").select("*").eq("guild_id", data.guildId).order("created_at", { ascending: false }).limit(100),
    fetchStructure(data.guildId),
  ]);
  if (settings.error) throw new Error(settings.error.message);
  if (calls.error) throw new Error(calls.error.message);
  const rows = calls.data ?? [];
  const ids = rows.map((r) => r.id);
  const { data: responses, error: responseError } = ids.length ? await supabaseAdmin.from("roll_call_responses").select("*").in("roll_call_id", ids).order("responded_at", { ascending: true }) : { data: [], error: null };
  if (responseError) throw new Error(responseError.message);
  const grouped = new Map<string, Array<Record<string, unknown>>>();
  for (const row of responses ?? []) {
    const key = String(row.roll_call_id);
    const list = grouped.get(key) ?? [];
    list.push(row as Record<string, unknown>);
    grouped.set(key, list);
  }
  const memberResults = await Promise.all(rows.filter((row) => row.status !== "open" || row.mode === "audit").map(async (row) => {
    const targetRoleIds = (row.target_role_ids ?? []).map(String);
    const result = await fetchGuildMembers(data.guildId, targetRoleIds);
    const responseIds = new Set((grouped.get(String(row.id)) ?? []).map((response) => String(response.user_id)));
    const missedMembers = result.members.filter((member) => !responseIds.has(String(member.user.id))).map((member) => ({ user_id: member.user.id, username: member.user.username, display_name: member.nick || member.user.global_name || member.user.username }));
    return [String(row.id), { missedMembers, memberFetchError: result.error, targetMemberCount: result.members.length }] as const;
  }));
  const memberMap = new Map(memberResults);
  return { guild: { id: guild.id, name: guild.name, icon: guild.icon }, structure, settings: settings.data ?? null, rollCalls: rows.map((row) => ({ ...row, responses: grouped.get(String(row.id)) ?? [], responseCount: (grouped.get(String(row.id)) ?? []).length, missedMembers: memberMap.get(String(row.id))?.missedMembers ?? [], memberFetchError: memberMap.get(String(row.id))?.memberFetchError ?? null, targetMemberCount: memberMap.get(String(row.id))?.targetMemberCount ?? null })) };
});

const settingsInput = z.object({ guildId: snowflake, enabled: z.boolean(), managerRoleIds: z.array(snowflake).max(25), defaultChannelId: snowflake.nullable(), dailyEnabled: z.boolean(), dailyHourUtc: z.number().int().min(0).max(23), dailyTargetRoleIds: z.array(snowflake).max(25), dailyTitle: z.string().max(200), dailyDescription: z.string().max(1500), dailyDurationMinutes: z.number().int().min(1).max(336 * 60) });
export const saveRollCallSettings = createServerFn({ method: "POST" }).inputValidator((data: unknown) => settingsInput.parse(data)).handler(async ({ data }) => {
  const { session, supabaseAdmin } = await authorize(data.guildId);
  const dailyDurationHours = data.dailyDurationMinutes / 60;
  const payload = { guild_id: data.guildId, enabled: data.enabled, manager_role_ids: data.managerRoleIds, default_channel_id: data.defaultChannelId, daily_enabled: data.dailyEnabled, daily_hour_utc: data.dailyHourUtc, daily_target_role_ids: data.dailyTargetRoleIds, daily_title: data.dailyTitle, daily_description: data.dailyDescription, daily_duration_hours: dailyDurationHours, daily_duration_minutes: data.dailyDurationMinutes, updated_at: new Date().toISOString() };
  const { error } = await supabaseAdmin.from("roll_call_settings").upsert(payload, { onConflict: "guild_id" });
  if (error) throw new Error(error.message);
  await supabaseAdmin.from("server_settings").upsert({ guild_id: data.guildId, rollcall_enabled: data.enabled, rollcall_manager_roles: data.managerRoleIds, rollcall_channel_id: data.defaultChannelId, rollcall_daily_enabled: data.dailyEnabled, rollcall_daily_time: `${String(data.dailyHourUtc).padStart(2, "0")}:00` }, { onConflict: "guild_id" });
  await supabaseAdmin.from("dashboard_access_log").insert({ discord_user_id: session.userId, discord_username: session.username, guild_id: data.guildId, action: "update:rollcall" });
  return { ok: true };
});

const startInput = z.object({ guildId: snowflake, mode: z.enum(["event", "daily", "audit"]), title: z.string().min(1).max(200), description: z.string().max(1500).nullable(), durationMinutes: z.number().int().min(1).max(336 * 60), channelId: snowflake, targetRoleIds: z.array(snowflake).max(25) });
export const startRollCall = createServerFn({ method: "POST" }).inputValidator((data: unknown) => startInput.parse(data)).handler(async ({ data }) => {
  const { session, guild, supabaseAdmin } = await authorize(data.guildId);
  await assertRollCallManager(data.guildId, session.userId, supabaseAdmin, guild);
  const opensAt = new Date();
  const closesAt = new Date(opensAt.getTime() + data.durationMinutes * 60_000);
  const { data: rollCall, error } = await supabaseAdmin.from("roll_calls").insert({ guild_id: data.guildId, mode: data.mode, title: data.title, description: data.description || null, channel_id: data.channelId, target_role_ids: data.targetRoleIds, opens_at: opensAt.toISOString(), closes_at: closesAt.toISOString(), status: "open", created_by: session.userId }).select("*").single();
  if (error || !rollCall) throw new Error(error?.message ?? "Could not create the roll call.");
  const { error: queueError } = await supabaseAdmin.from("bot_action_queue").insert({ guild_id: data.guildId, action: "rollcall_start", target_id: String(rollCall.id), payload: { roll_call_id: rollCall.id }, requested_by: session.userId, requested_by_name: session.username, status: "pending" });
  if (queueError) {
    await supabaseAdmin.from("roll_calls").delete().eq("id", rollCall.id).eq("guild_id", data.guildId);
    throw new Error(queueError.message);
  }
  return { ok: true, rollCallId: rollCall.id };
});

export const closeRollCall = createServerFn({ method: "POST" }).inputValidator((data: unknown) => z.object({ guildId: snowflake, id: z.string().uuid() }).parse(data)).handler(async ({ data }) => {
  const { session, guild, supabaseAdmin } = await authorize(data.guildId);
  await assertRollCallManager(data.guildId, session.userId, supabaseAdmin, guild);
  const { data: row } = await supabaseAdmin.from("roll_calls").select("id, status, channel_id").eq("id", data.id).eq("guild_id", data.guildId).maybeSingle();
  if (!row) throw new Error("Roll call not found.");
  if (row.status !== "open") return { ok: true };
  const { error } = await supabaseAdmin.from("bot_action_queue").insert({ guild_id: data.guildId, action: "rollcall_close", target_id: data.id, payload: { roll_call_id: data.id }, requested_by: session.userId, requested_by_name: session.username, status: "pending" });
  if (error) throw new Error(error.message);
  return { ok: true };
});