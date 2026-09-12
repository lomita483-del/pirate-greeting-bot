import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

async function authorize(guildId: string) {
  const { sessionFromHeader, assertGuildAccess } = await import(
    "@/lib/discord.server"
  );

  const session = await sessionFromHeader(
    getRequestHeader("cookie") ?? null,
  );

  if (!session) {
    throw new Error("Please sign in with Discord.");
  }

  const { isBanned } = await import("@/lib/admin.server");

  if ((await isBanned(session.userId)).banned) {
    throw new Error(
      "Your access to the !PIRATE control center has been revoked.",
    );
  }

  const guild = await assertGuildAccess(session, guildId);

  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );

  return {
    session,
    guild,
    supabaseAdmin,
  };
}

/* ---------------------------------------------------------------- */
/* Embed templates                                                   */
/* ---------------------------------------------------------------- */

const embedField = z.object({
  name: z.string().max(256),
  value: z.string().max(1024),
  inline: z.boolean().optional(),
});

const optionalUrl = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === ""
      ? undefined
      : value,
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

export type EmbedTemplate = EmbedShape & {
  id: string;
  name: string;
};

/* ---------------------------------------------------------------- */
/* Embed template operations                                         */
/* ---------------------------------------------------------------- */

export const listEmbedTemplates = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
      })
      .parse(data),
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

export const saveEmbedTemplate = createServerFn({
  method: "POST",
})
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
    const { supabaseAdmin, session } = await authorize(
      data.guildId,
    );

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
        {
          onConflict: "guild_id,name",
        },
      )
      .select("*")
      .maybeSingle();

    if (error || !row) {
      console.error(
        "Embed template save failed",
        error,
      );

      throw new Error(
        `Could not save that template${
          error?.message
            ? `: ${error.message}`
            : "."
        }`,
      );
    }

    return rowToTemplate(row);
  });

export const deleteEmbedTemplate = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: z.string().regex(/^\d{5,25}$/),
        id: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(
      data.guildId,
    );

    await supabaseAdmin
      .from("embed_templates")
      .delete()
      .eq("id", data.id)
      .eq("guild_id", data.guildId);

    return {
      ok: true,
    };
  });

/* ---------------------------------------------------------------- */
/* Ticket panel                                                      */
/*                                                                    */
/* There is exactly one transcript configuration for a server — the  */
/* "Global transcript settings" in the Tickets card — used by every   */
/* button and the legacy /ticket command alike. Buttons no longer     */
/* carry their own transcript override, and no longer carry their own */
/* embed description; the panel's single description (below) is the  */
/* only description ever shown.                                       */
/* ---------------------------------------------------------------- */

const snowflake = z
  .string()
  .regex(/^\d{5,25}$/);

const ticketFormQuestion = z.object({
  id: z.string().min(1).max(80),

  label: z.string().min(1).max(45),

  placeholder: z
    .string()
    .max(100)
    .optional(),

  required: z
    .boolean()
    .default(true),

  style: z
    .enum(["short", "paragraph"])
    .default("short"),
});

const ticketPanelButton = z.object({
  label: z
    .string()
    .min(1)
    .max(80),

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
   * Exact Discord category ID where this button's
   * tickets must be created. Always overrides the
   * server's default ticket category for this button.
   */
  categoryId: snowflake
    .nullable()
    .optional(),

  /*
   * Internal ticket type/category name.
   */
  category: z
    .string()
    .max(80)
    .optional(),

  /*
   * Staff/support roles that can access the ticket.
   */
  supportRoleIds: z
    .array(snowflake)
    .max(25)
    .default([]),

  /*
   * Roles allowed to click this particular button.
   */
  accessRoleIds: z
    .array(snowflake)
    .max(25)
    .default([]),

  /*
   * Discord permission required to use this button.
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
   * Discord modal questions.
   * Discord allows a maximum of five text inputs.
   */
  formQuestions: z
    .array(ticketFormQuestion)
    .max(5)
    .default([]),
});

