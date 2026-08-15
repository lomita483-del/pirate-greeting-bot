import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";

import { useGuild } from "@/components/dashboard/guild-context";
import { ModuleHeader } from "@/components/dashboard/module-page";
import { MemberProfilePanel, RanksPanel, ServerStatsPanel } from "@/components/dashboard/stats-panels";

export const Route = createFileRoute("/dashboard/$guildId/stats")({
  head: () => ({
    meta: [
      { title: "Stats — AHOY Control Center" },
      { name: "description", content: "Server statistics, member ranks and individual profile cards." },
      { property: "og:title", content: "Stats — AHOY Control Center" },
      { property: "og:description", content: "Server statistics, ranks and profile cards." },
    ],
  }),
  component: StatsPage,
});

function StatsPage() {
  const { guildId } = useGuild();
  return (
    <div>
      <ModuleHeader
        icon={BarChart3}
        title="Stats"
        description="Server statistics, ranks and member profile cards."
      />
      <div className="space-y-6">
        <ServerStatsPanel guildId={guildId} />
        <RanksPanel guildId={guildId} />
        <MemberProfilePanel guildId={guildId} />
      </div>
    </div>
  );
}
