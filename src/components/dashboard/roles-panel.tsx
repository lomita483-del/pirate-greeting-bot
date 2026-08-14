import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { Field, MultiPicker, PickerSelect, SectionHeader } from "./fields";
import { SaveBar } from "./save-bar";
import type { PanelProps } from "./types";
import { useDraft } from "./use-draft";

type LevelRole = { level: number; role_id: string };

function parseLevelRoles(value: unknown): LevelRole[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const level = Number(row["level"]);
    const roleId = typeof row["role_id"] === "string" ? row["role_id"] : null;
    return Number.isFinite(level) && roleId ? [{ level, role_id: roleId }] : [];
  });
}

export function RolesPanel({ guildId, config, onSaved }: PanelProps) {
  const roles = config.structure.roles;

  const form = useDraft(
    guildId,
    "roles",
    {
      auto_role_ids: config.roles?.auto_role_ids ?? [],
      level_roles: parseLevelRoles(config.roles?.level_roles),
    },
    onSaved,
  );
  const { draft, set } = form;

  const updateRow = (index: number, patch: Partial<LevelRole>) =>
    set(
      "level_roles",
      draft.level_roles.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  return (
    <div className="space-y-6">
      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Auto roles"
            description="Roles handed to every new crew member the moment they join."
          />
          <MultiPicker
            values={draft.auto_role_ids}
            options={roles}
            onChange={(values) => set("auto_role_ids", values.slice(0, 10))}
            emptyLabel="AHOY needs to be in this server to list roles."
          />
        </CardContent>
      </Card>

      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Level rewards"
            description="Award a role automatically when a member reaches a level."
            badge={`${draft.level_roles.length} rule${draft.level_roles.length === 1 ? "" : "s"}`}
          />

          {draft.level_roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No level rewards yet.</p>
          ) : (
            <div className="space-y-3">
              {draft.level_roles.map((row, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-xl border border-border/70 bg-secondary/30 p-4 sm:grid-cols-[120px_1fr_auto] sm:items-end"
                >
                  <Field label="Level">
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={row.level}
                      onChange={(e) =>
                        updateRow(index, {
                          level: Math.min(500, Math.max(1, Number(e.target.value) || 1)),
                        })
                      }
                    />
                  </Field>
                  <Field label="Role">
                    <PickerSelect
                      value={row.role_id || null}
                      options={roles}
                      onChange={(value) => updateRow(index, { role_id: value ?? "" })}
                      placeholder="Choose a role"
                      emptyLabel="Choose a role"
                    />
                  </Field>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove level reward"
                    onClick={() =>
                      set(
                        "level_roles",
                        draft.level_roles.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            disabled={draft.level_roles.length >= 50}
            onClick={() =>
              set("level_roles", [
                ...draft.level_roles,
                { level: (draft.level_roles.at(-1)?.level ?? 0) + 5 || 5, role_id: "" },
              ])
            }
          >
            <Plus className="h-4 w-4" />
            Add level reward
          </Button>
        </CardContent>
      </Card>

      <SaveBar
        dirty={form.dirty}
        saving={form.saving}
        onSave={() => {
          if (draft.level_roles.some((row) => !row.role_id)) return;
          form.save();
        }}
        onReset={form.reset}
      />
    </div>
  );
}
