import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2, Pencil, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendar,
  sendTestReminder,
  updateCalendarEvent,
} from "@/lib/calendar.functions";

import { Field, PickerSelect, SectionHeader } from "./fields";
import type { PanelProps } from "./types";

type Draft = {
  eventId: string | null;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  channelId: string | null;
  mention: string;
  remindersEnabled: boolean;
};

const MENTIONS = [
  { id: "none", name: "No mention" },
  { id: "everyone", name: "@everyone" },
  { id: "here", name: "@here" },
];

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function emptyDraft(): Draft {
  const start = new Date(Date.now() + 3600_000);
  start.setMinutes(0, 0, 0);
  return {
    eventId: null,
    title: "",
    description: "",
    location: "",
    start: toLocalInput(start.toISOString()),
    end: "",
    channelId: null,
    mention: "none",
    remindersEnabled: true,
  };
}

export function CalendarEventsPanel({ guildId, config }: PanelProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);

  const channels = useMemo(
    () =>
      config.structure.channels
        .filter((channel) => channel.kind === "text" || channel.kind === "announcement")
        .map((channel) => ({ id: channel.id, name: `#${channel.name}` })),
    [config.structure.channels],
  );

  const calendar = useQuery({
    queryKey: ["calendar", guildId],
    queryFn: () => getCalendar({ data: { guildId } }),
  });

  const events = calendar.data?.events ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["calendar", guildId] });

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      const payload = {
        guildId,
        title: value.title.trim(),
        description: value.description.trim() || null,
        location: value.location.trim() || null,
        start: new Date(value.start).toISOString(),
        end: value.end ? new Date(value.end).toISOString() : null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        isAllDay: false,
        channelId: value.channelId,
        mention: value.mention,
        remindersEnabled: value.remindersEnabled,
      };
      return value.eventId
        ? updateCalendarEvent({ data: { ...payload, eventId: value.eventId } })
        : createCalendarEvent({ data: payload });
    },
    onSuccess: (_result, value) => {
      toast.success(value.eventId ? "Event updated." : "Event created.");
      setDraft(null);
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (eventId: string) => deleteCalendarEvent({ data: { guildId, eventId } }),
    onSuccess: () => {
      toast.success("Event deleted.");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remind = useMutation({
    mutationFn: (vars: { eventId: string; channelId: string }) =>
      sendTestReminder({ data: { guildId, ...vars } }),
    onSuccess: () => toast.success("Reminder sent to Discord."),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card className="glass border-0">
      <CardContent className="space-y-5 pt-6">
        <SectionHeader
          title="Events"
          description="Create events by hand, edit or delete them, and fire a reminder into Discord straight away. Imported feed events show here too."
          badge={`${events.length} upcoming`}
        />

        {draft ? (
          <div className="space-y-4 rounded-2xl border border-border/40 bg-background/40 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {draft.eventId ? "Edit event" : "New event"}
              </p>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Field label="Title">
              <Input
                value={draft.title}
                placeholder="Crew meeting"
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <Textarea
                rows={3}
                value={draft.description}
                placeholder="What happens at this event?"
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Starts">
                <Input
                  type="datetime-local"
                  value={draft.start}
                  onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                />
              </Field>
              <Field label="Ends (optional)">
                <Input
                  type="datetime-local"
                  value={draft.end}
                  onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                />
              </Field>
              <Field label="Location (optional)">
                <Input
                  value={draft.location}
                  placeholder="Voice channel, link, address…"
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                />
              </Field>
              <Field label="Announce in">
                <PickerSelect
                  value={draft.channelId}
                  options={channels}
                  placeholder="Use the notifier channel"
                  emptyLabel="Use the notifier channel"
                  onChange={(value) => setDraft({ ...draft, channelId: value })}
                />
              </Field>
              <Field label="Mention">
                <PickerSelect
                  value={draft.mention}
                  options={MENTIONS}
                  placeholder="No mention"
                  emptyLabel="No mention"
                  onChange={(value) => setDraft({ ...draft, mention: value ?? "none" })}
                />
              </Field>
            </div>

            <div className="flex gap-2">
              <Button
                disabled={!draft.title.trim() || !draft.start || save.isPending}
                onClick={() => save.mutate(draft)}
              >
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {draft.eventId ? "Save changes" : "Create event"}
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setDraft(emptyDraft())}>
            <CalendarPlus className="h-4 w-4" /> New event
          </Button>
        )}

        {calendar.isPending ? (
          <p className="text-sm text-muted-foreground">Loading events…</p>
        ) : events.length ? (
          <div className="space-y-2">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/30 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.start).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    · {event.sourceName} · {event.reminderCount} reminder(s)
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setDraft({
                        eventId: event.id,
                        title: event.title,
                        description: "",
                        location: "",
                        start: toLocalInput(event.start),
                        end: toLocalInput(event.end),
                        channelId: event.channelId,
                        mention: "none",
                        remindersEnabled: true,
                      })
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={remind.isPending}
                    onClick={() => {
                      const channelId = event.channelId ?? calendar.data?.defaults.channelId;
                      if (!channelId) {
                        toast.error("Pick an announcement channel for this event first.");
                        return;
                      }
                      remind.mutate({ eventId: event.id, channelId });
                    }}
                  >
                    <Send className="h-3.5 w-3.5" /> Remind now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(event.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No upcoming events yet — create one above or sync a calendar feed.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
