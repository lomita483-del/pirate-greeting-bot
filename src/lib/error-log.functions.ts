import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

async function authorize(guildId: string) {
  const { sessionFromHeader, assertGuildAccess } = await import("@/lib/discord.server");
  const session = await sessionFromHeader(getRequestHeader("cookie") ?? null);
  if (!session) throw new Error("Please sign in with Discord.");
  const { isBanned } = await import("@/lib/admin.server");
  if ((await isBanned(session.userId)).banned) throw new Error("Your access to the !HOY BOT control center has been revoked.");
  const guild = await assertGuildAccess(session, guildId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { session, guild, supabaseAdmin };
}

export const getErrorLogs = createServerFn({ method: "GET" }).inputValidator((data: unknown) => z.object({ guildId: z.string().regex(/^\d{5,25}$/), source: z.string().max(30).optional(), page: z.number().int().min(0).max(500).default(0) }).parse(data)).handler(async ({ data }) => {
  const { supabaseAdmin } = await authorize(data.guildId); const pageSize = 30;
  let query = supabaseAdmin.from("bot_error_logs").select("*", { count: "exact" }).eq("guild_id", data.guildId);
  if (data.source && data.source !== "all") query = query.eq("source", data.source);
  const { data: rows, count } = await query.order("created_at", { ascending: false }).range(data.page * pageSize, data.page * pageSize + pageSize - 1);
  return { entries: rows ?? [], total: count ?? 0, page: data.page, pageSize };
});

export const clearErrorLogs = createServerFn({ method: "POST" }).inputValidator((data: unknown) => z.object({ guildId: z.string().regex(/^\d{5,25}$/) }).parse(data)).handler(async ({ data }) => {
  const { supabaseAdmin } = await authorize(data.guildId); const { error } = await supabaseAdmin.from("bot_error_logs").delete().eq("guild_id", data.guildId); if (error) throw new Error("Could not clear the error log."); return { ok: true };
});

export const getAllErrorLogs = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/lib/admin.server"); const { supabaseAdmin } = await requireAdmin(getRequestHeader("cookie") ?? null);
  const { data, error } = await supabaseAdmin.from("bot_error_logs").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error("Could not load platform error logs."); return data ?? [];
});

export const updateErrorStatus = createServerFn({ method: "POST" }).inputValidator((data: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["pending","fixed"]) }).parse(data)).handler(async ({ data }) => {
  const { requireAdmin } = await import("@/lib/admin.server"); const { supabaseAdmin } = await requireAdmin(getRequestHeader("cookie") ?? null); const admin = await (async () => { const { sessionFromHeader } = await import("@/lib/discord.server"); const s = await sessionFromHeader(getRequestHeader("cookie") ?? null); if (!s) throw new Error("Please sign in."); return s; })();
  const { error } = await supabaseAdmin.from("bot_error_logs").update({ status: data.status, resolved_by: data.status === "fixed" ? admin.userId : null, resolved_at: data.status === "fixed" ? new Date().toISOString() : null }).eq("id", data.id); if (error) throw new Error("Could not update error status."); return { ok: true };
});

export const deleteErrorLog = createServerFn({ method: "POST" }).inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data)).handler(async ({ data }) => { const { requireAdmin } = await import("@/lib/admin.server"); const { supabaseAdmin } = await requireAdmin(getRequestHeader("cookie") ?? null); const { error } = await supabaseAdmin.from("bot_error_logs").delete().eq("id", data.id); if (error) throw new Error("Could not delete error log."); return { ok: true }; });