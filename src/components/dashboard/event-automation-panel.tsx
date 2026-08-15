import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, FileText, Loader2, Plus, Rss, ScrollText, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteNotifier,
  deleteTemplate,
  generateSummaryNow,
  listEventAutomation,
  saveFeedSettings,
  saveNotifier,
  saveSummarySchedule,
  saveTemplate,
} from "@/lib/calendar.functions";
import {
  DEFAULT_REMINDER_TEMPLATE,
  DEFAULT_SUMMARY_TEMPLATE,
  TEMPLATE_VARIABLES,
  renderTemplate,
  type TemplateStructure,
} from "@/lib/event-templates";

import { Field, MultiPicker, PickerSelect, SectionHeader, ToggleRow, type Option } from "./fields";
import { OFFSET_PRESETS, offsetLabel } from "./calendar-panel";
import type { PanelProps } from "./types";

type NotifierDraft = {
  id: string | null;
  name: string;
  channelId: string | null;
  categoryId: string | null;
  calendarSourceId: string | null;
  offsets: number[];
  roleMentions: string[];
  cleanupPrevious: boolean;
  templateId: string | null;
  enabled: boolean;
};

const EMPTY_NOTIFIER: NotifierDraft = {
  id: null,
  name: "Event notifier",
  channelId: null,
  categoryId: null,
  calendarSourceId: null,
  offsets: [1440, 60, 10, 0],
  roleMentions: [],
  cleanupPrevious: false,
  templateId: null,
  enabled: true,
};

type TemplateDraft = {
  id: string | null;
  name: string;
  templateType: "reminder" | "summary";
  structure: TemplateStructure;
};

const EMPTY_TEMPLATE: TemplateDraft = {
  id: null,
  name: "Reminder template",
  templateType: "reminder",
  structure: DEFAULT_REMINDER_TEMPLATE,
};

