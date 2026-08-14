import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Ban, Crown, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";

import { AhoyWordmark } from "@/components/ahoy/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "@/components/dashboard/inbox";
import { getViewer } from "@/lib/ahoy.functions";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Choose a server — AHOY Control Center" },
      {
        name: "description",
        content: "Pick a Discord server you manage and configure AHOY's moderation, levels, economy and tickets.",
      },
      { property: "og:title", content: "Choose a server — AHOY Control Center" },
      {
        property: "og:description",
        content: "Pick a Discord server you manage and configure AHOY.",
      },
    ],
  }),
  component: ServerPicker,
});

function guildIcon(id: string, icon: string | null) {
  return icon ? `https://cdn.discordapp.com/icons/${id}/${icon}.png?size=64` : null;
}

function ServerPicker() {
  const { data, isPending } = useQuery({ queryKey: ["viewer"], queryFn: () => getViewer() });

  return (
    <div className="min-h-screen">
      <header className="hairline">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link to="/">
            <AhoyWordmark subtitle="Control Center" />
          </Link>
          {data?.signedIn ? (
            <div className="flex items-center gap-3">
              {data.adminRole ? (
                <Button asChild size="sm" variant="secondary">
                  <Link to="/admin">
                    <ShieldCheck className="mr-1 h-4 w-4" /> Owner console
                  </Link>
                </Button>
              ) : null}
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {data.user.displayName}
              </span>
              <Button asChild size="sm" variant="outline">
                <a href="/api/public/auth/discord/logout">Sign out</a>
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-semibold">Your fleet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Servers where you have Manage Server or Administrator permission.
        </p>

        {isPending ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : !data?.signedIn ? (
          <div className="glass mt-8 rounded-2xl p-8 text-center">
            <ShieldAlert className="mx-auto h-6 w-6 text-gold" />
            <p className="mt-4 text-sm text-muted-foreground">
              Sign in with Discord to load the servers you manage.
            </p>
            <Button asChild className="mt-6">
              <a href="/api/public/auth/discord/start">Sign in with Discord</a>
            </Button>
          </div>
        ) : data.banned ? (
          <div className="glass mt-8 rounded-2xl p-8 text-center">
            <Ban className="mx-auto h-6 w-6 text-destructive" />
            <p className="mt-4 text-sm text-muted-foreground">
              Your access to the AHOY control center has been revoked.
              {data.banReason ? ` Reason: ${data.banReason}` : ""}
            </p>
          </div>
        ) : data.guildsError ? (
          <div className="glass mt-8 rounded-2xl p-8 text-center">
            <RefreshCw className="mx-auto h-6 w-6 text-gold" />
            <p className="mt-4 text-sm text-muted-foreground">
              Discord did not return your servers. Your session may have expired.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <a href="/api/public/auth/discord/start">Reconnect Discord</a>
            </Button>
          </div>
        ) : data.guilds.length === 0 ? (
          <p className="glass mt-8 rounded-2xl p-8 text-center text-sm text-muted-foreground">
            No servers found where you can manage settings.
          </p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {data.guilds.map((guild) => {
              const icon = guildIcon(guild.id, guild.icon);
              return (
                <Link
                  key={guild.id}
                  to="/dashboard/$guildId"
                  params={{ guildId: guild.id }}
                  className="glass group flex items-center gap-4 rounded-2xl p-5 transition-transform hover:-translate-y-0.5"
                >
                  {icon ? (
                    <img
                      src={icon}
                      alt={`${guild.name} server icon`}
                      className="h-12 w-12 rounded-xl object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-sm font-semibold">
                      {guild.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{guild.name}</span>
                      {guild.owner ? <Crown className="h-3.5 w-3.5 text-gold" /> : null}
                    </span>
                    <Badge
                      variant="outline"
                      className={`mt-2 text-[11px] ${
                        guild.botPresent
                          ? "border-primary/50 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {guild.botPresent ? "AHOY on board" : "AHOY not invited"}
                    </Badge>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Link>
              );
            })}
          </div>
        )}
        {data?.signedIn && !data.banned ? <Inbox /> : null}
      </main>
    </div>
  );
}
