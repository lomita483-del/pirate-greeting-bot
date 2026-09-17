import { useState } from "react";
import { MessageCircle, Reply, Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

import { Field, SectionHeader, ToggleRow } from "./fields";
import type { PanelProps } from "./types";
import { saveMentionSettings } from "@/lib/mention.functions";

export function BotMentionPanel({ guildId, config, onSaved }: PanelProps) {
  const s = (config.settings ?? {}) as Record<string, any>;
  const [enabled, setEnabled] = useState(Boolean(s.mention_enabled ?? true));
  const [mode, setMode] = useState<"reply" | "channel">(s.mention_response_mode === "channel" ? "channel" : "reply");
  const [response, setResponse] = useState(String(s.mention_response ?? "Ahoy {user}! I'm on deck. Ask me for **help** or **status**, or use `/help` to explore the command navigator."));
  const [cooldown, setCooldown] = useState(Number(s.mention_cooldown_seconds ?? 3));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await saveMentionSettings({ data: {
        guildId,
        mention_enabled: enabled,
        mention_response_mode: mode,
        mention_response: response,
        mention_cooldown_seconds: Math.max(0, Math.min(3600, cooldown || 0)),
      } });
      setSaved(true);
      onSaved();
      window.setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Bot Mention Response"
            description="Configure what !HOY does when a member directly tags the bot. This is the canonical mention-response control for this server."
          />

          <ToggleRow
            label="Respond to direct @bot mentions"
            description="When enabled, !HOY listens for its Discord mention and responds without requiring a slash command."
            checked={enabled}
            onChange={setEnabled}
          />

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Response mode" hint="Reply attaches the response to the member's message; channel sends a normal message.">
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as "reply" | "channel")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="reply">Reply to the tagged message</option>
                <option value="channel">Normal channel message</option>
              </select>
            </Field>

            <Field label="Mention cooldown (seconds)" hint="Per member, per server. Set to 0 for no cooldown.">
              <Input type="number" min={0} max={3600} value={cooldown} onChange={(event) => setCooldown(Math.max(0, Number.parseInt(event.target.value || "0", 10) || 0))} />
            </Field>
          </div>

          <Field label="Default mention response" hint="Placeholders: {user}, {username}, {server}. Built-in help/status requests remain intelligent.">
            <Textarea rows={4} maxLength={1000} value={response} onChange={(event) => setResponse(event.target.value)} />
          </Field>

          <div className="rounded-2xl border border-primary/20 bg-primary/[0.045] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary"><Sparkles className="size-4" /> Live preview</div>
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-xs text-white/45"><MessageCircle className="size-4" /> Member tags !HOY</div>
              <p className="mt-3 text-sm leading-6 text-white/80">{response.replace("{user}", "@Member").replace("{username}", "Member").replace("{server}", config.guild.name)}</p>
              <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/35"><Reply className="size-3" /> {mode === "reply" ? "Reply mode" : "Channel mode"}</div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
            {saved ? <span className="text-xs text-emerald-400">Mention controls saved</span> : null}
            <Button type="button" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save mention controls"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
