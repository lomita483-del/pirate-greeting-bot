import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";
import { RolesPanel } from "@/components/dashboard/roles-panel";

export const Route = createFileRoute("/dashboard/$guildId/roles")({
  head: () => ({
    meta: [
      { title: "Roles — AHOY Control Center" },
      { name: "description", content: "Configure join roles and level-based role rewards for your members." },
      { property: "og:title", content: "Roles — AHOY Control Center" },
      { property: "og:description", content: "Join roles and level-based role rewards." },
    ],
  }),
  component: () => (
    <div>
      <ModuleHeader
        icon={Users}
        title="Roles"
        description="Assign roles on join and reward members as they level up."
      />
      <WithConfig>
        {({ guildId, config, refresh }) => (
          <RolesPanel guildId={guildId} config={config} onSaved={refresh} />
        )}
      </WithConfig>
    </div>
  ),
});
