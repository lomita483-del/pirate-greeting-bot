/**
 * Server-only calendar synchronisation + Discord reminder delivery for AHOY.
 *
 * - Calendar URLs, tokens and the Discord bot token never leave this module.
 * - Synchronisation is idempotent: events are keyed on
 *   (calendar_source_id, external_event_id, start_time).
 * - Reminders that have already been sent are never recreated or resent.
 */

import ICAL from "ical.js";

import {
  contextFromEvent,
  durationLabel,
  renderTemplate,
  type TemplateStructure,
} from "@/lib/event-templates";

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

/* ------------------------------------------------------------------ */
/* Notifiers, templates and audit                                      */
/* ------------------------------------------------------------------ */

export type NotifierRow = {
  id: string;
  guild_id: string;
  name: string;
  channel_id: string;
  category_id: string | null;
  calendar_source_id: string | null;
  reminder_offsets: number[];
  role_mentions: string[];
  cleanup_previous: boolean;
  template_id: string | null;
  enabled: boolean;
};

export async function loadNotifiers(supabaseAdmin: Admin, guildId: string): Promise<NotifierRow[]> {
  const { data } = await supabaseAdmin
    .from("event_notifiers")
    .select("*")
    .eq("guild_id", guildId)
    .eq("enabled", true);
  return (data ?? []) as unknown as NotifierRow[];
}

export async function loadTemplate(
  supabaseAdmin: Admin,
  templateId: string | null,
): Promise<TemplateStructure | null> {
  if (!templateId) return null;
  const { data } = await supabaseAdmin
    .from("message_templates")
    .select("raw_structure")
    .eq("id", templateId)
    .maybeSingle();
  const raw = (data as Record<string, unknown> | null)?.["raw_structure"];
  return (raw as TemplateStructure | undefined) ?? null;
}

/** Structured audit entry — mirrored to the guild audit trail. */
export async function writeCalendarAudit(
  supabaseAdmin: Admin,
  entry: {
    guildId: string;
    action: string;
    actorId?: string | null;
    resourceType?: string;
    resourceId?: string | null;
    endpoint?: string;
    details?: Record<string, unknown>;
  },
) {
  const metadata = {
    endpoint: entry.endpoint ?? null,
    status: "SUCCESS",
    ...(entry.details ?? {}),
  };
  try {
    const { data } = await supabaseAdmin
      .from("system_events")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        guild_id: entry.guildId,
        event_type: entry.action,
        actor_id: entry.actorId ?? null,
        resource_type: entry.resourceType ?? "calendar",
        resource_id: entry.resourceId ?? null,
        source: "dashboard",
        metadata,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select("id")
      .maybeSingle();
    await supabaseAdmin
      .from("audit_logs")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        guild_id: entry.guildId,
        event_id: (data as Record<string, unknown> | null)?.["id"] ?? null,
        action: entry.action,
        actor_id: entry.actorId ?? null,
        resource_type: entry.resourceType ?? "calendar",
        resource_id: entry.resourceId ?? null,
        metadata,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
  } catch (error) {
    console.error("Calendar audit write failed", error);
  }
}

/* ------------------------------------------------------------------ */
/* Reminder scheduling                                                 */
/* ------------------------------------------------------------------ */

/**
 * Recalculate pending reminder jobs for every upcoming event in a guild.
 * Sent reminders are never touched; obsolete pending jobs are cancelled.
 */
export async function rebuildRemindersForGuild(supabaseAdmin: Admin, guildId: string) {
  const [defaults, notifiers] = await Promise.all([
    loadDefaults(supabaseAdmin, guildId),
    loadNotifiers(supabaseAdmin, guildId),
  ]);
  const { data: events } = await supabaseAdmin
    .from("calendar_events")
    .select("*")
    .eq("guild_id", guildId)
    .gte("start_time", new Date().toISOString())
    .limit(500);

  for (const event of events ?? []) {
    await rebuildRemindersForEvent(
      supabaseAdmin,
      event as Record<string, unknown>,
      defaults,
      notifiers,
    );
  }
}

