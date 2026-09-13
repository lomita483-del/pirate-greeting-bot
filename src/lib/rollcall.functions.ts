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

async function fetchStructure(guildId: string) {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) return { channels: [], roles: [] };
  const headers = { authorization: `Bot ${token}` };
  const [channelsRes, rolesRes] = await Promise.all([
    fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers }),
    fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers }),
  ]);
  const channels = channelsRes.ok ? (await channelsRes.json()) as Array<{ id: string; name: string; type: number }> : [];
  const roles = rolesRes.ok ? (await rolesRes.json()) as Array<{ id: string; name: string; managed: boolean; position: number }> : [];
  return {
    channels: channels.filter((c) => c.type === 0 || c.type === 4).map((c) => ({ id: c.id, name: c.name, kind: c.type === 4 ? "category" : "text" })),
    roles: roles.filter((r) => !r.managed && r.name !== "@everyone").sort((a, b) => b.position - a.position).map((r) => ({ id: r.id, name: r.name })),
  };
}

export const getRollCallDashboard = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => guildInput.parse(data))
  .handler(async ({ data }) => {
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
    const { data: responses, error: responseError } = ids.length
      ? await supabaseAdmin.from("roll_call_responses").select("id, roll_call_id, user_id, username, display_name, responded_at").in("roll_call_id", ids).order("responded_at", { ascending: true })
      : { data: [], error: null };
    if (responseError) throw new Error(responseError.message);
    const grouped = new Map<string, Array<Record<string, unknown>>>();
    for (const row of responses ?? []) {
      const key = String(row.roll_call_id);
      const list = grouped.get(key) ?? [];
      list.push(row as Record<string, unknown>);
      grouped.set(key, list);
    }
    return {
      guild: { id: guild.id, name: guild.name, icon: guild.icon },
      structure,
      settings: settings.data ?? null,
      rollCalls: rows.map((row) => ({ ...row, responses: grouped.get(String(row.id)) ?? [], responseCount: (grouped.get(String(row.id)) ?? []).length })),
    };
  });

const settingsInput = z.object({
  guildId: snowflake, enabled: z.boolean(), managerRoleIds: z.array(snowflake).max(25), defaultChannelId: snowflake.nullable(), dailyEnabled: z.boolean(), dailyHourUtc: z.number().int().min(0).max(23), dailyTargetRoleIds: z.array(snowflake).max(25), dailyTitle: z.string().max(200), dailyDescription: z.string().max(1500), dailyDurationHours: z.number().int().min(1).max(336),
});

export const saveRollCallSettings = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => settingsInput.parse(data))
  .handler(async ({ data }) => {
    const { session, supabaseAdmin } = await authorize(data.guildId);
    const payload = { guild_id: data.guildId, enabled: data.enabled, manager_role_ids: data.managerRoleIds, default_channel_id: data.defaultChannelId, daily_enabled: data.dailyEnabled, daily_hour_utc: data.dailyHourUtc, daily_target_role_ids: data.dailyTargetRoleIds, daily_title: data.dailyTitle, daily_description: data.dailyDescription, daily_duration_hours: data.dailyDurationHours, updated_at: new Date().toISOString() };
    const { error } = await supabaseAdmin.from("roll_call_settings").upsert(payload, { onConflict: "guild_id" });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("dashboard_access_log").insert({ discord_user_id: session.userId, discord_username: session.username, guild_id: data.guildId, action: "update:rollcall" });
    return { ok: true };
  });

const startInput = z.object({ guildId: snowflake, mode: z.enum(["event", "daily", "audit"]), title: z.string().min(1).max(200), description: z.string().max(1500).nullable(), durationHours: z.number().min(0.25).max(336), channelId: snowflake, targetRoleIds: z.array(snowflake).max(25) });

export const startRollCall = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => startInput.parse(data))
  .handler(async ({ data }) => {
    const { session, supabaseAdmin } = await authorize(data.guildId);
    const opensAt = new Date();
    const closesAt = new Date(opensAt.getTime() + data.durationHours * 3600_000);
    const { data: rollCall, error } = await supabaseAdmin.from("roll_calls").insert({ guild_id: data.guildId, mode: data.mode, title: data.title, description: data.description || null, channel_id: data.channelId, target_role_ids: data.targetRoleIds, opens_at: opensAt.toISOString(), closes_at: closesAt.toISOString(), status: "open", created_by: session.userId }).select("*").single();
    if (error || !rollCall) throw new Error(error?.message ?? "Could not create the roll call.");
    const { error: queueError } = await supabaseAdmin.from("bot_action_queue").insert({ guild_id: data.guildId, action: "rollcall_start", target_id: String(rollCall.id), payload: { roll_call_id: rollCall.id }, requested_by: session.userId, requested_by_name: session.username, status: "pending" });
    if (queueError) { await supabaseAdmin.from("roll_calls").delete().eq("id", rollCall.id).eq("guild_id", data.guildId); throw new Error(queueError.message); }
    return { ok: true, rollCallId: rollCall.id };
  });

export const closeRollCall = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ guildId: snowflake, id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { session, supabaseAdmin } = await authorize(data.guildId);
    const { data: row } = await supabaseAdmin.from("roll_calls").select("id, status, channel_id").eq("id", data.id).eq("guild_id", data.guildId).maybeSingle();
    if (!row) throw new Error("Roll call not found.");
    if (row.status !== "open") return { ok: true };
    const { error } = await supabaseAdmin.from("bot_action_queue").insert({ guild_id: data.guildId, action: "rollcall_close", target_id: data.id, payload: { roll_call_id: data.id }, requested_by: session.userId, requested_by_name: session.username, status: "pending" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });