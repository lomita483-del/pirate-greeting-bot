import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

async function authorize(guildId: string) {
  const { sessionFromHeader, assertGuildAccess } = await import("@/lib/discord.server");
  const session = await sessionFromHeader(getRequestHeader("cookie") ?? null);
  if (!session) throw new Error("Please sign in with Discord.");
  const { isBanned } = await import("@/lib/admin.server");
  if ((await isBanned(session.userId)).banned) {
    throw new Error("Your access to the !PIRATE control center has been revoked.");
  }
  const guild = await assertGuildAccess(session, guildId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { session, guild, supabaseAdmin };
}

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
  timestamp: z.boolean().optional(),
  fields: z.array(embedField).max(25).optional(),
});

export type EmbedShape = z.infer<typeof embedShape>;

export type EmbedTemplate = EmbedShape & { id: string; name: string };

/* ---------------------------------------------------------------- */
/* Templates                                                         */
/* ---------------------------------------------------------------- */

export const listEmbedTemplates = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ guildId: z.string().regex(/^\d{5,25}$/) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { data: rows } = await supabaseAdmin
      .from("embed_templates")
      .select("*")
      .eq("guild_id", data.guildId)
      .order("name");
    return (rows ?? []).map(rowToTemplate);
  });

export const saveEmbedTemplate = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
        name: z.string().min(1).max(80),
        embed: embedShape,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, session } = await authorize(data.guildId);
    const { data: row, error } = await supabaseAdmin
      .from("embed_templates")
      .upsert(
        {
          guild_id: data.guildId,
          name: data.name,
          ...templateToRow(data.embed),
          created_by: session.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "guild_id,name" },
      )
      .select("*")
      .maybeSingle();
    if (error || !row) {
      console.error("Embed template save failed", error);
      throw new Error(`Could not save that template${error?.message ? `: ${error.message}` : "."}`);
    }
    return rowToTemplate(row);
  });

export const deleteEmbedTemplate = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ guildId: z.string().regex(/^\d{5,25}$/), id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    await supabaseAdmin
      .from("embed_templates")
      .delete()
      .eq("id", data.id)
      .eq("guild_id", data.guildId);
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* Ticket panel                                                       */
/* ---------------------------------------------------------------- */

const ticketFormQuestion = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(45),
  placeholder: z.string().max(100).optional(),
  required: z.boolean().default(true),
  style: z.enum(["short", "paragraph"]).default("short"),
});

const ticketPanelButton = z.object({
  label: z.string().min(1).max(80),

  description: z
    .string()
    .max(200)
    .optional(),

  emoji: z
    .string()
    .max(8)
    .optional(),

  style: z
    .enum([
      "primary",
      "secondary",
      "success",
      "danger",
    ])
    .default("primary"),

  /*
   * Discord category ID.
   */
  categoryId: z
    .string()
    .regex(/^\d{5,25}$/)
    .nullable()
    .optional(),

  /*
   * Internal ticket category.
   */
  category: z
    .string()
    .max(80)
    .optional(),

  /*
   * Roles that can work on tickets opened by this button.
   */
  supportRoleIds: z
    .array(z.string().regex(/^\d{5,25}$/))
    .max(25)
    .default([]),

  /*
   * Roles allowed to use this button.
   */
  accessRoleIds: z
    .array(z.string().regex(/^\d{5,25}$/))
    .max(25)
    .default([]),

  /*
   * Permission required to open.
   *
   * everyone
   * manage_channels
   * manage_guild
   * administrator
   */
  requiredPermission: z
    .enum([
      "everyone",
      "manage_channels",
      "manage_guild",
      "administrator",
    ])
    .default("everyone"),

  /*
   * Questions displayed in the Discord modal.
   */
  formQuestions: z
    .array(ticketFormQuestion)
    .max(5)
    .default([]),

  /*
   * Whether messages should be transcripted.
   */
  transcriptEnabled: z
    .boolean()
    .default(true),

  /*
   * Optional button-specific transcript channel.
   * Falls back to global setting when null.
   */
  transcriptChannelId: z
    .string()
    .regex(/^\d{5,25}$/)
    .nullable()
    .optional(),

  /*
   * Send transcript to ticket owner's DM.
   */
  dmTranscriptEnabled: z
    .boolean()
    .default(false),
});

export const postTicketPanel = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z
          .string()
          .regex(/^\d{5,25}$/),

        channelId: z
          .string()
          .regex(/^\d{5,25}$/),

        title: z
          .string()
          .max(256)
          .optional(),

        description: z
          .string()
          .max(2000)
          .optional(),

        /*
         * Global transcript destination.
         */
        transcriptChannelId: z
          .string()
          .regex(/^\d{5,25}$/)
          .nullable()
          .optional(),

        /*
         * Global DM transcript behaviour.
         */
        dmTranscriptEnabled: z
          .boolean()
          .default(false),

        buttons: z
          .array(ticketPanelButton)
          .min(1)
          .max(20),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, session } =
      await authorize(data.guildId);

    /*
     * Save global ticket transcript settings.
     */
    const { error: settingsError } =
      await supabaseAdmin
        .from("server_settings")
        .update({
          ticket_transcript_channel_id:
            data.transcriptChannelId ?? null,

          ticket_dm_transcript_enabled:
            Boolean(data.dmTranscriptEnabled),

          updated_at:
            new Date().toISOString(),
        })
        .eq("guild_id", data.guildId);

    if (settingsError) {
      console.error(
        "Ticket transcript settings update failed",
        settingsError,
      );

      throw new Error(
        "Could not save ticket transcript settings.",
      );
    }

    /*
     * Queue the actual Discord panel creation.
     *
     * The Python bot will create the persistent panel/button
     * records before posting the Discord message.
     */
    const { error } =
      await supabaseAdmin
        .from("bot_action_queue")
        .insert({
          guild_id: data.guildId,

          action: "ticket_panel",

          payload: {
            channel_id: data.channelId,

            title:
              data.title ?? null,

            description:
              data.description ?? null,

            transcript_channel_id:
              data.transcriptChannelId ?? null,

            dm_transcript_enabled:
              Boolean(data.dmTranscriptEnabled),

            buttons: data.buttons.map(
              (button) => ({
                label: button.label.trim(),

                description:
                  button.description?.trim() ||
                  null,

                emoji:
                  button.emoji?.trim() ||
                  null,

                style:
                  button.style,

                category_id:
                  button.categoryId ??
                  null,

                category:
                  button.category ??
                  null,

                support_role_ids:
                  button.supportRoleIds ?? [],

                access_role_ids:
                  button.accessRoleIds ?? [],

                required_permission:
                  button.requiredPermission ??
                  "everyone",

                form_questions:
                  button.formQuestions ?? [],

                transcript_enabled:
                  button.transcriptEnabled,

                transcript_channel_id:
                  button.transcriptChannelId ??
                  null,

                dm_transcript_enabled:
                  button.dmTranscriptEnabled,
              }),
            ),
          },

          requested_by:
            session.userId,

          status:
            "pending",
        });

    if (error) {
      console.error(
        "Ticket panel queue insert failed",
        error,
      );

      throw new Error(
        `Could not queue the ticket panel${
          error.message
            ? `: ${error.message}`
            : "."
        }`,
      );
    }

    return {
      ok: true,
    };
  });

/* ---------------------------------------------------------------- */
/* Send                                                               */
/* ---------------------------------------------------------------- */

export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
        channelId: z.string().regex(/^\d{5,25}$/),
        content: z.string().max(2000).optional(),
        mentionRoleId: z
          .string()
          .regex(/^\d{5,25}$/)
          .optional(),
        mentionEveryone: z.boolean().optional(),
        embed: embedShape.optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, session } = await authorize(data.guildId);

    const hasEmbedContent =
      data.embed &&
      (data.embed.title ||
        data.embed.description ||
        (data.embed.fields && data.embed.fields.length > 0) ||
        data.embed.imageUrl);
    if (!data.content && !hasEmbedContent) {
      throw new Error("Add a message or fill in the embed before sending.");
    }

    const { error } = await supabaseAdmin.from("bot_action_queue").insert({
      guild_id: data.guildId,
      action: "send_message",
      payload: {
        channel_id: data.channelId,
        content: data.content ?? "",
        mention_role_id: data.mentionRoleId ?? null,
        mention_everyone: Boolean(data.mentionEveryone),
        embed: data.embed ? templateToPayload(data.embed) : null,
      },
      requested_by: session.userId,
      status: "pending",
    });
    if (error) {
      console.error("Message queue insert failed", error);
      throw new Error(`Could not queue that message${error.message ? `: ${error.message}` : "."}`);
    }
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* helpers                                                            */
/* ---------------------------------------------------------------- */

function templateToRow(embed: EmbedShape) {
  return {
    title: embed.title || null,
    description: embed.description || null,
    url: embed.url || null,
    color: embed.color || null,
    author_name: embed.authorName || null,
    author_url: embed.authorUrl || null,
    author_icon_url: embed.authorIconUrl || null,
    footer_text: embed.footerText || null,
    footer_icon_url: embed.footerIconUrl || null,
    image_url: embed.imageUrl || null,
    thumbnail_url: embed.thumbnailUrl || null,
    fields: embed.fields ?? [],
    timestamp: Boolean(embed.timestamp),
  };
}

function templateToPayload(embed: EmbedShape) {
  const row = templateToRow(embed);
  return {
    title: row.title,
    description: row.description,
    url: row.url,
    color: row.color,
    author_name: row.author_name,
    author_url: row.author_url,
    author_icon_url: row.author_icon_url,
    footer_text: row.footer_text,
    footer_icon_url: row.footer_icon_url,
    image_url: row.image_url,
    thumbnail_url: row.thumbnail_url,
    fields: row.fields,
    timestamp: row.timestamp,
  };
}

function rowToTemplate(row: unknown): EmbedTemplate {
  const r = row as Record<string, unknown>;
  return {
    id: r["id"] as string,
    name: r["name"] as string,
    title: (r["title"] as string) || undefined,
    description: (r["description"] as string) || undefined,
    url: (r["url"] as string) || undefined,
    color: (r["color"] as string) || undefined,
    authorName: (r["author_name"] as string) || undefined,
    authorUrl: (r["author_url"] as string) || undefined,
    authorIconUrl: (r["author_icon_url"] as string) || undefined,
    footerText: (r["footer_text"] as string) || undefined,
    footerIconUrl: (r["footer_icon_url"] as string) || undefined,
    imageUrl: (r["image_url"] as string) || undefined,
    thumbnailUrl: (r["thumbnail_url"] as string) || undefined,
    timestamp: Boolean(r["timestamp"]),
    fields: (r["fields"] as EmbedShape["fields"]) ?? [],
  };
}
