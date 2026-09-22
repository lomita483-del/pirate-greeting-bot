import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, AlertTriangle, Bell, CheckCircle2, Crown, Database, Gauge, Home, Inbox, LayoutDashboard, ListChecks, Menu, RefreshCw, Rocket, Server, Settings, Shield, ShieldBan, UserRound, Users, Wrench, X } from "lucide-react";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { AhoyWordmark } from "@/components/ahoy/brand";
import { ErrorFeedbackPanel } from "@/components/admin/error-feedback-panel";
import { AppUpdatesPanel } from "@/components/admin/app-updates-panel";
import { NotificationsPanel } from "@/components/admin/notifications-panel";
import { PlanTaskManager } from "@/components/admin/plan-task-manager";
import { PremiumRequestsPanel } from "@/components/admin/premium-requests-panel";
import { ServersPanel } from "@/components/admin/servers-panel";
import { StaffPanel } from "@/components/admin/staff-panel";
import { SupportReportsPanel } from "@/components/admin/support-reports-panel";
import { UserManager } from "@/components/admin/user-manager";
import { Button } from "@/components/ui/button";
import { getAdminContext, getAdminOverview } from "@/lib/admin.functions";

export const Route = createFileRoute("/owner-console")({
  head: () => ({ meta: [{ title: "Owner Console — !HOY BOT" }, { name: "description", content: "Luxury owner-grade !HOY BOT operations console." }] }),
  component: AdminConsole,
});

const TABS = [
  { key: "overview", label: "Command Center", icon: Home },
  { key: "users", label: "Users", icon: Users },
  { key: "servers", label: "Servers", icon: Server },
  { key: "notifications", label: "Send Notify", icon: Bell },
  { key: "app-updates", label: "App Updates", icon: Rocket },
  { key: "tasks", label: "Premium Tasks", icon: ListChecks },
  { key: "premium", label: "Premium Requests", icon: Crown },
  { key: "errors", label: "Diagnostics", icon: AlertTriangle },
  { key: "reports", label: "User Reports", icon: UserRound },
  { key: "staff", label: "Staff & Settings", icon: Settings },
] as const;

type TabKey = (typeof TABS)[number]["key"];
type Context = Awaited<ReturnType<typeof getAdminContext>>;
type OverviewData = Awaited<ReturnType<typeof getAdminOverview>>;
type OverviewRuntime = OverviewData & { online?: boolean; botRuntime?: { startedAt?: string | null }; pendingPremiumRequests?: number };

function tabFromUrl(): TabKey {
  if (typeof window === "undefined") return "overview";
  const value = new URLSearchParams(window.location.search).get("tab") as TabKey | null;
  return value && TABS.some((item) => item.key === value) ? value : "overview";
}

