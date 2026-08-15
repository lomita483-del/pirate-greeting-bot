import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, BarChart3, FileText, Gauge, Shield, ShieldAlert } from "lucide-react";

import { useGuild } from "@/components/dashboard/guild-context";
import { ModuleHeader } from "@/components/dashboard/module-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/dashboard/$guildId/")({
  head: () => ({
    meta: [
      { title: "Server overview — AHOY Control Center" },
      {
        name: "description",
        content: "Overview of members, tickets, warnings and recent moderation activity for your Discord server.",
      },
      { property: "og:title", content: "Server overview — AHOY Control Center" },
      {
        property: "og:description",
        content: "Members, tickets, warnings and recent moderation activity at a glance.",
      },
    ],
  }),
  component: GuildHome,
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

const QUICK = [
  {
    title: "Moderation cases",
    body: "View, filter and manage every ban, kick, mute and warn case.",
    to: "/dashboard/$guildId/moderation",
    cta: "View cases",
    icon: Shield,
  },
  {
    title: "Auto moderation",
    body: "Block spam, invites, links and mass mentions automatically.",
    to: "/dashboard/$guildId/automod",
    cta: "Configure AutoMod",
    icon: ShieldAlert,
  },
  {
    title: "Command library",
    body: "Enable, restrict and customise every AHOY command.",
    to: "/dashboard/$guildId/commands",
    cta: "Open commands",
    icon: FileText,
  },
  {
    title: "Server stats",
    body: "Leaderboards, ranks and member profiles for your community.",
    to: "/dashboard/$guildId/stats",
    cta: "Show stats",
    icon: BarChart3,
  },
] as const;

function GuildHome() {
  const { guildId, config, overview } = useGuild();
  const name = config?.guild.name;

  return (
    <div>
      <ModuleHeader
        icon={Gauge}
        title={name ? `${name} Dashboard` : "Server Dashboard"}
        description="Your commonly used control panel pages and live server figures."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!overview
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
          : [
              ["Members", overview.memberCount ?? "—"],
              ["Open tickets", overview.openTickets],
              ["Active warnings", overview.activeWarnings],
              ["Mod actions (7d)", overview.moderationLast7Days],
            ].map(([label, value]) => (
              <Stat key={String(label)} label={String(label)} value={value as number} />
            ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {QUICK.map((card) => (
          <Card key={card.title} className="glass border-0">
            <CardContent className="pt-6">
              <card.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-3 text-lg font-semibold">{card.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{card.body}</p>
              <Button asChild size="sm" variant="secondary" className="mt-4">
                <Link to={card.to} params={{ guildId }}>
                  {card.cta}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass mt-8 border-0">
        <CardContent className="space-y-3 pt-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Activity className="h-4 w-4 text-primary" /> Recent moderation
          </h2>
          {overview && overview.recent.length > 0 ? (
            <ul className="space-y-2">
              {overview.recent.map((entry, index) => (
                <li
                  key={`${entry.created_at}-${index}`}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 px-4 py-3 text-sm"
                >
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    {entry.action}
                  </Badge>
                  <span className="font-medium">{entry.target_name ?? "Unknown"}</span>
                  <span className="text-muted-foreground">by {entry.moderator_name ?? "AHOY"}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No moderation actions recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
