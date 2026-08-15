import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";

import { ActivityLogPanel } from "@/components/dashboard/activity-panel";
import { AuditTrailPanel } from "@/components/dashboard/audit-trail-panel";
import { useGuild } from "@/components/dashboard/guild-context";
import { ModuleHeader } from "@/components/dashboard/module-page";

export const Route = createFileRoute("/dashboard/$guildId/activity")({
  head: () => ({
    meta: [
      { title: "Activity — AHOY Control Center" },
      { name: "description", content: "Live activity log of messages, members and voice events in your server." },
      { property: "og:title", content: "Activity — AHOY Control Center" },
      { property: "og:description", content: "Live activity log of messages, members and voice events." },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const { guildId } = useGuild();
  return (
    <div>
      <ModuleHeader
        icon={Activity}
        title="Activity"
        description="Everything AHOY has recorded happening in this server."
      />
      <ActivityLogPanel guildId={guildId} />
    </div>
  );
}
