import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const guildInput = z.object({ guildId: z.string().regex(/^\d{5,25}$/) });
const rowInput = z.object({ guildId: z.string().regex(/^\d{5,25}$/), id: z.string().uuid() });

async function authorize(guildId: string) {
  const { sessionFromHeader, assertGuildAccess } = await import("@/lib/discord.server");
  const session = await sessionFromHeader(getRequestHeader("cookie") ?? null);
  if (!session) throw new Error("Please sign in with Discord.");
  const { isBanned } = await import("@/lib/admin.server");
  if ((await isBanned(session.userId)).banned) throw new Error("Your access to the ! HOY control center has been revoked.");
  const guild = await assertGuildAccess(session, guildId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { session, guild, supabaseAdmin };
}

const settingsSchema = z.object({
  description: z.string().max(1000).default("Enter below for your chance to win!"),
  required_role_id: z.string().regex(/^\d{5,25}$/).nullable().default(null),
  bonus_role_id: z.string().regex(/^\d{5,25}$/).nullable().default(null),
  bonus_entries: z.number().int().min(1).max(10).default(2),
  min_account_age_days: z.number().int().min(0).max(3650).default(0),
  entry_mode: z.literal("button").default("button"),
});

const createInput = z.object({
  guildId: z.string().regex(/^\d{5,25}$/),
  channel_id: z.string().regex(/^\d{5,25}$/),
  prize: z.string().min(1).max(200),
  description: z.string().max(1000),
  winner_count: z.number().int().min(1).max(20),
  ends_at: z.string().datetime(),
  required_role_id: z.string().regex(/^\d{5,25}$/).nullable(),
  bonus_role_id: z.string().regex(/^\d{5,25}$/).nullable(),
  bonus_entries: z.number().int().min(1).max(10),
  min_account_age_days: z.number().int().min(0).max(3650),
});

export const getGiveawayManager = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => guildInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const db = supabaseAdmin as any;
    const { data: giveaways, error } = await db
      .from("giveaways")
      .select("id, channel_id, message_id, prize, winner_count, ends_at, status, winner_ids, host_name, host_id, settings, created_at, updated_at")
      .eq("guild_id", data.guildId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Could not load giveaways.");
    const ids = (giveaways ?? []).map((g: any) => g.id);
    let entries: Array<{ giveaway_id: string; user_id: string; weight: number; created_at: string }> = [];
    if (ids.length) {
      const result = await db.from("giveaway_entries").select("giveaway_id, user_id, weight, created_at").in("giveaway_id", ids).order("created_at", { ascending: false }).limit(50000);
      entries = result.data ?? [];
    }
    const counts = new Map<string, number>();
    for (const entry of entries) counts.set(entry.giveaway_id, (counts.get(entry.giveaway_id) ?? 0) + 1);
    return { giveaways: (giveaways ?? []).map((g: any) => ({ ...g, entry_count: counts.get(g.id) ?? 0 })) };
  });

export const createGiveawayFromDashboard = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createInput.parse(data))
  .handler(async ({ data }) => {
    const { session, supabaseAdmin } = await authorize(data.guildId);
    const db = supabaseAdmin as any;
    const endsAt = new Date(data.ends_at);
    if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= Date.now() + 30_000) throw new Error("Giveaway end time must be at least 30 seconds in the future.");
    const settings = settingsSchema.parse({ description: data.description, required_role_id: data.required_role_id, bonus_role_id: data.bonus_role_id, bonus_entries: data.bonus_entries, min_account_age_days: data.min_account_age_days, entry_mode: "button" });
    const { error } = await db.from("bot_action_queue").insert({ guild_id: data.guildId, action: "giveaway_create", payload: { channel_id: data.channel_id, prize: data.prize.trim(), winner_count: data.winner_count, ends_at: endsAt.toISOString(), settings }, requested_by: session.userId, status: "pending" });
    if (error) throw new Error("Could not queue that giveaway.");
    return { ok: true };
  });

const updateInput = createInput.extend({ id: z.string().uuid() });

export const updateGiveawayFromDashboard = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateInput.parse(data))
  .handler(async ({ data }) => {
    const { session, supabaseAdmin } = await authorize(data.guildId);
    const db = supabaseAdmin as any;
    const existing = await db.from("giveaways").select("id, status").eq("id", data.id).eq("guild_id", data.guildId).maybeSingle();
    if (!existing.data) throw new Error("Giveaway not found.");
    if (existing.data.status !== "running") throw new Error("Only running giveaways can be edited.");
    const endsAt = new Date(data.ends_at);
    if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= Date.now() + 30_000) throw new Error("Giveaway end time must be at least 30 seconds in the future.");
    const settings = settingsSchema.parse({ description: data.description, required_role_id: data.required_role_id, bonus_role_id: data.bonus_role_id, bonus_entries: data.bonus_entries, min_account_age_days: data.min_account_age_days, entry_mode: "button" });
    const { error } = await db.from("bot_action_queue").insert({ guild_id: data.guildId, action: "giveaway_edit", target_id: data.id, payload: { prize: data.prize.trim(), winner_count: data.winner_count, ends_at: endsAt.toISOString(), settings }, requested_by: session.userId, status: "pending" });
    if (error) throw new Error("Could not queue that giveaway edit.");
    return { ok: true };
  });

async function queueGiveawayAction(guildId: string, id: string, action: string) {
  const { session, supabaseAdmin } = await authorize(guildId);
  const db = supabaseAdmin as any;
  const { data: row } = await db.from("giveaways").select("id, status").eq("id", id).eq("guild_id", guildId).maybeSingle();
  if (!row) throw new Error("Giveaway not found.");
  if ((action === "giveaway_end" || action === "giveaway_cancel") && row.status !== "running") throw new Error("That giveaway is not running.");
  if (action === "giveaway_reroll" && row.status !== "ended") throw new Error("Only ended giveaways can be rerolled.");
  const { error } = await db.from("bot_action_queue").insert({ guild_id: guildId, action, target_id: id, payload: { giveaway_id: id }, requested_by: session.userId, status: "pending" });
  if (error) throw new Error("Could not queue that giveaway action.");
  return { ok: true };
}

export const endGiveawayFromDashboard = createServerFn({ method: "POST" }).inputValidator((data: unknown) => rowInput.parse(data)).handler(async ({ data }) => queueGiveawayAction(data.guildId, data.id, "giveaway_end"));
export const cancelGiveawayFromDashboard = createServerFn({ method: "POST" }).inputValidator((data: unknown) => rowInput.parse(data)).handler(async ({ data }) => queueGiveawayAction(data.guildId, data.id, "giveaway_cancel"));
export const rerollGiveawayFromDashboard = createServerFn({ method: "POST" }).inputValidator((data: unknown) => rowInput.parse(data)).handler(async ({ data }) => queueGiveawayAction(data.guildId, data.id, "giveaway_reroll"));

export const getGiveawayEntries = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => rowInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const db = supabaseAdmin as any;
    const { data: giveaway } = await db.from("giveaways").select("id").eq("id", data.id).eq("guild_id", data.guildId).maybeSingle();
    if (!giveaway) throw new Error("Giveaway not found.");
    const { data: entries, error } = await db.from("giveaway_entries").select("user_id, weight, created_at, updated_at").eq("giveaway_id", data.id).order("created_at", { ascending: true }).limit(50000);
    if (error) throw new Error("Could not load giveaway entries.");
    return { entries: entries ?? [] };
  });
