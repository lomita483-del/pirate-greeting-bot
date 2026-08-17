import { createFileRoute } from "@tanstack/react-router";
import { Shield } from "lucide-react";

import { CasesPanel } from "@/components/dashboard/cases-panel";
import { ReportsPanel } from "@/components/dashboard/reports-panel";
import { AppealsPanel } from "@/components/dashboard/appeals-panel";
import { useGuild } from "@/components/dashboard/guild-context";
import { ModuleHeader } from "@/components/dashboard/module-page";

export const Route = createFileRoute("/dashboard/$guildId/moderation")({
  head: () => ({
    meta: [
      { title: "Moderation — AHOY Control Center" },
      { name: "description", content: "Manage all ban, kick, mute and warn cases handled by AHOY." },
      { property: "og:title", content: "Moderation — AHOY Control Center" },
      { property: "og:description", content: "Manage all ban, kick, mute and warn cases." },
    ],
  }),
  component: ModerationPage,
});

function ModerationPage() {
  const { guildId } = useGuild();
  return (
    <div className="space-y-6">
      <ModuleHeader
        icon={Shield}
        title="Moderation"
        description="Manage cases, review member reports, and handle appeals from the dashboard."
      />
      <CasesPanel guildId={guildId} />
      <ReportsPanel guildId={guildId} />
      <AppealsPanel guildId={guildId} />
    </div>
  );
}
