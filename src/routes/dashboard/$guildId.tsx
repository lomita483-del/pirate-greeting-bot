import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft } from "lucide-react";

import { AhoyWordmark } from "@/components/ahoy/brand";
import { CommandsPanel } from "@/components/dashboard/commands-panel";
import { LeaderboardPanel, RemindersPanel } from "@/components/dashboard/engagement-panels";
import { RolesPanel } from "@/components/dashboard/roles-panel";
import {
  AutoModPanel,
  GeneralPanel,
  LoggingPanel,
  WelcomePanel,
} from "@/components/dashboard/settings-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getGuildConfig, getGuildOverview } from "@/lib/ahoy.functions";

export const Route = createFileRoute("/dashboard/$guildId")({
  head: () => ({
    meta: [
      { title: "Server control center — AHOY" },
      {
        name: "description",
        content:
          "Configure AHOY's moderation, AutoMod, welcome messages, logging, levels, economy, tickets and custom commands.",
      },
      { property: "og:title", content: "Server control center — AHOY" },
      {
        property: "og:description",
        content: "Configure moderation, AutoMod, levels, economy, tickets and custom commands.",
      },
    ],
  }),
  component: GuildDashboard,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-gold" />
      <p className="mt-4 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="glass border-0">
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function GuildDashboard() {
  const { guildId } = Route.useParams();
  const queryClient = useQueryClient();

  const overview = useQuery({
    queryKey: ["overview", guildId],
    queryFn: () => getGuildOverview({ data: { guildId } }),
  });
  const config = useQuery({
    queryKey: ["config", guildId],
    queryFn: () => getGuildConfig({ data: { guildId } }),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["config", guildId] });
    queryClient.invalidateQueries({ queryKey: ["overview", guildId] });
  };

  const error = overview.error ?? config.error;

  return (
    <div className="min-h-screen pb-16">
      <header className="hairline">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <Link to="/dashboard">
            <AhoyWordmark subtitle={config.data?.guild.name ?? "Control Center"} />
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" />
                All servers
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href="/api/public/auth/discord/logout">Sign out</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {error ? (
          <Card className="glass border-0">
            <CardContent className="py-10 text-center">
              <AlertTriangle className="mx-auto h-6 w-6 text-gold" />
              <p className="mt-4 text-sm text-muted-foreground">{(error as Error).message}</p>
              <Button asChild className="mt-6" variant="outline">
                <a href="/api/public/auth/discord/start">Reconnect Discord</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {overview.data && !overview.data.botPresent ? (
              <Card className="glass mb-6 border-0">
                <CardContent className="flex flex-wrap items-center gap-3 py-5">
                  <AlertTriangle className="h-5 w-5 text-gold" />
                  <p className="text-sm text-muted-foreground">
                    AHOY is not in this server yet, so channels and roles can't be listed. Settings
                    you save here will apply as soon as the bot joins.
                  </p>
                  <Button asChild size="sm" className="ml-auto">
                    <a href={`/api/public/invite?guild=${guildId}`}>Invite AHOY</a>
                  </Button>

                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {overview.isPending
                ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
                : overview.data
                  ? [
                      ["Members", overview.data.memberCount ?? "—"],
                      ["Open tickets", overview.data.openTickets],
                      ["Active warnings", overview.data.activeWarnings],
                      ["Mod actions (7d)", overview.data.moderationLast7Days],
                    ].map(([label, value]) => (
                      <Stat key={String(label)} label={String(label)} value={value as number} />
                    ))
                  : null}
            </div>

            <Tabs defaultValue="general" className="mt-8">
              <TabsList className="flex w-full flex-wrap justify-start gap-1 bg-secondary/40">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="welcome">Welcome</TabsTrigger>
                <TabsTrigger value="automod">AutoMod</TabsTrigger>
                <TabsTrigger value="logging">Logging</TabsTrigger>
                <TabsTrigger value="roles">Roles</TabsTrigger>
                <TabsTrigger value="leaderboards">Leaderboards</TabsTrigger>
                <TabsTrigger value="reminders">Reminders</TabsTrigger>
                <TabsTrigger value="commands">Commands</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              {config.isPending || !config.data ? (
                <div className="mt-6 space-y-4">
                  <Skeleton className="h-40 rounded-2xl" />
                  <Skeleton className="h-64 rounded-2xl" />
                </div>
              ) : (
                <>
                  <TabsContent value="general" className="mt-6">
                    <GeneralPanel guildId={guildId} config={config.data} onSaved={refresh} />
                  </TabsContent>
                  <TabsContent value="welcome" className="mt-6">
                    <WelcomePanel guildId={guildId} config={config.data} onSaved={refresh} />
                  </TabsContent>
                  <TabsContent value="automod" className="mt-6">
                    <AutoModPanel guildId={guildId} config={config.data} onSaved={refresh} />
                  </TabsContent>
                  <TabsContent value="logging" className="mt-6">
                    <LoggingPanel guildId={guildId} config={config.data} onSaved={refresh} />
                  </TabsContent>
                  <TabsContent value="roles" className="mt-6">
                    <RolesPanel guildId={guildId} config={config.data} onSaved={refresh} />
                  </TabsContent>
                  <TabsContent value="leaderboards" className="mt-6">
                    <LeaderboardPanel
                      guildId={guildId}
                      currency={config.data.settings?.currency_name ?? "coins"}
                    />
                  </TabsContent>
                  <TabsContent value="reminders" className="mt-6">
                    <RemindersPanel guildId={guildId} />
                  </TabsContent>
                  <TabsContent value="commands" className="mt-6">
                    <CommandsPanel guildId={guildId} config={config.data} onSaved={refresh} />
                  </TabsContent>
                  <TabsContent value="activity" className="mt-6">
                    <Card className="glass border-0">
                      <CardContent className="space-y-3 pt-6">
                        <h2 className="text-lg font-semibold">Recent moderation</h2>
                        {overview.data && overview.data.recent.length > 0 ? (
                          <ul className="space-y-2">
                            {overview.data.recent.map((entry, index) => (
                              <li
                                key={`${entry.created_at}-${index}`}
                                className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 px-4 py-3 text-sm"
                              >
                                <Badge variant="outline" className="border-primary/40 text-primary">
                                  {entry.action}
                                </Badge>
                                <span className="font-medium">{entry.target_name ?? "Unknown"}</span>
                                <span className="text-muted-foreground">
                                  by {entry.moderator_name ?? "AHOY"}
                                </span>
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {new Date(entry.created_at).toLocaleString()}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No moderation actions recorded yet.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </>
              )}
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
