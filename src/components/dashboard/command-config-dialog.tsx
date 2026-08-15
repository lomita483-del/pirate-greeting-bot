import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveCommandConfig, type CommandConfig } from "@/lib/ahoy.functions";

import { Field, MultiPicker, PickerSelect, ToggleRow, type Option } from "./fields";
import type { GuildStructure } from "./types";

const PERMISSIONS: Option[] = [
  { id: "none", name: "Anyone (no permission required)" },
  { id: "manage_messages", name: "Manage Messages" },
  { id: "kick_members", name: "Kick Members" },
  { id: "ban_members", name: "Ban Members" },
  { id: "manage_roles", name: "Manage Roles" },
  { id: "manage_channels", name: "Manage Channels" },
  { id: "manage_guild", name: "Manage Server" },
  { id: "administrator", name: "Administrator" },
];

const VISIBILITY: Option[] = [
  { id: "inherit", name: "Use the private-reply switch below" },
  { id: "private", name: "Always private (only the runner sees it)" },
  { id: "public", name: "Always public (everyone in the channel)" },
];

export const defaultCommandConfig = (command: string): CommandConfig => ({
  command,
  enabled: true,
  allowedRoleIds: [],
  deniedRoleIds: [],
  allowedChannelIds: [],
  blockedChannelIds: [],
  allowedCategoryIds: [],
  protectedRoleIds: [],
  protectedUserIds: [],
  outputChannelId: null,
  requiredPermission: "none",
  cooldownSeconds: 0,
  rateLimitPerMinute: 0,
  requireReason: false,
  requireConfirmation: false,
  responseVisibility: "inherit",
  ephemeral: true,
  customResponse: null,
  errorResponse: null,
  logEvent: true,
  logChannelId: null,
  notifyRoleId: null,
  notifyChannelId: null,
  notes: null,
  options: {},
});


export function CommandConfigDialog({
  open,
  onOpenChange,
  guildId,
  command,
  description,
  config,
  structure,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guildId: string;
  command: string;
  description: string;
  config: CommandConfig;
  structure: GuildStructure;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<CommandConfig>(config);
  const [optionKey, setOptionKey] = useState("");
  const [optionValue, setOptionValue] = useState("");

  useEffect(() => {
    if (open) setDraft(config);
  }, [open, config]);

  const set = <K extends keyof CommandConfig>(key: K, value: CommandConfig[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: () =>
      saveCommandConfig({
        data: {
          guildId,
          command,
          enabled: draft.enabled,
          allowedRoleIds: draft.allowedRoleIds,
          deniedRoleIds: draft.deniedRoleIds,
          allowedChannelIds: draft.allowedChannelIds,
          outputChannelId: draft.outputChannelId,
          requiredPermission: draft.requiredPermission,
          cooldownSeconds: draft.cooldownSeconds,
          ephemeral: draft.ephemeral,
          customResponse: draft.customResponse?.trim() ? draft.customResponse : null,
          notes: draft.notes?.trim() ? draft.notes : null,
          options: draft.options,
        },
      }),
    onSuccess: () => {
      toast.success(`Saved settings for ${command}`);
      onSaved();
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const textChannels: Option[] = structure.channels.map((c) => ({
    id: c.id,
    name: `#${c.name}`,
  }));
  const roles: Option[] = structure.roles.map((r) => ({ id: r.id, name: r.name }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-primary">/{command}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <ToggleRow
            label="Command enabled"
            description="Turn the command off entirely for this server."
            checked={draft.enabled}
            onChange={(v) => set("enabled", v)}
          />

          <Field
            label="Who can use it — allowed roles"
            hint="Leave empty to allow everyone (subject to the permission below)."
          >
            <MultiPicker
              values={draft.allowedRoleIds}
              options={roles}
              onChange={(v) => set("allowedRoleIds", v)}
              emptyLabel="No roles found — invite AHOY to load roles."
            />
          </Field>

          <Field label="Blocked roles" hint="Members with these roles can never run the command.">
            <MultiPicker
              values={draft.deniedRoleIds}
              options={roles}
              onChange={(v) => set("deniedRoleIds", v)}
              emptyLabel="No roles found."
            />
          </Field>

          <Field
            label="Required Discord permission"
            hint="Checked in addition to the roles above."
          >
            <PickerSelect
              value={draft.requiredPermission}
              options={PERMISSIONS}
              onChange={(v) =>
                set("requiredPermission", (v ?? "none") as CommandConfig["requiredPermission"])
              }
              placeholder="Select a permission"
              emptyLabel="Anyone"
            />
          </Field>

          <Field
            label="Where it can be used"
            hint="Leave empty to allow the command in every channel."
          >
            <MultiPicker
              values={draft.allowedChannelIds}
              options={textChannels}
              onChange={(v) => set("allowedChannelIds", v)}
              emptyLabel="No channels found."
            />
          </Field>

          <Field
            label="Where the result is posted"
            hint="Send the command's output to a specific channel instead of replying in place."
          >
            <PickerSelect
              value={draft.outputChannelId}
              options={textChannels}
              onChange={(v) => set("outputChannelId", v)}
              placeholder="Reply in the current channel"
              emptyLabel="Reply in the current channel"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cooldown (seconds)" hint="0 disables the cooldown.">
              <Input
                type="number"
                min={0}
                max={86400}
                value={draft.cooldownSeconds}
                onChange={(e) => set("cooldownSeconds", Math.max(0, Number(e.target.value) || 0))}
              />
            </Field>
            <Field label="Private reply" hint="Only the person who ran it sees the response.">
              <ToggleRow
                label="Ephemeral"
                checked={draft.ephemeral}
                onChange={(v) => set("ephemeral", v)}
              />
            </Field>
          </div>

          <Field
            label="Custom response"
            hint="Replaces AHOY's default reply. Use {user}, {server}, {command}, {value}."
          >
            <Textarea
              rows={3}
              value={draft.customResponse ?? ""}
              placeholder="Ahoy {user}! …"
              onChange={(e) => set("customResponse", e.target.value)}
            />
          </Field>

          <Field label="Purpose / staff notes" hint="Shown in the dashboard to your team.">
            <Textarea
              rows={2}
              value={draft.notes ?? ""}
              placeholder="What this command is meant for in this server…"
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>

          <Field
            label="Extra settings"
            hint="Feature-specific values the bot reads when running this command."
          >
            <div className="space-y-2">
              {Object.entries(draft.options).length > 0 ? (
                <ul className="space-y-1">
                  {Object.entries(draft.options).map(([key, value]) => (
                    <li
                      key={key}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-secondary/30 px-3 py-2 text-xs"
                    >
                      <span>
                        <strong className="text-foreground">{key}</strong> — {value}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const next = { ...draft.options };
                          delete next[key];
                          set("options", next);
                        }}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex gap-2">
                <Input
                  placeholder="field"
                  value={optionKey}
                  onChange={(e) => setOptionKey(e.target.value)}
                />
                <Input
                  placeholder="value"
                  value={optionValue}
                  onChange={(e) => setOptionValue(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (!optionKey.trim()) return;
                    set("options", {
                      ...draft.options,
                      [optionKey.trim()]: optionValue.trim(),
                    });
                    setOptionKey("");
                    setOptionValue("");
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save command settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
