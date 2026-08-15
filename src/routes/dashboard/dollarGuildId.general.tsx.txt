import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";

import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";
import { GeneralPanel } from "@/components/dashboard/settings-panels";
import { RoleManagerPanel } from "@/components/dashboard/role-manager-panel";

export const Route = createFileRoute("/dashboard/$guildId/general")({
  head: () => ({
    meta: [
      { title: "General settings — AHOY Control Center" },
      { name: "description", content: "Set AHOY's prefix, language, currency and core server defaults." },
      { property: "og:title", content: "General settings — AHOY Control Center" },
      { property: "og:description", content: "Prefix, language, currency and core server defaults." },
    ],
  }),
  component: () => (
    <div>
      <ModuleHeader
        icon={Settings}
        title="General settings"
        description="Core AHOY behaviour for this server."
      />
      <WithConfig>
        {({ guildId, config, refresh }) => (
          <>
            <GeneralPanel guildId={guildId} config={config} onSaved={refresh} />
            <RoleManagerPanel guildId={guildId} config={config} onSaved={refresh} />
          </>
        )}
      </WithConfig>
    </div>
  ),
});
