/**
 * Server-only calendar synchronisation + Discord reminder delivery for AHOY.
 *
 * - Calendar URLs, tokens and the Discord bot token never leave this module.
 * - Synchronisation is idempotent: events are keyed on
 *   (calendar_source_id, external_event_id, start_time).
 * - Reminders that have already been sent are never recreated or resent.
 */

import ICAL from "ical.js";

export type SyncResult = {
  checked: number;
  created: number;
  updated: number;
  cancelled: number;
  duplicates: number;
};

export type ParsedEvent = {
  externalEventId: string;
  parentExternalEventId: string | null;
  title: string;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date | null;
  timezone: string;
  isAllDay: boolean;
  isRecurring: boolean;
  recurrenceRule: string | null;
  status: "confirmed" | "cancelled";
  externalUpdatedAt: string | null;
};

const WINDOW_PAST_MS = 24 * 60 * 60 * 1000;
const WINDOW_FUTURE_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_OCCURRENCES = 60;

/* ------------------------------------------------------------------ */
/* iCalendar parsing                                                   */
/* ------------------------------------------------------------------ */

function tzidOf(prop: ICAL.Property | null): string {
  const tz = prop?.getParameter("tzid");
  return typeof tz === "string" && tz ? tz : "UTC";
}

/** Parse an .ics payload into concrete occurrences inside the sync window. */
export function parseIcs(text: string): ParsedEvent[] {
  const comp = new ICAL.Component(ICAL.parse(text));
  const method = comp.getFirstPropertyValue("method");
  const cancelledFeed = typeof method === "string" && method.toUpperCase() === "CANCEL";

  const now = Date.now();
  const windowStart = new Date(now - WINDOW_PAST_MS);
  const windowEnd = new Date(now + WINDOW_FUTURE_MS);
  const out: ParsedEvent[] = [];

  for (const vevent of comp.getAllSubcomponents("vevent")) {
    let event: ICAL.Event;
    try {
      event = new ICAL.Event(vevent);
    } catch {
      continue;
    }
    if (!event.startDate) continue;

    const rawStatus = vevent.getFirstPropertyValue("status");
    const status: ParsedEvent["status"] =
      cancelledFeed || (typeof rawStatus === "string" && rawStatus.toUpperCase() === "CANCELLED")
        ? "cancelled"
        : "confirmed";

    const uid = event.uid || `${event.summary ?? "event"}-${event.startDate.toString()}`;
    const timezone = tzidOf(vevent.getFirstProperty("dtstart")) || "UTC";
    const isAllDay = Boolean(event.startDate.isDate);
    const rrule = vevent.getFirstPropertyValue("rrule");
    const recurrenceRule = rrule ? String(rrule) : null;
    const lastModified =
      vevent.getFirstPropertyValue("last-modified") ?? vevent.getFirstPropertyValue("dtstamp");

    const base = {
      externalEventId: uid,
      title: (event.summary || "Untitled event").slice(0, 300),
      description: event.description ? String(event.description).slice(0, 4000) : null,
      location: event.location ? String(event.location).slice(0, 300) : null,
      timezone,
      isAllDay,
      recurrenceRule,
      status,
      externalUpdatedAt: lastModified ? new Date(String(lastModified)).toISOString() : null,
    };

    if (event.isRecurring()) {
      const iterator = event.iterator();
      let count = 0;
      let next = iterator.next();
      while (next && count < MAX_OCCURRENCES) {
        const detail = event.getOccurrenceDetails(next);
        const start = detail.startDate.toJSDate();
        if (start > windowEnd) break;
        if (start >= windowStart) {
          out.push({
            ...base,
            parentExternalEventId: uid,
            isRecurring: true,
            start,
            end: detail.endDate ? detail.endDate.toJSDate() : null,
          });
          count += 1;
        }
        next = iterator.next();
      }
    } else {
      const start = event.startDate.toJSDate();
      if (start >= windowStart && start <= windowEnd) {
        out.push({
          ...base,
          parentExternalEventId: null,
          isRecurring: false,
          start,
          end: event.endDate ? event.endDate.toJSDate() : null,
        });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Synchronisation                                                     */
/* ------------------------------------------------------------------ */

type Admin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export type CalendarSourceRow = {
  id: string;
  guild_id: string;
  source_type: string;
  name: string;
  ical_url: string | null;
  sync_enabled: boolean;
};

export async function fetchIcs(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { accept: "text/calendar, text/plain;q=0.8, */*;q=0.5" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`Calendar responded with HTTP ${response.status}`);
  const body = await response.text();
  if (!body.includes("BEGIN:VCALENDAR")) {
    throw new Error("That URL did not return an iCalendar (.ics) feed.");
  }
  return body;
}

/** Sync one calendar source. Safe to run concurrently / repeatedly. */
export async function syncCalendarSource(
  supabaseAdmin: Admin,
  source: CalendarSourceRow,
): Promise<SyncResult> {
  const result: SyncResult = { checked: 0, created: 0, updated: 0, cancelled: 0, duplicates: 0 };
  if (!source.ical_url) throw new Error("This calendar source has no feed URL configured.");

  const parsed = parseIcs(await fetchIcs(source.ical_url));
  result.checked = parsed.length;

  const { data: existingRows } = await supabaseAdmin
    .from("calendar_events")
    .select("id, external_event_id, start_time, title, description, location, end_time, status")
    .eq("calendar_source_id", source.id);

  const existing = new Map<string, Record<string, unknown>>();
  for (const row of existingRows ?? []) {
    const r = row as Record<string, unknown>;
    existing.set(`${r["external_event_id"]}|${new Date(String(r["start_time"])).toISOString()}`, r);
  }

  const seen = new Set<string>();
  for (const event of parsed) {
    const key = `${event.externalEventId}|${event.start.toISOString()}`;
    if (seen.has(key)) {
      result.duplicates += 1;
      continue;
    }
    seen.add(key);

    const payload = {
      calendar_source_id: source.id,
      guild_id: source.guild_id,
      external_event_id: event.externalEventId,
      parent_external_event_id: event.parentExternalEventId,
      title: event.title,
      description: event.description,
      location: event.location,
      start_time: event.start.toISOString(),
      end_time: event.end ? event.end.toISOString() : null,
      timezone: event.timezone,
      is_all_day: event.isAllDay,
      is_recurring: event.isRecurring,
      recurrence_rule: event.recurrenceRule,
      status: event.status,
      external_updated_at: event.externalUpdatedAt,
      updated_at: new Date().toISOString(),
    };

    const prior = existing.get(key);
    const { error } = await supabaseAdmin
      .from("calendar_events")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(payload as any, { onConflict: "calendar_source_id,external_event_id,start_time" });
    if (error) {
      console.error("Calendar upsert failed", error);
      continue;
    }
    if (!prior) result.created += 1;
    else if (
      prior["title"] !== payload.title ||
      prior["status"] !== payload.status ||
      prior["location"] !== payload.location ||
      prior["description"] !== payload.description
    ) {
      result.updated += 1;
    }
    if (event.status === "cancelled") result.cancelled += 1;
  }

  // Events that vanished from the feed are marked cancelled, never deleted.
  const missing = (existingRows ?? []).filter((row) => {
    const r = row as Record<string, unknown>;
    const key = `${r["external_event_id"]}|${new Date(String(r["start_time"])).toISOString()}`;
    return !seen.has(key) && new Date(String(r["start_time"])).getTime() > Date.now();
  });
  for (const row of missing) {
    const id = (row as Record<string, unknown>)["id"] as string;
    await supabaseAdmin
      .from("calendar_events")
      .update({ status: "cancelled" })
      .eq("id", id);
    result.cancelled += 1;
  }

  await supabaseAdmin
    .from("calendar_sources")
    .update({
      last_synced_at: new Date().toISOString(),
      sync_status: "ok",
      sync_error: null,
    })
    .eq("id", source.id);

  await rebuildRemindersForGuild(supabaseAdmin, source.guild_id);
  return result;
}

/* ------------------------------------------------------------------ */
/* Reminder scheduling                                                 */
/* ------------------------------------------------------------------ */

export type ReminderDefaults = {
  enabled: boolean;
  offsets: number[];
  discord_channel_id: string | null;
  mention: string;
};

export async function loadDefaults(
  supabaseAdmin: Admin,
  guildId: string,
): Promise<ReminderDefaults> {
  const { data } = await supabaseAdmin
    .from("event_reminder_defaults")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle();
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    enabled: row["enabled"] === undefined ? true : Boolean(row["enabled"]),
    offsets: (row["offsets"] as number[] | null) ?? [1440, 60, 10, 0],
    discord_channel_id: (row["discord_channel_id"] as string | null) ?? null,
    mention: (row["mention"] as string | null) ?? "none",
  };
}

/**
 * Recalculate pending reminder jobs for every upcoming event in a guild.
 * Sent reminders are never touched; obsolete pending jobs are cancelled.
 */
export async function rebuildRemindersForGuild(supabaseAdmin: Admin, guildId: string) {
  const defaults = await loadDefaults(supabaseAdmin, guildId);
  const { data: events } = await supabaseAdmin
    .from("calendar_events")
    .select("*")
    .eq("guild_id", guildId)
    .gte("start_time", new Date().toISOString())
    .limit(500);

  for (const event of events ?? []) {
    await rebuildRemindersForEvent(supabaseAdmin, event as Record<string, unknown>, defaults);
  }
}

export async function rebuildRemindersForEvent(
  supabaseAdmin: Admin,
  event: Record<string, unknown>,
  defaults: ReminderDefaults,
) {
  const eventId = event["id"] as string;
  const guildId = event["guild_id"] as string;
  const start = new Date(String(event["start_time"]));
  const channel = (event["discord_channel_id"] as string | null) ?? defaults.discord_channel_id;
  const mention = (event["mention"] as string | null) ?? defaults.mention;
  const offsets = ((event["reminder_offsets"] as number[] | null) ?? defaults.offsets) ?? [];
  const active =
    defaults.enabled &&
    event["reminders_enabled"] !== false &&
    event["status"] === "confirmed" &&
    Boolean(channel);

  const { data: jobs } = await supabaseAdmin
    .from("event_reminders")
    .select("id, reminder_minutes, status")
    .eq("event_id", eventId);

  const wanted = new Set(active ? offsets : []);

  for (const job of jobs ?? []) {
    const j = job as Record<string, unknown>;
    if (j["status"] === "sent") continue;
    if (!wanted.has(Number(j["reminder_minutes"]))) {
      await supabaseAdmin
        .from("event_reminders")
        .update({ status: "cancelled" })
        .eq("id", j["id"] as string);
    }
  }

  if (!active || !channel) return;

  const existingByOffset = new Map<number, Record<string, unknown>>();
  for (const job of jobs ?? []) {
    const j = job as Record<string, unknown>;
    existingByOffset.set(Number(j["reminder_minutes"]), j);
  }

  for (const minutes of wanted) {
    const prior = existingByOffset.get(minutes);
    if (prior && prior["status"] === "sent") continue;
    const scheduledFor = new Date(start.getTime() - minutes * 60_000).toISOString();
    await supabaseAdmin
      .from("event_reminders")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(
        {
          event_id: eventId,
          guild_id: guildId,
          discord_channel_id: channel,
          mention,
          reminder_minutes: minutes,
          scheduled_for: scheduledFor,
          status: "pending",
          error: null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        { onConflict: "event_id,reminder_minutes" },
      );
  }
}

/* ------------------------------------------------------------------ */
/* Discord delivery                                                    */
/* ------------------------------------------------------------------ */

const GOLD = 0xd4af37;

function mentionContent(mention: string | null): string | undefined {
  if (!mention || mention === "none") return undefined;
  if (mention === "everyone") return "@everyone";
  if (mention === "here") return "@here";
  return `<@&${mention}>`;
}

export function reminderEmbed(
  event: { title: string; description?: string | null; location?: string | null; start: Date },
  minutes: number,
  test = false,
) {
  const stamp = Math.floor(event.start.getTime() / 1000);
  const starting = minutes <= 0;
  const title = test
    ? "🏴‍☠️ TEST EVENT REMINDER"
    : starting
      ? "🏴‍☠️ EVENT STARTING NOW"
      : "🏴‍☠️ AHOY EVENT REMINDER";
  const lead = starting
    ? "The event is starting now!"
    : `The event starts <t:${stamp}:R>.`;
  const lines = [lead, "", `📅 <t:${stamp}:F>`];
  if (event.location) lines.push(`📍 ${event.location}`);
  if (event.description) lines.push("", event.description.slice(0, 600));

  return {
    title,
    description: `**${event.title}**\n\n${lines.join("\n")}`,
    color: GOLD,
    footer: { text: test ? "AHOY · test reminder — nothing was scheduled" : "AHOY Event Automation" },
    timestamp: new Date().toISOString(),
  };
}

export async function postToDiscord(
  channelId: string,
  embed: Record<string, unknown>,
  mention: string | null,
) {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) throw new Error("AHOY's bot token is not configured.");
  const content = mentionContent(mention);
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: { authorization: `Bot ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      content,
      embeds: [embed],
      allowed_mentions: { parse: content ? ["everyone", "roles"] : [] },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Discord rejected the message (HTTP ${response.status}): ${detail.slice(0, 200)}`);
  }
}

/** Deliver every reminder that is due. Idempotent and retry-safe. */
export async function dispatchDueReminders(supabaseAdmin: Admin) {
  const nowIso = new Date().toISOString();
  const { data: due } = await supabaseAdmin
    .from("event_reminders")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .gte("scheduled_for", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
    .limit(50);

  let sent = 0;
  let failed = 0;

  for (const job of due ?? []) {
    const j = job as Record<string, unknown>;
    const id = j["id"] as string;

    // Claim the job first so a concurrent run cannot send it twice.
    const { data: claimed } = await supabaseAdmin
      .from("event_reminders")
      .update({ status: "sending", attempts: Number(j["attempts"] ?? 0) + 1 })
      .eq("id", id)
      .eq("status", "pending")
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const { data: eventRow } = await supabaseAdmin
      .from("calendar_events")
      .select("*")
      .eq("id", j["event_id"] as string)
      .maybeSingle();
    const event = eventRow as Record<string, unknown> | null;

    if (!event || event["status"] !== "confirmed") {
      await supabaseAdmin.from("event_reminders").update({ status: "cancelled" }).eq("id", id);
      continue;
    }

    try {
      await postToDiscord(
        j["discord_channel_id"] as string,
        reminderEmbed(
          {
            title: String(event["title"]),
            description: event["description"] as string | null,
            location: event["location"] as string | null,
            start: new Date(String(event["start_time"])),
          },
          Number(j["reminder_minutes"]),
        ),
        (j["mention"] as string | null) ?? "none",
      );
      await supabaseAdmin
        .from("event_reminders")
        .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
        .eq("id", id);
      sent += 1;
    } catch (error) {
      const attempts = Number(j["attempts"] ?? 0) + 1;
      await supabaseAdmin
        .from("event_reminders")
        .update({
          status: attempts >= 5 ? "failed" : "pending",
          error: (error as Error).message.slice(0, 500),
        })
        .eq("id", id);
      failed += 1;
    }
  }

  return { sent, failed, due: (due ?? []).length };
}

/** Sync every enabled source across all guilds (used by the cron endpoint). */
export async function syncAllSources(supabaseAdmin: Admin) {
  const { data: sources } = await supabaseAdmin
    .from("calendar_sources")
    .select("*")
    .eq("sync_enabled", true)
    .limit(200);

  let ok = 0;
  let failed = 0;
  for (const source of sources ?? []) {
    try {
      await syncCalendarSource(supabaseAdmin, source as unknown as CalendarSourceRow);
      ok += 1;
    } catch (error) {
      failed += 1;
      await supabaseAdmin
        .from("calendar_sources")
        .update({
          sync_status: "error",
          sync_error: (error as Error).message.slice(0, 500),
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", (source as Record<string, unknown>)["id"] as string);
    }
  }
  return { sources: (sources ?? []).length, ok, failed };
}
