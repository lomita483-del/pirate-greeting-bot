import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteCustomCommand, saveCustomCommand } from "@/lib/ahoy.functions";

import { Field, SectionHeader, ToggleRow } from "./fields";
import type { PanelProps } from "./types";

type Draft = {
  id?: string;
  name: string;
  response: string;
  is_embed: boolean;
  embed_title: string;
  enabled: boolean;
};

const EMPTY: Draft = { name: "", response: "", is_embed: false, embed_title: "", enabled: true };

export function CommandsPanel({ guildId, config, onSaved }: PanelProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const save = useServerFn(saveCustomCommand);
  const remove = useServerFn(deleteCustomCommand);

  const saveMutation = useMutation({
    mutationFn: (value: Draft) =>
      save({
        data: {
          guildId,
          id: value.id,
          name: value.name.trim().toLowerCase(),
          response: value.response,
          is_embed: value.is_embed,
          embed_title: value.embed_title ? value.embed_title : null,
          enabled: value.enabled,
        },
      }),
    onSuccess: () => {
      toast.success("Command saved");
      setDraft(null);
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message || "Could not save that command"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { guildId, id } }),
    onSuccess: () => {
      toast.success("Command deleted");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete that command"),
  });

  return (
    <div className="space-y-6">
      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Custom commands"
            description="Plain text or embed replies triggered by the server prefix."
            badge={`${config.commands.length} saved`}
          />

          {config.commands.length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom commands yet.</p>
          ) : (
            <ul className="space-y-2">
              {config.commands.map((command) => (
                <li
                  key={command.id}
                  className="flex items-start gap-3 rounded-xl border border-border/70 bg-secondary/30 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {config.settings?.prefix ?? "!"}
                      {command.name}
                      {command.enabled ? null : (
                        <Badge variant="outline" className="text-[10px]">
                          disabled
                        </Badge>
                      )}
                      {command.is_embed ? (
                        <Badge variant="outline" className="border-primary/40 text-[10px] text-primary">
                          embed
                        </Badge>
                      ) : null}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {command.response}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{command.uses} uses</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${command.name}`}
                    onClick={() =>
                      setDraft({
                        id: command.id,
                        name: command.name,
                        response: command.response,
                        is_embed: command.is_embed,
                        embed_title: command.embed_title ?? "",
                        enabled: command.enabled,
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${command.name}`}
                    onClick={() => deleteMutation.mutate(command.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {draft ? (
            <div className="space-y-4 rounded-xl border border-border/70 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Command name" hint="Lowercase letters, numbers, - or _">
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </Field>
                <Field label="Embed title" hint="Only used when embed mode is on.">
                  <Input
                    value={draft.embed_title}
                    onChange={(e) => setDraft({ ...draft, embed_title: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Response">
                <Textarea
                  rows={4}
                  value={draft.response}
                  onChange={(e) => setDraft({ ...draft, response: e.target.value })}
                />
              </Field>
              <ToggleRow
                label="Send as embed"
                checked={draft.is_embed}
                onChange={(v) => setDraft({ ...draft, is_embed: v })}
              />
              <ToggleRow
                label="Enabled"
                checked={draft.enabled}
                onChange={(v) => setDraft({ ...draft, enabled: v })}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={saveMutation.isPending || !draft.name || !draft.response}
                  onClick={() => saveMutation.mutate(draft)}
                >
                  Save command
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setDraft({ ...EMPTY })}>
              <Plus className="h-4 w-4" />
              New command
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
