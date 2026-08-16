import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteCustomCommand, saveCustomCommand } from "@/lib/ahoy.functions";

import { SectionHeader } from "./fields";
import type { PanelProps } from "./types";

type Draft = {
  id?: string;
  name: string;
  response: string;
  is_embed: boolean;
  embed_title: string;
  enabled: boolean;
};

const emptyDraft: Draft = {
  name: "",
  response: "",
  is_embed: false,
  embed_title: "",
  enabled: true,
};

export function CommandsPanel({ guildId, config, onSaved }: PanelProps) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const prefix = config.settings?.prefix ?? "!";

  const save = useMutation({
    mutationFn: (value: Draft) =>
      saveCustomCommand({
        data: {
          guildId,
          id: value.id,
          name: value.name.trim().toLowerCase(),
          response: value.response,
          is_embed: value.is_embed,
          embed_title: value.embed_title.trim() ? value.embed_title.trim() : null,
          enabled: value.enabled,
        },
      }),
    onSuccess: () => {
      toast.success("Command saved");
      setDraft(emptyDraft);
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCustomCommand({ data: { guildId, id } }),
    onSuccess: () => {
      toast.success("Command deleted");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <Card className="glass border-0">
        <CardContent className="space-y-4 pt-6">
          <SectionHeader
            title={draft.id ? "Edit command" : "New command"}
            description={`Custom replies triggered with the ${prefix} prefix.`}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cmd-name">Command name</Label>
              <Input
                id="cmd-name"
                placeholder="welcome-info"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cmd-title">Embed title (optional)</Label>
              <Input
                id="cmd-title"
                placeholder="Server info"
                value={draft.embed_title}
                onChange={(e) => setDraft({ ...draft, embed_title: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cmd-response">Response</Label>
            <Textarea
              id="cmd-response"
              rows={4}
              placeholder="Ahoy! Here is what you need…"
              value={draft.response}
              onChange={(e) => setDraft({ ...draft, response: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={draft.is_embed}
                onCheckedChange={(v) => setDraft({ ...draft, is_embed: v })}
              />
              Send as embed
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={draft.enabled}
                onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
              />
              Enabled
            </label>
            <div className="ml-auto flex gap-2">
              {draft.id && (
                <Button variant="ghost" onClick={() => setDraft(emptyDraft)}>
                  Cancel
                </Button>
              )}
              <Button
                disabled={save.isPending || !draft.name.trim() || !draft.response.trim()}
                onClick={() => save.mutate(draft)}
              >
                <Plus className="h-4 w-4" /> {draft.id ? "Save changes" : "Create command"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-0">
        <CardContent className="space-y-3 pt-6">
          <SectionHeader
            title="Your commands"
            description="Click a command to edit it."
            badge={`${config.commands.length}`}
          />
          {config.commands.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No custom commands yet.
            </p>
          ) : (
            <ul className="grid gap-2">
              {config.commands.map((command) => (
                <li
                  key={command.id}
                  className="flex items-start gap-3 rounded-lg border border-border/40 bg-background/30 p-3"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() =>
                      setDraft({
                        id: command.id,
                        name: command.name,
                        response: command.response,
                        is_embed: Boolean(command.is_embed),
                        embed_title: command.embed_title ?? "",
                        enabled: Boolean(command.enabled),
                      })
                    }
                  >
                    <code className="text-sm font-medium text-primary">
                      {prefix}
                      {command.name}
                    </code>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {command.enabled ? "" : "(disabled) "}
                      {command.response}
                    </p>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(command.id)}
                    aria-label={`Delete ${command.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
