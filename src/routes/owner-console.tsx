import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Bell,
  ChevronLeft,
  Crown,
  FileText,
  Gauge,
  Home,
  LayoutDashboard,
  Menu,
  Radio,
  RefreshCw,
  Server,
  Settings,
  Shield,
  ShieldBan,
  Sparkles,
  UserRound,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AhoyWordmark } from "@/components/ahoy/brand";
import { NotificationsPanel } from "@/components/admin/notifications-panel";
import { ServersPanel } from "@/components/admin/servers-panel";
import { StaffPanel } from "@/components/admin/staff-panel";
import { UserManager } from "@/components/admin/user-manager";
import { Button } from "@/components/ui/button";
import { getAdminContext, getAdminOverview } from "@/lib/admin.functions";

export const Route = createFileRoute("/owner-console")({
  head: () => ({
    meta: [
      { title: "Owner Console — AHOY BOT" },
      {
        name: "description",
        content:
          "Premium AHOY BOT platform command center for owners and administrators.",
      },
    ],
  }),
  component: AdminConsole,
});

const TABS = [
  { key: "overview", label: "Command Center", short: "Home", icon: Home },
  { key: "users", label: "Users", short: "Users", icon: Users },
  { key: "servers", label: "Servers", short: "Servers", icon: Server },
  { key: "notifications", label: "Logs & Notices", short: "Logs", icon: FileText },
  { key: "staff", label: "Staff & Settings", short: "Staff", icon: Settings },
] as const;

type TabKey = (typeof TABS)[number]["key"];
type AdminContext = Awaited<ReturnType<typeof getAdminContext>>;
type AdminOverview = Awaited<ReturnType<typeof getAdminOverview>>;

function AdminConsole() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: context, isPending } = useQuery({
    queryKey: ["admin", "context"],
    queryFn: getAdminContext,
    staleTime: 30_000,
  });

  if (isPending) return <LoadingScreen />;

  if (!context?.signedIn) {
    return (
      <Gate title="Sign in required" description="Sign in with Discord to access the owner command center.">
        <Button asChild className="border border-[#e7a927]/40 bg-[#e7a927]/15 text-[#ffd56b] hover:bg-[#e7a927]/25">
          <a href="/api/public/auth/discord/start">Sign in with Discord</a>
        </Button>
      </Gate>
    );
  }

  if (!context.role) {
    return (
      <Gate
        title="Restricted command center"
        description="This area is reserved for authorized AHOY platform administrators."
      >
        <Button asChild variant="outline">
          <Link to="/dashboard">
            <ChevronLeft className="mr-2 size-4" />
            Back to dashboard
          </Link>
        </Button>
      </Gate>
    );
  }

  const changeTab = (next: TabKey) => {
    setTab(next);
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#01060d] text-white">
      <Background />
      <div className="relative z-10 min-h-screen">
        <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#020914]/75 backdrop-blur-2xl">
          <div className="mx-auto flex h-[72px] max-w-[1280px] items-center gap-3 px-3 sm:px-5 lg:px-7">
            <button
              type="button"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
              className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.045] text-white/75 transition hover:border-[#e7a927]/45 hover:bg-[#e7a927]/10 hover:text-[#ffd56b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5bd3b]/70"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <Link to="/dashboard" className="min-w-0 flex-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5bd3b]/70">
              <AhoyWordmark subtitle="Owner Console" />
            </Link>
            <Link to="/dashboard" aria-label="Return to server dashboard" className="hidden size-11 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.045] text-white/65 transition hover:border-[#e7a927]/45 hover:text-[#ffd56b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5bd3b]/70 sm:flex">
              <LayoutDashboard className="size-[18px]" />
            </Link>
            <button type="button" aria-label="Open platform notifications" onClick={() => changeTab("notifications")} className="relative flex size-11 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.045] text-white/65 transition hover:border-[#e7a927]/45 hover:text-[#ffd56b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5bd3b]/70">
              <Bell className="size-[18px]" />
              <span className="absolute right-2 top-2 size-2 rounded-full bg-[#ff315f] shadow-[0_0_12px_rgba(255,49,95,.85)]" />
            </button>
            <div className="hidden items-center gap-3 rounded-2xl border border-white/[0.12] bg-white/[0.045] px-3 py-2 sm:flex">
              <span className="flex size-8 items-center justify-center rounded-xl border border-[#e7a927]/30 bg-[#e7a927]/10"><Shield className="size-4 text-[#f5bd3b]" /></span>
              <div className="min-w-0">
                <p className="max-w-[130px] truncate text-xs font-semibold">{context.user?.username ?? "Administrator"}</p>
                <p className="text-[9px] uppercase tracking-[.2em] text-[#f5bd3b]/70">{context.role}</p>
              </div>
            </div>
          </div>
        </header>

        {menuOpen ? <NavigationOverlay tab={tab} onSelect={changeTab} /> : null}

        <main className="mx-auto w-full max-w-[1280px] px-3 pb-28 pt-4 sm:px-5 lg:px-7 lg:pb-10">
          {tab === "overview" ? <Overview context={context} onJump={changeTab} /> : null}
          {tab === "users" ? <PageShell title="User Command" subtitle="Manage platform accounts, access, plans and feature permissions." icon={Users}><UserManager /></PageShell> : null}
          {tab === "servers" ? <PageShell title="Fleet Command" subtitle="Monitor connected Discord servers and AHOY bot presence." icon={Server}><ServersPanel /></PageShell> : null}
          {tab === "notifications" ? <PageShell title="Logs & Notices" subtitle="Review platform events and manage administrator notifications." icon={FileText}><NotificationsPanel /></PageShell> : null}
          {tab === "staff" ? <PageShell title="Staff & Settings" subtitle="Control authorized administrators and owner-level access." icon={Settings}><StaffPanel canEdit={context.role === "owner"} /></PageShell> : null}
        </main>
        <MobileNav tab={tab} onSelect={changeTab} />
      </div>
    </div>
  );
}

