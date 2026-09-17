import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
const input = z.object({ guildId: z.string().regex(/^\d{5,25}$/) });
const values = z.object({
  xp_card_enabled: z.boolean().optional(), xp_card_style: z.enum(["glassmorphism", "gold", "minimal"]).optional(), xp_card_show_progress: z.boolean().optional(), xp_card_show_rank: z.boolean().optional(), xp_card_show_stats: z.boolean().optional(), xp_card_show_total_xp: z.boolean().optional(),
  level_up_card_enabled: z.boolean().optional(), level_up_card_style: z.enum(["glassmorphism", "gold", "minimal"]).optional(), level_up_card_show_progress: z.boolean().optional(), level_up_card_show_rank: z.boolean().optional(),
  welcome_card_style: z.enum(["glassmorphism", "gold", "minimal"]).optional(), profile_card_style: z.enum(["glassmorphism", "gold", "minimal"]).optional(),
});
async function authorize(guildId: string) {
  const { sessionFromHeader, assertGuildAccess } = await import("@/lib/discord.server"); const session = await sessionFromHeader(getRequestHeader("cookie") ?? null); if (!session) throw new Error("Please sign in with Discord.");
  const { isBanned } = await import("@/lib/admin.server"); if ((await isBanned(session.userId)).banned) throw new Error("Access revoked.");
  const guild = await assertGuildAccess(session, guildId); const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); return { session, guild, supabaseAdmin };
}
export const getCardSettings = createServerFn({ method: "GET" }).inputValidator((d: unknown) => input.parse(d)).handler(async ({ data }) => {
  const { supabaseAdmin } = await authorize(data.guildId); const { data: row } = await supabaseAdmin.from("server_settings").select("xp_card_enabled,xp_card_style,xp_card_show_progress,xp_card_show_rank,xp_card_show_stats,xp_card_show_total_xp,level_up_card_enabled,level_up_card_style,level_up_card_show_progress,level_up_card_show_rank,welcome_card_style,profile_card_style").eq("guild_id", data.guildId).maybeSingle();
  return row ?? { xp_card_enabled: true, xp_card_style: "glassmorphism", xp_card_show_progress: true, xp_card_show_rank: true, xp_card_show_stats: true, xp_card_show_total_xp: true, level_up_card_enabled: true, level_up_card_style: "glassmorphism", level_up_card_show_progress: true, level_up_card_show_rank: true, welcome_card_style: "glassmorphism", profile_card_style: "glassmorphism" };
});
export const saveCardSettings = createServerFn({ method: "POST" }).inputValidator((d: unknown) => z.object({ guildId: input.shape.guildId, values }).parse(d)).handler(async ({ data }) => {
  const { session, supabaseAdmin } = await authorize(data.guildId); const { error } = await supabaseAdmin.from("server_settings").upsert({ guild_id: data.guildId, ...data.values }, { onConflict: "guild_id" }); if (error) throw new Error("Could not save card settings.");
  await supabaseAdmin.from("dashboard_access_log").insert({ discord_user_id: session.userId, discord_username: session.username, guild_id: data.guildId, action: "update:card-styles" }); return { ok: true };
});
