import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const cookie = () => getRequestHeader("cookie") ?? null;

async function session() {
  const { sessionFromHeader } = await import("@/lib/discord.server");
  const value = await sessionFromHeader(cookie());
  if (!value) throw new Error("Please sign in with Discord.");
  return value;
}

export const createSupportReport = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ subject: z.string().min(3).max(160), category: z.enum(["bug","feature","complaint","account","general"]), message: z.string().min(5).max(5000), priority: z.enum(["low","normal","high","urgent"]).default("normal") }).parse(data))
  .handler(async ({ data }) => {
    const user = await session();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin.from("platform_users").select("username,global_name").eq("discord_user_id", user.userId).maybeSingle();
    const { data: row, error } = await supabaseAdmin.from("user_support_reports").insert({ user_id: user.userId, username: profile?.username ?? user.username, display_name: profile?.global_name ?? user.username, subject: data.subject, category: data.category, message: data.message, priority: data.priority }).select("*").single();
    if (error) throw new Error("Could not send your support report.");
    return row;
  });

export const getMySupportReports = createServerFn({ method: "GET" }).handler(async () => {
  const user = await session();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("user_support_reports").select("*").eq("user_id", user.userId).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error("Could not load your support history.");
  return data ?? [];
});

export const getAllSupportReports = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/lib/admin.server");
  const { supabaseAdmin } = await requireAdmin(cookie());
  const { data, error } = await supabaseAdmin.from("user_support_reports").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error("Could not load user reports.");
  return data ?? [];
});

export const replyToSupportReport = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), reply: z.string().min(1).max(5000), status: z.enum(["open","in_progress","resolved","closed"]).default("in_progress") }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { supabaseAdmin } = await requireAdmin(cookie());
    const admin = await session();
    const { error } = await supabaseAdmin.from("user_support_reports").update({ admin_reply: data.reply, replied_by: admin.userId, replied_at: new Date().toISOString(), status: data.status }).eq("id", data.id);
    if (error) throw new Error("Could not send the reply.");
    return { ok: true };
  });

export const updateSupportStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["open","in_progress","resolved","closed"]) }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { supabaseAdmin } = await requireAdmin(cookie());
    const { error } = await supabaseAdmin.from("user_support_reports").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error("Could not update the report.");
    return { ok: true };
  });