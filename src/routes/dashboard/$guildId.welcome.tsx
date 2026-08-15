import { createFileRoute } from "@tanstack/react-router";
import { Hand } from "lucide-react";

import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";
import { WelcomePanel } from "@/components/dashboard/settings-panels";

export const Route = createFileRoute("/dashboard/$guildId/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome messages — AHOY Control Center" },
      { name: "description", content: "Greet new members with custom welcome and leave messages." },
      { property: "og:title", content: "Welcome messages — AHOY Control Center" },
      { property: "og:description", content: "Custom welcome and leave messages for new members." },
    ],
  }),
  component: () => (
    <div>
      <ModuleHeader
        icon={Hand}
        title="Welcome messages"
        description="Greet joining members and announce leaves in the channels you choose."
      />
      <WithConfig>
        {({ guildId, config, refresh }) => (
          <WelcomePanel guildId={guildId} config={config} onSaved={refresh} />
        )}
      </WithConfig>
    </div>
  ),
});