function AdminConsole() {
  const [tab, setTab] = useState<TabKey>(tabFromUrl);
  const [menu, setMenu] = useState(false);
  const contextQuery = useQuery({ queryKey: ["admin", "context"], queryFn: getAdminContext, staleTime: 30_000 });

  useEffect(() => {
    const onPopState = () => setTab(tabFromUrl());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (contextQuery.isPending) return <Loading />;
  if (!contextQuery.data?.signedIn) return <Gate title="Sign in required" text="Sign in with Discord to access the owner command center." />;
  if (!contextQuery.data.role) return <Gate title="Restricted command center" text="This area is reserved for authorized !HOY BOT administrators." />;

  const context = contextQuery.data;
  const jump = (next: TabKey) => {
    window.history.pushState({ tab: next }, "", `/owner-console?tab=${next}`);
    setTab(next);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return <div className="min-h-screen bg-transparent text-foreground">
    <header className="sticky top-0 z-50 border-b border-white/10 bg-background/70 backdrop-blur-2xl">
      <div className="mx-auto flex min-h-20 max-w-[1440px] items-center gap-3 px-3 sm:px-6 lg:px-8">
        <Button variant="outline" size="icon" className="rounded-2xl border-white/10 bg-white/[.04]" onClick={() => setMenu((value) => !value)} aria-label="Open owner console navigation">{menu ? <X /> : <Menu />}</Button>
        <Link to="/owner-console" className="min-w-0 flex-1"><AhoyWordmark subtitle="Owner Command Center" /></Link>
        <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-300 md:inline-flex">● Live Operations</span>
        <Button variant="outline" size="icon" className="rounded-2xl border-white/10 bg-white/[.04]" onClick={() => jump("notifications")} aria-label="Open notifications"><Bell /></Button>
        <Link to="/dashboard" className="hidden sm:block"><Button variant="outline" size="icon" className="rounded-2xl border-white/10 bg-white/[.04]" aria-label="Open server dashboard"><LayoutDashboard /></Button></Link>
      </div>
    </header>
    {menu ? <NavOverlay tab={tab} onSelect={jump} /> : null}
    <main className="mx-auto max-w-[1440px] space-y-6 px-3 py-5 sm:px-6 lg:px-8">
      {tab === "overview" ? <Overview data={context} jump={jump} /> : null}
      {tab === "users" ? <Shell title="User Command" icon={Users}><UserManager /></Shell> : null}
      {tab === "servers" ? <Shell title="Fleet Command" icon={Server}><ServersPanel /></Shell> : null}
      {tab === "notifications" ? <Shell title="Notification Control" icon={Bell}><NotificationsPanel /></Shell> : null}
      {tab === "app-updates" ? <Shell title="App Updates" icon={Rocket}><AppUpdatesPanel /></Shell> : null}
      {tab === "tasks" ? <Shell title="Premium Task Studio" icon={ListChecks}><PlanTaskManager /></Shell> : null}
      {tab === "premium" ? <Shell title="Premium Access" icon={Crown}><PremiumRequestsPanel /></Shell> : null}
      {tab === "errors" ? <Shell title="Diagnostics & Feedback" icon={AlertTriangle}><ErrorFeedbackPanel /></Shell> : null}
      {tab === "reports" ? <Shell title="User Reports" icon={UserRound}><SupportReportsPanel /></Shell> : null}
      {tab === "staff" ? <Shell title="Staff & Settings" icon={Settings}><StaffPanel canEdit={context.role === "owner"} /></Shell> : null}
    </main>
  </div>;
}

function Overview({ data, jump }: { data: Context; jump: (tab: TabKey) => void }) {
  const query = useQuery({ queryKey: ["admin", "overview"], queryFn: getAdminOverview, refetchInterval: 15_000 });
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  if (query.isPending || !query.data) return <Loading />;

  const overview = query.data as OverviewRuntime;
  const online = Boolean(overview.online);
  const startedAt = overview.botRuntime?.startedAt;
  const uptime = online && startedAt ? formatUptime(Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000))) : "Offline";
  const fleet = overview.totalServers ? Math.round((overview.liveServers / overview.totalServers) * 100) : 0;
  const metrics = [["Users", overview.totalUsers, Users], ["Servers", overview.totalServers, Server], ["Active today", overview.activeToday, Activity], ["Members reached", overview.reachedMembers, Users], ["Open tickets", overview.openTickets, Inbox], ["Tracked XP", overview.trackedProfiles, Gauge]] as const;

  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-card/60 p-6 shadow-[0_30px_100px_rgba(0,0,0,.28)] backdrop-blur-2xl lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_10%,hsl(var(--primary)/.16),transparent_30%),radial-gradient(circle_at_92%_12%,rgba(0,180,255,.12),transparent_28%)]" />
      <div className="relative grid gap-7 xl:grid-cols-[1fr_360px]">
        <div>
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.25em] text-primary">Owner Operations</span><span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${online ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-red-400/20 bg-red-400/10 text-red-300"}`}>{online ? "Online" : "Offline"}</span></div>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Good to see you, {data.user?.displayName ?? data.user?.username ?? "Administrator"}.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">A live command deck for the bot, its servers, support workload, premium operations and member systems. Operational signals stay here; detailed workspaces live behind the controls below.</p>
          <div className="mt-5 flex flex-wrap gap-2"><Action label="Manage users" icon={Users} onClick={() => jump("users")} /><Action label="Manage fleet" icon={Server} onClick={() => jump("servers")} /><Action label="Send notification" icon={Bell} onClick={() => jump("notifications")} /><Action label="Diagnostics" icon={Wrench} onClick={() => jump("errors")} /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1"><Signal icon={Gauge} label="Runtime" value={uptime} detail="Live heartbeat" good={online} /><Signal icon={Server} label="Fleet coverage" value={`${fleet}%`} detail={`${overview.liveServers} / ${overview.totalServers} servers online`} good={fleet >= 80} /><Signal icon={Database} label="Data plane" value="Live" detail="Database snapshot available" good /></div>
      </div>
    </section>

    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{metrics.map(([label, value, Icon]) => <Metric key={label} label={label} value={value} icon={Icon} />)}</section>

    <section className="grid gap-5 lg:grid-cols-12">
      <div className="glass rounded-3xl p-5 lg:col-span-8">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.24em] text-primary">Operations pulse</p><h2 className="mt-1 text-xl font-black">Queues & readiness</h2></div><Button variant="outline" size="icon" className="rounded-xl" onClick={() => void query.refetch()} aria-label="Refresh operations data"><RefreshCw className={query.isFetching ? "animate-spin" : ""} /></Button></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2"><Ops title="Support queue" value={overview.openTickets} detail="Open tickets" action="Review reports" onClick={() => jump("reports")} /><Ops title="Premium" value={overview.pendingPremiumRequests ?? 0} detail="Requests awaiting review" action="Open requests" onClick={() => jump("premium")} /><Ops title="Moderation" value={overview.moderationLast7Days ?? 0} detail="Actions in 7 days" action="Inspect diagnostics" onClick={() => jump("errors")} /><Ops title="Notifications" value={overview.pendingNotifications ?? 0} detail="Pending delivery" action="Open delivery" onClick={() => jump("notifications")} /></div>
      </div>
      <div className="glass rounded-3xl p-5 lg:col-span-4"><p className="text-[10px] font-bold uppercase tracking-[.24em] text-primary">System readiness</p><h2 className="mt-1 text-xl font-black">Platform health</h2><div className="mt-5 space-y-3"><Health label="Discord runtime" good={online} /><Health label="Database snapshot" good /><Health label="Command center" good /><Health label="Fleet coverage" good={fleet >= 80} /><Health label="Support queue" good={(overview.openTickets ?? 0) < 10} warning={(overview.openTickets ?? 0) >= 10} /></div></div>
    </section>

    <section className="glass rounded-3xl p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.24em] text-primary">Owner actions</p><h2 className="text-xl font-black">Control deck</h2></div><span className="text-xs text-muted-foreground">Live data refreshes automatically</span></div><div className="mt-4 grid gap-3 md:grid-cols-3">{TABS.slice(1).map((item) => <button key={item.key} onClick={() => jump(item.key)} className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[.05]"><span className="flex size-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary"><item.icon className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="block text-[11px] text-muted-foreground">Open workspace</span></span><span className="text-muted-foreground transition group-hover:text-primary">→</span></button>)}</div></section>
  </div>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: ComponentType<any> }) { return <div className="glass rounded-2xl p-4"><Icon className="size-4 text-primary" /><p className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black">{Number(value ?? 0).toLocaleString()}</p></div>; }
function Signal({ icon: Icon, label, value, detail, good }: { icon: ComponentType<any>; label: string; value: string; detail: string; good: boolean }) { return <div className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="flex items-center gap-2"><Icon className="size-4 text-primary" /><span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span><span className={`ml-auto size-2 rounded-full ${good ? "bg-emerald-400" : "bg-red-400"}`} /></div><p className="mt-2 text-xl font-black">{value}</p><p className="text-[10px] text-muted-foreground">{detail}</p></div>; }
function Ops({ title, value, detail, action, onClick }: { title: string; value: number; detail: string; action: string; onClick: () => void }) { return <button onClick={onClick} className="rounded-2xl border border-white/10 bg-black/10 p-4 text-left transition hover:border-primary/30 hover:bg-primary/[.04]"><p className="text-xs font-semibold">{title}</p><p className="mt-2 text-2xl font-black">{Number(value ?? 0).toLocaleString()}</p><p className="text-[10px] text-muted-foreground">{detail}</p><p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-primary">{action} →</p></button>; }
function Health({ label, good, warning = false }: { label: string; good: boolean; warning?: boolean }) { return <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3"><span className={`flex size-8 items-center justify-center rounded-xl ${good ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}>{good ? <CheckCircle2 className="size-4" /> : <ShieldBan className="size-4" />}</span><span className="text-sm font-medium">{label}</span><span className={`ml-auto text-[9px] font-bold uppercase tracking-widest ${warning ? "text-amber-300" : good ? "text-emerald-300" : "text-red-300"}`}>{warning ? "Attention" : good ? "Healthy" : "Offline"}</span></div>; }
function Action({ label, icon: Icon, onClick }: { label: string; icon: ComponentType<any>; onClick: () => void }) { return <Button variant="outline" className="rounded-xl border-white/10 bg-white/[.03]" onClick={onClick}><Icon className="mr-2 size-4 text-primary" />{label}</Button>; }
function Shell({ title, icon: Icon, children }: { title: string; icon: ComponentType<any>; children: ReactNode }) { return <section className="space-y-5"><div className="glass flex items-center gap-4 rounded-3xl p-5"><span className="flex size-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Icon /></span><div><h1 className="text-2xl font-black">{title}</h1><p className="text-sm text-muted-foreground">Owner-grade controls for the !HOY BOT platform.</p></div></div>{children}</section>; }
function NavOverlay({ tab, onSelect }: { tab: TabKey; onSelect: (tab: TabKey) => void }) { return <div className="fixed inset-0 z-40 bg-background/80 p-4 pt-24 backdrop-blur-xl"><div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-card/95 p-3 shadow-2xl">{TABS.map((item) => <button key={item.key} onClick={() => onSelect(item.key)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ${tab === item.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/[.04]"}`}><item.icon className="size-4" />{item.label}</button>)}</div></div>; }
function Gate({ title, text }: { title: string; text: string }) { return <div className="grid min-h-[70vh] place-items-center"><div className="glass w-full max-w-lg rounded-3xl p-8 text-center"><Shield className="mx-auto size-10 text-primary" /><h1 className="mt-4 text-2xl font-black">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{text}</p><Button asChild className="mt-6 rounded-xl"><a href="/api/auth/discord/start">Sign in with Discord</a></Button></div></div>; }
function Loading() { return <div className="grid min-h-[70vh] place-items-center"><div className="glass rounded-3xl px-8 py-6 text-sm">Loading owner command center…</div></div>; }
function formatUptime(seconds: number) { const days = Math.floor(seconds / 86400); const hours = Math.floor((seconds % 86400) / 3600); const minutes = Math.floor((seconds % 3600) / 60); const secs = seconds % 60; if (days) return `${days}d ${hours}h ${minutes}m`; if (hours) return `${hours}h ${minutes}m ${secs}s`; return `${minutes}m ${secs}s`; }
