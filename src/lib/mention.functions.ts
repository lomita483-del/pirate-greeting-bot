import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const input = z.object({
  guildId: z.string().regex(/^\d{5,25}$/),
  mention_enabled: z.boolean(),
  mention_response_mode: z.enum(["reply", "channel"]),
  mention_response: z.string().min(1).max(1000),
  mention_cooldown_seconds: z.number().int().min(0).max(3600),
});

async function authorize(guildId: string) {
  const { sessionFromHeader, assertGuildAccess } = await import("@/lib/discord.server");
  const session = await sessionFromHeader(getRequestHeader("cookie") ?? null);
  if (!session) throw new Error("Please sign in with Discord.");
  const { isBanned } = await import("@/lib/admin.server");
  if ((await isBanned(session.userId)).banned) throw new Error("Your access to the control center has been revoked.");
  const guild = await assertGuildAccess(session, guildId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { guild, supabaseAdmin };
}

export const saveMentionSettings = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }) => {
    const { guild, supabaseAdmin } = await authorize(data.guildId);
    const { error } = await supabaseAdmin.from("server_settings").upsert(
      {
        guild_id: guild.id,
        mention_enabled: data.mention_enabled,
        mention_response_mode: data.mention_response_mode,
        mention_response: data.mention_response,
        mention_cooldown_seconds: data.mention_cooldown_seconds,
      },
      { onConflict: "guild_id" },
    );
    if (error) throw new Error("Could not save bot mention settings.");
    return { ok: true };
  });
