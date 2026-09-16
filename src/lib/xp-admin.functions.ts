import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const input = z.object({
  guildId: z.string().regex(/^\d{5,25}$/),
  userId: z.string().regex(/^\d{5,25}$/),
  amount: z.number().int().min(0).max(10_000_000),
  action: z.enum(["give", "remove", "set"]),
  reason: z.string().trim().max(500).optional(),
});

function levelForXp(xp: number) {
  let level = 0;
  while (5 * ((level + 1) ** 2) + 50 * (level + 1) + 100 <= xp) level += 1;
  return level;
}

export const adminAdjustXp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }) => {
    const { sessionFromHeader, assertGuildAccess } = await import("@/lib/discord.server");
    const session = await sessionFromHeader(getRequestHeader("cookie") ?? null);
    if (!session) throw new Error("Please sign in with Discord.");

    const guild = await assertGuildAccess(session, data.guildId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: readError } = await supabaseAdmin
      .from("xp_profiles")
      .select("id,guild_id,user_id,username,xp,level,messages")
      .eq("guild_id", guild.id)
      .eq("user_id", data.userId)
      .maybeSingle();
    if (readError) throw new Error(`Could not read XP profile: ${readError.message}`);

    const oldXp = Number(existing?.xp ?? 0);
    const newXp = data.action === "set" ? data.amount : data.action === "give" ? oldXp + data.amount : Math.max(0, oldXp - data.amount);
    const newLevel = levelForXp(newXp);

    const payload = {
      guild_id: guild.id,
      user_id: data.userId,
      username: existing?.username ?? null,
      xp: newXp,
      level: newLevel,
      messages: Number(existing?.messages ?? 0),
    };

    const { error: writeError } = await supabaseAdmin
      .from("xp_profiles")
      .upsert(payload, { onConflict: "guild_id,user_id" });
    if (writeError) throw new Error(`Could not update XP: ${writeError.message}`);

    try {
      await supabaseAdmin.from("xp_admin_audit").insert({
        guild_id: guild.id,
        target_user_id: data.userId,
        actor_user_id: session.userId,
        action: data.action,
        amount: data.amount,
        old_xp: oldXp,
        new_xp: newXp,
        old_level: Number(existing?.level ?? 0),
        new_level: newLevel,
        reason: data.reason ?? null,
      });
    } catch (error) {
      console.error("Failed to write XP admin audit", error);
    }

    return { ok: true as const, oldXp, newXp, oldLevel: Number(existing?.level ?? 0), newLevel };
  });
