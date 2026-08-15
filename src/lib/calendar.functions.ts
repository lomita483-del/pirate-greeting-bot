import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import type { TemplateStructure } from "@/lib/event-templates";

const guildId = z.string().regex(/^\d{5,25}$/);
const snowflake = z.string().regex(/^\d{5,25}$/);

async function authorize(id: string) {
  const { sessionFromHeader, assertGuildAccess } = await import("@/lib/discord.server");
  const session = await sessionFromHeader(getRequestHeader("cookie") ?? null);
  if (!session) throw new Error("Please sign in with Discord.");
  const { isBanned } = await import("@/lib/admin.server");
  if ((await isBanned(session.userId)).banned) {
    throw new Error("Your access to the AHOY control center has been revoked.");
  }
  const guild = await assertGuildAccess(session, id);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("servers")
    .upsert({ guild_id: guild.id, name: guild.name, icon: guild.icon }, { onConflict: "guild_id" });
  return { session, guild, supabaseAdmin };
}

export type CalendarSource = {
  id: string;
  sourceType: "google" | "ical";
  name: string;
  icalUrl: string | null;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  syncStatus: string;
  syncError: string | null;
};

export type CalendarEventSummary = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  timezone: string;
  isAllDay: boolean;
  isRecurring: boolean;
  recurrenceRule: string | null;
  status: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  channelId: string | null;
  reminderCount: number;
};

/* ---------------------------------------------------------------- */
/* Reads                                                             */
/* ---------------------------------------------------------------- */

export const getCalendar = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ guildId }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const [sourcesRes, defaultsRes, eventsRes] = await Promise.all([
      supabaseAdmin
        .from("calendar_sources")
        .select("*")
        .eq("guild_id", data.guildId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("event_reminder_defaults")
        .select("*")
        .eq("guild_id", data.guildId)
        .maybeSingle(),
      supabaseAdmin
        .from("calendar_events")
        .select("*")
        .eq("guild_id", data.guildId)
        .gte("start_time", new Date(Date.now() - 3600_000).toISOString())
        .order("start_time", { ascending: true })
        .limit(100),
    ]);

    const sources: CalendarSource[] = (sourcesRes.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r["id"] as string,
        sourceType: (r["source_type"] as "google" | "ical") ?? "ical",
        name: r["name"] as string,
        // Only the host is ever exposed — the secret feed path stays server-side.
        icalUrl: safeHost(r["ical_url"] as string | null),
        syncEnabled: Boolean(r["sync_enabled"]),
        lastSyncedAt: (r["last_synced_at"] as string | null) ?? null,
        syncStatus: (r["sync_status"] as string) ?? "pending",
        syncError: (r["sync_error"] as string | null) ?? null,
      };
    });

    const sourceById = new Map(
      (sourcesRes.data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return [r["id"] as string, r];
      }),
    );

    const eventIds = (eventsRes.data ?? []).map((r) => (r as Record<string, unknown>)["id"] as string);
    const reminderCounts: Record<string, number> = {};
    if (eventIds.length) {
      const { data: reminders } = await supabaseAdmin
        .from("event_reminders")
        .select("event_id, status")
        .in("event_id", eventIds);
      for (const row of reminders ?? []) {
        const r = row as Record<string, unknown>;
        if (r["status"] === "cancelled") continue;
        const key = r["event_id"] as string;
        reminderCounts[key] = (reminderCounts[key] ?? 0) + 1;
      }
    }

    const events: CalendarEventSummary[] = (eventsRes.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const src = sourceById.get(r["calendar_source_id"] as string) as
        | Record<string, unknown>
        | undefined;
      return {
        id: r["id"] as string,
        title: r["title"] as string,
        start: r["start_time"] as string,
        end: (r["end_time"] as string | null) ?? null,
        timezone: (r["timezone"] as string) ?? "UTC",
        isAllDay: Boolean(r["is_all_day"]),
        isRecurring: Boolean(r["is_recurring"]),
        recurrenceRule: (r["recurrence_rule"] as string | null) ?? null,
        status: (r["status"] as string) ?? "confirmed",
        sourceId: r["calendar_source_id"] as string,
        sourceName: (src?.["name"] as string) ?? "Calendar",
        sourceType: (src?.["source_type"] as string) ?? "ical",
        channelId: (r["discord_channel_id"] as string | null) ?? null,
        reminderCount: reminderCounts[r["id"] as string] ?? 0,
      };
    });

    const d = (defaultsRes.data ?? {}) as Record<string, unknown>;
    return {
      sources,
      events,
      defaults: {
        enabled: d["enabled"] === undefined ? true : Boolean(d["enabled"]),
        offsets: (d["offsets"] as number[] | null) ?? [1440, 60, 10, 0],
        channelId: (d["discord_channel_id"] as string | null) ?? null,
        mention: (d["mention"] as string | null) ?? "none",
      },
    };
  });

function safeHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export const getCalendarEvent = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ guildId, eventId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { data: row } = await supabaseAdmin
      .from("calendar_events")
      .select("*")
      .eq("id", data.eventId)
      .eq("guild_id", data.guildId)
      .maybeSingle();
    if (!row) throw new Error("That event no longer exists.");
    const r = row as Record<string, unknown>;

    const [{ data: reminders }, { data: source }] = await Promise.all([
      supabaseAdmin
        .from("event_reminders")
        .select("*")
        .eq("event_id", data.eventId)
        .order("scheduled_for", { ascending: true }),
      supabaseAdmin
        .from("calendar_sources")
        .select("name, source_type")
        .eq("id", r["calendar_source_id"] as string)
        .maybeSingle(),
    ]);

    const { loadDefaults } = await import("@/lib/calendar.server");
    const defaults = await loadDefaults(supabaseAdmin, data.guildId);

    return {
      event: {
        id: r["id"] as string,
        title: r["title"] as string,
        description: (r["description"] as string | null) ?? null,
        location: (r["location"] as string | null) ?? null,
        start: r["start_time"] as string,
        end: (r["end_time"] as string | null) ?? null,
        timezone: (r["timezone"] as string) ?? "UTC",
        isAllDay: Boolean(r["is_all_day"]),
        isRecurring: Boolean(r["is_recurring"]),
        recurrenceRule: (r["recurrence_rule"] as string | null) ?? null,
        status: (r["status"] as string) ?? "confirmed",
        channelId: (r["discord_channel_id"] as string | null) ?? null,
        mention: (r["mention"] as string | null) ?? null,
        offsets: (r["reminder_offsets"] as number[] | null) ?? null,
        remindersEnabled: r["reminders_enabled"] !== false,
        sourceName: ((source as Record<string, unknown> | null)?.["name"] as string) ?? "Calendar",
        sourceType:
          ((source as Record<string, unknown> | null)?.["source_type"] as string) ?? "ical",
      },
      defaults,
      reminders: (reminders ?? []).map((row2) => {
        const j = row2 as Record<string, unknown>;
        return {
          id: j["id"] as string,
          minutes: Number(j["reminder_minutes"]),
          scheduledFor: j["scheduled_for"] as string,
          status: j["status"] as string,
          sentAt: (j["sent_at"] as string | null) ?? null,
          attempts: Number(j["attempts"] ?? 0),
          error: (j["error"] as string | null) ?? null,
        };
      }),
    };
  });

/* ---------------------------------------------------------------- */
/* Sources                                                           */
/* ---------------------------------------------------------------- */

