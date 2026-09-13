import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{5,25}$/);

async function sessionOrNull() {
  const { sessionFromHeader } = await import("@/lib/discord.server");
  return sessionFromHeader(getRequestHeader("cookie") ?? null);
}

async function requireOwner() {
  const session = await sessionOrNull();
  if (!session) throw new Error("Please sign in with Discord.");
  const { bootstrapOwnerIds } = await import("@/lib/admin.server");
  if (!bootstrapOwnerIds().includes(session.userId)) throw new Error("Only the platform owner can review plan unlock requests.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { session, supabaseAdmin };
}

export const getPlansAndTasks = createServerFn({ method: "GET" }).handler(async () => {
  const session = await sessionOrNull();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: plans, error } = await supabaseAdmin.from("plans").select("id,key,name,description,features,sort_order,enabled").eq("enabled", true).order("sort_order");
  if (error) throw new Error("Could not load plans.");
  const ids = (plans ?? []).map((p) => p.id);
  const { data: tasks } = ids.length ? await supabaseAdmin.from("plan_tasks").select("id,plan_id,title,description,task_type,target_value,sort_order").in("plan_id", ids).order("sort_order") : { data: [] };
  let guildId: string | null = null;
  if (session) {
    const { data: membership } = await supabaseAdmin.from("servers").select("guild_id").eq("owner_id", session.userId).eq("bot_present", true).order("member_count", { ascending: false }).limit(1).maybeSingle();
    guildId = membership?.guild_id ?? null;
  }
  let server: Record<string, unknown> = {};
  if (guildId) {
    const { data } = await supabaseAdmin.from("servers").select("member_count,message_count_total,voice_minutes_total,reaction_count_total").eq("guild_id", guildId).maybeSingle();
    server = data ?? {};
  }
  const progress = (task: Record<string, unknown>) => {
    const type = String(task.task_type ?? "");
    const target = Number(task.target_value ?? 0);
    let current = 0;
    if (type === "message_count" || type === "messages") current = Number(server.message_count_total ?? 0);
    else if (type === "voice_minutes") current = Number(server.voice_minutes_total ?? 0);
    else if (type === "reaction_count" || type === "reactions") current = Number(server.reaction_count_total ?? 0);
    else if (type === "member_count") current = Number(server.member_count ?? 0);
    return { current, target, complete: target > 0 && current >= target };
  };
  return (plans ?? []).map((plan) => ({ ...plan, tasks: (tasks ?? []).filter((task) => task.plan_id === plan.id).map((task) => ({ ...task, progress: progress(task) })) }));
});

export const requestPlanUnlock = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ planId: z.string().uuid(), guildId: snowflake.optional(), method: z.enum(["task", "request"]).default("request") }).parse(data))
  .handler(async ({ data }) => {
    const session = await sessionOrNull();
    if (!session) throw new Error("Please sign in with Discord before requesting a plan.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan } = await supabaseAdmin.from("plans").select("id,key,name,features").eq("id", data.planId).eq("enabled", true).maybeSingle();
    if (!plan) throw new Error("That plan is no longer available.");
    const { data: existing } = await supabaseAdmin.from("plan_unlock_requests").select("id,status").eq("requester_user_id", session.userId).eq("plan_id", data.planId).eq("status", "pending").maybeSingle();
    if (existing) return { ok: true, alreadyPending: true, requestId: existing.id };
    const { data: row, error } = await supabaseAdmin.from("plan_unlock_requests").insert({ requester_user_id: session.userId, requester_username: session.username, guild_id: data.guildId ?? null, plan_id: data.planId, unlock_method: data.method, status: "pending" }).select("id").single();
    if (error || !row) throw new Error("Could not submit the unlock request.");
    return { ok: true, alreadyPending: false, requestId: row.id };
  });

export const listMyPlanUnlockRequests = createServerFn({ method: "GET" }).handler(async () => {
  const session = await sessionOrNull();
  if (!session) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("plan_unlock_requests").select("id,plan_id,unlock_method,status,review_note,requested_at,reviewed_at,plans(name,key)").eq("requester_user_id", session.userId).order("requested_at", { ascending: false }).limit(20);
  return data ?? [];
});

export const listPlanUnlockRequests = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await requireOwner();
  const { data } = await supabaseAdmin.from("plan_unlock_requests").select("id,requester_user_id,requester_username,guild_id,plan_id,unlock_method,status,task_progress,review_note,reviewed_by,requested_at,reviewed_at,plans(name,key,features)").order("requested_at", { ascending: false }).limit(200);
  return data ?? [];
});

export const reviewPlanUnlockRequest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ requestId: z.string().uuid(), decision: z.enum(["approved", "declined"]), note: z.string().max(500).optional() }).parse(data))
  .handler(async ({ data }) => {
    const { session, supabaseAdmin } = await requireOwner();
    const { data: request } = await supabaseAdmin.from("plan_unlock_requests").select("id,requester_user_id,plan_id,status,plans(key,name,features)").eq("id", data.requestId).maybeSingle();
    if (!request) throw new Error("Unlock request not found.");
    if (request.status !== "pending") throw new Error("That request has already been reviewed.");
    const plan = Array.isArray(request.plans) ? request.plans[0] : request.plans;
    if (data.decision === "approved") {
      const features = Array.isArray(plan?.features) ? plan.features : [];
      const { data: user } = await supabaseAdmin.from("platform_users").select("feature_flags").eq("discord_user_id", request.requester_user_id).maybeSingle();
      const currentFlags = (user?.feature_flags && typeof user.feature_flags === "object" ? user.feature_flags : {}) as Record<string, boolean>;
      const featureFlags = { ...currentFlags };
      for (const feature of features) featureFlags[String(feature)] = true;
      const { error: userError } = await supabaseAdmin.from("platform_users").update({ plan: plan?.key ?? "premium", premium: true, feature_flags: featureFlags }).eq("discord_user_id", request.requester_user_id);
      if (userError) throw new Error("Could not unlock the requested plan.");
    }
    await supabaseAdmin.from("plan_unlock_requests").update({ status: data.decision, review_note: data.note?.trim() || null, reviewed_by: session.userId, reviewed_at: new Date().toISOString() }).eq("id", data.requestId);
    await supabaseAdmin.from("platform_notifications").insert({ title: data.decision === "approved" ? "Plan unlocked" : "Plan unlock request reviewed", body: data.decision === "approved" ? `${plan?.name ?? "Your plan"} has been unlocked for your account.` : `${plan?.name ?? "Your plan"} unlock request was declined.${data.note ? ` Reason: ${data.note}` : ""}`, level: data.decision === "approved" ? "success" : "warning", target_type: "user", target_user_id: request.requester_user_id, target_guild_id: null, via_inbox: true, via_dm: true, via_announcement: false, announcement_channel_id: null, created_by: session.userId, delivery_status: "pending" });
    return { ok: true };
  });
