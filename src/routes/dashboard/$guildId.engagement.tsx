import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";

import { LeaderboardPanel, RemindersPanel } from "@/components/dashboard/engagement-panels";
import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";

export const Route = createFileRoute("/dashboard/$guildId/engagement")({
  head: () => ({
    meta: [
      { title: "Engagement — AHOY Control Center" },
      { name: "description", content: "XP and economy leaderboards plus member reminders for your server." },
      { property: "og:title", content: "Engagement — AHOY Control Center" },
      { property: "og:description", content: "Leaderboards and member reminders." },
    ],
  }),
  component: () => (
    <div>
      <ModuleHeader
        icon={Trophy}
        title="Engagement"
        description="Leaderboards and reminders that keep your members coming back."
      />
      <WithConfig>
        {({ guildId, config }) => (
          <div className="space-y-6">
            <LeaderboardPanel guildId={guildId} currency={config.settings?.currency_name ?? "coins"} />
            <RemindersPanel guildId={guildId} />
          </div>
        )}
      </WithConfig>
    </div>
  ),
});
