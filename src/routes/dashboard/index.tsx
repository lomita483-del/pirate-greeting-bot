import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Crown,
  Gauge,
  LayoutDashboard,
  Search,
  Server,
  ShieldAlert,
  Sparkles,
  Users,
  XCircle,
  Zap,
} from "lucide-react";

import { AhoyWordmark } from "@/components/ahoy/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "@/components/dashboard/inbox";
import { getViewer } from "@/lib/ahoy.functions";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Dashboard — AHOY BOT Control Center" },
      {
        name: "description",
        content: "Your AHOY BOT command center for managing Discord servers, fleet health and Premium access.",
      },
      { property: "og:title", content: "Dashboard — AHOY BOT Control Center" },
      {
        property: "og:description",
        content: "Manage your Discord fleet from one premium command center.",
      },
    ],
  }),
  component: UserDashboard,
});

function guildIcon(id: string, icon: string | null) {
  return icon ? `https://cdn.discordapp.com/icons/${id}/${icon}.png?size=128` : null;
}

function UserDashboard() {
  const { data, isPending } = useQuery({ queryKey: ["viewer"], queryFn: () => getViewer() });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "online" | "setup">("all");

  const guilds = useMemo(() => {
    if (!data?.signedIn) return [];
    const normalized = query.trim().toLowerCase();
    return data.guilds
      .filter((guild) => !normalized || guild.name.toLowerCase().includes(normalized))
      .filter((guild) => filter === "all" || (filter === "online" ? guild.botPresent : !guild.botPresent));
  }, [data, filter, query]);

  const totalMembers = data?.signedIn
    ? data.guilds.reduce((sum, guild) => sum + (guild.memberCount ?? 0), 0)
    : 0;
  const installed = data?.signedIn ? data.guilds.filter((guild) => guild.botPresent).length : 0;
  const setupNeeded = data?.signedIn ? data.guilds.filter((guild) => !guild.botPresent).length : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Go to AHOY BOT home">
            <AhoyWordmark subtitle="Command Center" />
          </Link>
          {data?.signedIn ? (
            <div className="flex items-center gap-2">
              {data.user.avatarUrl ? (
                <img src={data.user.avatarUrl} alt="" className="h-9 w-9 rounded-full border border-primary/30" />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 bg-secondary text-xs font-bold" aria-hidden="true">
                  {data.user.displayName.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="hidden max-w-40 truncate text-sm font-medium sm:block">{data.user.displayName}</span>
              <Button asChild size="sm" variant="outline" className="ml-1">
                <a href="/api/public/auth/discord/logout">Sign out</a>
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
            <Skeleton className="h-48 rounded-3xl" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
            <Skeleton className="h-80 rounded-3xl" />
          </div>
        ) : !data?.signedIn ? (
          <section className="mx-auto max-w-xl rounded-3xl border border-border/70 bg-card/70 p-10 text-center shadow-2xl" aria-labelledby="signin-title">
            <ShieldAlert className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
            <h1 id="signin-title" className="mt-5 text-2xl font-bold">Your command center is waiting</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sign in with Discord to see and manage your server fleet.</p>
            <Button asChild className="mt-6 gap-2"><a href="/api/public/auth/discord/start">Sign in with Discord <ArrowRight className="h-4 w-4" aria-hidden="true" /></a></Button>
          </section>
        ) : data.banned ? (
          <section className="mx-auto max-w-xl rounded-3xl border border-destructive/30 bg-card/70 p-10 text-center" role="alert">
            <XCircle className="mx-auto h-8 w-8 text-destructive" aria-hidden="true" />
            <h1 className="mt-5 text-2xl font-bold">Access restricted</h1>
            <p className="mt-2 text-sm text-muted-foreground">Your access to the AHOY BOT control center has been revoked.{data.banReason ? ` Reason: ${data.banReason}` : ""}</p>
          </section>
        ) : data.guildsError ? (
          <section className="mx-auto max-w-xl rounded-3xl border border-border/70 bg-card/70 p-10 text-center" role="alert">
            <ShieldAlert className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
            <h1 className="mt-5 text-2xl font-bold">Reconnect Discord</h1>
            <p className="mt-2 text-sm text-muted-foreground">Discord did not return your managed servers. Your session may have expired.</p>
            <Button asChild className="mt-6"><a href="/api/public/auth/discord/start">Reconnect Discord</a></Button>
          </section>
        ) : (
          <>
            <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-2xl sm:p-8" aria-labelledby="dashboard-title">
              <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-primary/40 text-primary"><Zap className="mr-1 h-3 w-3" aria-hidden="true" /> AHOY Command Center</Badge>
                    {data.adminRole ? <Badge variant="secondary"><Crown className="mr-1 h-3 w-3" aria-hidden="true" /> {data.adminRole}</Badge> : null}
                  </div>
                  <h1 id="dashboard-title" className="text-3xl font-bold tracking-tight sm:text-4xl">Welcome back, {data.user.displayName}</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Your fleet is all in one place. Monitor AHOY BOT, jump into a server, and keep your communities running from one premium dashboard.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" className="gap-2"><Link to="/pricing"><Sparkles className="h-4 w-4" aria-hidden="true" /> Plans &amp; Premium</Link></Button>
                  {data.adminRole ? <Button asChild className="gap-2"><Link to="/owner-console"><Crown className="h-4 w-4" aria-hidden="true" /> Owner Console</Link></Button> : null}
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Fleet summary">
              <SummaryCard icon={Server} label="Managed servers" value={data.guilds.length} detail="Servers you can control" />
              <SummaryCard icon={Bot} label="AHOY installed" value={installed} detail="Bot is on board" />
              <SummaryCard icon={Users} label="Members in fleet" value={totalMembers.toLocaleString()} detail="Across visible servers" />
              <SummaryCard icon={Gauge} label="Setup needed" value={setupNeeded} detail={setupNeeded ? "Servers ready for invite" : "Fleet fully onboarded"} />
            </section>

            <section className="mt-8" aria-labelledby="fleet-title">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" aria-hidden="true" /><h2 id="fleet-title" className="text-2xl font-bold">My Fleet</h2></div>
                  <p className="mt-1 text-sm text-muted-foreground">Every Discord server you can manage, with live AHOY status.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="relative block">
                    <span className="sr-only">Search servers</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search fleet" className="h-10 w-full rounded-xl border border-border bg-background/70 pl-9 pr-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary sm:w-56" />
                  </label>
                  <div className="flex rounded-xl border border-border bg-card/60 p-1" aria-label="Fleet filter">
                    {([['all', 'All'], ['online', 'Installed'], ['setup', 'Needs setup']] as const).map(([value, label]) => (
                      <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-lg px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${filter === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
                    ))}
                  </div>
                </div>
              </div>

              {guilds.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-border p-10 text-center">
                  <Search className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-3 font-medium">No servers match your filter</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try another search or switch the fleet filter.</p>
                </div>
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {guilds.map((guild) => <FleetCard key={guild.id} guild={guild} />)}
                </div>
              )}
            </section>

            <section className="mt-8 grid gap-4 lg:grid-cols-3" aria-label="Dashboard shortcuts">
              <ActionCard icon={LayoutDashboard} title="Server command center" body="Open a server to configure moderation, tickets, commands, roles and more." href={guilds[0] ? `/dashboard/${guilds[0].id}` : "/dashboard"} />
              <ActionCard icon={Sparkles} title="Premium access" body="Unlock advanced AHOY modules, complete tasks or request Premium from the owner." href="/pricing" />
              <ActionCard icon={Crown} title="Owner Console" body="Manage platform staff, users, notifications and Premium requests." href="/owner-console" />
            </section>

            <div className="mt-8"> <Inbox /> </div>
          </>
        )}
      </main>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, detail }: { icon: typeof Server; label: string; value: string | number; detail: string }) {
  return <div className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-lg"><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-primary" aria-hidden="true" /></div><p className="mt-3 text-3xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}

function FleetCard({ guild }: { guild: { id: string; name: string; icon: string | null; owner: boolean; botPresent: boolean; memberCount: number | null } }) {
  const icon = guildIcon(guild.id, guild.icon);
  return <article className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-5 shadow-lg transition duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-primary/5">
    <div className="flex items-start gap-4">
      {icon ? <img src={icon} alt={`${guild.name} server icon`} className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-border" loading="lazy" /> : <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-secondary text-sm font-bold">{guild.name.slice(0, 2).toUpperCase()}</span>}
      <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className="truncate font-semibold">{guild.name}</h3>{guild.owner ? <Crown className="h-4 w-4 shrink-0 text-primary" aria-label="Server owner" /> : null}</div><div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className={guild.botPresent ? "border-emerald-500/40 text-emerald-400" : "border-primary/40 text-primary"}>{guild.botPresent ? <><CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" /> AHOY online</> : <><XCircle className="mr-1 h-3 w-3" aria-hidden="true" /> Needs setup</>}</Badge><span className="text-xs text-muted-foreground">{guild.memberCount == null ? "Members unavailable" : `${guild.memberCount.toLocaleString()} members`}</span></div></div>
    </div>
    <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/60 pt-4">
      <span className="text-xs text-muted-foreground">{guild.botPresent ? "Ready to manage" : "Invite AHOY to begin"}</span>
      {guild.botPresent ? <Button asChild size="sm" className="gap-1"><Link to="/dashboard/$guildId" params={{ guildId: guild.id }} aria-label={`Open dashboard for ${guild.name}`}>Open Dashboard <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link></Button> : <Button asChild size="sm" variant="outline"><a href={`/api/public/invite?guild=${guild.id}`} aria-label={`Invite AHOY BOT to ${guild.name}`}>Invite AHOY</a></Button>}
    </div>
  </article>;
}

function ActionCard({ icon: Icon, title, body, href }: { icon: typeof Server; title: string; body: string; href: string }) {
  return <Link to={href as never} className="group rounded-2xl border border-border/70 bg-card/60 p-5 transition hover:-translate-y-0.5 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Icon className="h-5 w-5 text-primary" aria-hidden="true" /><h2 className="mt-3 font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span></Link>;
}
