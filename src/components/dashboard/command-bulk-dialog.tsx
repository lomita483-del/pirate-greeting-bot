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
import { saveCommandConfigBulk, type CommandConfig } from "@/lib/ahoy.functions";

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

type Fields = {
  enabled: boolean;
  allowedRoleIds: string[];
  deniedRoleIds: string[];
  requiredPermission: CommandConfig["requiredPermission"];
  allowedChannelIds: string[];
  outputChannelId: string | null;
  cooldownSeconds: number;
  ephemeral: boolean;
  customResponse: string;
  notes: string;
};

const EMPTY: Fields = {
  enabled: true,
  allowedRoleIds: [],
  deniedRoleIds: [],
  requiredPermission: "none",
  allowedChannelIds: [],
  outputChannelId: null,
  cooldownSeconds: 0,
  ephemeral: true,
  customResponse: "",
  notes: "",
};

type ApplyKey = keyof Fields;

/** Mass-edit dialog: applies the ticked settings to every selected command. */
export function CommandBulkDialog({
  open,
  onOpenChange,
  guildId,
  commands,
  scopeLabel,
  structure,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guildId: string;
  commands: string[];
  scopeLabel: string;
  structure: GuildStructure;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [apply, setApply] = useState<Set<ApplyKey>>(new Set());

  useEffect(() => {
    if (open) {
      setFields(EMPTY);
      setApply(new Set());
    }
  }, [open]);

  const toggleApply = (key: ApplyKey) =>
    setApply((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const set = <K extends ApplyKey>(key: K, value: Fields[K]) => {
    setFields((current) => ({ ...current, [key]: value }));
    setApply((current) => new Set(current).add(key));
  };

  const roles: Option[] = structure.roles.map((r) => ({ id: r.id, name: r.name }));
  const textChannels: Option[] = structure.channels
    .filter((c) => c.kind !== "category")
    .map((c) => ({ id: c.id, name: `#${c.name}` }));

  const save = useMutation({
    mutationFn: () => {
      const patch: Record<string, unknown> = {};
      if (apply.has("enabled")) patch["enabled"] = fields.enabled;
      if (apply.has("allowedRoleIds")) patch["allowedRoleIds"] = fields.allowedRoleIds;
      if (apply.has("deniedRoleIds")) patch["deniedRoleIds"] = fields.deniedRoleIds;
      if (apply.has("requiredPermission")) patch["requiredPermission"] = fields.requiredPermission;
      if (apply.has("allowedChannelIds")) patch["allowedChannelIds"] = fields.allowedChannelIds;
      if (apply.has("outputChannelId")) patch["outputChannelId"] = fields.outputChannelId;
      if (apply.has("cooldownSeconds")) patch["cooldownSeconds"] = fields.cooldownSeconds;
      if (apply.has("ephemeral")) patch["ephemeral"] = fields.ephemeral;
      if (apply.has("customResponse"))
        patch["customResponse"] = fields.customResponse.trim() || null;
      if (apply.has("notes")) patch["notes"] = fields.notes.trim() || null;
      return saveCommandConfigBulk({ data: { guildId, commands, patch } });
    },
    onSuccess: (res) => {
      toast.success(`Applied to ${res.updated} command(s).`);
      onSaved();
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const Section = ({
    field,
    label,
    hint,
    children,
  }: {
    field: ApplyKey;
    label: string;
    hint?: string;
    children: React.ReactNode;
  }) => (
    <div className="rounded-xl border border-border/40 bg-background/30 p-3">
      <label className="mb-2 flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="accent-primary"
          checked={apply.has(field)}
          onChange={() => toggleApply(field)}
        />
        {label}
      </label>
      {hint ? <p className="mb-2 text-xs text-muted-foreground">{hint}</p> : null}
      <div className={apply.has(field) ? "" : "opacity-50"}>{children}</div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Mass edit — {scopeLabel}</DialogTitle>
          <DialogDescription>
            Tick a setting to apply it to all {commands.length} selected command(s). Unticked
            settings are left untouched.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Section field="enabled" label="Enable / disable">
            <ToggleRow
              label="Commands enabled"
              checked={fields.enabled}
              onChange={(v) => set("enabled", v)}
            />
          </Section>

          <Section field="allowedRoleIds" label="Allowed roles" hint="Empty means everyone.">
            <MultiPicker
              values={fields.allowedRoleIds}
              options={roles}
              onChange={(v) => set("allowedRoleIds", v)}
              emptyLabel="No roles found — invite AHOY to load roles."
            />
          </Section>

          <Section field="deniedRoleIds" label="Blocked roles">
            <MultiPicker
              values={fields.deniedRoleIds}
              options={roles}
              onChange={(v) => set("deniedRoleIds", v)}
              emptyLabel="No roles found."
            />
          </Section>

          <Section field="requiredPermission" label="Required Discord permission">
            <PickerSelect
              value={fields.requiredPermission}
              options={PERMISSIONS}
              onChange={(v) =>
                set("requiredPermission", (v ?? "none") as CommandConfig["requiredPermission"])
              }
              placeholder="Select a permission"
              emptyLabel="Anyone"
            />
          </Section>

          <Section
            field="allowedChannelIds"
            label="Allowed channels"
            hint="Empty means the commands work everywhere."
          >
            <MultiPicker
              values={fields.allowedChannelIds}
              options={textChannels}
              onChange={(v) => set("allowedChannelIds", v)}
              emptyLabel="No channels found."
            />
          </Section>

          <Section field="outputChannelId" label="Output channel">
            <PickerSelect
              value={fields.outputChannelId}
              options={textChannels}
              onChange={(v) => set("outputChannelId", v)}
              placeholder="Reply in the current channel"
              emptyLabel="Reply in the current channel"
            />
          </Section>

          <div className="grid gap-3 sm:grid-cols-2">
            <Section field="cooldownSeconds" label="Cooldown (seconds)">
              <Input
                type="number"
                min={0}
                max={86400}
                value={fields.cooldownSeconds}
                onChange={(e) =>
                  set("cooldownSeconds", Math.max(0, Number(e.target.value) || 0))
                }
              />
            </Section>
            <Section field="ephemeral" label="Private reply">
              <ToggleRow
                label="Ephemeral"
                checked={fields.ephemeral}
                onChange={(v) => set("ephemeral", v)}
              />
            </Section>
          </div>

          <Section
            field="customResponse"
            label="Custom response"
            hint="Use {user}, {server}, {command}, {value}."
          >
            <Textarea
              rows={2}
              value={fields.customResponse}
              onChange={(e) => set("customResponse", e.target.value)}
            />
          </Section>

          <Section field="notes" label="Purpose / staff notes">
            <Textarea rows={2} value={fields.notes} onChange={(e) => set("notes", e.target.value)} />
          </Section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || apply.size === 0 || commands.length === 0}
          >
            {save.isPending ? "Applying…" : `Apply to ${commands.length} command(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
