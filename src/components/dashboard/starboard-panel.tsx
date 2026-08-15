import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { Field, MultiPicker, PickerSelect, SectionHeader, ToggleRow } from "./fields";
import { SaveBar } from "./save-bar";
import type { PanelProps } from "./types";
import { useDraft } from "./use-draft";

export function StarboardPanel({ guildId, config, onSaved }: PanelProps) {
  const s = config.starboard;
  const channels = config.structure.channels.filter((c) => c.kind === "text");

  const form = useDraft(
    guildId,
    "starboard",
    {
      enabled: s?.enabled ?? false,
      channel_id: s?.channel_id ?? null,
      emoji: s?.emoji ?? "⭐",
      threshold: s?.threshold ?? 3,
      allow_self_star: s?.allow_self_star ?? false,
      ignored_channel_ids: s?.ignored_channel_ids ?? [],
    },
    onSaved,
  );
  const { draft, set } = form;

  return (
    <div className="space-y-6">
      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Starboard"
            description="When a message collects enough stars, AHOY reposts it in your starboard channel with a link back to the original."
          />
          <ToggleRow
            label="Enable starboard"
            checked={draft.enabled}
            onChange={(v) => set("enabled", v)}
          />
          <div className="grid gap-5 md:grid-cols-3">
            <Field label="Starboard channel">
              <PickerSelect
                value={draft.channel_id}
                options={channels}
                onChange={(v) => set("channel_id", v)}
                placeholder="Select a channel"
              />
            </Field>
            <Field label="Star emoji" hint="Any single emoji members react with.">
              <Input value={draft.emoji} onChange={(e) => set("emoji", e.target.value)} />
            </Field>
            <Field label="Star threshold" hint="Stars needed before a message is featured.">
              <Input
                type="number"
                min={1}
                max={100}
                value={draft.threshold}
                onChange={(e) =>
                  set("threshold", Math.max(1, Number.parseInt(e.target.value, 10) || 1))
                }
              />
            </Field>
          </div>
          <ToggleRow
            label="Count the author's own star"
            description="Off means self-stars still show, but the crew decides what gets featured."
            checked={draft.allow_self_star}
            onChange={(v) => set("allow_self_star", v)}
          />
          <Field label="Ignored channels">
            <MultiPicker
              values={draft.ignored_channel_ids}
              options={channels}
              onChange={(v) => set("ignored_channel_ids", v)}
              emptyLabel="Channels appear once AHOY is in the server."
            />
          </Field>
        </CardContent>
      </Card>

      <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.save} onReset={form.reset} />
    </div>
  );
}