function Overview({ context, onJump }: { context: AdminContext; onJump: (tab: TabKey) => void }) {
  const { data, isPending, refetch, isFetching } = useQuery({ queryKey: ["admin", "overview"], queryFn: getAdminOverview, refetchInterval: 15_000 });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (isPending || !data) {
    return <div className="space-y-4" aria-busy="true" aria-label="Loading owner console"><div className="h-48 animate-pulse rounded-[28px] border border-white/[0.08] bg-white/[0.035]" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.03]" />)}</div></div>;
  }

  const online = getBotOnline(data, now);
  const uptime = online && data.botRuntime?.startedAt ? formatUptime(Math.max(0, Math.floor((now - Date.parse(data.botRuntime.startedAt)) / 1000))) : "Offline";
  const stats = [
    { label: "Users", value: data.totalUsers, icon: Users, accent: "blue" },
    { label: "Servers", value: data.totalServers, icon: Server, accent: "cyan" },
    { label: "Active today", value: data.activeToday, icon: UserRound, accent: "pink" },
    { label: "Members reached", value: data.reachedMembers, icon: Activity, accent: "gold" },
    { label: "Banned", value: data.bannedUsers, icon: ShieldBan, accent: "red" },
    { label: "Bot uptime", value: uptime, icon: Gauge, accent: "green" },
  ] as const;

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[30px] border border-white/[0.14] bg-[#061321]/85 p-5 shadow-[0_25px_90px_rgba(0,0,0,.38)] backdrop-blur-2xl sm:p-7">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_10%_30%,rgba(245,189,59,.16),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(0,174,255,.13),transparent_32%),linear-gradient(135deg,rgba(255,255,255,.04),transparent_45%)]" />
        <div aria-hidden className="absolute -right-20 -top-28 size-72 rounded-full border border-[#f5bd3b]/10" />
        <div aria-hidden className="absolute -right-10 -top-16 size-48 rounded-full border border-[#f5bd3b]/10" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex min-w-0 items-start gap-4">
            <div className="relative flex size-16 shrink-0 items-center justify-center rounded-2xl border border-[#e7a927]/35 bg-black/25 shadow-[0_0_45px_rgba(231,169,39,.12)]">
              <img src="/favicon.png" alt="AHOY BOT" className="size-11 rounded-xl object-cover" />
              <span className={`absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-[#061321] ${online ? "bg-[#00e5a0] shadow-[0_0_12px_rgba(0,229,160,.85)]" : "bg-[#ff315f]"}`} />
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#f5bd3b]/25 bg-[#f5bd3b]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.25em] text-[#ffd56b]">Owner Command Center</span>
                <span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.18em] ${online ? "border-[#00e5a0]/25 bg-[#00e5a0]/10 text-[#72f3c4]" : "border-[#ff315f]/25 bg-[#ff315f]/10 text-[#ff7b98]"}`}>{online ? "Bot Online" : "Bot Offline"}</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Good to see you, {context.user?.username ?? "Administrator"}.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">Your premium control surface for the AHOY ecosystem. Monitor the fleet, manage users, review logs and control administrator access from one place.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-[#e7a927]/30 bg-black/25 px-5 py-4 text-center shadow-[0_0_35px_rgba(231,169,39,.08)]">
            <div className="flex items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-[.24em] text-white/50"><span className={`size-2 rounded-full ${online ? "bg-[#00e5a0]" : "bg-[#ff315f]"}`} />Runtime</div>
            <p className="mt-2 font-mono text-xl font-black tracking-wider text-[#ffd56b] sm:text-2xl">{uptime}</p>
            <p className="mt-1 text-[9px] uppercase tracking-[.18em] text-white/30">Live heartbeat monitor</p>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          <QuickAction icon={Users} label="Manage users" onClick={() => onJump("users")} />
          <QuickAction icon={Server} label="Manage servers" onClick={() => onJump("servers")} />
          <QuickAction icon={FileText} label="Open logs" onClick={() => onJump("notifications")} />
          <QuickAction icon={Settings} label="Staff settings" onClick={() => onJump("staff")} />
          <LinkAction href="/owner-console/plan-requests" icon={Crown} label="Premium requests" />
        </div>
      </section>

      <section aria-label="Platform statistics" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{stats.map(({ label, value, icon: Icon, accent }) => <StatCard key={label} label={label} value={value} icon={Icon} accent={accent} />)}</section>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-3xl border border-white/[0.11] bg-white/[0.035] p-4 shadow-[0_20px_70px_rgba(0,0,0,.2)] backdrop-blur-xl sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.28em] text-[#f5bd3b]">Administration</p><h2 className="mt-1 text-lg font-bold">Control modules</h2></div><button type="button" onClick={() => void refetch()} aria-label="Refresh platform overview" className="flex size-10 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.035] text-white/55 transition hover:border-[#e7a927]/40 hover:text-[#ffd56b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5bd3b]/70"><RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} /></button></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ModuleCard icon={Users} title="User control" description="Accounts, plans, bans and access permissions." onClick={() => onJump("users")} />
            <ModuleCard icon={Server} title="Fleet control" description="Connected Discord servers and bot presence." onClick={() => onJump("servers")} />
            <ModuleCard icon={FileText} title="Audit & notices" description="Review administrator logs and platform notices." onClick={() => onJump("notifications")} />
            <ModuleCard icon={Shield} title="Staff control" description="Manage authorized platform administrators." onClick={() => onJump("staff")} />
          </div>
        </section>

        <section className="rounded-3xl border border-[#e7a927]/20 bg-[#061321]/75 p-4 shadow-[0_20px_70px_rgba(0,0,0,.22)] backdrop-blur-xl sm:p-5">
          <div className="mb-4 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl border border-[#e7a927]/25 bg-[#e7a927]/10 text-[#f5bd3b]"><Sparkles className="size-5" /></span><div><p className="text-[9px] font-bold uppercase tracking-[.25em] text-[#f5bd3b]">Owner tools</p><h2 className="text-lg font-bold">Premium operations</h2></div></div>
          <div className="space-y-2.5">
            <LinkActionLarge href="/owner-console/plan-requests" icon={Crown} title="Premium Access Requests" description="Approve or decline member Premium unlock requests." />
            <LinkActionLarge href="/pricing" icon={Zap} title="Plans & Premium" description="Review Premium capabilities and access workflow." />
            <LinkActionLarge href="/dashboard" icon={LayoutDashboard} title="Server Dashboard" description="Return to the AHOY server command center." />
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-white/[0.09] bg-white/[0.025] p-4 backdrop-blur-xl sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className={`flex size-10 items-center justify-center rounded-xl border ${online ? "border-[#00e5a0]/25 bg-[#00e5a0]/10 text-[#72f3c4]" : "border-[#ff315f]/25 bg-[#ff315f]/10 text-[#ff7b98]"}`}><Radio className="size-5" /></span><div><h2 className="font-bold">System health</h2><p className="text-xs text-white/40">Live status is refreshed automatically every 15 seconds.</p></div></div><div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[.12em]"><HealthPill label="Bot" healthy={online} /><HealthPill label="Database" healthy /><HealthPill label="Dashboard" healthy /></div></div>
      </section>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: typeof Users; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group flex items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 py-3 text-xs font-semibold text-white/65 transition hover:-translate-y-0.5 hover:border-[#e7a927]/35 hover:bg-[#e7a927]/10 hover:text-[#ffd56b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5bd3b]/70"><Icon className="size-4" /><span>{label}</span></button>;
}

function LinkAction({ href, icon: Icon, label }: { href: string; icon: typeof Crown; label: string }) {
  return <Link to={href as never} className="group flex items-center justify-center gap-2 rounded-xl border border-[#e7a927]/20 bg-[#e7a927]/[0.055] px-3 py-3 text-xs font-semibold text-[#ffd56b] transition hover:-translate-y-0.5 hover:border-[#e7a927]/45 hover:bg-[#e7a927]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5bd3b]/70"><Icon className="size-4" /><span>{label}</span></Link>;
}

function LinkActionLarge({ href, icon: Icon, title, description }: { href: string; icon: typeof Crown; title: string; description: string }) {
  return <Link to={href as never} className="group flex items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.035] p-3 transition hover:border-[#e7a927]/35 hover:bg-[#e7a927]/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5bd3b]/70"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#e7a927]/20 bg-[#e7a927]/10 text-[#f5bd3b]"><Icon className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block text-xs leading-5 text-white/40">{description}</span></span><ArrowRight className="size-4 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-[#ffd56b]" /></Link>;
}

function ModuleCard({ icon: Icon, title, description, onClick }: { icon: typeof Users; title: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group rounded-2xl border border-white/[0.08] bg-black/15 p-4 text-left transition hover:border-[#e7a927]/30 hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5bd3b]/70"><span className="flex size-9 items-center justify-center rounded-xl bg-white/[0.05] text-white/60 transition group-hover:bg-[#e7a927]/10 group-hover:text-[#f5bd3b]"><Icon className="size-4" /></span><span className="mt-3 block text-sm font-bold">{title}</span><span className="mt-1 block text-xs leading-5 text-white/40">{description}</span></button>;
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number | string; icon: typeof Users; accent: string }) {
  const accentClass = { blue: "text-[#62a8ff] bg-[#62a8ff]/10 border-[#62a8ff]/20", cyan: "text-[#4ed9ff] bg-[#4ed9ff]/10 border-[#4ed9ff]/20", pink: "text-[#ff79aa] bg-[#ff79aa]/10 border-[#ff79aa]/20", gold: "text-[#ffd56b] bg-[#ffd56b]/10 border-[#ffd56b]/20", red: "text-[#ff7895] bg-[#ff7895]/10 border-[#ff7895]/20", green: "text-[#72f3c4] bg-[#72f3c4]/10 border-[#72f3c4]/20" }[accent] ?? "text-white/70 bg-white/5 border-white/10";
  return <article className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4 shadow-[0_15px_45px_rgba(0,0,0,.15)] backdrop-blur-xl"><div className="flex items-center justify-between gap-2"><span className={`flex size-9 items-center justify-center rounded-xl border ${accentClass}`}><Icon className="size-4" /></span><span className="size-1.5 rounded-full bg-white/15" /></div><p className="mt-4 truncate text-[10px] font-semibold uppercase tracking-[.16em] text-white/40">{label}</p><p className="mt-1 truncate text-2xl font-black tracking-tight text-white">{typeof value === "number" ? value.toLocaleString() : value}</p></article>;
}

function HealthPill({ label, healthy }: { label: string; healthy: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${healthy ? "border-[#00e5a0]/20 bg-[#00e5a0]/10 text-[#72f3c4]" : "border-[#ff315f]/20 bg-[#ff315f]/10 text-[#ff7b98]"}`}><span className={`size-1.5 rounded-full ${healthy ? "bg-[#00e5a0]" : "bg-[#ff315f]"}`} />{label}: {healthy ? "OK" : "Offline"}</span>;
}

