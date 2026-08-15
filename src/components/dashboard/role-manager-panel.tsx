import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { updateGuildSection } from "@/lib/ahoy.functions";

type RoleOption = { id: string; name: string };

type Config = {
  settings?: { manager_role_ids?: string[] | null } | null;
  structure?: { roles?: RoleOption[] } | null;
};

export function RoleManagerPanel({
  guildId,
  config,
  onSaved,
}: {
  guildId: string;
  config: Config;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(
    config.settings?.manager_role_ids ?? [],
  );
  const queryClient = useQueryClient();
  const roles = config.structure?.roles ?? [];

  const mutation = useMutation({
    mutationFn: (roleIds: string[]) =>
      updateGuildSection({
        data: { guildId, section: "general", values: { manager_role_ids: roleIds } },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guild-config", guildId] });
      onSaved();
    },
  });

  function toggle(roleId: string) {
    const next = selected.includes(roleId)
      ? selected.filter((id) => id !== roleId)
      : [...selected, roleId];
    setSelected(next);
    mutation.mutate(next);
  }

  return (
    <div className="mt-6 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Role Manager</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Roles added here can fully manage AHOY and its features from this dashboard, in addition
        to anyone with Discord's own Manage Server or Administrator permission (those always have
        access regardless of this list).
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {selected.length === 0 && (
          <span className="text-sm text-muted-foreground">No extra manager roles added.</span>
        )}
        {selected.map((roleId) => {
          const role = roles.find((r) => r.id === roleId);
          return (
            <span
              key={roleId}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm"
            >
              {role?.name ?? roleId}
              <button
                type="button"
                onClick={() => toggle(roleId)}
                className="ml-1 text-muted-foreground hover:text-foreground"
                aria-label="Remove role"
              >
                ×
              </button>
            </span>
          );
        })}
      </div>

      <select
        className="mt-3 w-full rounded-md border bg-background px-3 py-2 text-sm"
        value=""
        onChange={(e) => {
          if (e.target.value) toggle(e.target.value);
        }}
      >
        <option value="">+ Add a role…</option>
        {roles
          .filter((r) => !selected.includes(r.id))
          .map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
      </select>

      <div className="mt-5 flex items-center justify-between border-t pt-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          Every error AHOY encounters is logged for review.
        </div>
        <Link
          to="/dashboard/$guildId/errors"
          params={{ guildId }}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          View error log →
        </Link>
      </div>
    </div>
  );
}
