import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";

import { EconomyAdminPanel, LeaderboardPanel, RemindersPanel, XpAdminPanel } from "@/components/dashboard/engagement-panels";
import { PremiumGate } from "@/components/dashboard/premium-gate";
import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";

export const Route = createFileRoute("/dashboard/$guildId/engagement")({
  head: () => ({
    meta: [
      { title: "Engagement — ! HOY Control Center" },
      { name: "description", content: "XP and economy leaderboards, XP and economy administration, and member reminders for your server." },
      { property: "og:title", content: "Engagement — ! HOY Control Center" },
      { property: "og:description", content: "Leaderboards, XP and economy administration, and reminders." },
    ],
  }),
  component: () => (
    <div>
      <ModuleHeader icon={Trophy} title="Engagement" description="XP, economy, administration and reminders that keep your members coming back." />
      <WithConfig>
        {({ guildId, config }) => (
          <PremiumGate feature="levels">
            <div className="space-y-6">
              <LeaderboardPanel guildId={guildId} currency={config.settings?.currency_name ?? "coins"} />
              <XpAdminPanel guildId={guildId} />
              <EconomyAdminPanel guildId={guildId} />
              <RemindersPanel guildId={guildId} />
            </div>
          </PremiumGate>
        )}
      </WithConfig>
    </div>
  ),
});
