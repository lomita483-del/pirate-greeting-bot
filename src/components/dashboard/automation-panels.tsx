import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteAnnouncement,
  deleteStatChannel,
  getAutomation,
  saveAnnouncement,
  saveStatChannel,
} from "@/lib/ahoy.functions";

import { Field, PickerSelect, SectionHeader, ToggleRow } from "./fields";
import type { GuildStructure } from "./types";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const STAT_KINDS = [
  { id: "members", name: "Total members" },
  { id: "humans", name: "Humans only" },
  { id: "bots", name: "Bots" },
  { id: "online", name: "Online members" },
  { id: "boosters", name: "Server boosters" },
] as const;

function useAutomation(guildId: string) {
  return useQuery({
    queryKey: ["automation", guildId],
    queryFn: () => getAutomation({ data: { guildId } }),
  });
}

/* ---------------------------------------------------------------- */

type AnnouncementDraft = {
  name: string;
  channel_id: string | null;
  message: string;
  use_embed: boolean;
  embed_title: string;
  recurrence: "once" | "hourly" | "daily" | "weekly";
  weekday: number;
  time_of_day: string;
  enabled: boolean;
};

const emptyAnnouncement: AnnouncementDraft = {
  name: "Announcement",
  channel_id: null,
  message: "",
  use_embed: false,
  embed_title: "",
  recurrence: "daily",
  weekday: 0,
  time_of_day: "12:00",
  enabled: true,
};

