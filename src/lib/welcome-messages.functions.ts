import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const embedField = z.object({
  name: z.string().max(256),
  value: z.string().max(1024),
  inline: z.boolean().optional(),
});

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().url().optional(),
);

const embedShape = z.object({
  title: z.string().max(256).optional(),
  description: z.string().max(4000).optional(),
  url: optionalUrl,
  color: z.string().max(7).optional(),
  authorName: z.string().max(256).optional(),
  authorUrl: optionalUrl,
  authorIconUrl: optionalUrl,
  footerText: z.string().max(2048).optional(),
  footerIconUrl: optionalUrl,
  imageUrl: optionalUrl,
  thumbnailUrl: optionalUrl,
  useMemberAvatarAsThumbnail: z.boolean().optional(),
  timestamp: z.boolean().optional(),
  fields: z.array(embedField).max(25).optional(),
});

export type WelcomeEmbedShape = z.infer<typeof embedShape>;

export type WelcomeMessage = {
  id: string;
  position: number;
  content: string;
  embed: WelcomeEmbedShape | null;
  enabled: boolean;
  useEmbed: boolean;
  attachDynamicImage: boolean;
};

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
  const looseAdmin = supabaseAdmin as unknown as {
    from: (table: string) => any;
    rpc: (fn: string, args?: any) => any;
  };
  return { session, guild, supabaseAdmin: looseAdmin };
}

function rowToMessage(row: unknown): WelcomeMessage {
  const r = row as Record<string, unknown>;
  return {
    id: r["id"] as string,
    position: Number(r["position"] ?? 0),
    content: (r["content"] as string) ?? "",
    embed: (r["embed"] as WelcomeEmbedShape | null) ?? null,
    enabled: r["enabled"] !== false,
    useEmbed: r["use_embed"] !== false,
    attachDynamicImage: r["attach_dynamic_image"] === true,
  };
}

export const listWelcomeMessages = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ guildId: z.string().regex(/^\d{5,25}$/) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { data: rows } = await supabaseAdmin
      .from("welcome_messages")
      .select("*")
      .eq("guild_id", data.guildId)
      .order("position");
    return ((rows ?? []) as unknown[]).map(rowToMessage);
  });

export const saveWelcomeMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
        id: z.string().uuid().optional(),
        position: z.number().int().min(0).max(2),
        content: z.string().max(2000).optional(),
        embed: embedShape.optional(),
        enabled: z.boolean().default(true),
        useEmbed: z.boolean().default(true),
        attachDynamicImage: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);

    if (!data.id) {
      const { count } = await supabaseAdmin
        .from("welcome_messages")
        .select("id", { count: "exact", head: true })
        .eq("guild_id", data.guildId);
      if ((count ?? 0) >= 3) throw new Error("You can have at most 3 welcome messages.");
    }

    const payload = {
      guild_id: data.guildId,
      position: data.position,
      content: data.content ?? "",
      embed: data.embed ?? null,
      enabled: data.enabled,
      use_embed: data.useEmbed,
      attach_dynamic_image: data.attachDynamicImage,
      updated_at: new Date().toISOString(),
    };

    const { data: row, error } = data.id
      ? await supabaseAdmin
          .from("welcome_messages")
          .update(payload)
          .eq("id", data.id)
          .eq("guild_id", data.guildId)
          .select("*")
          .maybeSingle()
      : await supabaseAdmin.from("welcome_messages").insert(payload).select("*").maybeSingle();

    if (error || !row) {
      console.error("Welcome message save failed", error);
      throw new Error(`Could not save that message${error?.message ? `: ${error.message}` : "."}`);
    }
    return rowToMessage(row);
  });

export const deleteWelcomeMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ guildId: z.string().regex(/^\d{5,25}$/), id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    await supabaseAdmin
      .from("welcome_messages")
      .delete()
      .eq("id", data.id)
      .eq("guild_id", data.guildId);
    return { ok: true };
  });
