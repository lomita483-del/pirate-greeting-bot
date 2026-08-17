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

export const getReports = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
        status: z.enum(["pending", "accepted", "ignored", "all"]).default("pending"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    let query = supabaseAdmin.from("user_reports").select("*").eq("guild_id", data.guildId);
    if (data.status !== "all") query = query.eq("status", data.status);
    const { data: rows } = await query.order("created_at", { ascending: false }).limit(100);
    return { reports: rows ?? [] };
  });

export const resolveReport = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
        id: z.string().uuid(),
        status: z.enum(["accepted", "ignored"]),
        openCase: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { session, supabaseAdmin } = await authorize(data.guildId);

    const { data: report } = await supabaseAdmin
      .from("user_reports")
      .select("*")
      .eq("id", data.id)
      .eq("guild_id", data.guildId)
      .maybeSingle();
    if (!report) throw new Error("That report no longer exists.");

    const { error } = await supabaseAdmin
      .from("user_reports")
      .update({ status: data.status, resolved_by: session.userId, resolved_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("guild_id", data.guildId);
    if (error) throw new Error("Could not update that report.");

    if (data.status === "accepted" && data.openCase) {
      const { data: caseNumber } = await supabaseAdmin.rpc("next_case_number", {
        _guild_id: data.guildId,
      });
      await supabaseAdmin.from("moderation_cases").insert({
        guild_id: data.guildId,
        case_number: caseNumber as number,
        action: "note",
        target_id: report.reported_user_id,
        target_name: report.reported_user_name,
        moderator_id: session.userId,
        moderator_name: session.username ?? "Dashboard",
        reason: `From report: ${report.reason}`,
        metadata: { source: "report", report_id: report.id },
      });
    }
    return { ok: true };
  });
