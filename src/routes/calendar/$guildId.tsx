import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Bell, CalendarDays, CalendarPlus, CheckCircle2, ChevronDown, Clock3, LayoutDashboard, RefreshCw, Settings2, Sparkles } from "lucide-react";

import { PremiumGate } from "@/components/dashboard/premium-gate";
import { CalendarEventsPanel } from "@/components/dashboard/calendar-events-panel";
import { CalendarPanel } from "@/components/dashboard/calendar-panel";
import { EventAutomationPanel } from "@/components/dashboard/event-automation-panel";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getGuildConfig, getViewer } from "@/lib/ahoy.functions";

export const Route = createFileRoute("/calendar/$guildId")({
  head: () => ({
    meta: [
      { title: "!HOY Calendar — event sync & reminders" },
      { name: "description", content: "Premium calendar sync, event management and Discord reminder automation for !HOY BOT." },
      { property: "og:title", content: "!HOY Calendar — event sync & reminders" },
      { property: "og:description", content: "Manage calendars, events and Discord reminders for your server." },
    ],
  }),
  component: CalendarWorkspace,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <AlertTriangle className="mx-auto size-7 text-gold" />
      <h1 className="mt-4 text-xl font-bold">Calendar could not be loaded</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Button asChild variant="outline" className="mt-5 gap-2"><Link to="/"><ArrowLeft className="size-4" />Back to Home</Link></Button>
    </main>
  ),
});

function guildIcon(id: string, icon: string | null) {
  return icon ? `https://cdn.discordapp.com/icons/${id}/${icon}.png?size=96` : null;
}

