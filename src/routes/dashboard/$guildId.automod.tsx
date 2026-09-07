import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";
import { AutoModPanel } from "@/components/dashboard/settings-panels";

export const Route = createFileRoute("/dashboard/$guildId/automod")({
  head: () => ({
    meta: [
      { title: "Auto Moderation — !PIRATE Control Center" },
      { name: "description", content: "Automatically block spam, invites, links and mass mentions in your server." },
      { property: "og:title", content: "Auto Moderation — !PIRATE Control Center" },
      { property: "og:description", content: "Block spam, invites, links and mass mentions automatically." },
    ],
  }),
  component: () => (
    <div>
      <ModuleHeader
        icon={ShieldAlert}
        title="Auto Moderation"
        description="Prevent spam, invites and other unwanted messages using !PIRATE's auto moderation."
      />
      <WithConfig>
        {({ guildId, config, refresh }) => (
          <AutoModPanel guildId={guildId} config={config} onSaved={refresh} />
        )}
      </WithConfig>
    </div>
  ),
});
