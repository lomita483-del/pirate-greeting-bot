import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

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
      throw new Error("Could not add that calendar.");
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