export function AnnouncementsPanel({
  guildId,
  structure,
}: {
  guildId: string;
  structure: GuildStructure;
}) {
  const queryClient = useQueryClient();
  const query = useAutomation(guildId);
  const save = useServerFn(saveAnnouncement);
  const remove = useServerFn(deleteAnnouncement);
  const [draft, setDraft] = useState<AnnouncementDraft>(emptyAnnouncement);
  const [editing, setEditing] = useState<string | null>(null);
  const channels = structure.channels.filter((c) => c.kind === "text");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["automation", guildId] });

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          guildId,
          id: editing ?? undefined,
          name: draft.name,
          channel_id: draft.channel_id!,
          message: draft.message,
          use_embed: draft.use_embed,
          embed_title: draft.embed_title || null,
          recurrence: draft.recurrence,
          weekday: draft.recurrence === "weekly" ? draft.weekday : null,
          time_of_day: draft.time_of_day,
          enabled: draft.enabled,
        },
      }),
    onSuccess: () => {
      toast.success(editing ? "Announcement updated" : "Announcement scheduled");
      setDraft(emptyAnnouncement);
      setEditing(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { guildId, id } }),
    onSuccess: () => {
      toast.success("Announcement deleted");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = query.data?.announcements ?? [];
  const canSave = Boolean(draft.channel_id) && draft.message.trim().length > 0;

  return (
    <Card className="glass border-0">
      <CardContent className="space-y-5 pt-6">
        <SectionHeader
          title="Scheduled announcements"
          description="AHOY posts these automatically. Times are in UTC and the schedule repeats until you disable it."
          badge={`${rows.filter((r) => r.enabled).length} active`}
        />

        {query.isPending ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing scheduled yet — create your first announcement below.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 px-4 py-3 text-sm"
              >
                <Badge
                  variant="outline"
                  className={
                    row.enabled
                      ? "border-primary/40 text-primary"
                      : "border-border text-muted-foreground"
                  }
                >
                  {row.recurrence}
                </Badge>
                <span className="font-medium">{row.name}</span>
                <span className="text-muted-foreground">
                  #{channels.find((c) => c.id === row.channel_id)?.name ?? row.channel_id} ·{" "}
                  {row.recurrence === "weekly"
                    ? `${WEEKDAYS[row.weekday ?? 0]} ${row.time_of_day}`
                    : row.time_of_day}{" "}
                  UTC
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  Next {new Date(row.next_run_at).toLocaleString()}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(row.id);
                    setDraft({
                      name: row.name,
                      channel_id: row.channel_id,
                      message: row.message,
                      use_embed: row.use_embed,
                      embed_title: row.embed_title ?? "",
                      recurrence: row.recurrence as AnnouncementDraft["recurrence"],
                      weekday: row.weekday ?? 0,
                      time_of_day: row.time_of_day,
                      enabled: row.enabled,
                    });
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete announcement"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(row.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-5 rounded-2xl border border-border/70 bg-secondary/20 p-4">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Name">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Channel">
              <PickerSelect
                value={draft.channel_id}
                options={channels}
                onChange={(v) => setDraft({ ...draft, channel_id: v })}
                placeholder="Select a channel"
              />
            </Field>
          </div>
          <Field label="Message">
            <Textarea
              rows={3}
              value={draft.message}
              onChange={(e) => setDraft({ ...draft, message: e.target.value })}
            />
          </Field>
          <div className="grid gap-5 md:grid-cols-3">
            <Field label="Repeats">
              <Select
                value={draft.recurrence}
                onValueChange={(v) =>
                  setDraft({ ...draft, recurrence: v as AnnouncementDraft["recurrence"] })
                }
              >
                <SelectTrigger className="bg-secondary/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">Once</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Time (UTC)" hint="24-hour, e.g. 18:30">
              <Input
                value={draft.time_of_day}
                onChange={(e) => setDraft({ ...draft, time_of_day: e.target.value })}
                placeholder="12:00"
              />
            </Field>
            {draft.recurrence === "weekly" ? (
              <Field label="Weekday">
                <Select
                  value={String(draft.weekday)}
                  onValueChange={(v) => setDraft({ ...draft, weekday: Number(v) })}
                >
                  <SelectTrigger className="bg-secondary/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((day, index) => (
                      <SelectItem key={day} value={String(index)}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>
          <ToggleRow
            label="Send as embed"
            checked={draft.use_embed}
            onChange={(v) => setDraft({ ...draft, use_embed: v })}
          />
          {draft.use_embed ? (
            <Field label="Embed title">
              <Input
                value={draft.embed_title}
                onChange={(e) => setDraft({ ...draft, embed_title: e.target.value })}
              />
            </Field>
          ) : null}
          <ToggleRow
            label="Enabled"
            checked={draft.enabled}
            onChange={(v) => setDraft({ ...draft, enabled: v })}
          />
          <div className="flex justify-end gap-3">
            {editing ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setDraft(emptyAnnouncement);
                }}
              >
                Cancel
              </Button>
            ) : null}
            <Button
              size="sm"
              disabled={!canSave || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              <Plus className="h-4 w-4" />
              {editing ? "Update announcement" : "Schedule announcement"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------------- */

type StatDraft = {
  channel_id: string | null;
  kind: (typeof STAT_KINDS)[number]["id"];
  name_template: string;
  enabled: boolean;
};

const emptyStat: StatDraft = {
  channel_id: null,
  kind: "members",
  name_template: "Members: {count}",
  enabled: true,
};

export function StatChannelsPanel({
  guildId,
  structure,
}: {
  guildId: string;
  structure: GuildStructure;
}) {
  const queryClient = useQueryClient();
  const query = useAutomation(guildId);
  const save = useServerFn(saveStatChannel);
  const remove = useServerFn(deleteStatChannel);
  const [draft, setDraft] = useState<StatDraft>(emptyStat);
  const voice = structure.voiceChannels ?? [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["automation", guildId] });

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          guildId,
          channel_id: draft.channel_id!,
          kind: draft.kind,
          name_template: draft.name_template,
          enabled: draft.enabled,
        },
      }),
    onSuccess: () => {
      toast.success("Stat channel saved");
      setDraft(emptyStat);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { guildId, id } }),
    onSuccess: () => {
      toast.success("Stat channel removed");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = query.data?.statChannels ?? [];

  return (
    <Card className="glass border-0">
      <CardContent className="space-y-5 pt-6">
        <SectionHeader
          title="Server stat channels"
          description="Pick a voice channel and AHOY renames it with a live count every 10 minutes. Use {count} in the template."
          badge={`${rows.length} tracked`}
        />

        {query.isPending ? (
          <Skeleton className="h-20 rounded-2xl" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No stat channels yet. Create a locked voice channel in Discord, then add it below.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 px-4 py-3 text-sm"
              >
                <Badge variant="outline" className="border-primary/40 text-primary">
                  {STAT_KINDS.find((k) => k.id === row.kind)?.name ?? row.kind}
                </Badge>
                <span className="font-medium">
                  {voice.find((c) => c.id === row.channel_id)?.name ?? row.channel_id}
                </span>
                <span className="text-muted-foreground">{row.name_template}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {row.last_value === null ? "Not updated yet" : `Last: ${row.last_value}`}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove stat channel"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(row.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-5 rounded-2xl border border-border/70 bg-secondary/20 p-4">
          <div className="grid gap-5 md:grid-cols-3">
            <Field label="Voice channel">
              <PickerSelect
                value={draft.channel_id}
                options={voice}
                onChange={(v) => setDraft({ ...draft, channel_id: v })}
                placeholder="Select a voice channel"
                emptyLabel="Not set"
              />
            </Field>
            <Field label="Counter">
              <Select
                value={draft.kind}
                onValueChange={(v) => setDraft({ ...draft, kind: v as StatDraft["kind"] })}
              >
                <SelectTrigger className="bg-secondary/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAT_KINDS.map((kind) => (
                    <SelectItem key={kind.id} value={kind.id}>
                      {kind.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Name template" hint="{count} is replaced with the live number.">
              <Input
                value={draft.name_template}
                onChange={(e) => setDraft({ ...draft, name_template: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!draft.channel_id || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              <Plus className="h-4 w-4" />
              Add stat channel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
