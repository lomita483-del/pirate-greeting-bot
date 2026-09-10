import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { ReactionRolesPanel } from "@/components/dashboard/community-panels";
import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";
import { RolesPanel } from "@/components/dashboard/roles-panel";

export const Route = createFileRoute("/dashboard/$guildId/roles")({
  head: () => ({
    meta: [
      { title: "Roles — !PIRATE Control Center" },
      { name: "description", content: "Configure join roles and level-based role rewards for your members." },
      { property: "og:title", content: "Roles — !PIRATE Control Center" },
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
          <div className="space-y-6">
            <RolesPanel guildId={guildId} config={config} onSaved={refresh} />
            <ReactionRolesPanel guildId={guildId} structure={config.structure} />
          </div>
        )}
      </WithConfig>
    </div>
  ),
});