export function EventAutomationPanel({ guildId, config }: PanelProps) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["event-automation", guildId],
    queryFn: () => listEventAutomation({ data: { guildId } }),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["event-automation", guildId] });
    queryClient.invalidateQueries({ queryKey: ["calendar", guildId] });
  };

  const channels: Option[] = config.structure.channels
    .filter((c) => c.kind !== "category")
    .map((c) => ({ id: c.id, name: `#${c.name}` }));
  const categories: Option[] = config.structure.channels
    .filter((c) => c.kind === "category")
    .map((c) => ({ id: c.id, name: c.name }));
  const mentionOptions: Option[] = [
    { id: "everyone", name: "@everyone" },
    { id: "here", name: "@here" },
    ...config.structure.roles.map((r) => ({ id: r.id, name: `@${r.name}` })),
  ];

  const [notifier, setNotifier] = useState<NotifierDraft | null>(null);
  const [template, setTemplate] = useState<TemplateDraft | null>(null);
  const [summaryDraft, setSummaryDraft] = useState<{
    enabled: boolean;
    channelId: string | null;
    cadence: "daily" | "weekly";
    hourUtc: number;
    pinMessage: boolean;
    templateId: string | null;
  } | null>(null);
  const [feedDrafts, setFeedDrafts] = useState<Record<string, Record<string, unknown>>>({});

  const notifierSave = useMutation({
    mutationFn: (draft: NotifierDraft) => {
      if (!draft.channelId) throw new Error("Pick a channel for this notifier.");
      return saveNotifier({
        data: {
          guildId,
          notifierId: draft.id,
          name: draft.name.trim() || "Event notifier",
          channelId: draft.channelId,
          categoryId: draft.categoryId,
          calendarSourceId: draft.calendarSourceId,
          offsets: draft.offsets,
          roleMentions: draft.roleMentions,
          cleanupPrevious: draft.cleanupPrevious,
          templateId: draft.templateId,
          enabled: draft.enabled,
        },
      });
    },
    onSuccess: () => {
      toast.success("Notifier saved — reminders rescheduled.");
      setNotifier(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const notifierRemove = useMutation({
    mutationFn: (id: string) => deleteNotifier({ data: { guildId, notifierId: id } }),
    onSuccess: () => {
      toast.success("Notifier removed.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const templateSave = useMutation({
    mutationFn: (draft: TemplateDraft) =>
      saveTemplate({
        data: {
          guildId,
          templateId: draft.id,
          name: draft.name.trim() || "Template",
          templateType: draft.templateType,
          structure: {
            title: draft.structure.title ?? "",
            description: draft.structure.description ?? "",
            color: draft.structure.color ?? "#D4AF37",
            thumbnail: draft.structure.thumbnail ?? "",
            image: draft.structure.image ?? "",
            footer: draft.structure.footer ?? "",
            content: draft.structure.content ?? "",
            fields: draft.structure.fields ?? [],
          },
        },
      }),
    onSuccess: () => {
      toast.success("Template saved.");
      setTemplate(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const templateRemove = useMutation({
    mutationFn: (id: string) => deleteTemplate({ data: { guildId, templateId: id } }),
    onSuccess: () => {
      toast.success("Template deleted.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const summarySave = useMutation({
    mutationFn: (draft: NonNullable<typeof summaryDraft>) =>
      saveSummarySchedule({ data: { guildId, ...draft } }),
    onSuccess: () => {
      toast.success("Summary schedule saved.");
      setSummaryDraft(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const summaryNow = useMutation({
    mutationFn: (channelId: string | null) => generateSummaryNow({ data: { guildId, channelId } }),
    onSuccess: (res) => toast.success(`Summary posted with ${res.events} event(s).`),
    onError: (error: Error) => toast.error(error.message),
  });

  const feedSave = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (payload: any) => saveFeedSettings({ data: { guildId, ...payload } }),
    onSuccess: () => {
      toast.success("Feed settings saved.");
      setFeedDrafts({});
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (query.isPending) {
    return <p className="text-sm text-muted-foreground">Loading event automation…</p>;
  }
  if (query.error) {
    return <p className="text-sm text-muted-foreground">{(query.error as Error).message}</p>;
  }

  const data = query.data!;
  const templateOptions: Option[] = data.templates.map((t) => ({
    id: t.id,
    name: `${t.name} (${t.templateType})`,
  }));
  const sourceOptions: Option[] = data.feeds.map((f) => ({ id: f.id, name: f.name }));
  const summary =
    summaryDraft ?? {
      enabled: data.summary.enabled,
      channelId: data.summary.channelId,
      cadence: data.summary.cadence,
      hourUtc: data.summary.hourUtc,
      pinMessage: data.summary.pinMessage,
      templateId: data.summary.templateId,
    };

  return (
    <div className="space-y-6">
      {/* Feed settings ----------------------------------------------------- */}
      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Event feed settings"
            description="Per-feed sync behaviour: target channel, lookahead window, default voice-event duration and sync direction."
            badge={`${data.feeds.length} feed(s)`}
          />
          {data.feeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Connect a calendar above and its feed settings appear here.
            </p>
          ) : (
            data.feeds.map((feed) => {
              const draft = { ...feed, ...(feedDrafts[feed.id] ?? {}) } as typeof feed;
              const patch = (next: Partial<typeof feed>) =>
                setFeedDrafts((prev) => ({
                  ...prev,
                  [feed.id]: { ...(prev[feed.id] ?? {}), ...next },
                }));
              return (
                <div
                  key={feed.id}
                  className="space-y-4 rounded-2xl border border-border/40 bg-background/30 p-4"
                >
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Rss className="h-4 w-4 text-primary" /> {feed.name}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Target channel" hint="Where this feed's events are announced.">
                      <PickerSelect
                        value={draft.targetChannelId}
                        options={channels}
                        onChange={(v) => patch({ targetChannelId: v })}
                        placeholder="Select a channel"
                        emptyLabel="Use the server default"
                      />
                    </Field>
                    <Field label="Calendar ID" hint="e.g. you@gmail.com — shown on event cards.">
                      <Input
                        value={draft.calendarId ?? ""}
                        onChange={(e) => patch({ calendarId: e.target.value })}
                        placeholder="you@gmail.com"
                      />
                    </Field>
                    <Field label="Voice event duration (minutes)">
                      <Input
                        type="number"
                        min={5}
                        max={1440}
                        value={draft.voiceDurationDefault}
                        onChange={(e) => patch({ voiceDurationDefault: Number(e.target.value) })}
                      />
                    </Field>
                    <Field label="Lookahead (days)" hint="How far ahead events are imported.">
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={draft.lookaheadDays}
                        onChange={(e) => patch({ lookaheadDays: Number(e.target.value) })}
                      />
                    </Field>
                    <Field label="Sync direction">
                      <PickerSelect
                        value={draft.syncDirection}
                        options={[
                          { id: "gcal_to_discord", name: "Calendar → Discord" },
                          { id: "discord_to_gcal", name: "Discord → Calendar" },
                          { id: "two_way", name: "Two-way" },
                        ]}
                        onChange={(v) => patch({ syncDirection: v ?? "gcal_to_discord" })}
                        placeholder="Calendar → Discord"
                        emptyLabel="Calendar → Discord"
                      />
                    </Field>
                  </div>
                  <Field
                    label="Allowed categories"
                    hint="Restrict this feed's automation to channels inside these categories."
                  >
                    <MultiPicker
                      values={draft.allowedCategoryIds}
                      options={categories}
                      onChange={(v) => patch({ allowedCategoryIds: v })}
                      emptyLabel="This server has no categories."
                    />
                  </Field>
                  <ToggleRow
                    label="Create native Discord events"
                    description="Mirror synced events as Discord scheduled events."
                    checked={draft.createDiscordEvents}
                    onChange={(v) => patch({ createDiscordEvents: v })}
                  />
                  <Button
                    size="sm"
                    disabled={feedSave.isPending}
                    onClick={() =>
                      feedSave.mutate({
                        sourceId: feed.id,
                        targetChannelId: draft.targetChannelId,
                        calendarId: draft.calendarId?.trim() || null,
                        voiceDurationDefault: draft.voiceDurationDefault || 30,
                        lookaheadDays: draft.lookaheadDays || 30,
                        syncDirection: draft.syncDirection,
                        allowedCategoryIds: draft.allowedCategoryIds,
                        createDiscordEvents: draft.createDiscordEvents,
                      })
                    }
                  >
                    Save feed settings
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Notifiers --------------------------------------------------------- */}
      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Event notifiers"
            description="Each notifier posts its own reminder stream — its own channel, offsets, mentions and template."
            badge={`${data.notifiers.length} notifier(s)`}
          />
          <div className="grid gap-3">
            {data.notifiers.map((n) => {
              const channel = config.structure.channels.find((c) => c.id === n.channelId);
              return (
                <div
                  key={n.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/40 bg-background/30 p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Bell className="h-3.5 w-3.5 text-primary" /> {n.name}
                      {n.enabled ? null : <Badge variant="outline">paused</Badge>}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>📢 #{channel?.name ?? n.channelId}</span>
                      <span>🔔 {n.offsets.map(offsetLabel).join(", ") || "no offsets"}</span>
                      {n.roleMentions.length ? <span>📣 {n.roleMentions.length} mention(s)</span> : null}
                      {n.cleanupPrevious ? <span>🧹 cleans up previous</span> : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setNotifier({
                          id: n.id,
                          name: n.name,
                          channelId: n.channelId,
                          categoryId: n.categoryId,
                          calendarSourceId: n.calendarSourceId,
                          offsets: n.offsets,
                          roleMentions: n.roleMentions,
                          cleanupPrevious: n.cleanupPrevious,
                          templateId: n.templateId,
                          enabled: n.enabled,
                        })
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => notifierRemove.mutate(n.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {notifier ? (
            <div className="space-y-4 rounded-2xl border border-primary/30 bg-background/40 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Notifier name">
                  <Input
                    value={notifier.name}
                    onChange={(e) => setNotifier({ ...notifier, name: e.target.value })}
                  />
                </Field>
                <Field label="Channel">
                  <PickerSelect
                    value={notifier.channelId}
                    options={channels}
                    onChange={(v) => setNotifier({ ...notifier, channelId: v })}
                    placeholder="Select a channel"
                    emptyLabel="No channel"
                  />
                </Field>
                <Field label="Bound category" hint="Optional — scopes this notifier to a category.">
                  <PickerSelect
                    value={notifier.categoryId}
                    options={categories}
                    onChange={(v) => setNotifier({ ...notifier, categoryId: v })}
                    placeholder="Any category"
                    emptyLabel="Any category"
                  />
                </Field>
                <Field label="Calendar feed" hint="Leave empty to cover every connected calendar.">
                  <PickerSelect
                    value={notifier.calendarSourceId}
                    options={sourceOptions}
                    onChange={(v) => setNotifier({ ...notifier, calendarSourceId: v })}
                    placeholder="All calendars"
                    emptyLabel="All calendars"
                  />
                </Field>
                <Field label="Message template">
                  <PickerSelect
                    value={notifier.templateId}
                    options={templateOptions}
                    onChange={(v) => setNotifier({ ...notifier, templateId: v })}
                    placeholder="Built-in AHOY embed"
                    emptyLabel="Built-in AHOY embed"
                  />
                </Field>
              </div>
              <Field label="Reminder offsets">
                <div className="grid gap-2 sm:grid-cols-2">
                  {OFFSET_PRESETS.map((preset) => (
                    <label
                      key={preset.minutes}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/40 bg-background/30 px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={notifier.offsets.includes(preset.minutes)}
                        onChange={() =>
                          setNotifier({
                            ...notifier,
                            offsets: notifier.offsets.includes(preset.minutes)
                              ? notifier.offsets.filter((m) => m !== preset.minutes)
                              : [...notifier.offsets, preset.minutes],
                          })
                        }
                      />
                      {preset.label}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Role mentions">
                <MultiPicker
                  values={notifier.roleMentions}
                  options={mentionOptions}
                  onChange={(v) => setNotifier({ ...notifier, roleMentions: v })}
                  emptyLabel="No roles available."
                />
              </Field>
              <ToggleRow
                label="Clean up previous reminders"
                description="Delete this notifier's earlier reminder messages for the same event."
                checked={notifier.cleanupPrevious}
                onChange={(v) => setNotifier({ ...notifier, cleanupPrevious: v })}
              />
              <ToggleRow
                label="Notifier enabled"
                checked={notifier.enabled}
                onChange={(v) => setNotifier({ ...notifier, enabled: v })}
              />
              <div className="flex gap-2">
                <Button
                  disabled={notifierSave.isPending}
                  onClick={() => notifierSave.mutate(notifier)}
                >
                  {notifierSave.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save notifier
                </Button>
                <Button variant="ghost" onClick={() => setNotifier(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setNotifier({ ...EMPTY_NOTIFIER })}>
              <Plus className="h-4 w-4" /> Add notifier
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Templates --------------------------------------------------------- */}
      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Message & embed templates"
            description="Design reminder and summary embeds with dynamic variables. The preview renders live."
            badge={`${data.templates.length} template(s)`}
          />
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_VARIABLES.map((v) => (
              <Badge key={v} variant="outline" className="font-mono text-[10px]">
                {v}
              </Badge>
            ))}
          </div>

          <div className="grid gap-3">
            {data.templates.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/30 p-3"
              >
                <p className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-3.5 w-3.5 text-primary" /> {t.name}
                  <Badge variant="outline">{t.templateType}</Badge>
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setTemplate({
                        id: t.id,
                        name: t.name,
                        templateType: t.templateType,
                        structure: t.structure ?? DEFAULT_REMINDER_TEMPLATE,
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => templateRemove.mutate(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {template ? (
            <TemplateEditor
              draft={template}
              onChange={setTemplate}
              onCancel={() => setTemplate(null)}
              onSave={() => templateSave.mutate(template)}
              saving={templateSave.isPending}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setTemplate({ ...EMPTY_TEMPLATE })}>
                <Plus className="h-4 w-4" /> New reminder template
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  setTemplate({
                    id: null,
                    name: "Summary template",
                    templateType: "summary",
                    structure: DEFAULT_SUMMARY_TEMPLATE,
                  })
                }
              >
                <Plus className="h-4 w-4" /> New summary template
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summaries --------------------------------------------------------- */}
      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Event summaries"
            description="AHOY posts (and optionally pins) a digest of upcoming events on a schedule."
          />
          <ToggleRow
            label="Scheduled summaries enabled"
            checked={summary.enabled}
            onChange={(v) => setSummaryDraft({ ...summary, enabled: v })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Summary channel">
              <PickerSelect
                value={summary.channelId}
                options={channels}
                onChange={(v) => setSummaryDraft({ ...summary, channelId: v })}
                placeholder="Select a channel"
                emptyLabel="No channel selected"
              />
            </Field>
            <Field label="Cadence">
              <PickerSelect
                value={summary.cadence}
                options={[
                  { id: "daily", name: "Daily" },
                  { id: "weekly", name: "Weekly" },
                ]}
                onChange={(v) =>
                  setSummaryDraft({ ...summary, cadence: (v as "daily" | "weekly") ?? "daily" })
                }
                placeholder="Daily"
                emptyLabel="Daily"
              />
            </Field>
            <Field label="Hour (UTC)">
              <Input
                type="number"
                min={0}
                max={23}
                value={summary.hourUtc}
                onChange={(e) =>
                  setSummaryDraft({ ...summary, hourUtc: Number(e.target.value) || 0 })
                }
              />
            </Field>
            <Field label="Summary template">
              <PickerSelect
                value={summary.templateId}
                options={templateOptions.filter((t) => t.name.includes("summary"))}
                onChange={(v) => setSummaryDraft({ ...summary, templateId: v })}
                placeholder="Built-in AHOY digest"
                emptyLabel="Built-in AHOY digest"
              />
            </Field>
          </div>
          <ToggleRow
            label="Pin the summary message"
            checked={summary.pinMessage}
            onChange={(v) => setSummaryDraft({ ...summary, pinMessage: v })}
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={summarySave.isPending} onClick={() => summarySave.mutate(summary)}>
              Save summary schedule
            </Button>
            <Button
              variant="secondary"
              disabled={summaryNow.isPending || !summary.channelId}
              onClick={() => summaryNow.mutate(summary.channelId)}
            >
              {summaryNow.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScrollText className="h-4 w-4" />}
              Post summary now
            </Button>
          </div>
          {data.summary.lastRunAt ? (
            <p className="text-xs text-muted-foreground">
              Last posted {new Date(data.summary.lastRunAt).toLocaleString()}.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function TemplateEditor({
  draft,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  draft: TemplateDraft;
  onChange: (next: TemplateDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const patch = (next: Partial<TemplateStructure>) =>
    onChange({ ...draft, structure: { ...draft.structure, ...next } });

  const preview = renderTemplate(draft.structure, {
    Title: "Crew briefing",
    Description: "Weekly planning call for the whole crew.",
    Location: "Bridge · Voice",
    Url: "https://example.com/event",
    StartTime: new Date(Date.now() + 3600_000),
    EndTime: new Date(Date.now() + 7200_000),
    Duration: "1 hour",
    Status: "UPCOMING",
    Mentions: "@everyone",
    Calendar: "Crew calendar",
    Rsvp: "🟢 4 attending · 🔴 1 declined",
    Frontmatter: { Thumbnail: "" },
  });

  return (
    <div className="space-y-4 rounded-2xl border border-primary/30 bg-background/40 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Template name">
          <Input value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="Template type">
          <PickerSelect
            value={draft.templateType}
            options={[
              { id: "reminder", name: "Reminder" },
              { id: "summary", name: "Summary" },
            ]}
            onChange={(v) =>
              onChange({ ...draft, templateType: (v as "reminder" | "summary") ?? "reminder" })
            }
            placeholder="Reminder"
            emptyLabel="Reminder"
          />
        </Field>
        <Field label="Message content (outside the embed)">
          <Input
            value={draft.structure.content ?? ""}
            onChange={(e) => patch({ content: e.target.value })}
            placeholder="{{.Mentions}}"
          />
        </Field>
        <Field label="Embed colour">
          <Input
            value={draft.structure.color ?? "#D4AF37"}
            onChange={(e) => patch({ color: e.target.value })}
            placeholder="#D4AF37"
          />
        </Field>
        <Field label="Embed title">
          <Input
            value={draft.structure.title ?? ""}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="🏴‍☠️ {{.Title}}"
          />
        </Field>
        <Field label="Thumbnail URL">
          <Input
            value={draft.structure.thumbnail ?? ""}
            onChange={(e) => patch({ thumbnail: e.target.value })}
            placeholder="{{.Frontmatter.Thumbnail}}"
          />
        </Field>
      </div>
      <Field label="Embed description">
        <Textarea
          rows={5}
          value={draft.structure.description ?? ""}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="Starts {{discordDateTime .StartTime 'R'}}"
        />
      </Field>
      <Field label="Footer">
        <Input
          value={draft.structure.footer ?? ""}
          onChange={(e) => patch({ footer: e.target.value })}
          placeholder="AHOY Event Automation"
        />
      </Field>

      <div className="rounded-xl border border-border/40 bg-background/30 p-4 text-sm">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Live preview</p>
        {preview.content ? <p className="mt-2 text-primary">{preview.content}</p> : null}
        <p className="mt-2 font-semibold">{String(preview.embed["title"] ?? "")}</p>
        <p className="whitespace-pre-wrap text-muted-foreground">
          {String(preview.embed["description"] ?? "")}
        </p>
      </div>

      <div className="flex gap-2">
        <Button disabled={saving} onClick={onSave}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save template
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
