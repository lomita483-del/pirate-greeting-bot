import { createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";

import { CommandsPanel } from "@/components/dashboard/commands-panel";
import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";

export const Route = createFileRoute("/dashboard/$guildId/custom-commands")({
  head: () => ({
    meta: [
      { title: "Custom commands — AHOY Control Center" },
      { name: "description", content: "Create and manage your own AHOY commands with custom responses." },
      { property: "og:title", content: "Custom commands — AHOY Control Center" },
      { property: "og:description", content: "Create and manage your own AHOY commands." },
    ],
  }),
  component: () => (
    <div>
      <ModuleHeader
        icon={Bot}
        title="Custom commands"
        description="Create and manage your own commands and their responses."
      />
      <WithConfig>
        {({ guildId, config, refresh }) => (
          <CommandsPanel guildId={guildId} config={config} onSaved={refresh} />
        )}
      </WithConfig>
    </div>
  ),
});
