/**
 * Task-based premium unlock system.
 *
 * A `plan` is unlocked per-server once every one of its `plan_tasks` is
 * complete. Growth/engagement task types (member_count, boost_count,
 * invite_count, message_count, voice_minutes, reaction_count) are evaluated
 * live against counters on `servers` — the Python bot increments those
 * counters directly, this file never duplicates that state. Only
 * `daily_login_streak` (bumped by visiting this server's dashboard) and
 * `custom` (marked done by hand) get their own row in
 * `server_task_progress`.
 *
 * Plan/task authoring is restricted to the platform owner (requireOwner).
 * Reading a server's progress and ticking off a custom task is restricted
 * to that server's own admins (assertGuildAccess).
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { FEATURE_KEYS } from "@/lib/admin.functions";

const snowflake = z.string().regex(/^\d{5,25}$/);
const cookie = () => getRequestHeader("cookie") ?? null;

export const TASK_TYPES = [
  "member_count",
  "boost_count",
  "invite_count",
  "message_count",
  "voice_minutes",
  "reaction_count",
  "daily_login_streak",
  "custom",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

/** Growth/engagement task types map straight onto a live counter column. */
const COUNTER_COLUMN: Partial<Record<TaskType, string>> = {
  member_count: "member_count",
  boost_count: "boost_count",
  invite_count: "invite_count",
  message_count: "message_count_total",
  voice_minutes: "voice_minutes_total",
  reaction_count: "reaction_count_total",
};

type SupabaseAdmin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function computeTaskProgress(
  supabaseAdmin: SupabaseAdmin,
  guildId: string,
  task: { id: string; task_type: string; target_value: number },
): Promise<{ progress: number; completed: boolean }> {
  const column = COUNTER_COLUMN[task.task_type as TaskType];
  if (column) {
    const { data } = await supabaseAdmin
      .from("servers")
      .select(column)
      .eq("guild_id", guildId)
      .maybeSingle();
    const value = Number((data as Record<string, unknown> | null)?.[column] ?? 0);
    return { progress: value, completed: value >= Number(task.target_value) };
  }
  if (task.task_type === "daily_login_streak") {
    const { data } = await supabaseAdmin
      .from("server_login_streaks")
      .select("streak_days")
      .eq("guild_id", guildId)
      .maybeSingle();
    const value = Number((data as Record<string, unknown> | null)?.["streak_days"] ?? 0);
    return { progress: value, completed: value >= Number(task.target_value) };
  }
  // custom — manually ticked
  const { data } = await supabaseAdmin
    .from("server_task_progress")
    .select("progress_value, completed")
    .eq("guild_id", guildId)
    .eq("task_id", task.id)
    .maybeSingle();
  const row = data as Record<string, unknown> | null;
  return {
    progress: Number(row?.["progress_value"] ?? 0),
    completed: Boolean(row?.["completed"]),
  };
}

/* ------------------------------------------------------------------ */
/* Owner-only authoring                                                */
/* ------------------------------------------------------------------ */

export const listPlansAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/lib/admin.server");
  const { supabaseAdmin } = await requireAdmin(cookie());
  const { data, error } = await supabaseAdmin
    .from("plans")
    .select("*, plan_tasks(*)")
    .order("sort_order", { ascending: true });
  if (error) throw new Error("Could not load plans.");
  return (data ?? []).map((plan) => ({
    ...plan,
    plan_tasks: ((plan as Record<string, unknown>)["plan_tasks"] as unknown[] ?? []).sort(
      (a, b) =>
        Number((a as Record<string, unknown>)["sort_order"] ?? 0) -
        Number((b as Record<string, unknown>)["sort_order"] ?? 0),
    ),
  }));
});

const planInput = z.object({
  key: z.string().min(2).max(40).regex(/^[a-z0-9_-]+$/, "Lowercase letters, numbers, - or _ only."),
  name: z.string().min(2).max(80),
  description: z.string().max(500).nullable().optional(),
  features: z.array(z.enum(FEATURE_KEYS)).default([]),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  enabled: z.boolean().default(true),
});

