import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { postTicketPanel } from "@/lib/send.functions";

import { Field, PickerSelect } from "./fields";

type ChannelOption = { id: string; name: string };

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
    "Click the button below to open a private ticket with the crew. Only you and our staff will see it.",
  );
  const [buttonLabel, setButtonLabel] = useState("Create a ticket");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!channelId) {
      toast.error("Pick a channel for the panel first.");
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
          buttonLabel: buttonLabel || undefined,
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
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div>
        <p className="text-sm font-semibold">Post a ticket panel</p>
        <p className="text-xs text-muted-foreground">
          Send a public message with a button members can click to open a private ticket.
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
        <Field label="Button label">
          <Input value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} maxLength={80} />
        </Field>
      </div>
      <Field label="Panel title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={256} />
      </Field>
      <Field label="Panel description">
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Button onClick={send} disabled={sending} className="gap-2">
        <Send className="size-4" />
        {sending ? "Sending…" : "Send panel"}
      </Button>
    </div>
  );
}
