import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";

import { CalendarPanel } from "@/components/dashboard/calendar-panel";
import { EventAutomationPanel } from "@/components/dashboard/event-automation-panel";
import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";

export const Route = createFileRoute("/dashboard/$guildId/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar & event reminders — AHOY" },
      {
        name: "description",
        content:
          "Connect Google Calendar or iCalendar feeds and let AHOY announce every event in Discord with automatic reminders.",
      },
      { property: "og:title", content: "Calendar & event reminders — AHOY" },
      {
        property: "og:description",
        content: "Sync calendars and automate Discord event reminders with AHOY.",
      },
    ],
  }),
  component: () => (
    <div>
      <ModuleHeader
        icon={CalendarDays}
        title="Calendar sources"
        description="Import events from Google Calendar or any iCalendar feed and schedule Discord reminders automatically."
      />
      <WithConfig>
        {({ guildId, config, refresh }) => (
          <div className="space-y-6">
            <CalendarPanel guildId={guildId} config={config} onSaved={refresh} />
            <EventAutomationPanel guildId={guildId} config={config} onSaved={refresh} />
          </div>
        )}
      </WithConfig>
    </div>
  ),
});