type ReminderTarget = {
  notifierId: string | null;
  channelId: string;
  mention: string;
  roleMentions: string[];
  offsets: number[];
  templateId: string | null;
};

export async function rebuildRemindersForEvent(
  supabaseAdmin: Admin,
  event: Record<string, unknown>,
  defaults: ReminderDefaults,
  notifiers?: NotifierRow[],
) {
  const eventId = event["id"] as string;
  const guildId = event["guild_id"] as string;
  const sourceId = event["calendar_source_id"] as string | null;
  const start = new Date(String(event["start_time"]));
  const list = notifiers ?? (await loadNotifiers(supabaseAdmin, guildId));

  const eventActive =
    event["reminders_enabled"] !== false && event["status"] === "confirmed" && start.getTime() > 0;

  const targets: ReminderTarget[] = [];

  // 1. Server default reminder stream (with per-event overrides).
  const defaultChannel =
    (event["discord_channel_id"] as string | null) ?? defaults.discord_channel_id;
  if (defaults.enabled && defaultChannel) {
    targets.push({
      notifierId: null,
      channelId: defaultChannel,
      mention: (event["mention"] as string | null) ?? defaults.mention,
      roleMentions: [],
      offsets: ((event["reminder_offsets"] as number[] | null) ?? defaults.offsets) ?? [],
      templateId: null,
    });
  }

  // 2. Every notifier bound to this guild (optionally scoped to one feed).
  for (const notifier of list) {
    if (notifier.calendar_source_id && notifier.calendar_source_id !== sourceId) continue;
    targets.push({
      notifierId: notifier.id,
      channelId: notifier.channel_id,
      mention: "none",
      roleMentions: notifier.role_mentions ?? [],
      offsets: notifier.reminder_offsets ?? [],
      templateId: notifier.template_id,
    });
  }

  const { data: jobs } = await supabaseAdmin
    .from("event_reminders")
    .select("id, reminder_minutes, status, notifier_id")
    .eq("event_id", eventId);

  const wanted = new Map<string, ReminderTarget & { minutes: number }>();
  if (eventActive) {
    for (const target of targets) {
      for (const minutes of new Set(target.offsets)) {
        wanted.set(`${target.notifierId ?? "default"}|${minutes}`, { ...target, minutes });
      }
    }
  }

  // Cancel pending jobs that are no longer wanted.
  for (const job of jobs ?? []) {
    const j = job as Record<string, unknown>;
    if (j["status"] === "sent") continue;
    const key = `${(j["notifier_id"] as string | null) ?? "default"}|${Number(j["reminder_minutes"])}`;
    if (!wanted.has(key)) {
      await supabaseAdmin
        .from("event_reminders")
        .update({ status: "cancelled" })
        .eq("id", j["id"] as string);
    }
  }

  const existing = new Map<string, Record<string, unknown>>();
  for (const job of jobs ?? []) {
    const j = job as Record<string, unknown>;
    existing.set(
      `${(j["notifier_id"] as string | null) ?? "default"}|${Number(j["reminder_minutes"])}`,
      j,
    );
  }

  for (const [key, target] of wanted) {
    const prior = existing.get(key);
    const payload = {
      event_id: eventId,
      guild_id: guildId,
      notifier_id: target.notifierId,
      template_id: target.templateId,
      discord_channel_id: target.channelId,
      mention: target.mention,
      role_mentions: target.roleMentions,
      reminder_minutes: target.minutes,
      scheduled_for: new Date(start.getTime() - target.minutes * 60_000).toISOString(),
      status: "pending",
      error: null,
    };
    if (prior) {
      if (prior["status"] === "sent") continue;
      await supabaseAdmin
        .from("event_reminders")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(payload as any)
        .eq("id", prior["id"] as string);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabaseAdmin.from("event_reminders").insert(payload as any);
    }
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

export function mentionsString(mention: string | null, roleMentions: string[] = []): string {
  const parts = roleMentions.map((m) => mentionContent(m)).filter(Boolean) as string[];
  const single = mentionContent(mention);
  if (single && !parts.includes(single)) parts.unshift(single);
  return parts.join(" ");
}

/** Interactive RSVP components attached to every event announcement. */
export function rsvpComponents(eventId: string) {
  return [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 3,
          label: "Attending",
          emoji: { name: "🟢" },
          custom_id: `ahoy:rsvp:${eventId}:attending`,
        },
        {
          type: 2,
          style: 4,
          label: "Decline",
          emoji: { name: "🔴" },
          custom_id: `ahoy:rsvp:${eventId}:declined`,
        },
        {
          type: 2,
          style: 2,
          label: "Set personal reminder",
          emoji: { name: "🔔" },
          custom_id: `ahoy:rsvp:${eventId}:remindme`,
        },
      ],
    },
  ];
}

