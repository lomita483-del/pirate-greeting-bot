import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Link2, Loader2, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
  syncCalendarNow,
} from "@/lib/calendar.functions";

import { SectionHeader } from "./fields";
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
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [customValue, setCustomValue] = useState("");
  const [customUnit, setCustomUnit] = useState("minutes");
  const [automationOpen, setAutomationOpen] = useState(false);
  const automationRef = useRef<HTMLDivElement>(null);

  const [configureMode, setConfigureMode] = useState<"closed" | "choosing" | "specific">("closed");
  const [chosenEventId, setChosenEventId] = useState("");

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>("");

  const accountsQuery = useQuery({
    queryKey: ["google-accounts", guildId],
    queryFn: () => listGoogleAccounts({ data: { guildId } }),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) {
      toast.success(`${connected} connected to Google Calendar.`);
      void queryClient.invalidateQueries({ queryKey: ["google-accounts", guildId] });
    } else if (error) {
      const messages: Record<string, string> = {
        signed_out: "Your Discord session expired. Sign in again, then reconnect Google.",
        no_access: "You no longer have permission to manage this server.",
        no_refresh_token:
          "Google did not provide offline access. Remove AHOY from your Google account permissions and reconnect.",
        storage_failed: "Google connected, but AHOY could not save the account. Please try again.",
        signin_failed: "Google sign-in could not be completed. Please try again.",
        invalid_state: "The Google sign-in request expired. Please start again.",
      };
      toast.error(messages[error] ?? "Google sign-in could not be completed.");
    }
    if (connected || error) window.history.replaceState({}, "", window.location.pathname);
  }, [guildId, queryClient]);

  const calendarsQuery = useQuery({
    queryKey: ["google-calendars", guildId, selectedAccountId],
    queryFn: () =>
      listGoogleCalendarsForAccount({ data: { guildId, accountId: selectedAccountId! } }),
    enabled: Boolean(selectedAccountId),
  });

  const addGoogleCalendar = useMutation({
    mutationFn: (calendarName: string) =>
      addGoogleCalendarSource({
        data: {
          guildId,
          accountId: selectedAccountId!,
          calendarId: selectedCalendarId,
          calendarName,
        },
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


  const events = calendar.data?.events ?? [];
  const upcoming = useMemo(() => events.filter((e) => e.status === "confirmed"), [events]);

  function openAllAtOnce() {
    setConfigureMode("closed");
    requestAnimationFrame(() =>
      document
        .getElementById("event-notifiers")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }


  function goToSpecificEvent() {
    if (!chosenEventId) return;
    setConfigureMode("closed");
    navigate({ to: "/dashboard/$guildId/event/$eventId", params: { guildId, eventId: chosenEventId } });
  }

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
            <a href={`/api/public/auth/google/start?guildId=${guildId}`}>Sign in with Google</a>
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
                <p className="text-sm text-muted-foreground">No calendars found on this account.</p>
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
                          <span className={failed ? "text-destructive" : "text-emerald-400"}>
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
            In Google Calendar open{" "}
            <strong>Settings → your calendar → Secret address in iCal format</strong> and paste that
            URL here. The URL is stored server-side only and is never sent back to the browser.
          </p>
        </CardContent>
      </Card>




      {/* Upcoming events ---------------------------------------------------- */}
      <Card className="glass border-0">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  upcoming.length > 0 ? "bg-emerald-400" : "bg-muted-foreground/40"
                }`}
              />
              <div>
                <p className="text-sm font-semibold">Upcoming events</p>
                <p className="text-xs text-muted-foreground">
                  {upcoming.length} event(s) imported · used by your event notifiers
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => setConfigureMode(configureMode === "closed" ? "choosing" : "closed")}
              disabled={upcoming.length === 0}
            >
              <Settings2 className="h-4 w-4" /> Configure
            </Button>
          </div>

          {configureMode === "choosing" ? (
            <div className="flex flex-wrap gap-2 rounded-xl border border-border/40 bg-background/30 p-3">
              <p className="w-full text-sm text-muted-foreground">
                Configure every event at once with an event notifier, or pick a specific one?
              </p>
              <Button size="sm" onClick={openAllAtOnce}>
                All at once
              </Button>

              <Button size="sm" variant="secondary" onClick={() => setConfigureMode("specific")}>
                A specific event
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfigureMode("closed")}>
                Cancel
              </Button>
            </div>
          ) : null}

          {configureMode === "specific" ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/40 bg-background/30 p-3">
              <select
                className="h-9 min-w-[220px] flex-1 rounded-md border border-border/50 bg-background px-2 text-sm"
                value={chosenEventId}
                onChange={(e) => setChosenEventId(e.target.value)}
              >
                <option value="">Select an event…</option>
                {upcoming.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} —{" "}
                    {new Date(event.start).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </option>
                ))}
              </select>
              <Button size="sm" disabled={!chosenEventId} onClick={goToSpecificEvent}>
                Configure
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfigureMode("closed")}>
                Cancel
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
