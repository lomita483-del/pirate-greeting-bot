import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Field,
  ImageUrlField,
  MultiPicker,
  PickerSelect,
  SectionHeader,
  ToggleRow,
} from "./fields";
import { TicketPanelPublisher } from "./ticket-panel-publisher";

import { SaveBar } from "./save-bar";
import type { PanelProps } from "./types";
import { useDraft } from "./use-draft";

function num(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/* ---------------------------------------------------------------- */

export function GeneralPanel({ guildId, config, onSaved }: PanelProps) {
  const s = config.settings;
  const channels = config.structure.channels.filter((c) => c.kind === "text");
  const categories = config.structure.channels.filter((c) => c.kind === "category");

  const form = useDraft(
    guildId,
    "general",
    {
      prefix: s?.prefix ?? "!",
      currency_name: s?.currency_name ?? "doubloons",
      currency_symbol: s?.currency_symbol ?? "🪙",
      timezone: s?.timezone ?? "UTC",
      mod_log_channel_id: s?.mod_log_channel_id ?? null,
      xp_enabled: s?.xp_enabled ?? true,
      xp_per_message: s?.xp_per_message ?? 15,
      xp_cooldown_seconds: s?.xp_cooldown_seconds ?? 60,
      level_up_message: s?.level_up_message ?? "Ahoy {user}, ye reached level {level}!",
      level_up_channel_id: s?.level_up_channel_id ?? null,
      economy_enabled: s?.economy_enabled ?? true,
      daily_reward: s?.daily_reward ?? 250,
      starting_balance: s?.starting_balance ?? 100,
      tickets_enabled: s?.tickets_enabled ?? true,
      ticket_category_id: s?.ticket_category_id ?? null,
      ticket_panel_channel_id: s?.ticket_panel_channel_id ?? null,
      ticket_support_role_ids: s?.ticket_support_role_ids ?? [],
      ticket_welcome_message:
        s?.ticket_welcome_message ?? "Thanks for reaching out — the crew will be with you shortly.",
      ticket_transcripts_enabled: s?.ticket_transcripts_enabled ?? true,
    },
    onSaved,
  );
  const { draft, set } = form;

  return (
    <div className="space-y-6">
      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Core"
            description="Prefix, currency and where moderation is logged."
          />
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Legacy prefix"
              hint="Slash commands always work; this is for text commands."
            >
              <Input
                value={draft.prefix}
                maxLength={5}
                onChange={(e) => set("prefix", e.target.value)}
              />
            </Field>
            <Field label="Timezone">
              <Input value={draft.timezone} onChange={(e) => set("timezone", e.target.value)} />
            </Field>
            <Field label="Currency name">
              <Input
                value={draft.currency_name}
                onChange={(e) => set("currency_name", e.target.value)}
              />
            </Field>
            <Field label="Currency symbol">
              <Input
                value={draft.currency_symbol}
                onChange={(e) => set("currency_symbol", e.target.value)}
              />
            </Field>
            <Field label="Moderation log channel">
              <PickerSelect
                value={draft.mod_log_channel_id}
                options={channels}
                onChange={(v) => set("mod_log_channel_id", v)}
                placeholder="Select a channel"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="XP & levels"
            description="Reward active crew members for chatting."
          />
          <ToggleRow
            label="Enable XP system"
            checked={draft.xp_enabled}
            onChange={(v) => set("xp_enabled", v)}
          />
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="XP per message">
              <Input
                type="number"
                min={1}
                max={500}
                value={draft.xp_per_message}
                onChange={(e) => set("xp_per_message", num(e.target.value, 15))}
              />
            </Field>
            <Field label="Cooldown (seconds)">
              <Input
                type="number"
                min={0}
                max={3600}
                value={draft.xp_cooldown_seconds}
                onChange={(e) => set("xp_cooldown_seconds", num(e.target.value, 60))}
              />
            </Field>
            <Field label="Level-up channel" hint="Leave unset to reply in the active channel.">
              <PickerSelect
                value={draft.level_up_channel_id}
                options={channels}
                onChange={(v) => set("level_up_channel_id", v)}
                placeholder="Select a channel"
              />
            </Field>
            <Field label="Level-up message" hint="Placeholders: {user}, {level}">
              <Input
                value={draft.level_up_message}
                onChange={(e) => set("level_up_message", e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader title="Economy" description="Daily rewards and starting balances." />
          <ToggleRow
            label="Enable economy"
            checked={draft.economy_enabled}
            onChange={(v) => set("economy_enabled", v)}
          />
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Daily reward">
              <Input
                type="number"
                min={0}
                value={draft.daily_reward}
                onChange={(e) => set("daily_reward", num(e.target.value, 250))}
              />
            </Field>
            <Field label="Starting balance">
              <Input
                type="number"
                min={0}
                value={draft.starting_balance}
                onChange={(e) => set("starting_balance", num(e.target.value, 100))}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Tickets"
            description="Support requests handled in private channels."
          />
          <ToggleRow
            label="Enable tickets"
            checked={draft.tickets_enabled}
            onChange={(v) => set("tickets_enabled", v)}
          />
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Ticket category">
              <PickerSelect
                value={draft.ticket_category_id}
                options={categories}
                onChange={(v) => set("ticket_category_id", v)}
                placeholder="Select a category"
              />
            </Field>
            <Field label="Panel channel">
              <PickerSelect
                value={draft.ticket_panel_channel_id}
                options={channels}
                onChange={(v) => set("ticket_panel_channel_id", v)}
                placeholder="Select a channel"
              />
            </Field>
          </div>
          <Field label="Support roles">
            <MultiPicker
              values={draft.ticket_support_role_ids}
              options={config.structure.roles}
              onChange={(v) => set("ticket_support_role_ids", v)}
              emptyLabel="Invite AHOY to this server to load roles."
            />
          </Field>
          <Field label="Ticket welcome message">
            <Textarea
              rows={3}
              value={draft.ticket_welcome_message}
              onChange={(e) => set("ticket_welcome_message", e.target.value)}
            />
          </Field>
          <ToggleRow
            label="Save transcripts"
            description="Store ticket messages so you can review them later."
            checked={draft.ticket_transcripts_enabled}
            onChange={(v) => set("ticket_transcripts_enabled", v)}
          />
          <TicketPanelPublisher
            guildId={guildId}
            channels={channels}
            defaultChannelId={draft.ticket_panel_channel_id}
          />
        </CardContent>
      </Card>

      <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.save} onReset={form.reset} />
    </div>
  );
}

/* ---------------------------------------------------------------- */

export function GoodbyePanel({ guildId, config, onSaved }: PanelProps) {
  const w = config.welcome;
  const channels = config.structure.channels.filter((c) => c.kind === "text");

  const form = useDraft(
    guildId,
    "welcome",
    {
      goodbye_enabled: w?.goodbye_enabled ?? false,
      goodbye_channel_id: w?.goodbye_channel_id ?? null,
      goodbye_message: w?.goodbye_message ?? "{user} has sailed off into the fog.",
    },
    onSaved,
  );
  const { draft, set } = form;

  return (
    <div className="space-y-6">
      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Goodbye"
            description="Send a farewell when someone leaves. Placeholders: {user}, {username}, {server}, {membercount}."
          />
          <ToggleRow
            label="Enable goodbye messages"
            checked={draft.goodbye_enabled}
            onChange={(v) => set("goodbye_enabled", v)}
          />
          <Field label="Goodbye channel">
            <PickerSelect
              value={draft.goodbye_channel_id}
              options={channels}
              onChange={(v) => set("goodbye_channel_id", v)}
              placeholder="Select a channel"
            />
          </Field>
          <Field label="Goodbye message">
            <Textarea
              rows={2}
              value={draft.goodbye_message}
              onChange={(e) => set("goodbye_message", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.save} onReset={form.reset} />
    </div>
  );
}


/* ---------------------------------------------------------------- */
/* Logging — granular, per-event-type channel routing               */
/* ---------------------------------------------------------------- */

const LOG_EVENTS = [
  ["member_join", "Member joined"],
  ["member_leave", "Member left"],
  ["message_delete", "Message deleted"],
  ["message_edit", "Message edited"],
  ["moderation_actions", "Moderation actions"],
  ["role_changes", "Role changes"],
  ["channel_changes", "Channel changes"],
  ["server_changes", "Server changes"],
  ["voice_activity", "Voice activity"],
] as const;

type EventDef = { key: string; label: string };
type EventCategory = { title: string; events: EventDef[] };

const GRANULAR_CATEGORIES: EventCategory[] = [
  {
    title: "Channels",
    events: [
      { key: "channel_create", label: "Channel Create" },
      { key: "channel_delete", label: "Channel Delete" },
      { key: "channel_name_update", label: "Channel Name Update" },
      { key: "channel_topic_update", label: "Channel Topic Update" },
      { key: "channel_nsfw_update", label: "Channel NSFW Update" },
      { key: "channel_parent_update", label: "Channel Category Update" },
      { key: "channel_slow_mode_update", label: "Channel Slow Mode Update" },
    ],
  },
  {
    title: "Roles",
    events: [
      { key: "role_create", label: "Role Create" },
      { key: "role_delete", label: "Role Delete" },
      { key: "role_name_update", label: "Role Name Update" },
      { key: "role_color_update", label: "Role Color Update" },
      { key: "role_permissions_update", label: "Role Permissions Update" },
      { key: "role_hoist_update", label: "Role Hoist Update" },
      { key: "role_mentionable_update", label: "Role Mentionable Update" },
      { key: "role_position_update", label: "Role Position Update" },
    ],
  },
  {
    title: "Messages",
    events: [
      { key: "message_delete", label: "Message Delete" },
      { key: "message_bulk_delete", label: "Message Bulk Delete" },
      { key: "message_edit", label: "Message Edit" },
    ],
  },
  {
    title: "Users",
    events: [
      { key: "user_join", label: "User Join" },
      { key: "user_leave", label: "User Leave" },
      { key: "user_roles_add", label: "User Roles Add" },
      { key: "user_roles_remove", label: "User Roles Remove" },
      { key: "user_name_update", label: "Nickname Update" },
      { key: "user_avatar_update", label: "Avatar Update" },
      { key: "user_timed_out", label: "User Timed Out" },
      { key: "user_timeout_removed", label: "User Timeout Removed" },
    ],
  },
  {
    title: "Voice",
    events: [
      { key: "voice_user_join", label: "Voice User Join" },
      { key: "voice_user_leave", label: "Voice User Leave" },
      { key: "voice_user_switch", label: "Voice User Switch" },
    ],
  },
  {
    title: "Server",
    events: [
      { key: "server_name_update", label: "Server Name Update" },
      { key: "server_icon_update", label: "Server Icon Update" },
      { key: "server_owner_update", label: "Server Owner Update" },
      { key: "verification_level_update", label: "Verification Level Update" },
      { key: "server_boost_level_update", label: "Server Boost Level Update" },
    ],
  },
  {
    title: "Emojis & Stickers",
    events: [
      { key: "emoji_create", label: "Emoji Create" },
      { key: "emoji_delete", label: "Emoji Delete" },
      { key: "sticker_create", label: "Sticker Create" },
      { key: "sticker_delete", label: "Sticker Delete" },
    ],
  },
  {
    title: "Invites",
    events: [
      { key: "invite_create", label: "Invite Create" },
      { key: "invite_delete", label: "Invite Delete" },
    ],
  },
  {
    title: "Threads",
    events: [
      { key: "thread_create", label: "Thread Create" },
      { key: "thread_delete", label: "Thread Delete" },
      { key: "thread_archive", label: "Thread Archive" },
      { key: "thread_unarchive", label: "Thread Unarchive" },
      { key: "thread_lock", label: "Thread Lock" },
      { key: "thread_unlock", label: "Thread Unlock" },
      { key: "thread_name_update", label: "Thread Name Update" },
    ],
  },
  {
    title: "Webhooks",
    events: [{ key: "webhook_update", label: "Webhook Activity" }],
  },
  {
    title: "Moderation",
    events: [
      { key: "moderation_ban", label: "Ban Add" },
      { key: "moderation_unban", label: "Ban Remove" },
      { key: "moderation_kick", label: "Kick" },
      { key: "moderation_warn", label: "Warn Add" },
      { key: "moderation_timeout", label: "Timeout Add" },
      { key: "moderation_untimeout", label: "Timeout Remove" },
      { key: "moderation_automod", label: "AutoMod Action" },
    ],
  },
];

export function LoggingPanel({ guildId, config, onSaved }: PanelProps) {
  const l = config.logging as
    | (NonNullable<typeof config.logging> & {
        channel_overrides?: Record<string, string | null> | null;
      })
    | null
    | undefined;

  const channels = config.structure.channels.filter((c) => c.kind === "text");
  const form = useDraft(
    guildId,
    "logging",
    {
      enabled: l?.enabled ?? false,
      log_channel_id: l?.log_channel_id ?? null,
      member_join: l?.member_join ?? true,
      member_leave: l?.member_leave ?? true,
      message_delete: l?.message_delete ?? true,
      message_edit: l?.message_edit ?? true,
      moderation_actions: l?.moderation_actions ?? true,
      role_changes: l?.role_changes ?? true,
      channel_changes: l?.channel_changes ?? false,
      server_changes: l?.server_changes ?? false,
      voice_activity: l?.voice_activity ?? false,
      channel_overrides: (l?.channel_overrides ?? {}) as Record<string, string | null>,
    },
    onSaved,
  );
  const { draft, set } = form;

  function setOverride(key: string, channelId: string | null) {
    const next = { ...draft.channel_overrides };
    if (channelId) next[key] = channelId;
    else delete next[key];
    set("channel_overrides", next);
  }

  function setCategoryChannel(category: EventCategory, channelId: string | null) {
    const next = { ...draft.channel_overrides };
    for (const evt of category.events) {
      if (channelId) next[evt.key] = channelId;
      else delete next[evt.key];
    }
    set("channel_overrides", next);
  }

  return (
    <div className="space-y-6">
      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Event logging"
            description="Keep a written record of everything on deck."
          />
          <ToggleRow
            label="Enable logging"
            checked={draft.enabled}
            onChange={(v) => set("enabled", v)}
          />
          <Field
            label="Default log channel"
            hint="Used by the original broad category toggles below."
          >
            <PickerSelect
              value={draft.log_channel_id}
              options={channels}
              onChange={(v) => set("log_channel_id", v)}
              placeholder="Select a channel"
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            {LOG_EVENTS.map(([key, label]) => (
              <ToggleRow
                key={key}
                label={label}
                checked={draft[key]}
                onChange={(v) => set(key, v)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-0">
        <CardContent className="space-y-6 pt-6">
          <SectionHeader
            title="Detailed event log"
            description="Route each specific event type to its own channel. Leave a type unset to skip it."
          />
          {GRANULAR_CATEGORIES.map((category) => (
            <div key={category.title} className="space-y-2 rounded-xl border border-border/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{category.title}</p>
                <div className="w-48">
                  <PickerSelect
                    value={null}
                    options={channels}
                    onChange={(v) => setCategoryChannel(category, v)}
                    placeholder="Set category channel"
                  />
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {category.events.map((evt) => (
                  <div
                    key={evt.key}
                    className="flex items-center justify-between gap-3 rounded-lg bg-secondary/30 px-3 py-2"
                  >
                    <span className="text-sm text-muted-foreground">{evt.label}</span>
                    <div className="w-40">
                      <PickerSelect
                        value={draft.channel_overrides[evt.key] ?? null}
                        options={channels}
                        onChange={(v) => setOverride(evt.key, v)}
                        placeholder="Set channel"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.save} onReset={form.reset} />
    </div>
  );
}

/* ---------------------------------------------------------------- */

type ModAction = "delete" | "warn" | "timeout";

const ACTIONS: Array<[ModAction, string]> = [
  ["delete", "Delete message"],
  ["warn", "Delete + warn"],
  ["timeout", "Delete + timeout"],
];

function ActionSelect({
  value,
  onChange,
}: {
  value: ModAction;
  onChange: (value: ModAction) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ModAction)}>
      <SelectTrigger className="bg-secondary/40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ACTIONS.map(([id, label]) => (
          <SelectItem key={id} value={id}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AutoModPanel({ guildId, config, onSaved }: PanelProps) {
  const a = config.automod;
  const form = useDraft(
    guildId,
    "automod",
    {
      enabled: a?.enabled ?? false,
      anti_spam_enabled: a?.anti_spam_enabled ?? true,
      anti_spam_messages: a?.anti_spam_messages ?? 5,
      anti_spam_seconds: a?.anti_spam_seconds ?? 5,
      anti_spam_action: (a?.anti_spam_action ?? "timeout") as ModAction,
      mention_limit_enabled: a?.mention_limit_enabled ?? true,
      mention_limit: a?.mention_limit ?? 6,
      mention_action: (a?.mention_action ?? "warn") as ModAction,
      invite_filter_enabled: a?.invite_filter_enabled ?? true,
      invite_action: (a?.invite_action ?? "delete") as ModAction,
      word_filter_enabled: a?.word_filter_enabled ?? false,
      blocked_words: a?.blocked_words ?? [],
      word_action: (a?.word_action ?? "delete") as ModAction,
      duplicate_filter_enabled: a?.duplicate_filter_enabled ?? false,
      duplicate_action: (a?.duplicate_action ?? "delete") as ModAction,
      timeout_seconds: a?.timeout_seconds ?? 600,
      ignored_role_ids: a?.ignored_role_ids ?? [],
      ignored_channel_ids: a?.ignored_channel_ids ?? [],
    },
    onSaved,
  );
  const { draft, set } = form;

  return (
    <div className="space-y-6">
      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="AutoMod"
            description="Automatic filters run before XP and custom commands."
            badge={draft.enabled ? "Active" : "Off"}
          />
          <ToggleRow
            label="Enable AutoMod"
            checked={draft.enabled}
            onChange={(v) => set("enabled", v)}
          />

          <div className="space-y-4 rounded-xl border border-border/70 p-4">
            <ToggleRow
              label="Anti-spam"
              description="Too many messages in a short window."
              checked={draft.anti_spam_enabled}
              onChange={(v) => set("anti_spam_enabled", v)}
            />
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Messages">
                <Input
                  type="number"
                  min={2}
                  max={30}
                  value={draft.anti_spam_messages}
                  onChange={(e) => set("anti_spam_messages", num(e.target.value, 5))}
                />
              </Field>
              <Field label="Within seconds">
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={draft.anti_spam_seconds}
                  onChange={(e) => set("anti_spam_seconds", num(e.target.value, 5))}
                />
              </Field>
              <Field label="Action">
                <ActionSelect
                  value={draft.anti_spam_action}
                  onChange={(v) => set("anti_spam_action", v)}
                />
              </Field>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border/70 p-4">
            <ToggleRow
              label="Mention flood"
              checked={draft.mention_limit_enabled}
              onChange={(v) => set("mention_limit_enabled", v)}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Max mentions per message">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={draft.mention_limit}
                  onChange={(e) => set("mention_limit", num(e.target.value, 6))}
                />
              </Field>
              <Field label="Action">
                <ActionSelect
                  value={draft.mention_action}
                  onChange={(v) => set("mention_action", v)}
                />
              </Field>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border/70 p-4">
            <ToggleRow
              label="Invite links"
              checked={draft.invite_filter_enabled}
              onChange={(v) => set("invite_filter_enabled", v)}
            />
            <Field label="Action">
              <ActionSelect value={draft.invite_action} onChange={(v) => set("invite_action", v)} />
            </Field>
          </div>

          <div className="space-y-4 rounded-xl border border-border/70 p-4">
            <ToggleRow
              label="Word filter"
              checked={draft.word_filter_enabled}
              onChange={(v) => set("word_filter_enabled", v)}
            />
            <Field label="Blocked words" hint="One per line.">
              <Textarea
                rows={4}
                value={draft.blocked_words.join("\n")}
                onChange={(e) =>
                  set(
                    "blocked_words",
                    e.target.value
                      .split("\n")
                      .map((word) => word.trim().toLowerCase())
                      .filter(Boolean)
                      .slice(0, 200),
                  )
                }
              />
            </Field>
            <Field label="Action">
              <ActionSelect value={draft.word_action} onChange={(v) => set("word_action", v)} />
            </Field>
          </div>

          <div className="space-y-4 rounded-xl border border-border/70 p-4">
            <ToggleRow
              label="Duplicate messages"
              checked={draft.duplicate_filter_enabled}
              onChange={(v) => set("duplicate_filter_enabled", v)}
            />
            <Field label="Action">
              <ActionSelect
                value={draft.duplicate_action}
                onChange={(v) => set("duplicate_action", v)}
              />
            </Field>
          </div>

          <Field label="Timeout length (seconds)">
            <Input
              type="number"
              min={60}
              max={2419200}
              value={draft.timeout_seconds}
              onChange={(e) => set("timeout_seconds", num(e.target.value, 600))}
            />
          </Field>
          <Field label="Ignored roles">
            <MultiPicker
              values={draft.ignored_role_ids}
              options={config.structure.roles}
              onChange={(v) => set("ignored_role_ids", v)}
              emptyLabel="Invite AHOY to this server to load roles."
            />
          </Field>
          <Field label="Ignored channels">
            <MultiPicker
              values={draft.ignored_channel_ids}
              options={config.structure.channels.filter((c) => c.kind === "text")}
              onChange={(v) => set("ignored_channel_ids", v)}
              emptyLabel="Invite AHOY to this server to load channels."
            />
          </Field>
        </CardContent>
      </Card>
      <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.save} onReset={form.reset} />
    </div>
  );
}
