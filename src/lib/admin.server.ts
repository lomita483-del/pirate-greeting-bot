/**
 * Server-only platform-owner authorization.
 *
 * Owner identity is bootstrapped from the OWNER_DISCORD_IDS env var
 * (comma separated Discord user ids). Those ids are always super-owners and
 * can never be demoted from the UI. Additional staff live in `platform_admins`.
 */

import { sessionFromHeader, type AhoySession } from "@/lib/discord.server";

export type AdminRole = "owner" | "admin";

export function bootstrapOwnerIds(): string[] {
  return (process.env["OWNER_DISCORD_IDS"] ?? "")
    .split(/[,\s]+/)
    .map((v) => v.trim())
    .filter((v) => /^\d{5,25}$/.test(v));
}

export async function adminRoleFor(userId: string): Promise<AdminRole | null> {
  if (bootstrapOwnerIds().includes(userId)) return "owner";
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("platform_admins")
    .select("role")
    .eq("discord_user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return data.role === "owner" ? "owner" : "admin";
}

/** Throws unless the caller is a platform admin/owner. */
export async function requireAdmin(cookieHeader: string | null): Promise<{
  session: AhoySession;
  role: AdminRole;
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
}> {
  const session = await sessionFromHeader(cookieHeader);
  if (!session) throw new Error("Please sign in with Discord.");
  const role = await adminRoleFor(session.userId);
  if (!role) throw new Error("You do not have access to the owner panel.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { session, role, supabaseAdmin };
}

export function requireOwner(role: AdminRole) {
  if (role !== "owner") throw new Error("Only the platform owner can do that.");
}

/** True when the account is banned from the website. */
export async function isBanned(userId: string): Promise<{ banned: boolean; reason: string | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("platform_users")
    .select("banned, ban_reason")
    .eq("discord_user_id", userId)
    .maybeSingle();
  return { banned: Boolean(data?.banned), reason: data?.ban_reason ?? null };
}

/** Records a dashboard sign-in and returns the ban state. */
export async function recordSignIn(user: {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}): Promise<{ banned: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin
    .from("platform_users")
    .select("login_count, banned")
    .eq("discord_user_id", user.id)
    .maybeSingle();

  await supabaseAdmin.from("platform_users").upsert(
    {
      discord_user_id: user.id,
      username: user.username,
      global_name: user.global_name,
      avatar: user.avatar,
      last_seen_at: new Date().toISOString(),
      login_count: (existing?.login_count ?? 0) + 1,
    },
    { onConflict: "discord_user_id" },
  );

  await supabaseAdmin.from("dashboard_access_log").insert({
    discord_user_id: user.id,
    discord_username: user.username,
    action: "signin",
  });

  return { banned: Boolean(existing?.banned) };
}
