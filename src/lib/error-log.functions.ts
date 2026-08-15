import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

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

export const getErrorLogs = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
        source: z.string().max(30).optional(),
        page: z.number().int().min(0).max(500).default(0),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const pageSize = 30;
    let query = supabaseAdmin
      .from("bot_error_logs")
      .select("*", { count: "exact" })
      .eq("guild_id", data.guildId);
    if (data.source && data.source !== "all") query = query.eq("source", data.source);

    const { data: rows, count } = await query
      .order("created_at", { ascending: false })
      .range(data.page * pageSize, data.page * pageSize + pageSize - 1);

    return { entries: rows ?? [], total: count ?? 0, page: data.page, pageSize };
  });

export const clearErrorLogs = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ guildId: z.string().regex(/^\d{5,25}$/) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { error } = await supabaseAdmin
      .from("bot_error_logs")
      .delete()
      .eq("guild_id", data.guildId);
    if (error) throw new Error("Could not clear the error log.");
    return { ok: true };
  });
