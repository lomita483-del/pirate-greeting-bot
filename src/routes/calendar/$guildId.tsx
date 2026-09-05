import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Bell, CalendarDays, LayoutDashboard } from "lucide-react";

import { CalendarPanel } from "@/components/dashboard/calendar-panel";
import { EventAutomationPanel } from "@/components/dashboard/event-automation-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getGuildConfig } from "@/lib/ahoy.functions";

export const Route = createFileRoute("/calendar/$guildId")({
  head: () => ({
    meta: [
      { title: "AHOY Calendar — event sync & reminders" },
      {
        name: "description",
        content:
          "Connect Google Calendar or iCalendar feeds and schedule Discord reminders, RSVPs and daily summaries for this server.",
      },
      { property: "og:title", content: "AHOY Calendar — event sync & reminders" },
      {
        property: "og:description",
        content: "Manage calendar feeds and Discord event reminders for your server.",
      },
    ],
  }),
  component: CalendarWorkspace,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-gold" />
      <p className="mt-4 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function CalendarWorkspace() {
  const { guildId } = Route.useParams();
  const queryClient = useQueryClient();
  const config = useQuery({
    queryKey: ["guild-config", guildId],
    queryFn: () => getGuildConfig({ data: { guildId } }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["guild-config", guildId] });
    void queryClient.invalidateQueries({ queryKey: ["calendar", guildId] });
  };

  return (
    <div className="min-h-screen">
      <header className="hairline sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Ahoy Calendar
              </p>
              <h1 className="text-lg font-semibold leading-tight">Event sync & reminders</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="gap-2">
              <Link to="/calendar">
                <ArrowLeft className="h-4 w-4" /> Servers
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary" className="gap-2">
              <Link to="/dashboard/$guildId" params={{ guildId }}>
                <LayoutDashboard className="h-4 w-4" /> Control center
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-8">
        {config.isPending || !config.data ? (
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        ) : (
          <Tabs defaultValue="sources">
            <TabsList className="mb-6">
              <TabsTrigger value="sources" className="gap-2">
                <CalendarDays className="h-4 w-4" /> Calendars
              </TabsTrigger>
              <TabsTrigger value="reminders" className="gap-2">
                <Bell className="h-4 w-4" /> Reminders & automation
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sources" className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Connect Google Calendar accounts or paste an iCalendar link, then sync to pull the
                upcoming events AHOY will announce.
              </p>
              <CalendarPanel guildId={guildId} config={config.data} onSaved={refresh} />
            </TabsContent>

            <TabsContent value="reminders" className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Notifiers decide where reminders land, how early they fire, who gets pinged and how
                previous reminders are cleaned up. Templates, filters and daily summaries live here
                too.
              </p>
              <EventAutomationPanel guildId={guildId} config={config.data} onSaved={refresh} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