function PageShell({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: typeof Users; children: ReactNode }) {
  return <section className="space-y-4"><div className="relative overflow-hidden rounded-3xl border border-white/[0.12] bg-white/[0.035] p-5 shadow-[0_20px_70px_rgba(0,0,0,.25)] backdrop-blur-2xl sm:p-6"><div aria-hidden className="absolute right-0 top-0 size-56 rounded-full bg-[#e7a927]/[0.055] blur-[70px]" /><div className="relative flex items-center gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[#e7a927]/25 bg-[#e7a927]/10 text-[#f5bd3b]"><Icon className="size-5" /></span><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.28em] text-[#f5bd3b]">Administrator module</p><h1 className="mt-1 text-xl font-black sm:text-2xl">{title}</h1><p className="mt-1 text-xs leading-5 text-white/40">{subtitle}</p></div></div></div><div className="rounded-3xl border border-white/[0.09] bg-[#061321]/60 p-2 shadow-[0_20px_70px_rgba(0,0,0,.2)] backdrop-blur-xl sm:p-4">{children}</div></section>;
}

function NavigationOverlay({ tab, onSelect }: { tab: TabKey; onSelect: (tab: TabKey) => void }) {
  return <div className="fixed inset-x-0 top-[72px] z-40 border-b border-white/[0.09] bg-[#020914]/95 shadow-2xl backdrop-blur-2xl"><div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-2 px-3 py-3 sm:grid-cols-3 sm:px-5 lg:grid-cols-5 lg:px-7">{TABS.map(({ key, label, icon: Icon }) => <button key={key} type="button" aria-current={tab === key ? "page" : undefined} onClick={() => onSelect(key)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5bd3b]/70 ${tab === key ? "border-[#e7a927]/40 bg-[#e7a927]/10 text-[#ffd56b]" : "border-white/[0.08] bg-white/[0.025] text-white/60 hover:border-white/[0.16] hover:text-white"}`}><Icon className="size-4" /><span className="text-xs font-semibold">{label}</span></button>)}</div></div>;
}

function MobileNav({ tab, onSelect }: { tab: TabKey; onSelect: (tab: TabKey) => void }) {
  return <nav aria-label="Owner console navigation" className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[#020914]/90 p-2 backdrop-blur-2xl lg:hidden"><div className="mx-auto grid max-w-xl grid-cols-5 gap-1">{TABS.map(({ key, short, icon: Icon }) => <button key={key} type="button" aria-label={short} aria-current={tab === key ? "page" : undefined} onClick={() => onSelect(key)} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5bd3b]/70 ${tab === key ? "bg-[#e7a927]/10 text-[#ffd56b]" : "text-white/40 hover:text-white/70"}`}><Icon className="size-4" /><span>{short}</span></button>)}</div></nav>;
}

function Background() {
  return <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(22,69,105,.5),transparent_42%),linear-gradient(180deg,#03101d_0%,#020914_55%,#01060d_100%)]" /><div className="absolute -left-40 top-20 size-[480px] rounded-full bg-[#f2a900]/[0.045] blur-[130px]" /><div className="absolute -right-40 top-1/3 size-[480px] rounded-full bg-[#00a7ff]/[0.04] blur-[140px]" /><div className="absolute bottom-[-180px] left-1/4 size-[520px] rounded-full bg-[#a42cff]/[0.035] blur-[150px]" /><div className="absolute inset-0 opacity-[0.055] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:54px_54px]" /></div>;
}

function getBotOnline(data: AdminOverview, now: number) {
  const runtime = data.botRuntime;
  if (!runtime || runtime.status !== "online" || !runtime.startedAt || runtime.stoppedAt) return false;
  const heartbeat = runtime.heartbeatAt ? Date.parse(runtime.heartbeatAt) : Number.NaN;
  return Number.isFinite(heartbeat) && now - heartbeat <= 45_000;
}

function formatUptime(totalSeconds: number) {
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(days).padStart(2, "0")}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center bg-[#01060d] px-6"><div className="rounded-3xl border border-white/[0.1] bg-white/[0.035] px-8 py-7 text-center shadow-[0_25px_80px_rgba(0,0,0,.35)] backdrop-blur-2xl"><div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-[#e7a927]/30 bg-[#e7a927]/10 text-[#f5bd3b]"><Radio className="size-6 animate-pulse" /></div><p className="mt-4 text-[10px] font-bold uppercase tracking-[.3em] text-white/45">Checking clearance</p><p className="mt-2 text-xs text-white/25">Loading owner command center…</p></div></div>;
}

function Gate({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-[#01060d] px-5 text-white"><Background /><section className="relative z-10 w-full max-w-md rounded-3xl border border-white/[0.12] bg-[#061321]/85 p-7 text-center shadow-[0_25px_90px_rgba(0,0,0,.4)] backdrop-blur-2xl"><div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-[#e7a927]/30 bg-[#e7a927]/10 text-[#f5bd3b]"><Shield className="size-6" /></div><h1 className="mt-5 text-xl font-black">{title}</h1><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/45">{description}</p><div className="mt-6 flex justify-center">{children}</div></section></div>;
}
