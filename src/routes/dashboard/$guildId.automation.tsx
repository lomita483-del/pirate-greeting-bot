import { createFileRoute } from "@tanstack/react-router";
import { Workflow } from "lucide-react";

import { AnnouncementsPanel, StatChannelsPanel } from "@/components/dashboard/automation-panels";
import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";

export const Route = createFileRoute("/dashboard/$guildId/automation")({
  head: () => ({
    meta: [
      { title: "Automation — ! HOY BOT Control Center" },
      { name: "description", content: "Schedule recurring announcements and live server stat channels with ! HOY BOT." },
      { property: "og:title", content: "Automation — ! HOY BOT Control Center" },
      { property: "og:description", content: "Recurring announcements and live server statistics automation." },
    ],
  }),
  component: () => (
    <div>
      <ModuleHeader
        icon={Workflow}
        title="Automation"
        description="Build recurring announcements and keep server statistics visible automatically."
      />
      <WithConfig>
        {({ guildId, config, refresh }) => (
          <div className="space-y-6">
            <AnnouncementsPanel guildId={guildId} structure={config.structure} />
            <StatChannelsPanel guildId={guildId} structure={config.structure} />
          </div>
        )}
      </WithConfig>
    </div>
  ),
});
