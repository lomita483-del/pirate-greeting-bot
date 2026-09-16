import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";

import { CommandListPanel } from "@/components/dashboard/command-list-panel";
import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";

export const Route = createFileRoute("/dashboard/$guildId/commands")({
  head: () => ({
    meta: [
      { title: "Commands — ! HOY BOT Control Center" },
      {
        name: "description",
        content: "Enable, disable and fully customise permissions, channels and cooldowns for every ! HOY BOT command.",
      },
      { property: "og:title", content: "Commands — ! HOY BOT Control Center" },
      { property: "og:description", content: "Permissions, channels and cooldowns for every ! HOY BOT command." },
    ],
  }),
  component: () => (
    <div>
      <ModuleHeader
        icon={FileText}
        title="Commands"
        description="Update permissions, channels, cooldowns and replies for all default commands."
      />
      <WithConfig>
        {({ guildId, config, refresh }) => (
          <CommandListPanel guildId={guildId} config={config} onSaved={refresh} />
        )}
      </WithConfig>
    </div>
  ),
});
