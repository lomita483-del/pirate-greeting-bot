import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Ban, Crown, RefreshCw, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";

import { AhoyWordmark } from "@/components/ahoy/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "@/components/dashboard/inbox";
import { getViewer } from "@/lib/ahoy.functions";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Choose a server — ! HOY BOT Control Center" },
      {
        name: "description",
        content: "Pick a Discord server you manage and configure ! HOY BOT moderation, levels, economy and tickets.",
      },
      { property: "og:title", content: "Choose a server — ! HOY BOT Control Center" },
      {
        property: "og:description",
        content: "Pick a Discord server you manage and configure ! HOY BOT.",
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
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-5">
          <Link to="/" aria-label="Go to AHOY BOT home">
            <AhoyWordmark subtitle="Control Center" />
          </Link>
          {data?.signedIn ? (
            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <Button asChild size="sm" variant="outline" aria-label="Open plans and premium access">
                <Link to="/pricing">
                  <Sparkles className="mr-1 h-4 w-4" />
                  Plans &amp; Premium
                </Link>
              </Button>
              {data.adminRole ? (
                <Button asChild size="sm" variant="secondary" aria-label="Open owner console">
                  <Link to="/owner-console">
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
        <section className="glass mb-8 rounded-2xl border border-gold/20 p-5 sm:p-6" aria-labelledby="premium-access-title">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-gold">
                <Crown className="h-5 w-5" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em]">Premium access</span>
              </div>
              <h1 id="premium-access-title" className="text-xl font-semibold sm:text-2xl">Unlock more AHOY BOT modules</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                View your current plan, complete unlock tasks, or send the owner a Premium Access request.
              </p>
            </div>
            <Button asChild className="shrink-0 gap-2" aria-label="View plans and request Premium Access">
              <Link to="/pricing">
                Request Premium Access
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>

        <h2 className="text-3xl font-semibold">Your fleet</h2>
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
            <ShieldAlert className="mx-auto h-6 w-6 text-gold" aria-hidden="true" />
            <p className="mt-4 text-sm text-muted-foreground">
              Sign in with Discord to load the servers you manage.
            </p>
            <Button asChild className="mt-6">
              <a href="/api/public/auth/discord/start">Sign in with Discord</a>
            </Button>
          </div>
        ) : data.banned ? (
          <div className="glass mt-8 rounded-2xl p-8 text-center">
            <Ban className="mx-auto h-6 w-6 text-destructive" aria-hidden="true" />
            <p className="mt-4 text-sm text-muted-foreground">
              Your access to the AHOY BOT control center has been revoked.
              {data.banReason ? ` Reason: ${data.banReason}` : ""}
            </p>
          </div>
        ) : data.guildsError ? (
          <div className="glass mt-8 rounded-2xl p-8 text-center">
            <RefreshCw className="mx-auto h-6 w-6 text-gold" aria-hidden="true" />
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
                  aria-label={`Open dashboard for ${guild.name}`}
                  className="glass group flex items-center gap-4 rounded-2xl p-5 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {icon ? (
                    <img
                      src={icon}
                      alt={`${guild.name} server icon`}
                      className="h-12 w-12 rounded-xl object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-sm font-semibold">
                      {guild.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{guild.name}</span>
                      {guild.owner ? <Crown className="h-3.5 w-3.5 text-gold" aria-label="Server owner" /> : null}
                    </span>
                    {guild.botPresent ? (
                      <Badge
                        variant="outline"
                        className="mt-2 text-[11px] border-primary/50 text-primary"
                      >
                        AHOY BOT on board
                      </Badge>
                    ) : (
                      <span
                        role="link"
                        tabIndex={0}
                        aria-label={`Invite AHOY BOT to ${guild.name}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.location.href = `/api/public/invite?guild=${guild.id}`;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            window.location.href = `/api/public/invite?guild=${guild.id}`;
                          }
                        }}
                        className="mt-2 inline-flex cursor-pointer rounded-full border border-gold/50 px-2.5 py-0.5 text-[11px] text-gold hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                      >
                        Invite AHOY BOT
                      </span>
                    )}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" />
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
