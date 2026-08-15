import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Anchor,
  BarChart3,
  Coins,
  LifeBuoy,
  MessageSquareCode,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react";

import { AhoyWordmark } from "@/components/ahoy/brand";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/ahoy.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AHOY — Discord Bot & Server Dashboard" },
      {
        name: "description",
        content:
          "AHOY is a premium Discord bot with moderation, AutoMod, XP levels, economy, tickets and a real-time web control center.",
      },
      { property: "og:title", content: "AHOY — Discord Bot & Server Dashboard" },
      {
        property: "og:description",
        content:
          "AHOY is a premium Discord bot with moderation, AutoMod, XP levels, economy, tickets and a real-time web control center.",
      },
    ],
  }),
  component: LandingPage,
});

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Moderation crew",
    body: "Warn, timeout, kick, ban and purge with full audit history written to your database.",
  },
  {
    icon: Waves,
    title: "AutoMod tides",
    body: "Spam, mention floods, invites, duplicates and a custom word filter — each with its own action.",
  },
  {
    icon: BarChart3,
    title: "XP & levels",
    body: "Message XP with cooldowns, level-up announcements and automatic level role rewards.",
  },
  {
    icon: Coins,
    title: "Ship's economy",
    body: "Daily rewards, balances and transfers with a currency you name yourself.",
  },
  {
    icon: LifeBuoy,
    title: "Ticket harbour",
    body: "Button-driven support tickets with support roles, transcripts and clean close flows.",
  },
  {
    icon: ScrollText,
    title: "Event logging",
    body: "Joins, leaves, edits, deletions, role and channel changes routed to a log channel.",
  },
  {
    icon: MessageSquareCode,
    title: "Custom commands",
    body: "Author plain-text or embed responses from the dashboard, live in seconds.",
  },
  {
    icon: Sparkles,
    title: "Welcome aboard",
    body: "Rich welcome and goodbye embeds with auto-roles for every new crew member.",
  },
];

function LandingPage() {
  const { data } = useQuery({ queryKey: ["viewer"], queryFn: () => getViewer() });
  const signedIn = data?.signedIn === true;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <AhoyWordmark subtitle="Control Center" />
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <a href="/api/public/invite">Invite AHOY</a>
          </Button>
          {signedIn ? (
            <Button asChild size="sm">
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="secondary">
              <a href="/api/public/auth/discord/start">Sign in with Discord</a>
            </Button>
          )}
        </div>

      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-14 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-4 py-1.5 text-xs uppercase tracking-[0.22em] text-muted-foreground">
            <Anchor className="h-3.5 w-3.5 text-primary" />
            All hands on deck
          </span>
          <h1 className="mx-auto mt-8 max-w-3xl text-balance text-5xl font-semibold leading-[1.05] md:text-6xl">
            Command your Discord server from <span className="text-tide">one helm</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-muted-foreground md:text-lg">
            AHOY pairs a modular Python bot with a permission-aware control center. Moderation,
            AutoMod, levels, economy and tickets — every setting saved straight to your own
            database.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <a href="/api/public/auth/discord/start">
                {signedIn ? "Continue with Discord" : "Sign in with Discord"}
              </a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="/api/public/invite">Add AHOY to your server</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#features">Explore the systems</a>
            </Button>

          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            We only request <code className="text-foreground">identify</code> and{" "}
            <code className="text-foreground">guilds</code>. Permissions are verified with Discord
            on every request.
          </p>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="glass rounded-2xl p-5">
                <feature.icon className="h-5 w-5 text-primary" />
                <h2 className="mt-4 text-base font-semibold">{feature.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="hairline border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground">
          <span>AHOY — steady as she goes.</span>
          <span>Built with discord.py + Lovable Cloud</span>
        </div>
      </footer>
    </div>
  );
}
