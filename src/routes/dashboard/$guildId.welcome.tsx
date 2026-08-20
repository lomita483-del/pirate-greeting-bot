import { createFileRoute } from "@tanstack/react-router";
import { Hand } from "lucide-react";

import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";
import { GoodbyePanel } from "@/components/dashboard/settings-panels";
import { WelcomeMessagesPanel } from "@/components/dashboard/welcome-messages-panel";

export const Route = createFileRoute("/dashboard/$guildId/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome messages — AHOY Control Center" },
      { name: "description", content: "Greet joining members and announce leaves in the channels you choose." },
      { property: "og:title", content: "Welcome messages — AHOY Control Center" },
      { property: "og:description", content: "Custom welcome and leave messages for new members." },
    ],
  }),
  component: () => (
    <div className="space-y-6">
      <ModuleHeader
        icon={Hand}
        title="Welcome messages"
        description="Greet joining members and announce leaves in the channels you choose."
      />
      <WithConfig>
        {({ guildId, config, refresh }) => (
          <>
            <WelcomeMessagesPanel guildId={guildId} config={config} onSaved={refresh} />
            <GoodbyePanel guildId={guildId} config={config} onSaved={refresh} />
          </>
        )}
      </WithConfig>
    </div>
  ),
});
