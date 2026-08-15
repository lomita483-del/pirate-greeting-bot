import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, Menu } from "lucide-react";

import { AhoyWordmark } from "@/components/ahoy/brand";
import { GuildContext } from "@/components/dashboard/guild-context";
import { GuildNav } from "@/components/dashboard/guild-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { getGuildConfig, getGuildOverview, getViewer } from "@/lib/ahoy.functions";

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
  component: GuildDashboardLayout,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-gold" />
      <p className="mt-4 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function guildIcon(id: string, icon: string | null) {
  return icon ? `https://cdn.discordapp.com/icons/${id}/${icon}.png?size=64` : null;
}

function ServerSwitcher({ guildId, name }: { guildId: string; name: string }) {
  const { data } = useQuery({ queryKey: ["viewer"], queryFn: () => getViewer() });
  const guilds = data?.signedIn && !data.guildsError ? data.guilds : [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="max-w-[220px] gap-2">
          <span className="truncate">{name}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Your servers</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {guilds.length === 0 ? (
          <DropdownMenuItem disabled>No servers available</DropdownMenuItem>
        ) : (
          guilds.map((guild) => {
            const icon = guildIcon(guild.id, guild.icon);
            return (
              <DropdownMenuItem key={guild.id} asChild>
                <Link to="/dashboard/$guildId" params={{ guildId: guild.id }} className="gap-2">
                  {icon ? (
                    <img src={icon} alt="" className="size-6 rounded-md" />
                  ) : (
                    <span className="flex size-6 items-center justify-center rounded-md bg-secondary text-[10px]">
                      {guild.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="truncate">{guild.name}</span>
                  {guild.id === guildId ? <Check className="ml-auto h-4 w-4 text-primary" /> : null}
                </Link>
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" /> All servers
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GuildDashboardLayout() {
  const { guildId } = Route.useParams();
  const queryClient = useQueryClient();
  const [mobileNav, setMobileNav] = useState(false);

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
  const guildName = config.data?.guild.name ?? "Control Center";

  return (
    <GuildContext.Provider
      value={{
        guildId,
        config: config.data,
        overview: overview.data,
        isPending: config.isPending,
        refresh,
      }}
    >
      <div className="min-h-screen">
        <header className="hairline sticky top-0 z-30 bg-background/80 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <Sheet open={mobileNav} onOpenChange={setMobileNav}>
                <SheetTrigger asChild>
                  <Button size="icon" variant="ghost" className="lg:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 overflow-y-auto p-6">
                  <GuildNav guildId={guildId} onNavigate={() => setMobileNav(false)} />
                </SheetContent>
              </Sheet>
              <Link to="/dashboard" className="hidden sm:block">
                <AhoyWordmark />
              </Link>
              <ServerSwitcher guildId={guildId} name={guildName} />
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <a href="/api/public/auth/discord/logout">Sign out</a>
              </Button>
            </div>
          </div>
        </header>

        <div className="flex">
          <aside className="hairline sticky top-[65px] hidden h-[calc(100vh-65px)] w-64 shrink-0 overflow-y-auto border-r px-4 py-6 lg:block">
            <GuildNav guildId={guildId} />
          </aside>

          <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">
            <div className="mx-auto max-w-5xl">
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
                  {overview.data && overview.data.botStatus !== "present" ? (
                    <Card className="glass mb-6 border-0">
                      <CardContent className="flex flex-wrap items-center gap-3 py-5">
                        <AlertTriangle className="h-5 w-5 text-gold" />
                        <p className="text-sm text-muted-foreground">
                          {overview.data.botStatus === "absent"
                            ? "AHOY is not in this server yet, so channels and roles can't be listed. Settings you save here will apply as soon as the bot joins."
                            : "AHOY's bot token isn't configured or is invalid, so channels and roles can't be listed. Settings you save here still apply."}
                        </p>
                        {overview.data.botStatus === "absent" ? (
                          <Button asChild size="sm" className="ml-auto">
                            <a href={`/api/public/invite?guild=${guildId}`}>Invite AHOY</a>
                          </Button>
                        ) : null}
                      </CardContent>
                    </Card>
                  ) : null}
                  <Outlet />
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </GuildContext.Provider>
  );
}