export const addCalendarSource = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId,
        sourceType: z.enum(["ical", "google"]),
        name: z.string().min(1).max(120),
        icalUrl: z.string().url().max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, session } = await authorize(data.guildId);
    const url = data.icalUrl.replace(/^webcal:/i, "https:");
    if (!/^https:\/\//i.test(url)) throw new Error("Calendar URLs must use https.");

    const { fetchIcs, syncCalendarSource } = await import("@/lib/calendar.server");
    await fetchIcs(url); // validates before we store anything

    const { data: inserted, error } = await supabaseAdmin
      .from("calendar_sources")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(
        {
          guild_id: data.guildId,
          source_type: data.sourceType,
          name: data.name,
          ical_url: url,
          connected_by: session.userId,
          sync_enabled: true,
          sync_status: "pending",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        { onConflict: "guild_id,ical_url" },
      )
      .select("*")
      .maybeSingle();
    if (error || !inserted) {
      console.error("Calendar source insert failed", error);
      // TEMPORARY: surface the real database error for debugging. Revert
      // this to `throw new Error("Could not add that calendar.");` once
      // the root cause is fixed.
      throw new Error(`Could not add that calendar: ${error?.message ?? "no row returned"}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await syncCalendarSource(supabaseAdmin, inserted as any);
    return { ok: true, result };
  });

export const syncCalendarNow = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ guildId, sourceId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { data: source } = await supabaseAdmin
      .from("calendar_sources")
      .select("*")
      .eq("id", data.sourceId)
      .eq("guild_id", data.guildId)
      .maybeSingle();
    if (!source) throw new Error("That calendar source no longer exists.");

    const { syncCalendarSource } = await import("@/lib/calendar.server");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await syncCalendarSource(supabaseAdmin, source as any);
      return { ok: true as const, result };
    } catch (error) {
      await supabaseAdmin
        .from("calendar_sources")
        .update({
          sync_status: "error",
          sync_error: (error as Error).message.slice(0, 500),
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", data.sourceId);
      throw new Error((error as Error).message);
    }
  });

export const updateCalendarSource = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId,
        sourceId: z.string().uuid(),
        name: z.string().min(1).max(120).optional(),
        syncEnabled: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch["name"] = data.name;
    if (data.syncEnabled !== undefined) patch["sync_enabled"] = data.syncEnabled;
    await supabaseAdmin
      .from("calendar_sources")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", data.sourceId)
      .eq("guild_id", data.guildId);
    return { ok: true };
  });

export const deleteCalendarSource = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ guildId, sourceId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    await supabaseAdmin
      .from("calendar_sources")
      .delete()
      .eq("id", data.sourceId)
      .eq("guild_id", data.guildId);
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* Reminder configuration                                            */
/* ---------------------------------------------------------------- */

const offsetsSchema = z.array(z.number().int().min(0).max(20160)).max(12);
const mentionSchema = z.union([z.enum(["none", "everyone", "here"]), snowflake]);

export const saveReminderDefaults = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId,
        enabled: z.boolean(),
        offsets: offsetsSchema,
        channelId: snowflake.nullable(),
        mention: mentionSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { error } = await supabaseAdmin
      .from("event_reminder_defaults")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(
        {
          guild_id: data.guildId,
          enabled: data.enabled,
          offsets: [...new Set(data.offsets)].sort((a, b) => b - a),
          discord_channel_id: data.channelId,
          mention: data.mention,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        { onConflict: "guild_id" },
      );
    if (error) {
      console.error("Reminder defaults save failed", error);
      throw new Error("Could not save the reminder defaults.");
    }
    const { rebuildRemindersForGuild } = await import("@/lib/calendar.server");
    await rebuildRemindersForGuild(supabaseAdmin, data.guildId);
    return { ok: true };
  });

export const saveEventAutomation = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId,
        eventId: z.string().uuid(),
        channelId: snowflake.nullable(),
        mention: mentionSchema.nullable(),
        offsets: offsetsSchema.nullable(),
        remindersEnabled: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { error } = await supabaseAdmin
      .from("calendar_events")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({
        discord_channel_id: data.channelId,
        mention: data.mention,
        reminder_offsets: data.offsets ? [...new Set(data.offsets)].sort((a, b) => b - a) : null,
        reminders_enabled: data.remindersEnabled,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .eq("id", data.eventId)
      .eq("guild_id", data.guildId);
    if (error) throw new Error("Could not save this event's automation.");

    const { data: event } = await supabaseAdmin
      .from("calendar_events")
      .select("*")
      .eq("id", data.eventId)
      .maybeSingle();
    const { loadDefaults, rebuildRemindersForEvent } = await import("@/lib/calendar.server");
    if (event) {
      await rebuildRemindersForEvent(
        supabaseAdmin,
        event as Record<string, unknown>,
        await loadDefaults(supabaseAdmin, data.guildId),
      );
    }
    return { ok: true };
  });

export const sendTestReminder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ guildId, eventId: z.string().uuid(), channelId: snowflake }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { data: row } = await supabaseAdmin
      .from("calendar_events")
      .select("*")
      .eq("id", data.eventId)
      .eq("guild_id", data.guildId)
      .maybeSingle();
    if (!row) throw new Error("That event no longer exists.");
    const r = row as Record<string, unknown>;

    const { reminderEmbed, postToDiscord } = await import("@/lib/calendar.server");
    await postToDiscord(
      data.channelId,
      reminderEmbed(
        {
          title: String(r["title"]),
          description: r["description"] as string | null,
          location: r["location"] as string | null,
          start: new Date(String(r["start_time"])),
        },
        60,
        true,
      ),
      "none",
    );
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* Feed settings (Chronicle-style EventFeed model)                    */
/* ---------------------------------------------------------------- */

export const saveFeedSettings = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId,
        sourceId: z.string().uuid(),
        targetChannelId: snowflake.nullable(),
        calendarId: z.string().max(200).nullable(),
        voiceDurationDefault: z.number().int().min(5).max(1440),
        lookaheadDays: z.number().int().min(1).max(365),
        syncDirection: z.enum(["gcal_to_discord", "discord_to_gcal", "two_way"]),
        allowedCategoryIds: z.array(snowflake).max(25),
        createDiscordEvents: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, session } = await authorize(data.guildId);
    const { error } = await supabaseAdmin
      .from("calendar_sources")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({
        target_channel_id: data.targetChannelId,
        calendar_id: data.calendarId,
        voice_channel_duration_default: data.voiceDurationDefault,
        lookahead_days: data.lookaheadDays,
        sync_direction: data.syncDirection,
        allowed_category_ids: data.allowedCategoryIds,
        create_discord_events: data.createDiscordEvents,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .eq("id", data.sourceId)
      .eq("guild_id", data.guildId);
    if (error) throw new Error("Could not save the feed settings.");

    const { writeCalendarAudit } = await import("@/lib/calendar.server");
    await writeCalendarAudit(supabaseAdmin, {
      guildId: data.guildId,
      action: "FEED_UPDATED",
      actorId: session.userId,
      resourceType: "calendar_source",
      resourceId: data.sourceId,
      endpoint: "/api/v1/feeds",
      details: { sync_direction: data.syncDirection, lookahead_days: data.lookaheadDays },
    });
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* Message templates                                                  */
/* ---------------------------------------------------------------- */

export type StoredTemplate = {
  id: string;
  name: string;
  templateType: "reminder" | "summary";
  structure: TemplateStructure;
};

export const listEventAutomation = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ guildId }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const [templatesRes, notifiersRes, summaryRes, feedRes, filtersRes, logsRes] = await Promise.all([
      supabaseAdmin
        .from("message_templates")
        .select("*")
        .eq("guild_id", data.guildId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("event_notifiers")
        .select("*")
        .eq("guild_id", data.guildId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("event_summary_schedules")
        .select("*")
        .eq("guild_id", data.guildId)
        .maybeSingle(),
      supabaseAdmin.from("calendar_sources").select("*").eq("guild_id", data.guildId),
      supabaseAdmin
        .from("calendar_filters")
        .select("*")
        .eq("guild_id", data.guildId)
        .order("priority", { ascending: false }),
      supabaseAdmin
        .from("calendar_job_log")
        .select("*")
        .eq("guild_id", data.guildId)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    const templates = (templatesRes.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r["id"] as string,
        name: r["name"] as string,
        templateType: (r["template_type"] as "reminder" | "summary") ?? "reminder",
        structure: (r["raw_structure"] ?? {}) as TemplateStructure,
      };
    });

    const notifiers = (notifiersRes.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r["id"] as string,
        name: r["name"] as string,
        channelId: r["channel_id"] as string,
        categoryId: (r["category_id"] as string | null) ?? null,
        calendarSourceId: (r["calendar_source_id"] as string | null) ?? null,
        offsets: (r["reminder_offsets"] as number[] | null) ?? [],
        roleMentions: (r["role_mentions"] as string[] | null) ?? [],
        cleanupPrevious: Boolean(r["cleanup_previous"]),
        templateId: (r["template_id"] as string | null) ?? null,
        enabled: r["enabled"] !== false,
        timezone: (r["timezone"] as string) ?? "UTC",
        language: (r["language"] as string) ?? "en",
        linkMode: (r["link_mode"] as string) ?? "google",
        customLink: (r["custom_link"] as string | null) ?? null,
        detectionDays: Number(r["detection_days"] ?? 30),
        recurringMode: (r["recurring_mode"] as string) ?? "each_occurrence",
        cleanupMode: (r["cleanup_mode"] as string) ?? "delete_previous",
        mentionTarget: (r["mention_target"] as string) ?? "none",
        reminderChannelId: (r["reminder_channel_id"] as string | null) ?? null,
        summaryChannelId: (r["summary_channel_id"] as string | null) ?? null,
        activityChannelId: (r["activity_channel_id"] as string | null) ?? null,
        errorChannelId: (r["error_channel_id"] as string | null) ?? null,
        announceCreated: Boolean(r["announce_created"]),
        announceUpdated: Boolean(r["announce_updated"]),
        announceCancelled: Boolean(r["announce_cancelled"]),
        announceEnteringRange: Boolean(r["announce_entering_range"]),
        recurringActivityMessages: r["recurring_activity_messages"] !== false,
        healthStatus: (r["health_status"] as string) ?? "healthy",
        healthError: (r["health_error"] as string | null) ?? null,
      };
    });

    const feeds = (feedRes.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r["id"] as string,
        name: r["name"] as string,
        targetChannelId: (r["target_channel_id"] as string | null) ?? null,
        calendarId: (r["calendar_id"] as string | null) ?? null,
        voiceDurationDefault: Number(r["voice_channel_duration_default"] ?? 30),
        lookaheadDays: Number(r["lookahead_days"] ?? 30),
        syncDirection: (r["sync_direction"] as string) ?? "gcal_to_discord",
        allowedCategoryIds: (r["allowed_category_ids"] as string[] | null) ?? [],
        createDiscordEvents: Boolean(r["create_discord_events"]),
      };
    });

    const filters = (filtersRes.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r["id"] as string,
        notifierId: (r["notifier_id"] as string | null) ?? null,
        field: (r["field"] as string) ?? "title",
        operator: (r["operator"] as string) ?? "contains",
        value: (r["value"] as string) ?? "",
        action: (r["action"] as string) ?? "include",
        priority: Number(r["priority"] ?? 0),
        enabled: r["enabled"] !== false,
      };
    });

    const logs = (logsRes.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r["id"] as string,
        jobType: (r["job_type"] as string) ?? "reminder",
        status: (r["status"] as string) ?? "sent",
        error: (r["error"] as string | null) ?? null,
        channelId: (r["channel_id"] as string | null) ?? null,
        notifierId: (r["notifier_id"] as string | null) ?? null,
        createdAt: r["created_at"] as string,
        detail: JSON.stringify(r["metadata"] ?? {}).slice(0, 300),
      };
    });

    const s = (summaryRes.data ?? {}) as Record<string, unknown>;
    return {
      templates,
      notifiers,
      feeds,
      filters,
      logs,
      summary: {
        enabled: Boolean(s["enabled"]),
        channelId: (s["channel_id"] as string | null) ?? null,
        cadence: ((s["cadence"] as string) ?? "daily") as "daily" | "weekly",
        hourUtc: Number(s["hour_utc"] ?? 8),
        pinMessage: s["pin_message"] === undefined ? true : Boolean(s["pin_message"]),
        templateId: (s["template_id"] as string | null) ?? null,
        lastRunAt: (s["last_run_at"] as string | null) ?? null,
      },
    };
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId,
        templateId: z.string().uuid().nullable(),
        name: z.string().min(1).max(80),
        templateType: z.enum(["reminder", "summary"]),
        structure: z.object({
          title: z.string().max(400).optional(),
          description: z.string().max(4000).optional(),
          color: z.string().max(16).nullable().optional(),
          thumbnail: z.string().max(500).nullable().optional(),
          image: z.string().max(500).nullable().optional(),
          footer: z.string().max(300).nullable().optional(),
          content: z.string().max(1500).nullable().optional(),
          fields: z
            .array(
              z.object({
                name: z.string().max(256),
                value: z.string().max(1024),
                inline: z.boolean().optional(),
              }),
            )
            .max(10)
            .optional(),
        }),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, session } = await authorize(data.guildId);
    const payload = {
      guild_id: data.guildId,
      name: data.name,
      template_type: data.templateType,
      raw_structure: data.structure,
      created_by: session.userId,
      updated_at: new Date().toISOString(),
    };
    const query = data.templateId
      ? supabaseAdmin
          .from("message_templates")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(payload as any)
          .eq("id", data.templateId)
          .eq("guild_id", data.guildId)
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabaseAdmin.from("message_templates").insert(payload as any);
    const { error } = await query;
    if (error) {
      console.error("Template save failed", error);
      throw new Error("Could not save that template (names must be unique).");
    }

    const { writeCalendarAudit } = await import("@/lib/calendar.server");
    await writeCalendarAudit(supabaseAdmin, {
      guildId: data.guildId,
      action: data.templateId ? "TEMPLATE_UPDATED" : "TEMPLATE_CREATED",
      actorId: session.userId,
      resourceType: "message_template",
      resourceId: data.templateId,
      endpoint: "/api/v1/templates",
      details: { name: data.name, type: data.templateType },
    });
    return { ok: true };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ guildId, templateId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, session } = await authorize(data.guildId);
    await supabaseAdmin
      .from("message_templates")
      .delete()
      .eq("id", data.templateId)
      .eq("guild_id", data.guildId);
    const { writeCalendarAudit } = await import("@/lib/calendar.server");
    await writeCalendarAudit(supabaseAdmin, {
      guildId: data.guildId,
      action: "TEMPLATE_DELETED",
      actorId: session.userId,
      resourceType: "message_template",
      resourceId: data.templateId,
      endpoint: "/api/v1/templates",
    });
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* Notifiers                                                          */
/* ---------------------------------------------------------------- */

export const saveNotifier = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId,
        notifierId: z.string().uuid().nullable(),
        name: z.string().min(1).max(80),
        channelId: snowflake,
        categoryId: snowflake.nullable(),
        calendarSourceId: z.string().uuid().nullable(),
        offsets: offsetsSchema,
        roleMentions: z.array(mentionSchema).max(10),
        cleanupPrevious: z.boolean(),
        templateId: z.string().uuid().nullable(),
        enabled: z.boolean(),
        timezone: z.string().max(64).optional(),
        language: z.string().max(8).optional(),
        linkMode: z.enum(["google", "discord", "custom", "none"]).optional(),
        customLink: z.string().max(400).nullable().optional(),
        detectionDays: z.number().int().min(1).max(365).optional(),
        recurringMode: z.enum(["each_occurrence", "first_only", "skip"]).optional(),
        cleanupMode: z.enum(["delete_previous", "edit_previous", "keep_all"]).optional(),
        mentionTarget: z.string().max(30).optional(),
        reminderChannelId: snowflake.nullable().optional(),
        summaryChannelId: snowflake.nullable().optional(),
        activityChannelId: snowflake.nullable().optional(),
        errorChannelId: snowflake.nullable().optional(),
        announceCreated: z.boolean().optional(),
        announceUpdated: z.boolean().optional(),
        announceCancelled: z.boolean().optional(),
        announceEnteringRange: z.boolean().optional(),
        recurringActivityMessages: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, session } = await authorize(data.guildId);
    const payload = {
      guild_id: data.guildId,
      name: data.name,
      channel_id: data.channelId,
      category_id: data.categoryId,
      calendar_source_id: data.calendarSourceId,
      reminder_offsets: [...new Set(data.offsets)].sort((a, b) => b - a),
      role_mentions: data.roleMentions.filter((m) => m !== "none"),
      cleanup_previous: data.cleanupPrevious,
      template_id: data.templateId,
      enabled: data.enabled,
      timezone: data.timezone ?? "UTC",
      language: data.language ?? "en",
      link_mode: data.linkMode ?? "google",
      custom_link: data.customLink ?? null,
      detection_days: data.detectionDays ?? 30,
      recurring_mode: data.recurringMode ?? "each_occurrence",
      cleanup_mode: data.cleanupMode ?? "delete_previous",
      mention_target: data.mentionTarget ?? "none",
      reminder_channel_id: data.reminderChannelId ?? null,
      summary_channel_id: data.summaryChannelId ?? null,
      activity_channel_id: data.activityChannelId ?? null,
      error_channel_id: data.errorChannelId ?? null,
      announce_created: data.announceCreated ?? false,
      announce_updated: data.announceUpdated ?? false,
      announce_cancelled: data.announceCancelled ?? false,
      announce_entering_range: data.announceEnteringRange ?? false,
      recurring_activity_messages: data.recurringActivityMessages ?? true,
      created_by: session.userId,
      updated_at: new Date().toISOString(),
    };
    const { error } = data.notifierId
      ? await supabaseAdmin
          .from("event_notifiers")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(payload as any)
          .eq("id", data.notifierId)
          .eq("guild_id", data.guildId)
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await supabaseAdmin.from("event_notifiers").insert(payload as any);
    if (error) {
      console.error("Notifier save failed", error);
      throw new Error("Could not save that notifier.");
    }

    const { rebuildRemindersForGuild, writeCalendarAudit } = await import("@/lib/calendar.server");
    await rebuildRemindersForGuild(supabaseAdmin, data.guildId);
    await writeCalendarAudit(supabaseAdmin, {
      guildId: data.guildId,
      action: data.notifierId ? "NOTIFIER_UPDATED" : "NOTIFIER_CREATED",
      actorId: session.userId,
      resourceType: "event_notifier",
      resourceId: data.notifierId,
      endpoint: "/api/v1/notifiers",
      details: { channel_id: data.channelId, offsets: payload.reminder_offsets },
    });
    return { ok: true };
  });

export const deleteNotifier = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ guildId, notifierId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, session } = await authorize(data.guildId);
    await supabaseAdmin
      .from("event_notifiers")
      .delete()
      .eq("id", data.notifierId)
      .eq("guild_id", data.guildId);
    const { rebuildRemindersForGuild, writeCalendarAudit } = await import("@/lib/calendar.server");
    await rebuildRemindersForGuild(supabaseAdmin, data.guildId);
    await writeCalendarAudit(supabaseAdmin, {
      guildId: data.guildId,
      action: "NOTIFIER_DELETED",
      actorId: session.userId,
      resourceType: "event_notifier",
      resourceId: data.notifierId,
      endpoint: "/api/v1/notifiers",
    });
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* Summaries                                                          */
/* ---------------------------------------------------------------- */

export const saveSummarySchedule = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId,
        enabled: z.boolean(),
        channelId: snowflake.nullable(),
        cadence: z.enum(["daily", "weekly"]),
        hourUtc: z.number().int().min(0).max(23),
        pinMessage: z.boolean(),
        templateId: z.string().uuid().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, session } = await authorize(data.guildId);
    const { error } = await supabaseAdmin
      .from("event_summary_schedules")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(
        {
          guild_id: data.guildId,
          enabled: data.enabled,
          channel_id: data.channelId,
          cadence: data.cadence,
          hour_utc: data.hourUtc,
          pin_message: data.pinMessage,
          template_id: data.templateId,
          updated_at: new Date().toISOString(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        { onConflict: "guild_id" },
      );
    if (error) throw new Error("Could not save the summary schedule.");
    const { writeCalendarAudit } = await import("@/lib/calendar.server");
    await writeCalendarAudit(supabaseAdmin, {
      guildId: data.guildId,
      action: "SUMMARY_SCHEDULE_UPDATED",
      actorId: session.userId,
      resourceType: "summary",
      endpoint: "/api/v1/summaries",
      details: { cadence: data.cadence, hour_utc: data.hourUtc },
    });
    return { ok: true };
  });

export const generateSummaryNow = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ guildId, channelId: snowflake.nullable() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { generateSummary } = await import("@/lib/calendar.server");
    return await generateSummary(supabaseAdmin, data.guildId, { channelId: data.channelId });
  });

/* ---------------------------------------------------------------- */
/* RSVPs                                                              */
/* ---------------------------------------------------------------- */

export const getEventRsvps = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ guildId, eventId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { data: rows } = await supabaseAdmin
      .from("event_rsvps")
      .select("user_id, response, updated_at")
      .eq("event_id", data.eventId)
      .limit(500);
    const list = (rows ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        userId: r["user_id"] as string,
        response: (r["response"] as string) ?? "attending",
      };
    });
    return {
      attending: list.filter((r) => r.response === "attending").length,
      declined: list.filter((r) => r.response === "declined").length,
      list,
    };
  });


/* ---------------------------------------------------------------- */
/* Event filters                                                      */
/* ---------------------------------------------------------------- */

export const saveCalendarFilter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId,
        filterId: z.string().uuid().nullable(),
        notifierId: z.string().uuid().nullable(),
        field: z.enum(["title", "description", "location", "status", "calendar"]),
        operator: z.enum(["contains", "not_contains", "equals", "starts_with", "ends_with", "regex"]),
        value: z.string().min(1).max(200),
        action: z.enum(["include", "exclude"]),
        priority: z.number().int().min(0).max(100),
        enabled: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, session } = await authorize(data.guildId);
    const payload = {
      guild_id: data.guildId,
      notifier_id: data.notifierId,
      field: data.field,
      operator: data.operator,
      value: data.value,
      action: data.action,
      priority: data.priority,
      enabled: data.enabled,
      created_by: session.userId,
    };
    const { error } = data.filterId
      ? await supabaseAdmin
          .from("calendar_filters")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(payload as any)
          .eq("id", data.filterId)
          .eq("guild_id", data.guildId)
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await supabaseAdmin.from("calendar_filters").insert(payload as any);
    if (error) {
      console.error("Filter save failed", error);
      throw new Error("Could not save that filter rule.");
    }
    const { rebuildRemindersForGuild, writeCalendarAudit } = await import("@/lib/calendar.server");
    await rebuildRemindersForGuild(supabaseAdmin, data.guildId);
    await writeCalendarAudit(supabaseAdmin, {
      guildId: data.guildId,
      action: data.filterId ? "FILTER_UPDATED" : "FILTER_CREATED",
      actorId: session.userId,
      resourceType: "calendar_filter",
      resourceId: data.filterId,
      endpoint: "/api/v1/filters",
      details: { field: data.field, operator: data.operator, action: data.action },
    });
    return { ok: true };
  });

export const deleteCalendarFilter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ guildId, filterId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, session } = await authorize(data.guildId);
    await supabaseAdmin
      .from("calendar_filters")
      .delete()
      .eq("id", data.filterId)
      .eq("guild_id", data.guildId);
    const { rebuildRemindersForGuild, writeCalendarAudit } = await import("@/lib/calendar.server");
    await rebuildRemindersForGuild(supabaseAdmin, data.guildId);
    await writeCalendarAudit(supabaseAdmin, {
      guildId: data.guildId,
      action: "FILTER_DELETED",
      actorId: session.userId,
      resourceType: "calendar_filter",
      resourceId: data.filterId,
      endpoint: "/api/v1/filters",
    });
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* Google Calendar accounts                                          */
/* ---------------------------------------------------------------- */

export type GoogleAccountSummary = {
  id: string;
  email: string;
};

/** Google accounts connected to this guild by any admin. */
export const listGoogleAccounts = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ guildId }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { data: rows } = await supabaseAdmin
      .from("google_accounts")
      .select("id, google_email")
      .eq("guild_id", data.guildId)
      .order("created_at", { ascending: true });
    return {
      accounts: (rows ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return { id: r["id"] as string, email: r["google_email"] as string };
      }),
    };
  });

export const disconnectGoogleAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ guildId, accountId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    await supabaseAdmin
      .from("google_accounts")
      .delete()
      .eq("id", data.accountId)
      .eq("guild_id", data.guildId);
    return { ok: true };
  });

export const listGoogleCalendarsForAccount = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ guildId, accountId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await authorize(data.guildId);
    const { data: account } = await supabaseAdmin
      .from("google_accounts")
      .select("id")
      .eq("id", data.accountId)
      .eq("guild_id", data.guildId)
      .maybeSingle();
    if (!account) throw new Error("That Google account is no longer connected.");

    const { getValidAccessToken, listGoogleCalendars } = await import("@/lib/google.server");
    const accessToken = await getValidAccessToken(supabaseAdmin, data.accountId);
    const calendars = await listGoogleCalendars(accessToken);
    return { calendars };
  });

export const addGoogleCalendarSource = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        guildId,
        accountId: z.string().uuid(),
        calendarId: z.string().min(1).max(300),
        calendarName: z.string().min(1).max(120),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, session } = await authorize(data.guildId);

    const { data: account } = await supabaseAdmin
      .from("google_accounts")
      .select("id")
      .eq("id", data.accountId)
      .eq("guild_id", data.guildId)
      .maybeSingle();
    if (!account) throw new Error("That Google account is no longer connected.");

    const { data: inserted, error } = await supabaseAdmin
      .from("calendar_sources")
      .upsert(
        {
          guild_id: data.guildId,
          source_type: "google",
          name: data.calendarName,
          ical_url: null,
          google_account_id: data.accountId,
          external_calendar_id: data.calendarId,
          connected_by: session.userId,
          sync_enabled: true,
          sync_status: "pending",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        { onConflict: "guild_id,google_account_id,external_calendar_id" },
      )
      .select("*")
      .maybeSingle();
    if (error || !inserted) {
      console.error("Google calendar source insert failed", error);
      throw new Error(`Could not add that calendar: ${error?.message ?? "no row returned"}`);
    }

    const { syncCalendarSource } = await import("@/lib/calendar.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await syncCalendarSource(supabaseAdmin, inserted as any);
    return { ok: true, result };
  });
