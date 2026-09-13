import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowRight, BarChart3, Bot, FileText, Gauge, Server, Shield, ShieldAlert, Ticket, Users, Zap } from "lucide-react";

import { useGuild } from "@/components/dashboard/guild-context";
import { ModuleHeader } from "@/components/dashboard/module-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/dashboard/$guildId/")({
  head: () => ({
    meta: [
      { title: "Server Dashboard — AHOY BOT Control Center" },
      { name: "description", content: "Premium AHOY BOT command center for Discord server management." },
    ],
  }),
  component: GuildHome,
});

function Stat({ label, value, icon: Icon, detail }: { label: string; value: string | number; icon: typeof Users; detail: string }) {
  return <Card className="border-border/70 bg-card/70 shadow-lg"><CardContent className="pt-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-primary" aria-hidden="true" /></div><p className="mt-3 text-3xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
}

const QUICK = [
  { title: "Moderation", body: "Review bans, kicks, timeouts, warnings and every moderation case.", to: "/dashboard/$guildId/moderation", cta: "Open moderation", icon: Shield },
  { title: "Auto moderation", body: "Protect your community from spam, invites, links and mass mentions.", to: "/dashboard/$guildId/automod", cta: "Configure AutoMod", icon: ShieldAlert },
  { title: "Command library", body: "Manage your AHOY commands, permissions and availability.", to: "/dashboard/$guildId/commands", cta: "Manage commands", icon: FileText },
  { title: "Server stats", body: "Explore members, ranks, profiles, activity and community statistics.", to: "/dashboard/$guildId/stats", cta: "View analytics", icon: BarChart3 },
  { title: "Tickets", body: "Manage your support workflow and open ticket activity.", to: "/dashboard/$guildId/tickets", cta: "Open tickets", icon: Ticket },
  { title: "Activity", body: "See what is happening across your server and recent events.", to: "/dashboard/$guildId/activity", cta: "View activity", icon: Activity },
] as const;

function GuildHome() {
  const { guildId, config, overview } = useGuild();
  const name = config?.guild.name;
  const icon = config?.guild.icon ? `https://cdn.discordapp.com/icons/${guildId}/${config.guild.icon}.png?size=128` : null;

  return <div className="space-y-8">
    <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-2xl sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {icon ? <img src={icon} alt={`${name ?? "Server"} icon`} className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-primary/30" /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-secondary text-lg font-bold" aria-hidden="true">{(name ?? "AH").slice(0, 2).toUpperCase()}</span>}
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-primary/40 text-primary"><Zap className="mr-1 h-3 w-3" aria-hidden="true" /> Command Center</Badge>{overview?.botPresent ? <Badge variant="outline" className="border-emerald-500/40 text-emerald-400"><Bot className="mr-1 h-3 w-3" aria-hidden="true" /> AHOY online</Badge> : null}</div><h1 className="mt-2 truncate text-2xl font-bold sm:text-3xl">{name ? `${name} Dashboard` : "Server Dashboard"}</h1><p className="mt-1 text-sm text-muted-foreground">Your server operations, health and AHOY controls at a glance.</p></div>
        </div>
        <Button asChild variant="outline" className="gap-2"><Link to="/dashboard/$guildId/stats" params={{ guildId }}><BarChart3 className="h-4 w-4" aria-hidden="true" /> View analytics</Link></Button>
      </div>
    </section>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {!overview ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />) : <>
        <Stat icon={Users} label="Members" value={overview.memberCount ?? "—"} detail="Current server members" />
        <Stat icon={Ticket} label="Open tickets" value={overview.openTickets} detail="Support conversations" />
        <Stat icon={ShieldAlert} label="Active warnings" value={overview.activeWarnings} detail="Members with active warnings" />
        <Stat icon={Activity} label="Moderation · 7d" value={overview.moderationLast7Days} detail="Actions in the last 7 days" />
      </>}
    </div>

    {overview ? <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Server health"><Health label="Bot status" value={overview.botPresent ? "Online" : "Not installed"} good={overview.botPresent} icon={Bot} /><Health label="Channels" value={overview.channels} good icon={Server} /><Health label="Roles" value={overview.roles} good icon={Users} /><Health label="Tracked members" value={overview.trackedMembers} good icon={Activity} /></section> : null}

    <section aria-labelledby="quick-actions-title"><div className="flex items-end justify-between gap-4"><div><h2 id="quick-actions-title" className="text-2xl font-bold">Command Center</h2><p className="mt-1 text-sm text-muted-foreground">Jump directly into the tools you use most.</p></div><Badge variant="secondary">{QUICK.length} modules</Badge></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{QUICK.map((card) => <Card key={card.title} className="border-border/70 bg-card/60 shadow-lg transition hover:-translate-y-0.5 hover:border-primary/30"><CardContent className="pt-6"><card.icon className="h-5 w-5 text-primary" aria-hidden="true" /><h3 className="mt-3 text-lg font-semibold">{card.title}</h3><p className="mt-1 min-h-12 text-sm leading-6 text-muted-foreground">{card.body}</p><Button asChild size="sm" variant="secondary" className="mt-4 gap-1"><Link to={card.to} params={{ guildId }}>{card.cta}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link></Button></CardContent></Card>)}</div></section>

    <section className="rounded-3xl border border-border/70 bg-card/60 p-5 shadow-xl sm:p-6" aria-labelledby="recent-title"><div className="flex items-center justify-between gap-3"><div><h2 id="recent-title" className="flex items-center gap-2 text-lg font-semibold"><Activity className="h-4 w-4 text-primary" aria-hidden="true" /> Recent moderation</h2><p className="mt-1 text-sm text-muted-foreground">The latest activity recorded by AHOY.</p></div><Button asChild size="sm" variant="ghost" className="gap-1"><Link to="/dashboard/$guildId/moderation" params={{ guildId }}>View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link></Button></div>{overview && overview.recent.length > 0 ? <ul className="mt-5 space-y-2">{overview.recent.map((entry, index) => <li key={`${entry.created_at}-${index}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-secondary/20 px-4 py-3 text-sm"><Badge variant="outline" className="border-primary/40 text-primary">{entry.action}</Badge><span className="font-medium">{entry.target_name ?? "Unknown"}</span><span className="text-muted-foreground">by {entry.moderator_name ?? "AHOY"}</span><span className="ml-auto text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</span></li>)} </ul> : <p className="mt-5 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No moderation actions recorded yet.</p>}</section>
  </div>;
}

function Health({ label, value, good, icon: Icon }: { label: string; value: string | number; good: boolean; icon: typeof Bot }) { return <div className="rounded-2xl border border-border/70 bg-card/50 p-4"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" aria-hidden="true" /><span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</span></div><div className="mt-2 flex items-center gap-2"><span className="font-semibold">{value}</span>{good ? <span className="h-2 w-2 rounded-full bg-emerald-400" aria-label="Healthy" /> : null}</div></div>; }
