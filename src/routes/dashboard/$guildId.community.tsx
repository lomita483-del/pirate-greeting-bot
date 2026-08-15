import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { GiveawaysPanel, ReactionRolesPanel } from "@/components/dashboard/community-panels";
import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";
import { PollsPanel } from "@/components/dashboard/polls-panel";
import { StarboardPanel } from "@/components/dashboard/starboard-panel";

export const Route = createFileRoute("/dashboard/$guildId/community")({
  head: () => ({
    meta: [
      { title: "Community — AHOY Control Center" },
      { name: "description", content: "Run reaction roles, giveaways, polls and a starboard for your community." },
      { property: "og:title", content: "Community — AHOY Control Center" },
      { property: "og:description", content: "Reaction roles, giveaways, polls and starboard." },
    ],
  }),
  component: () => (
    <div>
      <ModuleHeader
        icon={Sparkles}
        title="Community"
        description="Reaction roles, giveaways, polls and the starboard."
      />
      <WithConfig>
        {({ guildId, config, refresh }) => (
          <div className="space-y-6">
            <ReactionRolesPanel guildId={guildId} structure={config.structure} />
            <GiveawaysPanel guildId={guildId} structure={config.structure} />
            <PollsPanel guildId={guildId} structure={config.structure} />
            <StarboardPanel guildId={guildId} config={config} onSaved={refresh} />
          </div>
        )}
      </WithConfig>
    </div>
  ),
});
