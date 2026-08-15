import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";

import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";
import { LoggingPanel } from "@/components/dashboard/settings-panels";

export const Route = createFileRoute("/dashboard/$guildId/logging")({
  head: () => ({
    meta: [
      { title: "Logging — AHOY Control Center" },
      { name: "description", content: "Log moderation actions, message edits, deletions and member updates." },
      { property: "og:title", content: "Logging — AHOY Control Center" },
      { property: "og:description", content: "Log moderation, messages and member updates." },
    ],
  }),
  component: () => (
    <div>
      <ModuleHeader
        icon={ScrollText}
        title="Logging"
        description="Log all actions happening in this server to the channels you pick."
      />
      <WithConfig>
        {({ guildId, config, refresh }) => (
          <LoggingPanel guildId={guildId} config={config} onSaved={refresh} />
        )}
      </WithConfig>
    </div>
  ),
});
