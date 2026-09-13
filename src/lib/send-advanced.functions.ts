import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{5,25}$/);
const url = z.string().url().max(512);
const button = z.object({
  label: z.string().min(1).max(80),
  url,
  emoji: z.string().max(8).optional(),
  purpose: z.string().max(200).optional(),
});
const field = z.object({ name: z.string().max(256), value: z.string().max(1024), inline: z.boolean().optional() });
const embed = z.object({
  title: z.string().max(256).optional(), description: z.string().max(4000).optional(), url: z.string().url().max(512).optional(), color: z.string().max(7).optional(),
  authorName: z.string().max(256).optional(), authorUrl: z.string().url().max(512).optional(), authorIconUrl: z.string().url().max(512).optional(),
  footerText: z.string().max(2048).optional(), footerIconUrl: z.string().url().max(512).optional(), imageUrl: z.string().url().max(512).optional(), thumbnailUrl: z.string().url().max(512).optional(), timestamp: z.boolean().optional(),
  fields: z.array(field).max(25).optional(), buttons: z.array(button).max(5).optional(),
});
export type SendEmbed = z.infer<typeof embed>;

export const sendAdvancedMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ guildId: snowflake, channelId: snowflake, content: z.string().max(2000).optional(), mentionRoleId: snowflake.optional(), mentionEveryone: z.boolean().optional(), embed: embed.optional() }).parse(data))
  .handler(async ({ data }) => {
    const { sessionFromHeader, assertGuildAccess } = await import("@/lib/discord.server");
    const session = await sessionFromHeader(getRequestHeader("cookie") ?? null);
    if (!session) throw new Error("Please sign in with Discord.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertGuildAccess(session, data.guildId);
    const hasEmbed = Boolean(data.embed && (data.embed.title || data.embed.description || data.embed.imageUrl || data.embed.thumbnailUrl || data.embed.fields?.length));
    if (!data.content && !hasEmbed) throw new Error("Add a message or fill in the embed before sending.");
    const payload = { channel_id: data.channelId, content: data.content ?? "", mention_role_id: data.mentionRoleId ?? null, mention_everyone: Boolean(data.mentionEveryone), embed: data.embed ? {
      title: data.embed.title ?? null, description: data.embed.description ?? null, url: data.embed.url ?? null, color: data.embed.color ?? null,
      author_name: data.embed.authorName ?? null, author_url: data.embed.authorUrl ?? null, author_icon_url: data.embed.authorIconUrl ?? null,
      footer_text: data.embed.footerText ?? null, footer_icon_url: data.embed.footerIconUrl ?? null, image_url: data.embed.imageUrl ?? null, thumbnail_url: data.embed.thumbnailUrl ?? null, timestamp: Boolean(data.embed.timestamp), fields: data.embed.fields ?? [],
      buttons: (data.embed.buttons ?? []).map((b) => ({ label: b.label.trim(), url: b.url, emoji: b.emoji?.trim() || null, purpose: b.purpose?.trim() || null })),
    } : null };
    const { error } = await supabaseAdmin.from("bot_action_queue").insert({ guild_id: data.guildId, action: "send_message", payload, requested_by: session.userId, status: "pending" });
    if (error) throw new Error(`Could not queue that message: ${error.message}`);
    return { ok: true };
  });
