import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { postTicketPanel } from "@/lib/send.functions";

import { Field, PickerSelect } from "./fields";

type ChannelOption = { id: string; name: string };

type PanelButton = {
  label: string;
  description: string;
  emoji: string;
  style: "primary" | "secondary" | "success" | "danger";
};

const STYLES: Array<{ value: PanelButton["style"]; label: string }> = [
  { value: "primary", label: "Blurple" },
  { value: "secondary", label: "Grey" },
  { value: "success", label: "Green" },
  { value: "danger", label: "Red" },
];

const DEFAULT_BUTTONS: PanelButton[] = [
  {
    label: "General support",
    description: "Questions, help and anything else the crew can answer.",
    emoji: "🎫",
    style: "primary",
  },
  {
    label: "Report a member",
    description: "Flag rule-breaking behaviour privately to the staff team.",
    emoji: "🚩",
    style: "danger",
  },
];

export function TicketPanelPublisher({
  guildId,
  channels,
  defaultChannelId,
}: {
  guildId: string;
  channels: ChannelOption[];
  defaultChannelId: string | null;
}) {
  const post = useServerFn(postTicketPanel);
  const [channelId, setChannelId] = useState<string | null>(defaultChannelId);
  const [title, setTitle] = useState("Need a hand?");
  const [description, setDescription] = useState(
    "Pick the option that matches your request. A private channel will be created for you and the crew only.",
  );
  const [buttons, setButtons] = useState<PanelButton[]>(DEFAULT_BUTTONS);
  const [sending, setSending] = useState(false);

  const update = (index: number, patch: Partial<PanelButton>) =>
    setButtons((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  async function send() {
    if (!channelId) {
      toast.error("Pick a channel for the panel first.");
      return;
    }
    const clean = buttons.filter((b) => b.label.trim().length > 0);
    if (clean.length === 0) {
      toast.error("Add at least one button.");
      return;
    }
    setSending(true);
    try {
      await post({
        data: {
          guildId,
          channelId,
          title: title || undefined,
          description: description || undefined,
          buttonLabel: clean[0].label,
          buttons: clean.map((b) => ({
            label: b.label.trim(),
            description: b.description.trim() || undefined,
            emoji: b.emoji.trim() || undefined,
            style: b.style,
          })),
        },
      });
      toast.success("Ticket panel queued — AHOY will post it within a few seconds.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the panel.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-surface-2/40 p-4">
      <div>
        <p className="text-sm font-semibold">Post a ticket panel</p>
        <p className="text-xs text-muted-foreground">
          Send a public message with as many buttons as you need — each one opens its own kind of
          private ticket and shows its description in the embed.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Post to channel">
          <PickerSelect
            value={channelId}
            options={channels}
            onChange={setChannelId}
            placeholder="Select a channel"
          />
        </Field>
        <Field label="Panel title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={256} />
        </Field>
      </div>
      <Field label="Panel description">
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Buttons ({buttons.length}/20)</p>
          <Button
            size="sm"
            variant="secondary"
            className="gap-1"
            disabled={buttons.length >= 20}
            onClick={() =>
              setButtons((rows) => [
                ...rows,
                { label: "", description: "", emoji: "🎫", style: "primary" },
              ])
            }
          >
            <Plus className="size-4" /> Add button
          </Button>
        </div>

        {buttons.map((button, index) => (
          <div key={index} className="rounded-xl border border-border/60 bg-background/40 p-3">
            <div className="grid gap-3 md:grid-cols-[80px_1fr_150px_auto] md:items-end">
              <Field label="Emoji">
                <Input
                  value={button.emoji}
                  maxLength={8}
                  onChange={(e) => update(index, { emoji: e.target.value })}
                />
              </Field>
              <Field label="Label">
                <Input
                  value={button.label}
                  maxLength={80}
                  placeholder="General support"
                  onChange={(e) => update(index, { label: e.target.value })}
                />
              </Field>
              <Field label="Colour">
                <Select
                  value={button.style}
                  onValueChange={(value) =>
                    update(index, { style: value as PanelButton["style"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STYLES.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove button"
                onClick={() => setButtons((rows) => rows.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
            <div className="mt-3">
              <Field label="Description shown in the embed">
                <Input
                  value={button.description}
                  maxLength={200}
                  placeholder="What this ticket type is for"
                  onChange={(e) => update(index, { description: e.target.value })}
                />
              </Field>
            </div>
          </div>
        ))}
      </div>

      <Button onClick={send} disabled={sending} className="gap-2">
        <Send className="size-4" />
        {sending ? "Sending…" : "Send panel"}
      </Button>
    </div>
  );
}
