import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Anchor, ArrowRight, BarChart3, CalendarDays, Check, Coins, LifeBuoy, MessageSquareCode, ScrollText, ShieldCheck, Sparkles, Waves } from "lucide-react";

import { AhoyWordmark } from "@/components/ahoy/brand";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/ahoy.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "!HOY BOT — Discord Bot & Server Dashboard" },
      { name: "description", content: "!HOY BOT is a premium Discord bot with moderation, AutoMod, XP levels, economy, tickets, live analytics and a real-time web control center." },
      { property: "og:title", content: "!HOY BOT — Discord Bot & Server Dashboard" },
      { property: "og:description", content: "!HOY BOT is a premium Discord bot with moderation, AutoMod, XP levels, economy, tickets, live analytics and a real-time web control center." },
    ],
  }),
  component: LandingPage,
});

const FEATURES = [
  { icon: ShieldCheck, title: "Moderation crew", body: "Warn, timeout, kick, ban and purge with a complete audit trail." },
  { icon: Waves, title: "AutoMod tides", body: "Catch spam, floods, invites, duplicates and custom words automatically." },
  { icon: BarChart3, title: "XP & levels", body: "Reward active communities with XP, levels and automatic role rewards." },
  { icon: Coins, title: "Ship's economy", body: "Daily rewards, balances and transfers with a currency you control." },
  { icon: LifeBuoy, title: "Ticket harbour", body: "Button-driven support tickets with roles, transcripts and clean close flows." },
  { icon: ScrollText, title: "Event logging", body: "Keep joins, leaves, edits, deletions and server changes organized." },
  { icon: MessageSquareCode, title: "Custom commands", body: "Create plain-text or embed responses and publish them in seconds." },
  { icon: Sparkles, title: "Welcome aboard", body: "Give new members a polished welcome with embeds and auto-roles." },
];

function LandingPage() {
  const { data } = useQuery({ queryKey: ["viewer"], queryFn: () => getViewer() });
  const signedIn = data?.signedIn === true;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 px-4 pt-4 sm:px-6">
        <div className="glass mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 rounded-2xl px-4 py-3 sm:px-5">
          <AhoyWordmark subtitle="Control Center" />
          <nav aria-label="Main navigation" className="flex items-center gap-1.5 sm:gap-2">
            <Link to="/privacy" className="hidden rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex">Privacy</Link>
            <Link to="/terms" className="hidden rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex">Terms</Link>
            <Button asChild size="sm" variant="outline" className="rounded-xl"><a href="/api/public/invite">Invite <span className="hidden sm:inline">!HOY</span></a></Button>
            {signedIn ? <Button asChild size="sm" className="rounded-xl"><Link to="/dashboard">Open dashboard</Link></Button> : <Button asChild size="sm" variant="secondary" className="rounded-xl"><a href="/api/public/auth/discord/start">Sign in</a></Button>}
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-20 text-center sm:px-6 sm:pt-24 md:pb-16">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/80 bg-secondary/30 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground shadow-[0_12px_40px_-24px_oklch(0_0_0/0.9)] backdrop-blur-xl">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10"><Anchor className="h-3 w-3 text-primary" /></span>
            Premium Discord control
          </div>
          <h1 className="mx-auto mt-7 max-w-4xl text-balance text-4xl font-semibold leading-[1.04] tracking-tight sm:text-5xl md:text-7xl">Your server deserves a <span className="text-tide">better helm.</span></h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">Moderation, automation, community rewards, support and events — brought together in one beautifully controlled experience with !HOY BOT.</p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            {signedIn ? <Button asChild size="lg" className="h-12 rounded-xl px-6"><Link to="/dashboard">Open your dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link></Button> : <Button asChild size="lg" variant="secondary" className="h-12 rounded-xl px-6"><a href="/api/public/auth/discord/start">Continue with Discord <ArrowRight className="ml-2 h-4 w-4" /></a></Button>}
            <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-6"><a href="/api/public/invite">Add !HOY to your server</a></Button>
          </div>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> Fast setup</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> Live configuration</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> Built for communities</span>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 md:pb-20">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="glass group flex min-h-[310px] flex-col justify-between rounded-3xl p-6 transition-transform duration-300 hover:-translate-y-1 sm:p-8">
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"><Anchor className="h-4 w-4 text-primary" /></span> Server control</span>
                  <span className="rounded-full border border-border/70 bg-background/20 px-2.5 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">01</span>
                </div>
                <h2 className="mt-7 text-2xl font-semibold sm:text-3xl">Everything your crew needs.</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Manage moderation, AutoMod, welcomes, tickets, custom commands and server settings from a single control center.</p>
              </div>
              <Button asChild variant="secondary" className="mt-7 w-full rounded-xl sm:w-fit"><Link to="/dashboard">Open control center <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </div>

            <div className="glass group flex min-h-[310px] flex-col justify-between rounded-3xl p-6 transition-transform duration-300 hover:-translate-y-1 sm:p-8">
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"><CalendarDays className="h-4 w-4 text-primary" /></span> !HOY Calendar</span>
                  <span className="rounded-full border border-border/70 bg-background/20 px-2.5 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">02</span>
                </div>
                <h2 className="mt-7 text-2xl font-semibold sm:text-3xl">Events that never get missed.</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Sync Google Calendar or iCalendar feeds and let !HOY handle announcements, countdown reminders, RSVPs and daily summaries.</p>
              </div>
              <Button asChild className="mt-7 w-full rounded-xl sm:w-fit"><Link to="/calendar">Explore Calendar <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 md:pb-24">
          <div className="mb-7 flex flex-col gap-2 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">The toolkit</p>
              <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Power without the clutter.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground sm:text-right">Thoughtful tools for the moments that matter, wrapped in one consistent control experience.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="glass group rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-1 focus-within:-translate-y-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 transition-transform duration-300 group-hover:scale-105"><feature.icon className="h-5 w-5 text-primary" /></div>
                <h3 className="mt-5 text-base font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 md:pb-24">
          <div className="glass relative overflow-hidden rounded-3xl p-7 text-center sm:p-10 md:p-12">
            <div className="relative mx-auto max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">Ready when you are</p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Bring a little more order aboard.</h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">Add !HOY to your community and turn everyday server management into a calmer, cleaner experience.</p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-xl px-7"><a href="/api/public/invite">Add !HOY to your server <ArrowRight className="ml-2 h-4 w-4" /></a></Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-7"><Link to="/calendar">Explore Calendar</Link></Button>
              </div>
              <p className="mt-5 text-[11px] text-muted-foreground">We only request <code className="rounded bg-background/40 px-1.5 py-0.5 text-foreground">identify</code> and <code className="rounded bg-background/40 px-1.5 py-0.5 text-foreground">guilds</code>. Permissions are verified with Discord on every request.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>!HOY — steady as she goes.</span>
            <span className="hidden text-border sm:inline">•</span>
            <Link to="/privacy" className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Privacy Policy</Link>
            <Link to="/terms" className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Terms of Service</Link>
          </div>
          <span>Built with LOVE 💕</span>
        </div>
      </footer>
    </div>
  );
}