function CalendarWorkspace() {
  const { guildId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const viewer = useQuery({ queryKey: ["viewer"], queryFn: () => getViewer(), staleTime: 30_000 });
  const config = useQuery({ queryKey: ["guild-config", guildId], queryFn: () => getGuildConfig({ data: { guildId } }) });
  const guilds = viewer.data?.signedIn && !viewer.data.guildsError ? viewer.data.guilds : [];
  const currentGuild = guilds.find((g) => g.id === guildId);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["guild-config", guildId] });
    void queryClient.invalidateQueries({ queryKey: ["calendar", guildId] });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#02070d] text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-24 top-10 size-96 rounded-full bg-cyan-400/[0.06] blur-3xl" />
      </div>
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#02070d]/75 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-[74px] max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Back to Home" className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.04] text-white/65 transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_30px_rgba(32,199,183,.12)]"><CalendarDays className="size-5" /></span>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[.28em] text-primary">!HOY CALENDAR</p>
              <h1 className="truncate text-base font-black sm:text-lg">{currentGuild?.name ?? "Calendar Workspace"}</h1>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="hidden gap-2 sm:flex"><Link to="/dashboard/$guildId" params={{ guildId }}><LayoutDashboard className="size-4" />Control Center</Link></Button>
          <Button variant="outline" size="icon" onClick={refresh} aria-label="Refresh calendar" className="shrink-0"><RefreshCw className="size-4" /></Button>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[30px] border border-white/[0.12] bg-white/[0.035] p-5 shadow-[0_30px_100px_rgba(0,0,0,.3)] backdrop-blur-2xl sm:p-7">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(32,199,183,.15),transparent_34%),radial-gradient(circle_at_95%_15%,rgba(56,189,248,.08),transparent_28%)]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.22em] text-primary">Premium workspace</span>
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[9px] uppercase tracking-[.18em] text-white/45"><Sparkles className="size-3" /> Live calendar control</span>
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Your events, under one helm.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">Connect external calendars, manage events, and automate Discord reminders without leaving the !HOY dashboard.</p>
            </div>
            <div className="w-full max-w-sm">
              <label className="mb-2 block text-[9px] font-bold uppercase tracking-[.22em] text-white/35">Select server</label>
              <Select value={guildId} onValueChange={(id) => void navigate({ to: "/calendar/$guildId", params: { guildId: id } })}>
                <SelectTrigger className="h-12 rounded-2xl border-white/[0.12] bg-black/25 shadow-xl"><SelectValue placeholder="Choose a server" /></SelectTrigger>
                <SelectContent>{guilds.map((guild) => <SelectItem key={guild.id} value={guild.id}><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-400" />{guild.name}</span></SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={CalendarDays} label="Calendar hub" value="Connected" detail="Feeds & accounts" />
          <StatCard icon={CalendarPlus} label="Event control" value="Ready" detail="Create & manage" />
          <StatCard icon={Bell} label="Automation" value="Active" detail="Reminders & notices" />
          <StatCard icon={Clock3} label="Sync engine" value="Live" detail="Server workspace" />
        </section>

        {config.isPending || !config.data ? (
          <div className="mt-5 space-y-4"><Skeleton className="h-24 rounded-3xl" /><Skeleton className="h-[500px] rounded-3xl" /></div>
        ) : (
          <PremiumGate feature="calendar">
            <section className="mt-5 rounded-[30px] border border-white/[0.1] bg-white/[0.025] p-3 shadow-2xl backdrop-blur-2xl sm:p-5">
              <div className="mb-5 flex items-center justify-between gap-3 px-1 sm:px-2">
                <div><p className="text-[9px] font-bold uppercase tracking-[.24em] text-primary">Calendar controls</p><h3 className="mt-1 text-xl font-black">Manage your schedule</h3></div>
                <div className="hidden items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-2 text-[9px] uppercase tracking-[.18em] text-emerald-300 sm:flex"><CheckCircle2 className="size-3.5" /> Workspace ready</div>
              </div>
              <Tabs defaultValue="sources">
                <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl border border-white/[0.08] bg-black/20 p-1.5">
                  <TabsTrigger value="sources" className="gap-2 rounded-xl py-3 text-xs"><CalendarDays className="size-4" /> <span className="hidden sm:inline">Calendars</span><span className="sm:hidden">Sources</span></TabsTrigger>
                  <TabsTrigger value="events" className="gap-2 rounded-xl py-3 text-xs"><CalendarPlus className="size-4" /> Events</TabsTrigger>
                  <TabsTrigger value="reminders" className="gap-2 rounded-xl py-3 text-xs"><Bell className="size-4" /> <span className="hidden sm:inline">Reminders & automation</span><span className="sm:hidden">Automation</span></TabsTrigger>
                </TabsList>
                <TabsContent value="sources" className="mt-5 space-y-5"><p className="px-1 text-sm leading-6 text-white/45">Connect Google Calendar accounts or iCalendar feeds, then sync the events !HOY should announce in Discord.</p><CalendarPanel guildId={guildId} config={config.data} onSaved={refresh} /></TabsContent>
                <TabsContent value="events" className="mt-5 space-y-5"><p className="px-1 text-sm leading-6 text-white/45">Create, edit and delete events manually, or send a reminder into Discord immediately.</p><CalendarEventsPanel guildId={guildId} config={config.data} onSaved={refresh} /></TabsContent>
                <TabsContent value="reminders" className="mt-5 space-y-5"><p className="px-1 text-sm leading-6 text-white/45">Choose reminder timing, destinations, mentions, cleanup rules, templates, filters and daily summaries.</p><EventAutomationPanel guildId={guildId} config={config.data} onSaved={refresh} /></TabsContent>
              </Tabs>
            </section>
          </PremiumGate>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, detail }: { icon: typeof CalendarDays; label: string; value: string; detail: string }) {
  return <article className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4 shadow-[0_15px_45px_rgba(0,0,0,.16)] backdrop-blur-xl"><span className="flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Icon className="size-4" /></span><p className="mt-3 text-[9px] font-bold uppercase tracking-[.16em] text-white/35">{label}</p><p className="mt-1 text-lg font-black">{value}</p><p className="mt-0.5 text-[10px] text-white/35">{detail}</p></article>;
}
