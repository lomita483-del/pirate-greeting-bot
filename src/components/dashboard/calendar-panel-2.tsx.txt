import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Link2,
  Loader2,
  RefreshCw,
  Repeat,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addCalendarSource,
  addGoogleCalendarSource,
  deleteCalendarSource,
  disconnectGoogleAccount,
  getCalendar,
  listGoogleAccounts,
  listGoogleCalendarsForAccount,
  saveReminderDefaults,
  syncCalendarNow,
} from "@/lib/calendar.functions";

import { Field, PickerSelect, SectionHeader, ToggleRow, type Option } from "./fields";
import type { PanelProps } from "./types";

export const OFFSET_PRESETS: Array<{ minutes: number; label: string }> = [
  { minutes: 1440, label: "24 hours before" },
  { minutes: 720, label: "12 hours before" },
  { minutes: 360, label: "6 hours before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 30, label: "30 minutes before" },
  { minutes: 10, label: "10 minutes before" },
  { minutes: 0, label: "At event start" },
];

export function offsetLabel(minutes: number): string {
  if (minutes <= 0) return "At start";
  if (minutes % 1440 === 0) return `${minutes / 1440}d before`;
  if (minutes % 60 === 0) return `${minutes / 60}h before`;
  return `${minutes}m before`;
}

function relative(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} day(s) ago`;
}

export function CalendarPanel({ guildId, config }: PanelProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [customValue, setCustomValue] = useState("");
  const [customUnit, setCustomUnit] = useState("minutes");

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>("");

  const accountsQuery = useQuery({
    queryKey: ["google-accounts", guildId],
    queryFn: () => listGoogleAccounts({ data: { guildId } }),
  });

  const calendarsQuery = useQuery({
    queryKey: ["google-calendars", guildId, selectedAccountId],
    queryFn: () =>
      listGoogleCalendarsForAccount({ data: { guildId, accountId: selectedAccountId! } }),
    enabled: Boolean(selectedAccountId),
  });

  const addGoogleCalendar = useMutation({
    mutationFn: (calendarName: string) =>
      addGoogleCalendarSource({
        data: { guildId, accountId: selectedAccountId!, calendarId: selectedCalendarId, calendarName },
      }),
    onSuccess: (res) => {
      toast.success(
        `Calendar connected — ${res.result.checked} events checked, ${res.result.created} imported.`,
      );
      setSelectedCalendarId("");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const disconnectGoogle = useMutation({
    mutationFn: (accountId: string) => disconnectGoogleAccount({ data: { guildId, accountId } }),
    onSuccess: () => {
      toast.success("Google account disconnected.");
      setSelectedAccountId(null);
      queryClient.invalidateQueries({ queryKey: ["google-accounts", guildId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const calendar = useQuery({
    queryKey: ["calendar", guildId],
    queryFn: () => getCalendar({ data: { guildId } }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["calendar", guildId] });

  const channels: Option[] = config.structure.channels
    .filter((c) => c.kind !== "category")
    .map((c) => ({ id: c.id, name: `#${c.name}` }));
  const mentions: Option[] = [
    { id: "none", name: "No mention" },
    { id: "everyone", name: "@everyone" },
    { id: "here", name: "@here" },
    ...config.structure.roles.map((r) => ({ id: r.id, name: `@${r.name}` })),
  ];

  const defaults = calendar.data?.defaults;
  const [draft, setDraft] = useState<{
    enabled: boolean;
    offsets: number[];
    channelId: string | null;
    mention: string;
  } | null>(null);
  const current = draft ??
    (defaults
      ? {
          enabled: defaults.enabled,
          offsets: defaults.offsets,
          channelId: defaults.channelId,
          mention: defaults.mention,
        }
      : { enabled: true, offsets: [1440, 60, 10, 0], channelId: null, mention: "none" });

  const add = useMutation({
    mutationFn: () =>
      addCalendarSource({
        data: {
          guildId,
          sourceType: /google\.com/i.test(url) ? "google" : "ical",
          name: name.trim() || "Calendar",
          icalUrl: url.trim(),
        },
      }),
    onSuccess: (res) => {
      toast.success(
        `Calendar added — ${res.result.checked} events checked, ${res.result.created} imported.`,
      );
      setName("");
      setUrl("");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sync = useMutation({
    mutationFn: (sourceId: string) => syncCalendarNow({ data: { guildId, sourceId } }),
    onSuccess: (res) => {
      const r = res.result;
      toast.success(
        `Sync completed — ${r.checked} checked, ${r.created} new, ${r.updated} updated, ${r.cancelled} cancelled, ${r.duplicates} duplicates.`,
      );
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (sourceId: string) => deleteCalendarSource({ data: { guildId, sourceId } }),
    onSuccess: () => {
      toast.success("Calendar removed.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveDefaults = useMutation({
    mutationFn: () =>
      saveReminderDefaults({
        data: {
          guildId,
          enabled: current.enabled,
          offsets: current.offsets,
          channelId: current.channelId,
          mention: current.mention,
        },
      }),
    onSuccess: () => {
      toast.success("Reminder automation saved.");
      setDraft(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const events = calendar.data?.events ?? [];
  const upcoming = useMemo(() => events.filter((e) => e.status === "confirmed"), [events]);

  const toggleOffset = (minutes: number) =>
    setDraft({
      ...current,
      offsets: current.offsets.includes(minutes)
        ? current.offsets.filter((m) => m !== minutes)
        : [...current.offsets, minutes],
    });

  return (
    <div className="space-y-6">
      {/* Google Calendar --------------------------------------------------- */}
      <Card className="glass border-0">
        <CardContent className="space-y-4 pt-6">
          <SectionHeader
            title="Google Calendar"
            description="Sign in with Google and pick a calendar — no copying links, and AHOY refreshes it automatically."
          />

          {accountsQuery.data?.accounts.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {accountsQuery.data.accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setSelectedAccountId(account.id)}
                  className={`rounded-xl border p-3 text-left text-sm transition ${
                    selectedAccountId === account.id
                      ? "border-primary bg-primary/10"
                      : "border-border/40 bg-background/30 hover:bg-background/50"
                  }`}
                >
                  <p className="font-medium">{account.email}</p>
                  <p className="text-xs text-muted-foreground">Tap to choose a calendar</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No Google accounts connected yet.</p>
          )}

          <Button asChild variant="secondary">
            <a href={`/api/public/auth/google/start?guildId=${guildId}`}>
              Sign in with Google
            </a>
          </Button>

          {selectedAccountId ? (
            <div className="rounded-xl border border-border/40 bg-background/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">Choose a calendar to connect</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => disconnectGoogle.mutate(selectedAccountId)}
                >
                  Disconnect account
                </Button>
              </div>
              {calendarsQuery.isPending ? (
                <p className="text-sm text-muted-foreground">Loading calendars…</p>
              ) : calendarsQuery.data?.calendars.length ? (
                <div className="space-y-2">
                  <select
                    className="h-10 w-full rounded-md border border-border/50 bg-background px-3 text-sm"
                    value={selectedCalendarId}
                    onChange={(e) => setSelectedCalendarId(e.target.value)}
                  >
                    <option value="">Select a calendar…</option>
                    {calendarsQuery.data.calendars.map((cal) => (
                      <option key={cal.id} value={cal.id}>
                        {cal.summary}
                        {cal.primary ? " (primary)" : ""}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={!selectedCalendarId || addGoogleCalendar.isPending}
                    onClick={() => {
                      const name =
                        calendarsQuery.data?.calendars.find((c) => c.id === selectedCalendarId)
                          ?.summary ?? "Google Calendar";
                      addGoogleCalendar.mutate(name);
                    }}
                  >
                    {addGoogleCalendar.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Connect this calendar
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No calendars found on this account.
                </p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Calendar sources -------------------------------------------------- */}
      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Calendar sources"
            description="Connect an iCalendar (.ics) feed — including Google Calendar's secret iCal address — and AHOY keeps its events in sync every 5 minutes."
            badge={`${calendar.data?.sources.length ?? 0} connected`}
          />

          {calendar.isPending ? (
            <p className="text-sm text-muted-foreground">Loading calendars…</p>
          ) : calendar.data?.sources.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {calendar.data.sources.map((source) => {
                const failed = source.syncStatus === "error";
                return (
                  <div
                    key={source.id}
                    className="rounded-2xl border border-border/40 bg-background/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          {source.sourceType === "google" ? "Google Calendar" : "iCalendar"}
                          <span
                            className={
                              failed ? "text-destructive" : "text-emerald-400"
                            }
                          >
                            {failed ? "🔴" : "🟢"}
                          </span>
                        </p>
                        <p className="mt-1 truncate text-sm text-foreground/90">{source.name}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Link2 className="h-3 w-3" />
                          {source.icalUrl ?? "private feed"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Last synced: {relative(source.lastSyncedAt)}
                        </p>
                        {failed && source.syncError ? (
                          <p className="mt-2 flex items-start gap-1 text-xs text-destructive">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>Unable to synchronize: {source.syncError}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={sync.isPending}
                        onClick={() => sync.mutate(source.id)}
                      >
                        {sync.isPending && sync.variables === source.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Sync now
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => remove.mutate(source.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No calendars connected yet. Add an .ics URL below to import events.
            </p>
          )}

          <div className="grid gap-2 rounded-2xl border border-border/40 bg-background/30 p-4 sm:grid-cols-[1fr_2fr_auto]">
            <Input
              placeholder="Calendar name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="https://…/basic.ics"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button disabled={!url.trim() || add.isPending} onClick={() => add.mutate()}>
              {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add calendar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            In Google Calendar open <strong>Settings → your calendar → Secret address in iCal
            format</strong> and paste that URL here. The URL is stored server-side only and is never
            sent back to the browser.
          </p>
        </CardContent>
      </Card>

      {/* Reminder automation ---------------------------------------------- */}
      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Event reminder automation"
            description="Default reminders applied to every synced event. Individual events can override these."
          />
          <ToggleRow
            label="Reminder automation enabled"
            description="Turn off to pause every scheduled reminder for this server."
            checked={current.enabled}
            onChange={(v) => setDraft({ ...current, enabled: v })}
          />
          <Field label="Default reminder times">
            <div className="grid gap-2 sm:grid-cols-2">
              {OFFSET_PRESETS.map((preset) => (
                <label
                  key={preset.minutes}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/40 bg-background/30 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={current.offsets.includes(preset.minutes)}
                    onChange={() => toggleOffset(preset.minutes)}
                  />
                  {preset.label}
                </label>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                className="w-24"
                type="number"
                min={0}
                placeholder="45"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
              />
              <select
                className="h-9 rounded-md border border-border/50 bg-background px-2 text-sm"
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  const n = Number(customValue);
                  if (!Number.isFinite(n) || n < 0) return;
                  const mult = customUnit === "days" ? 1440 : customUnit === "hours" ? 60 : 1;
                  toggleOffset(Math.min(20160, Math.round(n * mult)));
                  setCustomValue("");
                }}
              >
                Add reminder
              </Button>
              <div className="flex flex-wrap gap-1">
                {current.offsets
                  .slice()
                  .sort((a, b) => b - a)
                  .map((m) => (
                    <Badge key={m} variant="outline" className="text-[10px]">
                      {offsetLabel(m)}
                    </Badge>
                  ))}
              </div>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default Discord channel" hint="Where reminders are announced.">
              <PickerSelect
                value={current.channelId}
                options={channels}
                onChange={(v) => setDraft({ ...current, channelId: v })}
                placeholder="Select a channel"
                emptyLabel="No channel selected"
              />
            </Field>
            <Field label="Default mention">
              <PickerSelect
                value={current.mention}
                options={mentions}
                onChange={(v) => setDraft({ ...current, mention: v ?? "none" })}
                placeholder="No mention"
                emptyLabel="No mention"
              />
            </Field>
          </div>

          <Button onClick={() => saveDefaults.mutate()} disabled={saveDefaults.isPending}>
            {saveDefaults.isPending ? "Saving…" : "Save reminder automation"}
          </Button>
        </CardContent>
      </Card>

      {/* Upcoming events --------------------------------------------------- */}
      <Card className="glass border-0">
        <CardContent className="space-y-4 pt-6">
          <SectionHeader
            title="Upcoming events"
            description="Everything AHOY has imported from your calendars."
            badge={`${upcoming.length} events`}
          />
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No upcoming events yet. Add a calendar and run a sync.
            </p>
          ) : (
            <ul className="grid gap-2">
              {upcoming.map((event) => {
                const channel = config.structure.channels.find((c) => c.id === event.channelId);
                return (
                  <li
                    key={event.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/40 bg-background/30 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{event.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {new Date(event.start).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                        {event.isRecurring ? (
                          <span className="flex items-center gap-1">
                            <Repeat className="h-3 w-3" /> Recurring
                          </span>
                        ) : null}
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> {event.sourceName}
                        </span>
                        <span>🔔 {event.reminderCount} reminder(s)</span>
                        {channel ? <span>📢 #{channel.name}</span> : null}
                      </div>
                    </div>
                    <Button asChild size="sm" variant="secondary">
                      <Link
                        to="/dashboard/$guildId/event/$eventId"
                        params={{ guildId, eventId: event.id }}
                      >
                        Configure
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