export const createPlan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => planInput.parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin, requireOwner } = await import("@/lib/admin.server");
    const { role, supabaseAdmin } = await requireAdmin(cookie());
    requireOwner(role);
    const { data: row, error } = await supabaseAdmin
      .from("plans")
      .insert({
        key: data.key,
        name: data.name,
        description: data.description ?? null,
        features: data.features,
        sort_order: data.sortOrder,
        enabled: data.enabled,
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`Could not create that plan: ${error.message}`);
    return row;
  });

export const updatePlan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => planInput.partial().extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin, requireOwner } = await import("@/lib/admin.server");
    const { role, supabaseAdmin } = await requireAdmin(cookie());
    requireOwner(role);
    const { id, sortOrder, ...rest } = data;
    const patch: Record<string, unknown> = { ...rest };
    if (sortOrder !== undefined) patch["sort_order"] = sortOrder;
    const { error } = await supabaseAdmin.from("plans").update(patch).eq("id", id);
    if (error) throw new Error("Could not update that plan.");
    return { ok: true };
  });

export const deletePlan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin, requireOwner } = await import("@/lib/admin.server");
    const { role, supabaseAdmin } = await requireAdmin(cookie());
    requireOwner(role);
    await supabaseAdmin.from("plans").delete().eq("id", data.id);
    return { ok: true };
  });

const taskInput = z.object({
  planId: z.string().uuid(),
  title: z.string().min(2).max(120),
  description: z.string().max(400).nullable().optional(),
  taskType: z.enum(TASK_TYPES),
  targetValue: z.number().positive().max(1_000_000_000),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

export const createPlanTask = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => taskInput.parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin, requireOwner } = await import("@/lib/admin.server");
    const { session, role, supabaseAdmin } = await requireAdmin(cookie());
    requireOwner(role);

    const { count } = await supabaseAdmin
      .from("plan_tasks")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", data.planId);
    if ((count ?? 0) >= 10) {
      throw new Error("A plan can have at most 10 tasks.");
    }

    const { data: row, error } = await supabaseAdmin
      .from("plan_tasks")
      .insert({
        plan_id: data.planId,
        title: data.title,
        description: data.description ?? null,
        task_type: data.taskType,
        target_value: data.targetValue,
        sort_order: data.sortOrder,
        created_by: session.userId,
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`Could not create that task: ${error.message}`);
    return row;
  });

export const updatePlanTask = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    taskInput.omit({ planId: true }).partial().extend({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, requireOwner } = await import("@/lib/admin.server");
    const { role, supabaseAdmin } = await requireAdmin(cookie());
    requireOwner(role);
    const { id, taskType, targetValue, sortOrder, ...rest } = data;
    const patch: Record<string, unknown> = { ...rest };
    if (taskType !== undefined) patch["task_type"] = taskType;
    if (targetValue !== undefined) patch["target_value"] = targetValue;
    if (sortOrder !== undefined) patch["sort_order"] = sortOrder;
    const { error } = await supabaseAdmin.from("plan_tasks").update(patch).eq("id", id);
    if (error) throw new Error("Could not update that task.");
    return { ok: true };
  });

export const deletePlanTask = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin, requireOwner } = await import("@/lib/admin.server");
    const { role, supabaseAdmin } = await requireAdmin(cookie());
    requireOwner(role);
    await supabaseAdmin.from("plan_tasks").delete().eq("id", data.id);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Per-server view — any admin of that specific server                 */
/* ------------------------------------------------------------------ */