function statusBadge(event: { status?: string | null; start_time: string; end_time?: string | null }) {
  const now = Date.now();
  const start = new Date(event.start_time).getTime();
  const end = event.end_time ? new Date(event.end_time).getTime() : start + 30 * 60_000;
  if ((event.status ?? "confirmed") !== "confirmed") return "[CANCELLED]";
  if (now >= start && now <= end) return "[IN PROGRESS]";
  if (now > end) return "[ENDED]";
  return "[UPCOMING]";
}

/** Legacy/built-in reminder embed used when no template is configured. */
export function reminderEmbed(
  event: {
    title: string;
    description?: string | null;
    location?: string | null;
    start: Date;
    end?: Date | null;
    status?: string | null;
  },
  minutes: number,
  test = false,
) {
  const stamp = Math.floor(event.start.getTime() / 1000);
  const starting = minutes <= 0;
  const badge = statusBadge({
    status: event.status ?? "confirmed",
    start_time: event.start.toISOString(),
    end_time: event.end ? event.end.toISOString() : null,
  });
  const title = test
    ? "🏴‍☠️ TEST EVENT REMINDER"
    : starting
      ? "🏴‍☠️ EVENT STARTING NOW"
      : "🏴‍☠️ AHOY EVENT REMINDER";
  const lead = starting ? "The event is starting now!" : `The event starts <t:${stamp}:R>.`;
  const lines = [`${badge}`, "", lead, "", `📅 <t:${stamp}:F>`];
  lines.push(`⏱️ ${durationLabel(event.start, event.end ?? null)}`);
  if (event.location) lines.push(`📍 ${event.location}`);
  if (event.description) lines.push("", event.description.slice(0, 600));

  return {
    title,
    description: `**${event.title}**\n\n${lines.join("\n")}`,
    color: GOLD,
    footer: {
      text: test ? "AHOY · test reminder — nothing was scheduled" : "AHOY Event Automation",
    },
    timestamp: new Date().toISOString(),
  };
}

export async function postToDiscord(
  channelId: string,
  embed: Record<string, unknown>,
  mention: string | null,
  options: {
    components?: unknown[];
    content?: string;
    roleMentions?: string[];
    pin?: boolean;
  } = {},
): Promise<string | null> {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) throw new Error("AHOY's bot token is not configured.");
  const content = options.content?.trim() || mentionsString(mention, options.roleMentions ?? []);
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: { authorization: `Bot ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      content: content || undefined,
      embeds: [embed],
      components: options.components ?? [],
      allowed_mentions: { parse: content ? ["everyone", "roles"] : [] },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Discord rejected the message (HTTP ${response.status}): ${detail.slice(0, 200)}`,
    );
  }
  const body = (await response.json()) as { id?: string };
  if (options.pin && body.id) {
    await fetch(`https://discord.com/api/v10/channels/${channelId}/pins/${body.id}`, {
      method: "PUT",
      headers: { authorization: `Bot ${token}` },
    }).catch(() => undefined);
  }
  return body.id ?? null;
}

async function deleteDiscordMessage(channelId: string, messageId: string) {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) return;
  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
    method: "DELETE",
    headers: { authorization: `Bot ${token}` },
  }).catch(() => undefined);
}

async function rsvpSummary(supabaseAdmin: Admin, eventId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("event_rsvps")
    .select("response")
    .eq("event_id", eventId)
    .limit(1000);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const attending = rows.filter((r) => r["response"] === "attending").length;
  const declined = rows.filter((r) => r["response"] === "declined").length;
  return `🟢 ${attending} attending · 🔴 ${declined} declined`;
}

