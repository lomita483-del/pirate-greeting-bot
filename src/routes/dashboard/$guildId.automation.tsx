import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";

import { AnnouncementsPanel, StatChannelsPanel } from "@/components/dashboard/automation-panels";
import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";

export const Route = createFileRoute("/dashboard/$guildId/automation")({
  head: () => ({
    meta: [
      { title: "Automation — AHOY Control Center" },
      { name: "description", content: "Schedule recurring announcements and live server stat channels." },
      { property: "og:title", content: "Automation — AHOY Control Center" },
      { property: "og:description", content: "Scheduled announcements and live stat channels." },
    ],
  }),
  component: () => (
    <div>
      <ModuleHeader
        icon={CalendarClock}
        title="Automation"
        description="Scheduled announcements and automatically updated stat channels."
      />
      <WithConfig>
        {({ guildId, config }) => (
          <div className="space-y-6">
            <AnnouncementsPanel guildId={guildId} structure={config.structure} />
            <StatChannelsPanel guildId={guildId} structure={config.structure} />
          </div>
        )}
      </WithConfig>
    </div>
  ),
});
