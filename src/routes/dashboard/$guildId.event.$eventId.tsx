import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { OFFSET_PRESETS, offsetLabel } from "@/components/dashboard/calendar-panel";
import { Field, PickerSelect, SectionHeader, ToggleRow, type Option } from "@/components/dashboard/fields";
import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { GuildConfig } from "@/components/dashboard/types";
import {
  getCalendarEvent,
  saveEventAutomation,
  sendTestReminder,
  syncCalendarNow,
} from "@/lib/calendar.functions";

export const Route = createFileRoute("/dashboard/$guildId/event/$eventId")({
  head: () => ({
    meta: [
      { title: "Event automation — AHOY" },
      {
        name: "description",
        content:
          "Review a synced calendar event and configure its Discord channel, mentions and reminder schedule.",
      },
      { property: "og:title", content: "Event automation — AHOY" },
      {
        property: "og:description",
        content: "Configure Discord reminders for a synced calendar event.",
      },
    ],
  }),
  component: () => (
    <WithConfig>{({ guildId, config }) => <EventDetail guildId={guildId} config={config} />}</WithConfig>
  ),
});

function EventDetail({ guildId, config }: { guildId: string; config: GuildConfig }) {
  const { eventId } = Route.useParams();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<{
    channelId: string | null;
    mention: string;
    offsets: number[];
    remindersEnabled: boolean;
    overridden: boolean;
  } | null>(null);

  const query = useQuery({
    queryKey: ["calendar-event", guildId, eventId],
    queryFn: () => getCalendarEvent({ data: { guildId, eventId } }),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["calendar-event", guildId, eventId] });
    queryClient.invalidateQueries({ queryKey: ["calendar", guildId] });
  };

  const channels: Option[] = config.structure.channels
    .filter((c) => c.kind !== "category")
    .map((c) => ({ id: c.id, name: `#${c.name}` }));
  const mentions: Option[] = [
    { id: "none", name: "No mention" },
    { id: "everyone", name: "@everyone" },
    { id: "here", name: "@here" },
    ...config.structure.roles.map((r) => ({ id: r.id, name: `@${r.name}` })),
  ];

  const save = useMutation({
    mutationFn: (payload: {
      channelId: string | null;
      mention: string | null;
      offsets: number[] | null;
      remindersEnabled: boolean;
    }) => saveEventAutomation({ data: { guildId, eventId, ...payload } }),
    onSuccess: () => {
      toast.success("Event automation saved.");
      setDraft(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const test = useMutation({
    mutationFn: (channelId: string) => sendTestReminder({ data: { guildId, eventId, channelId } }),
    onSuccess: () => toast.success("Test reminder sent to Discord."),
    onError: (error: Error) => toast.error(error.message),
  });

  const resync = useMutation({
    mutationFn: (sourceId: string) => syncCalendarNow({ data: { guildId, sourceId } }),
    onSuccess: () => {
      toast.success("Calendar re-synced.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (query.isPending) return <Skeleton className="h-96 rounded-2xl" />;
  if (query.error) {
    return <p className="text-sm text-muted-foreground">{(query.error as Error).message}</p>;
  }

  const { event, defaults, reminders } = query.data!;
  const current =
    draft ?? {
      channelId: event.channelId ?? defaults.discord_channel_id,
      mention: event.mention ?? defaults.mention,
      offsets: event.offsets ?? defaults.offsets,
      remindersEnabled: event.remindersEnabled,
      overridden: event.offsets !== null,
    };

  const toggleOffset = (minutes: number) =>
    setDraft({
      ...current,
      overridden: true,
      offsets: current.offsets.includes(minutes)
        ? current.offsets.filter((m) => m !== minutes)
        : [...current.offsets, minutes],
    });

  const start = new Date(event.start);

  return (
    <div>
      <Button asChild size="sm" variant="ghost" className="mb-4">
        <Link to="/dashboard/$guildId/calendar" params={{ guildId }}>
          <ArrowLeft className="h-4 w-4" /> Back to calendar
        </Link>
      </Button>

      <ModuleHeader icon={CalendarClock} title={event.title} description={event.sourceName} />

      <div className="space-y-6">
        <Card className="glass border-0">
          <CardContent className="space-y-3 pt-6">
            <SectionHeader title="Event information" description="Imported from your connected calendar." />
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Info label="Date" value={start.toLocaleDateString(undefined, { dateStyle: "full" })} />
              <Info label="Start time" value={start.toLocaleTimeString(undefined, { timeStyle: "short" })} />
              <Info
                label="End time"
                value={
                  event.end
                    ? new Date(event.end).toLocaleTimeString(undefined, { timeStyle: "short" })
                    : "—"
                }
              />
              <Info label="Timezone" value={event.timezone} />
              <Info label="Location" value={event.location ?? "—"} />
              <Info label="Calendar source" value={`${event.sourceName} (${event.sourceType})`} />
              <Info
                label="Recurring"
                value={event.isRecurring ? (event.recurrenceRule ?? "Yes") : "One-off event"}
              />
              <Info label="Status" value={event.status} />
            </dl>
            {event.description ? (
              <p className="whitespace-pre-wrap rounded-xl border border-border/40 bg-background/30 p-3 text-sm text-muted-foreground">
                {event.description}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="glass border-0">
          <CardContent className="space-y-5 pt-6">
            <SectionHeader
              title="Discord automation"
              description="Overrides the server defaults for this event only."
            />
            <ToggleRow
              label="Reminders enabled"
              checked={current.remindersEnabled}
              onChange={(v) => setDraft({ ...current, remindersEnabled: v })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Discord channel">
                <PickerSelect
                  value={current.channelId}
                  options={channels}
                  onChange={(v) => setDraft({ ...current, channelId: v })}
                  placeholder="Use the server default"
                  emptyLabel="Use the server default"
                />
              </Field>
              <Field label="Mention">
                <PickerSelect
                  value={current.mention}
                  options={mentions}
                  onChange={(v) => setDraft({ ...current, mention: v ?? "none" })}
                  placeholder="No mention"
                  emptyLabel="No mention"
                />
              </Field>
            </div>

            <Field
              label="Reminder schedule"
              hint={`Server defaults: ${defaults.offsets.map(offsetLabel).join(", ") || "none"}`}
            >
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
            </Field>

            <div className="rounded-xl border border-border/40 bg-background/30 p-4 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Message preview</p>
              <p className="mt-2 font-semibold text-primary">🏴‍☠️ AHOY EVENT REMINDER</p>
              <p className="mt-1 font-medium">{event.title}</p>
              <p className="text-muted-foreground">
                The event starts soon.
                <br />
                📅 {start.toLocaleString()}
                {event.location ? (
                  <>
                    <br />📍 {event.location}
                  </>
                ) : null}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  save.mutate({
                    channelId: current.channelId,
                    mention: current.mention,
                    offsets: current.offsets,
                    remindersEnabled: current.remindersEnabled,
                  })
                }
                disabled={save.isPending}
              >
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
              <Button
                variant="secondary"
                disabled={!current.channelId || test.isPending}
                onClick={() => current.channelId && test.mutate(current.channelId)}
              >
                {test.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Send test reminder
              </Button>
              <Button
                variant="ghost"
                disabled={resync.isPending}
                onClick={() =>
                  queryClient
                    .fetchQuery({
                      queryKey: ["calendar", guildId],
                      queryFn: () => import("@/lib/calendar.functions").then((m) => m.getCalendar({ data: { guildId } })),
                    })
                    .then((data) => {
                      const source = data.events.find((e) => e.id === eventId)?.sourceId;
                      if (source) resync.mutate(source);
                    })
                }
              >
                Sync event
              </Button>
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() =>
                  save.mutate({
                    channelId: current.channelId,
                    mention: current.mention,
                    offsets: current.offsets,
                    remindersEnabled: false,
                  })
                }
              >
                Disable reminders
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-0">
          <CardContent className="space-y-3 pt-6">
            <SectionHeader
              title="Scheduled reminders"
              description="Reminder jobs AHOY will deliver to Discord."
              badge={`${reminders.length}`}
            />
            {reminders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No reminder jobs yet — pick a channel and save.
              </p>
            ) : (
              <ul className="grid gap-2">
                {reminders.map((job) => (
                  <li
                    key={job.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/30 px-3 py-2 text-sm"
                  >
                    <span>{offsetLabel(job.minutes)}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(job.scheduledFor).toLocaleString()}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {job.status}
                      {job.attempts ? ` · ${job.attempts} attempt(s)` : ""}
                    </Badge>
                    {job.error ? (
                      <span className="w-full text-xs text-destructive">{job.error}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