/** Build the outgoing message for one reminder job. */
export async function buildReminderMessage(
  supabaseAdmin: Admin,
  event: Record<string, unknown>,
  job: { reminder_minutes: number; mention: string | null; role_mentions?: string[]; template_id?: string | null },
  sourceName = "Calendar",
) {
  const structure = await loadTemplate(supabaseAdmin, job.template_id ?? null);
  const mentions = mentionsString(job.mention ?? "none", job.role_mentions ?? []);
  if (!structure) {
    return {
      content: mentions,
      embed: reminderEmbed(
        {
          title: String(event["title"]),
          description: event["description"] as string | null,
          location: event["location"] as string | null,
          start: new Date(String(event["start_time"])),
          end: event["end_time"] ? new Date(String(event["end_time"])) : null,
          status: event["status"] as string | null,
        },
        Number(job.reminder_minutes),
      ) as Record<string, unknown>,
    };
  }
  const ctx = contextFromEvent(
    {
      title: String(event["title"]),
      description: event["description"] as string | null,
      location: event["location"] as string | null,
      html_link: event["html_link"] as string | null,
      start_time: String(event["start_time"]),
      end_time: (event["end_time"] as string | null) ?? null,
      status: event["status"] as string | null,
    },
    {
      mentions,
      calendar: sourceName,
      rsvp: await rsvpSummary(supabaseAdmin, event["id"] as string),
    },
  );
  return renderTemplate(structure, ctx);
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
      const notifierId = (j["notifier_id"] as string | null) ?? null;
      let cleanup = false;
      let sourceName = "Calendar";
      if (notifierId) {
        const { data: notifier } = await supabaseAdmin
          .from("event_notifiers")
          .select("cleanup_previous, name")
          .eq("id", notifierId)
          .maybeSingle();
        cleanup = Boolean((notifier as Record<string, unknown> | null)?.["cleanup_previous"]);
      }
      const { data: source } = await supabaseAdmin
        .from("calendar_sources")
        .select("name")
        .eq("id", event["calendar_source_id"] as string)
        .maybeSingle();
      sourceName = ((source as Record<string, unknown> | null)?.["name"] as string) ?? sourceName;

      const message = await buildReminderMessage(
        supabaseAdmin,
        event,
        {
          reminder_minutes: Number(j["reminder_minutes"]),
          mention: (j["mention"] as string | null) ?? "none",
          role_mentions: (j["role_mentions"] as string[] | null) ?? [],
          template_id: (j["template_id"] as string | null) ?? null,
        },
        sourceName,
      );

      if (cleanup) {
        const { data: previous } = await supabaseAdmin
          .from("event_reminders")
          .select("id, message_id, discord_channel_id")
          .eq("event_id", event["id"] as string)
          .eq("notifier_id", notifierId as string)
          .eq("status", "sent")
          .not("message_id", "is", null);
        for (const row of previous ?? []) {
          const p = row as Record<string, unknown>;
          await deleteDiscordMessage(
            p["discord_channel_id"] as string,
            p["message_id"] as string,
          );
          await supabaseAdmin
            .from("event_reminders")
            .update({ message_id: null })
            .eq("id", p["id"] as string);
        }
      }

      const messageId = await postToDiscord(
        j["discord_channel_id"] as string,
        message.embed,
        null,
        {
          content: message.content,
          components: rsvpComponents(event["id"] as string),
        },
      );

      await supabaseAdmin
        .from("event_reminders")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          error: null,
          message_id: messageId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .eq("id", id);
      sent += 1;

      await writeCalendarAudit(supabaseAdmin, {
        guildId: event["guild_id"] as string,
        action: "REMINDER_SENT",
        resourceType: "calendar_event",
        resourceId: event["id"] as string,
        endpoint: "/api/public/hooks/calendar-sync",
        details: {
          event: String(event["title"]),
          offset_minutes: Number(j["reminder_minutes"]),
          channel_id: j["discord_channel_id"],
        },
      });
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

/* ------------------------------------------------------------------ */
/* Summaries                                                           */
/* ------------------------------------------------------------------ */

export async function generateSummary(
  supabaseAdmin: Admin,
  guildId: string,
  options: { channelId?: string | null; pin?: boolean; days?: number; templateId?: string | null } = {},
) {
  const { data: schedule } = await supabaseAdmin
    .from("event_summary_schedules")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle();
  const s = (schedule ?? {}) as Record<string, unknown>;

  const channelId = options.channelId ?? (s["channel_id"] as string | null);
  if (!channelId) throw new Error("No summary channel is configured.");
  const cadence = (s["cadence"] as string) ?? "daily";
  const days = options.days ?? (cadence === "weekly" ? 7 : 1);
  const pin = options.pin ?? Boolean(s["pin_message"]);

  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const { data: events } = await supabaseAdmin
    .from("calendar_events")
    .select("*")
    .eq("guild_id", guildId)
    .eq("status", "confirmed")
    .gte("start_time", new Date().toISOString())
    .lte("start_time", until)
    .order("start_time", { ascending: true })
    .limit(25);

  const rows = (events ?? []) as Array<Record<string, unknown>>;
  const lines = rows.length
    ? rows.map((e) => {
        const stamp = Math.floor(new Date(String(e["start_time"])).getTime() / 1000);
        const where = e["location"] ? ` · 📍 ${String(e["location"]).slice(0, 60)}` : "";
        return `• **${String(e["title"]).slice(0, 90)}** — <t:${stamp}:F> (<t:${stamp}:R>)${where}`;
      })
    : ["No events are scheduled in this window."];

  const structure = await loadTemplate(
    supabaseAdmin,
    options.templateId ?? ((s["template_id"] as string | null) ?? null),
  );

  const embed = structure
    ? renderTemplate(structure, {
        ...contextFromEvent({
          title: cadence === "weekly" ? "This week's events" : "Today's events",
          description: lines.join("\n"),
          start_time: new Date().toISOString(),
        }),
        Description: lines.join("\n"),
      }).embed
    : {
        title: cadence === "weekly" ? "🏴‍☠️ Events this week" : "🏴‍☠️ Events today",
        description: lines.join("\n"),
        color: GOLD,
        footer: { text: "AHOY Event Automation" },
        timestamp: new Date().toISOString(),
      };

  const messageId = await postToDiscord(channelId, embed as Record<string, unknown>, null, { pin });

  await supabaseAdmin
    .from("event_summary_schedules")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(
      { guild_id: guildId, last_run_at: new Date().toISOString() } as any,
      { onConflict: "guild_id" },
    );

  await writeCalendarAudit(supabaseAdmin, {
    guildId,
    action: "SUMMARY_GENERATED",
    resourceType: "summary",
    resourceId: messageId,
    endpoint: "/api/v1/summaries/generate",
    details: { events: rows.length, channel_id: channelId, cadence },
  });

  return { events: rows.length, channelId, messageId };
}

/** Run every guild summary schedule whose hour has arrived. */
export async function runDueSummaries(supabaseAdmin: Admin) {
  const { data } = await supabaseAdmin
    .from("event_summary_schedules")
    .select("*")
    .eq("enabled", true)
    .limit(200);

  const now = new Date();
  let posted = 0;
  for (const row of data ?? []) {
    const s = row as Record<string, unknown>;
    if (!s["channel_id"]) continue;
    if (Number(s["hour_utc"] ?? 8) !== now.getUTCHours()) continue;
    const last = s["last_run_at"] ? new Date(String(s["last_run_at"])) : null;
    const cadence = (s["cadence"] as string) ?? "daily";
    const minGap = cadence === "weekly" ? 6.5 * 24 * 3600_000 : 20 * 3600_000;
    if (last && now.getTime() - last.getTime() < minGap) continue;
    try {
      await generateSummary(supabaseAdmin, s["guild_id"] as string, {});
      posted += 1;
    } catch (error) {
      console.error("Summary failed", error);
    }
  }
  return { posted };
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