const ticketPanelPayload = z.object({
  guildId: snowflake,

  channelId: snowflake,

  title: z
    .string()
    .max(256)
    .optional(),

  description: z
    .string()
    .max(2000)
    .optional(),

  /*
   * Global transcript destination — the only one there is.
   */
  transcriptChannelId: snowflake
    .nullable()
    .optional(),

  /*
   * Global DM-transcript setting — the only one there is.
   */
  dmTranscriptEnabled: z
    .boolean()
    .default(false),

  buttons: z
    .array(ticketPanelButton)
    .min(1)
    .max(20),
});

export const postTicketPanel = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    ticketPanelPayload.parse(data),
  )
  .handler(async ({ data }) => {
    const {
      supabaseAdmin,
      session,
    } = await authorize(data.guildId);

    /*
     * Save the one and only transcript configuration
     * for this server.
     */
    const {
      error: settingsError,
    } = await supabaseAdmin
      .from("server_settings")
      .update({
        ticket_transcript_channel_id:
          data.transcriptChannelId ?? null,

        ticket_dm_transcript_enabled:
          Boolean(
            data.dmTranscriptEnabled,
          ),

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
     * IMPORTANT:
     *
     * Do not reduce this payload to a button index or
     * category slug.
     *
     * The Python bot needs the complete configuration
     * for every button so that it can:
     *
     * 1. create the ticket in the exact selected category
     * 2. apply the selected support roles
     * 3. apply access-role restrictions
     * 4. enforce the required permission
     * 5. display the correct Discord modal
     * 6. save the submitted form answers
     * 7. send the support-role mention
     *
     * Transcript delivery (channel + DM) always uses the
     * server-wide settings saved just above — buttons no
     * longer carry their own transcript override.
     */
    const payload = {
      channel_id: data.channelId,

      title:
        data.title?.trim() || null,

      description:
        data.description?.trim() || null,

      transcript_channel_id:
        data.transcriptChannelId ?? null,

      dm_transcript_enabled:
        Boolean(
          data.dmTranscriptEnabled,
        ),

      buttons: data.buttons.map(
        (button, index) => ({
          /*
           * Stable position is useful to the Discord
           * button callback while the database ID is
           * generated by the bot.
           */
          position: index,

          label:
            button.label.trim(),

          emoji:
            button.emoji?.trim() ||
            null,

          style:
            button.style,

          /*
           * EXACT Discord category.
           */
          category_id:
            button.categoryId ??
            null,

          /*
           * Internal ticket category/type.
           */
          category:
            button.category?.trim() ||
            button.label.trim(),

          /*
           * Staff/support roles.
           */
          support_role_ids:
            Array.from(
              new Set(
                button.supportRoleIds ?? [],
              ),
            ).slice(0, 25),

          /*
           * Roles allowed to open this ticket type.
           */
          access_role_ids:
            Array.from(
              new Set(
                button.accessRoleIds ?? [],
              ),
            ).slice(0, 25),

          /*
           * Permission required to open.
           */
          required_permission:
            button.requiredPermission ??
            "everyone",

          /*
           * Modal questions.
           */
          form_questions:
            button.formQuestions.map(
              (question) => ({
                id: question.id,
                label:
                  question.label.trim(),
                placeholder:
                  question.placeholder
                    ?.trim() ||
                  null,
                required:
                  Boolean(
                    question.required,
                  ),
                style:
                  question.style,
              }),
            ),

          enabled: true,
        }),
      ),
    };

    /*
     * Queue the complete panel configuration.
     *
     * The Discord bot consumes this record and is
     * responsible for creating the actual Discord
     * message/buttons and persistent database records.
     */
    const { error } =
      await supabaseAdmin
        .from("bot_action_queue")
        .insert({
          guild_id:
            data.guildId,

          action:
            "ticket_panel",

          payload,

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
      buttonCount:
        data.buttons.length,
    };
  });

/* ---------------------------------------------------------------- */
/* Send message                                                      */
/* ---------------------------------------------------------------- */

export const sendMessage = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId: snowflake,

        channelId: snowflake,

        content: z
          .string()
          .max(2000)
          .optional(),

        mentionRoleId: snowflake.optional(),

        mentionEveryone:
          z.boolean().optional(),

        embed:
          embedShape.optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const {
      supabaseAdmin,
      session,
    } = await authorize(data.guildId);

    const hasEmbedContent =
      data.embed &&
      (
        data.embed.title ||
        data.embed.description ||
        (
          data.embed.fields &&
          data.embed.fields.length > 0
        ) ||
        data.embed.imageUrl
      );

    if (
      !data.content &&
      !hasEmbedContent
    ) {
      throw new Error(
        "Add a message or fill in the embed before sending.",
      );
    }

    const { error } =
      await supabaseAdmin
        .from("bot_action_queue")
        .insert({
          guild_id:
            data.guildId,

          action:
            "send_message",

          payload: {
            channel_id:
              data.channelId,

            content:
              data.content ?? "",

            mention_role_id:
              data.mentionRoleId ??
              null,

            mention_everyone:
              Boolean(
                data.mentionEveryone,
              ),

            embed:
              data.embed
                ? templateToPayload(
                    data.embed,
                  )
                : null,
          },

          requested_by:
            session.userId,

          status:
            "pending",
        });

    if (error) {
      console.error(
        "Message queue insert failed",
        error,
      );

      throw new Error(
        `Could not queue that message${
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
/* Helpers                                                           */
/* ---------------------------------------------------------------- */

function templateToRow(
  embed: EmbedShape,
) {
  return {
    title:
      embed.title ||
      null,

    description:
      embed.description ||
      null,

    url:
      embed.url ||
      null,

    color:
      embed.color ||
      null,

    author_name:
      embed.authorName ||
      null,

    author_url:
      embed.authorUrl ||
      null,

    author_icon_url:
      embed.authorIconUrl ||
      null,

    footer_text:
      embed.footerText ||
      null,

    footer_icon_url:
      embed.footerIconUrl ||
      null,

    image_url:
      embed.imageUrl ||
      null,

    thumbnail_url:
      embed.thumbnailUrl ||
      null,

    fields:
      embed.fields ??
      [],

    timestamp:
      Boolean(
        embed.timestamp,
      ),
  };
}

function templateToPayload(
  embed: EmbedShape,
) {
  const row =
    templateToRow(embed);

  return {
    title:
      row.title,

    description:
      row.description,

    url:
      row.url,

    color:
      row.color,

    author_name:
      row.author_name,

    author_url:
      row.author_url,

    author_icon_url:
      row.author_icon_url,

    footer_text:
      row.footer_text,

    footer_icon_url:
      row.footer_icon_url,

    image_url:
      row.image_url,

    thumbnail_url:
      row.thumbnail_url,

    fields:
      row.fields,

    timestamp:
      row.timestamp,
  };
}

function rowToTemplate(
  row: unknown,
): EmbedTemplate {
  const r =
    row as Record<
      string,
      unknown
    >;

  return {
    id:
      r["id"] as string,

    name:
      r["name"] as string,

    title:
      (r["title"] as string) ||
      undefined,

    description:
      (r["description"] as string) ||
      undefined,

    url:
      (r["url"] as string) ||
      undefined,

    color:
      (r["color"] as string) ||
      undefined,

    authorName:
      (r["author_name"] as string) ||
      undefined,

    authorUrl:
      (r["author_url"] as string) ||
      undefined,

    authorIconUrl:
      (r["author_icon_url"] as string) ||
      undefined,

    footerText:
      (r["footer_text"] as string) ||
      undefined,

    footerIconUrl:
      (r["footer_icon_url"] as string) ||
      undefined,

    imageUrl:
      (r["image_url"] as string) ||
      undefined,

    thumbnailUrl:
      (r["thumbnail_url"] as string) ||
      undefined,

    timestamp:
      Boolean(
        r["timestamp"],
      ),

    fields:
      (r["fields"] as EmbedShape["fields"]) ??
      [],
  };
}
