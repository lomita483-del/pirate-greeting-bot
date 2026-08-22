/**
 * Chronicle-style message template rendering for AHOY event automation.
 *
 * Pure functions only — safe to import from the browser (live preview) and
 * from server code (actual delivery).
 */

export type TemplateStructure = {
  title?: string;
  description?: string;
  color?: string | null;
  thumbnail?: string | null;
  image?: string | null;
  footer?: string | null;
  content?: string | null;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
};

export type TemplateContext = {
  Title: string;
  Description: string;
  Location: string;
  Url: string;
  StartTime: Date;
  EndTime: Date | null;
  Duration: string;
  Status: string;
  Mentions: string;
  Calendar: string;
  Rsvp: string;
  Frontmatter: Record<string, string>;
};

export const TEMPLATE_VARIABLES = [
  "{{.Title}}",
  "{{.Description}}",
  "{{.Location}}",
  "{{.Url}}",
  "{{.Mentions}}",
  "{{.Duration}}",
  "{{.Status}}",
  "{{.Calendar}}",
  "{{.Rsvp}}",
  "{{discordDateTime .StartTime 'F'}}",
  "{{discordDateTime .StartTime 'R'}}",
  "{{discordDateTime .EndTime 't'}}",
  "{{.Frontmatter.Thumbnail}}",
] as const;

/**
 * Detailed by default: a short lede plus a field grid (Scheduled for, Duration,
 * Location, Calendar, RSVP, Status) so a reminder is informative at a glance
 * instead of a single paragraph. Empty fields render as "—" rather than being
 * silently dropped, so admins editing this in the dashboard can see exactly
 * what each field is for.
 */
export const DEFAULT_REMINDER_TEMPLATE: TemplateStructure = {
  title: "🏴‍☠️ {{.Title}}",
  description: "{{.Description}}",
  color: "#D4AF37",
  footer: "AHOY Event Automation · {{.Status}}",
  content: "{{.Mentions}}",
  fields: [
    {
      name: "📅 Scheduled for",
      value: "{{discordDateTime .StartTime 'F'}}\n{{discordDateTime .StartTime 'R'}}",
      inline: true,
    },
    { name: "⏱️ Duration", value: "{{.Duration}}", inline: true },
    { name: "📍 Location", value: "{{.Location}}", inline: true },
    { name: "🗓️ Calendar", value: "{{.Calendar}}", inline: true },
    { name: "✅ RSVP", value: "{{.Rsvp}}", inline: true },
    { name: "🔗 Link", value: "{{.Url}}", inline: true },
  ],
};

export const DEFAULT_SUMMARY_TEMPLATE: TemplateStructure = {
  title: "🏴‍☠️ Upcoming events",
  description: "{{.Description}}",
  color: "#D4AF37",
  footer: "AHOY Event Automation",
  content: "",
  fields: [],
};

function discordStamp(date: Date | null, style: string): string {
  if (!date) return "—";
  const s = Math.floor(date.getTime() / 1000);
  const flag = (style || "F").replace(/['"]/g, "").slice(0, 1) || "F";
  return `<t:${s}:${flag}>`;
}

/** Replace every `{{...}}` token in a string using the given context. */
export function renderTemplateString(input: string | null | undefined, ctx: TemplateContext): string {
  if (!input) return "";
  return input.replace(/\{\{\s*(.+?)\s*\}\}/g, (_match, raw: string) => {
    const expr = raw.trim();

    const dt = expr.match(/^discordDateTime\s+\.(StartTime|EndTime)\s*(?:['"]?([A-Za-z])['"]?)?$/);
    if (dt) {
      const value = dt[1] === "EndTime" ? ctx.EndTime : ctx.StartTime;
      return discordStamp(value, dt[2] ?? "F");
    }

    const front = expr.match(/^\.Frontmatter\.([A-Za-z0-9_]+)$/);
    if (front) return ctx.Frontmatter[front[1]!] ?? "";

    const key = expr.replace(/^\./, "") as keyof TemplateContext;
    const value = ctx[key];
    if (value instanceof Date) return discordStamp(value, "F");
    if (typeof value === "string") return value;
    return "";
  });
}

function colorToInt(color: string | null | undefined, fallback = 0xd4af37): number {
  if (!color) return fallback;
  const hex = color.replace("#", "").trim();
  const parsed = Number.parseInt(hex, 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Render a stored template into a Discord embed + message content. */
export function renderTemplate(
  structure: TemplateStructure | null | undefined,
  ctx: TemplateContext,
): { content: string; embed: Record<string, unknown> } {
  const tpl = structure && Object.keys(structure).length ? structure : DEFAULT_REMINDER_TEMPLATE;
  const clean = (value: string) =>
    value
      .split("\n")
      .filter((line) => !/^(📍|📎)\s*$/.test(line.trim()))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const embed: Record<string, unknown> = {
    title: clean(renderTemplateString(tpl.title, ctx)).slice(0, 256) || ctx.Title,
    description: clean(renderTemplateString(tpl.description, ctx)).slice(0, 4000),
    color: colorToInt(tpl.color),
    timestamp: new Date().toISOString(),
  };
  const footer = clean(renderTemplateString(tpl.footer, ctx));
  if (footer) embed["footer"] = { text: footer.slice(0, 2048) };
  const thumb = renderTemplateString(tpl.thumbnail, ctx).trim();
  if (/^https?:\/\//.test(thumb)) embed["thumbnail"] = { url: thumb };
  const image = renderTemplateString(tpl.image, ctx).trim();
  if (/^https?:\/\//.test(image)) embed["image"] = { url: image };
  const fields = (tpl.fields ?? [])
    .map((f) => ({
      name: clean(renderTemplateString(f.name, ctx)).slice(0, 256) || "\u200b",
      value: clean(renderTemplateString(f.value, ctx)).slice(0, 1024) || "—",
      inline: Boolean(f.inline),
    }))
    .slice(0, 25);
  if (fields.length) embed["fields"] = fields;

  return { content: clean(renderTemplateString(tpl.content, ctx)).slice(0, 1800), embed };
}

export function durationLabel(start: Date, end: Date | null, fallbackMinutes = 30): string {
  const minutes = end
    ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))
    : fallbackMinutes;
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours} hour${hours === 1 ? "" : "s"}`;
}

/** Build a rendering context from a stored calendar event row. */
export function contextFromEvent(
  event: {
    title: string;
    description?: string | null;
    location?: string | null;
    html_link?: string | null;
    start_time: string;
    end_time?: string | null;
    status?: string | null;
  },
  extras: { mentions?: string; calendar?: string; rsvp?: string; fallbackMinutes?: number } = {},
): TemplateContext {
  const start = new Date(event.start_time);
  const end = event.end_time ? new Date(event.end_time) : null;
  return {
    Title: event.title,
    Description: event.description ?? "",
    Location: event.location ?? "—",
    Url: event.html_link ?? "",
    StartTime: start,
    EndTime: end,
    Duration: durationLabel(start, end, extras.fallbackMinutes ?? 30),
    Status: (event.status ?? "confirmed").toUpperCase(),
    Mentions: extras.mentions ?? "",
    Calendar: extras.calendar ?? "—",
    Rsvp: extras.rsvp ?? "—",
    Frontmatter: {},
  };
}
