import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/** Any signed-in Discord user — no guild-manage permission required. Used
 * for the public appeal form, since the person appealing is (by definition)
 * usually banned or otherwise not someone who can manage the server. */
async function authorizeSelf() {
  const { sessionFromHeader } = await import("@/lib/discord.server");
  const session = await sessionFromHeader(getRequestHeader("cookie") ?? null);
  if (!session) throw new Error("Please sign in with Discord to submit an appeal.");
  const { isBanned } = await import("@/lib/admin.server");
  if ((await isBanned(session.userId)).banned) {
    throw new Error("Your access to AHOY has been revoked.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const looseAdmin = supabaseAdmin as unknown as {
    from: (table: string) => any;
    rpc: (fn: string, args?: any) => any;
  };
  return { session, supabaseAdmin: looseAdmin };
}

async function authorizeManager(guildId: string) {
  const { sessionFromHeader, assertGuildAccess } = await import("@/lib/discord.server");
  const session = await sessionFromHeader(getRequestHeader("cookie") ?? null);
  if (!session) throw new Error("Please sign in with Discord.");
  const { isBanned } = await import("@/lib/admin.server");
  if ((await isBanned(session.userId)).banned) {
    throw new Error("Your access to the AHOY control center has been revoked.");
  }
  await assertGuildAccess(session, guildId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const looseAdmin = supabaseAdmin as unknown as {
    from: (table: string) => any;
    rpc: (fn: string, args?: any) => any;
  };
  return { session, supabaseAdmin: looseAdmin };
}

/** The signed-in user's own cases in this guild that are eligible to appeal
 * (active bans/timeouts, or anything not yet appealed). Public — no
 * guild-manage permission needed, since the target is looking at their own
 * punishment history. */
export const getMyAppealableCases = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ guildId: z.string().regex(/^\d{5,25}$/) }).parse(data))
  .handler(async ({ data }) => {
    const { session, supabaseAdmin } = await authorizeSelf();

    const [{ data: cases }, { data: appeals }, { data: server }] = await Promise.all([
      supabaseAdmin
        .from("moderation_cases")
        .select("id, case_number, action, reason, created_at, active, voided")
        .eq("guild_id", data.guildId)
        .eq("target_id", session.userId)
        .in("action", ["ban", "timeout", "kick", "warn"])
        .order("created_at", { ascending: false })
        .limit(25),
      supabaseAdmin
        .from("case_appeals")
        .select("case_id, status")
        .eq("guild_id", data.guildId)
        .eq("user_id", session.userId),
      supabaseAdmin.from("servers").select("name, icon").eq("guild_id", data.guildId).maybeSingle(),
    ]);

    type AppealLite = { case_id: string; status: string };
    type CaseLite = {
      id: string;
      case_number: number | null;
      action: string;
      reason: string | null;
      voided: boolean | null;
      created_at: string;
    };
    const appealedByCase = new Map<string, string>(
      ((appeals ?? []) as AppealLite[]).map((a) => [a.case_id, a.status]),
    );
    return {
      serverName: server?.name ?? "This server",
      cases: ((cases ?? []) as CaseLite[]).map((c) => ({
        ...c,
        appealStatus: appealedByCase.get(c.id) ?? null,
      })),
    };
  });

export const submitAppeal = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
        caseId: z.string().uuid(),
        caseNumber: z.number().int().optional(),
        message: z.string().min(10).max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { session, supabaseAdmin } = await authorizeSelf();

    const { data: caseRow } = await supabaseAdmin
      .from("moderation_cases")
      .select("id, target_id")
      .eq("id", data.caseId)
      .eq("guild_id", data.guildId)
      .maybeSingle();
    if (!caseRow || caseRow.target_id !== session.userId) {
      throw new Error("That case doesn't belong to you.");
    }

    const { error } = await supabaseAdmin.from("case_appeals").insert({
      guild_id: data.guildId,
      case_id: data.caseId,
      case_number: data.caseNumber ?? null,
      user_id: session.userId,
      username: session.username,
      message: data.message,
    });
    if (error) {
      throw new Error(
        error.code === "23505" ? "You've already submitted an appeal for this case." : "Could not submit your appeal.",
      );
    }
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* Admin review                                                       */
/* ---------------------------------------------------------------- */

export type AppealRow = {
  id: string;
  guild_id: string;
  case_id: string;
  case_number: number | null;
  user_id: string;
  username: string | null;
  message: string;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
};

export const getAppeals = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
        status: z.enum(["pending", "accepted", "rejected", "all"]).default("pending"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorizeManager(data.guildId);
    let query = supabaseAdmin.from("case_appeals").select("*").eq("guild_id", data.guildId);
    if (data.status !== "all") query = query.eq("status", data.status);
    const { data: rows } = await query.order("created_at", { ascending: false }).limit(100);
    return { appeals: (rows ?? []) as AppealRow[] };
  });

export const resolveAppeal = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
        id: z.string().uuid(),
        status: z.enum(["accepted", "rejected"]),
        liftPunishment: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { session, supabaseAdmin } = await authorizeManager(data.guildId);

    const { data: appeal } = await supabaseAdmin
      .from("case_appeals")
      .select("*, moderation_cases(action, target_id)")
      .eq("id", data.id)
      .eq("guild_id", data.guildId)
      .maybeSingle();
    if (!appeal) throw new Error("That appeal no longer exists.");

    const { error } = await supabaseAdmin
      .from("case_appeals")
      .update({ status: data.status, resolved_by: session.userId, resolved_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("guild_id", data.guildId);
    if (error) throw new Error("Could not update that appeal.");

    if (data.status === "accepted" && data.liftPunishment) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const caseInfo = (appeal as any).moderation_cases as
        | { action: string; target_id: string }
        | undefined;
      if (caseInfo && (caseInfo.action === "ban" || caseInfo.action === "timeout")) {
        await supabaseAdmin.from("bot_action_queue").insert({
          guild_id: data.guildId,
          action: caseInfo.action === "ban" ? "unban" : "untimeout",
          target_id: caseInfo.target_id,
          payload: {
            reason: "Appeal accepted from the AHOY dashboard",
            moderator_name: session.username ?? session.userId,
            case_id: appeal.case_id,
          },
          requested_by: session.userId,
          requested_by_name: session.username ?? null,
        });
      }
    }
    return { ok: true };
  });