export const getServerPlanStatus = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ guildId: snowflake }).parse(data))
  .handler(async ({ data }) => {
    const { sessionFromHeader, assertGuildAccess } = await import("@/lib/discord.server");
    const session = await sessionFromHeader(cookie());
    if (!session) throw new Error("Please sign in with Discord.");
    await assertGuildAccess(session, data.guildId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Bump the daily-login streak for this server, once per calendar day.
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const { data: streakRow } = await supabaseAdmin
      .from("server_login_streaks")
      .select("*")
      .eq("guild_id", data.guildId)
      .maybeSingle();
    if (!streakRow) {
      await supabaseAdmin
        .from("server_login_streaks")
        .insert({ guild_id: data.guildId, last_login_date: today, streak_days: 1 });
    } else if ((streakRow as Record<string, unknown>)["last_login_date"] !== today) {
      const nextStreak =
        (streakRow as Record<string, unknown>)["last_login_date"] === yesterday
          ? Number((streakRow as Record<string, unknown>)["streak_days"] ?? 0) + 1
          : 1;
      await supabaseAdmin
        .from("server_login_streaks")
        .update({ last_login_date: today, streak_days: nextStreak })
        .eq("guild_id", data.guildId);
    }

    const { data: plans } = await supabaseAdmin
      .from("plans")
      .select("*, plan_tasks(*)")
      .eq("enabled", true)
      .order("sort_order", { ascending: true });

    const { data: unlocks } = await supabaseAdmin
      .from("server_plan_unlocks")
      .select("plan_id")
      .eq("guild_id", data.guildId);
    const unlockedIds = new Set(
      (unlocks ?? []).map((u) => (u as Record<string, unknown>)["plan_id"] as string),
    );

    const result = [];
    for (const plan of plans ?? []) {
      const planRow = plan as Record<string, unknown>;
      const tasks = ((planRow["plan_tasks"] as unknown[]) ?? []).sort(
        (a, b) =>
          Number((a as Record<string, unknown>)["sort_order"] ?? 0) -
          Number((b as Record<string, unknown>)["sort_order"] ?? 0),
      ) as Array<Record<string, unknown>>;

      const withProgress = [];
      let allDone = tasks.length > 0;
      for (const task of tasks) {
        const { progress, completed } = await computeTaskProgress(supabaseAdmin, data.guildId, {
          id: task["id"] as string,
          task_type: task["task_type"] as string,
          target_value: Number(task["target_value"]),
        });
        withProgress.push({ ...task, progress, completed });
        if (!completed) allDone = false;
      }

      let unlocked = unlockedIds.has(planRow["id"] as string);
      if (allDone && !unlocked) {
        await supabaseAdmin
          .from("server_plan_unlocks")
          .upsert(
            { guild_id: data.guildId, plan_id: planRow["id"] },
            { onConflict: "guild_id,plan_id" },
          );
        unlocked = true;
      }

      result.push({ ...planRow, plan_tasks: withProgress, unlocked });
    }
    return result;
  });

export const setCustomTaskProgress = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ guildId: snowflake, taskId: z.string().uuid(), completed: z.boolean() })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { sessionFromHeader, assertGuildAccess } = await import("@/lib/discord.server");
    const session = await sessionFromHeader(cookie());
    if (!session) throw new Error("Please sign in with Discord.");
    await assertGuildAccess(session, data.guildId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: task } = await supabaseAdmin
      .from("plan_tasks")
      .select("id, task_type, target_value")
      .eq("id", data.taskId)
      .maybeSingle();
    if (!task) throw new Error("That task no longer exists.");
    if ((task as Record<string, unknown>)["task_type"] !== "custom") {
      throw new Error("Only custom tasks can be marked complete by hand.");
    }

    await supabaseAdmin.from("server_task_progress").upsert(
      {
        guild_id: data.guildId,
        task_id: data.taskId,
        progress_value: data.completed
          ? Number((task as Record<string, unknown>)["target_value"])
          : 0,
        completed: data.completed,
        completed_at: data.completed ? new Date().toISOString() : null,
      },
      { onConflict: "guild_id,task_id" },
    );
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Public — plan catalogue for the marketing "See plans" page          */
/* ------------------------------------------------------------------ */

export const listPublicPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("plans")
    .select("id, key, name, description, features, plan_tasks(id, title, description, task_type, target_value, sort_order)")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((plan) => ({
    ...plan,
    plan_tasks: ((plan as Record<string, unknown>)["plan_tasks"] as unknown[] ?? []).sort(
      (a, b) =>
        Number((a as Record<string, unknown>)["sort_order"] ?? 0) -
        Number((b as Record<string, unknown>)["sort_order"] ?? 0),
    ),
  }));
});
