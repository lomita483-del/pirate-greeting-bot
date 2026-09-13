import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, AlertTriangle, ArrowRight, Bell, ChevronLeft, Crown, Gauge, Home, LayoutDashboard, ListChecks, Menu, Radio, RefreshCw, Server, Settings, Shield, ShieldBan, UserRound, Users, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AhoyWordmark } from "@/components/ahoy/brand";
import { ErrorFeedbackPanel } from "@/components/admin/error-feedback-panel";
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
  head: () => ({ meta: [{ title: "Owner Console — !HOY BOT" }, { name: "description", content: "Premium !HOY BOT platform command center." }] }),
  component: AdminConsole,
});

const TABS = [
  { key: "overview", label: "Command Center", short: "Home", icon: Home },
  { key: "users", label: "Users", short: "Users", icon: Users },
  { key: "servers", label: "Servers", short: "Servers", icon: Server },
  { key: "notifications", label: "Send Notify", short: "Notify", icon: Bell },
  { key: "tasks", label: "Premium Tasks", short: "Tasks", icon: ListChecks },
  { key: "premium", label: "Premium Requests", short: "Premium", icon: Crown },
  { key: "errors", label: "Error & Feedback", short: "Errors", icon: AlertTriangle },
  { key: "reports", label: "Users Reports", short: "Reports", icon: UserRound },
  { key: "staff", label: "Staff & Settings", short: "Staff", icon: Settings },
] as const;

type TabKey = (typeof TABS)[number]["key"];
type AdminContext = Awaited<ReturnType<typeof getAdminContext>>;
type AdminOverview = Awaited<ReturnType<typeof getAdminOverview>>;

function tabFromUrl(): TabKey {
  if (typeof window === "undefined") return "overview";
  const value = new URLSearchParams(window.location.search).get("tab") as TabKey | null;
  return value && TABS.some((item) => item.key === value) ? value : "overview";
}

function AdminConsole() {
  const [tab, setTab] = useState<TabKey>(() => tabFromUrl());
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: context, isPending } = useQuery({ queryKey: ["admin", "context"], queryFn: getAdminContext, staleTime: 30_000 });

  useEffect(() => {
    const onPopState = () => setTab(tabFromUrl());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (isPending) return <LoadingScreen />;
  if (!context?.signedIn) return <Gate title="Sign in required" description="Sign in with Discord to access the owner command center."><Button asChild><a href="/api/public/auth/discord/start">Sign in with Discord</a></Button></Gate>;
  if (!context.role) return <Gate title="Restricted command center" description="This area is reserved for authorized !HOY BOT platform administrators."><Button asChild variant="outline"><Link to="/dashboard"><ChevronLeft className="mr-2 size-4" />Back to dashboard</Link></Button></Gate>;

  const changeTab = (next: TabKey) => {
    if (next !== tab) window.history.pushState({ ownerTab: next }, "", `/owner-console?tab=${next}`);
    setTab(next);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return <div className="min-h-screen overflow-x-hidden bg-[#01060d] text-white"><Background /><div className="relative z-10 min-h-screen">
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#020914]/80 backdrop-blur-2xl"><div className="mx-auto flex min-h-[72px] max-w-[1320px] items-center gap-2 px-3 sm:gap-3 sm:px-5 lg:px-7">
      <button type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.045] text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}</button>
      <Link to="/owner-console" className="min-w-0 flex-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><AhoyWordmark subtitle="Owner Console" /></Link>
      <a href="/" aria-label="Back to home" className="hidden size-11 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.045] text-white/65 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex"><Home className="size-[18px]" /></a>
      <Link to="/dashboard" aria-label="Back to dashboard" className="hidden size-11 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.045] text-white/65 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex"><LayoutDashboard className="size-[18px]" /></Link>
      <button type="button" aria-label="Open Send Notify" onClick={() => changeTab("notifications")} className="flex size-11 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.045] text-white/65 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Bell className="size-[18px]" /></button>
      <div className="hidden items-center gap-3 rounded-2xl border border-white/[0.12] bg-white/[0.045] px-3 py-2 sm:flex"><span className="flex size-8 items-center justify-center rounded-xl border border-primary/30 bg-primary/10"><Shield className="size-4 text-primary" /></span><div className="min-w-0"><p className="max-w-[150px] truncate text-xs font-semibold">{context.user?.displayName ?? context.user?.username ?? "Administrator"}</p><p className="text-[9px] uppercase tracking-[.2em] text-primary/70">{context.role}</p></div></div>
    </div></header>
    {menuOpen ? <NavigationOverlay tab={tab} onSelect={changeTab} /> : null}
    <main className="mx-auto w-full max-w-[1320px] px-3 pb-28 pt-4 sm:px-5 lg:px-7 lg:pb-10">
      {tab === "overview" ? <Overview context={context} onJump={changeTab} /> : null}
      {tab === "users" ? <PageShell title="User Command" subtitle="Manage platform accounts, plans, bans and access permissions." icon={Users}><UserManager /></PageShell> : null}
      {tab === "servers" ? <PageShell title="Fleet Command" subtitle="Monitor connected Discord servers and !HOY BOT presence." icon={Server}><ServersPanel /></PageShell> : null}
      {tab === "notifications" ? <PageShell title="Send Notify" subtitle="Compose, target and deliver platform notifications." icon={Bell}><NotificationsPanel /></PageShell> : null}
      {tab === "tasks" ? <PageShell title="Premium Task Studio" subtitle="Create and modify the tasks that drive Premium unlock qualification." icon={ListChecks}><PlanTaskManager /></PageShell> : null}
      {tab === "premium" ? <PageShell title="Premium Access Requests" subtitle="Review, approve or decline member Premium requests directly inside the Owner Console." icon={Crown}><PremiumRequestsPanel /></PageShell> : null}
      {tab === "errors" ? <PageShell title="Error & Feedback Center" subtitle="ALL ERROR LOGS, diagnostics, user feedback and issue triage." icon={AlertTriangle}><ErrorFeedbackPanel /></PageShell> : null}
      {tab === "reports" ? <PageShell title="Users Reports" subtitle="Review user concerns, complaints and feedback and reply to them from the Owner Console." icon={UserRound}><SupportReportsPanel /></PageShell> : null}
      {tab === "staff" ? <PageShell title="Staff & Settings" subtitle="Control authorized administrators and owner-level access." icon={Settings}><StaffPanel canEdit={context.role === "owner"} /></PageShell> : null}
    </main>
    <MobileNav tab={tab} onSelect={changeTab} />
  </div></div>;
}

function Overview({ context, onJump }: { context: AdminContext; onJump: (tab: TabKey) => void }) {
  const { data, isPending, refetch, isFetching } = useQuery({ queryKey: ["admin", "overview"], queryFn: getAdminOverview, refetchInterval: 15_000 });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  if (isPending || !data) return <LoadingScreen />;
  const online = getBotOnline(data, now);
  const uptime = online && data.botRuntime?.startedAt ? formatUptime(Math.max(0, Math.floor((now - Date.parse(data.botRuntime.startedAt)) / 1000))) : "Offline";
  return <div className="space-y-4">
    <section className="relative overflow-hidden rounded-[30px] border border-white/[0.14] bg-[#061321]/85 p-5 shadow-[0_25px_90px_rgba(0,0,0,.38)] backdrop-blur-2xl sm:p-7"><div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_10%_30%,rgba(245,189,59,.16),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(0,174,255,.13),transparent_32%)]" /><div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center"><div className="flex min-w-0 items-start gap-4"><div className="relative flex size-16 shrink-0 items-center justify-center rounded-2xl border border-primary/35 bg-black/25"><img src="/favicon.png" alt="!HOY BOT" className="size-11 rounded-xl object-cover" /><span className={`absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-[#061321] ${online ? "bg-emerald-400" : "bg-red-400"}`} /></div><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.25em] text-primary">Owner Command Center</span><span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.18em] ${online ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-red-400/25 bg-red-400/10 text-red-300"}`}>{online ? "Bot Online" : "Bot Offline"}</span></div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Good to see you, {context.user?.displayName ?? context.user?.username ?? "Administrator"}.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">Your premium control surface for the !HOY BOT ecosystem. Every major owner, support, diagnostics and Premium workflow is available below.</p></div></div><div className="rounded-2xl border border-primary/30 bg-black/25 px-5 py-4 text-center"><div className="flex items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-[.24em] text-white/50"><span className={`size-2 rounded-full ${online ? "bg-emerald-400" : "bg-red-400"}`} />Runtime</div><p className="mt-2 font-mono text-xl font-black tracking-wider text-primary sm:text-2xl">{uptime}</p><p className="mt-1 text-[9px] uppercase tracking-[.18em] text-white/30">Live heartbeat monitor</p></div></div>
    <div className="relative mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-9"><QuickAction icon={Users} label="Users" onClick={() => onJump("users")} /><QuickAction icon={Server} label="Servers" onClick={() => onJump("servers")} /><QuickAction icon={Bell} label="Send Notify" onClick={() => onJump("notifications")} /><QuickAction icon={ListChecks} label="Premium Tasks" onClick={() => onJump("tasks")} /><QuickAction icon={Crown} label="Premium Requests" onClick={() => onJump("premium")} /><QuickAction icon={AlertTriangle} label="ERROR & FEEDBACK" onClick={() => onJump("errors")} /><QuickAction icon={UserRound} label="Users Reports" onClick={() => onJump("reports")} /><QuickAction icon={Settings} label="Staff" onClick={() => onJump("staff")} /></div></section>
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{[["Users",data.totalUsers,Users],["Servers",data.totalServers,Server],["Active today",data.activeToday,Activity],["Members reached",data.reachedMembers,Activity],["Banned",data.bannedUsers,ShieldBan],["Bot uptime",uptime,Gauge]].map(([label,value,Icon]) => <article key={String(label)} className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4 shadow-[0_15px_45px_rgba(0,0,0,.15)] backdrop-blur-xl"><span className="flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Icon className="size-4" /></span><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-white/40">{String(label)}</p><p className="mt-1 truncate text-2xl font-black">{typeof value === "number" ? value.toLocaleString() : value}</p></article>)}</section>
    <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-3xl border border-white/[0.1] bg-white/[0.035] p-5 shadow-xl backdrop-blur-xl"><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.25em] text-primary">System diagnostics</p><h2 className="mt-1 text-lg font-bold">Error & Feedback</h2></div><button type="button" onClick={() => void refetch()} aria-label="Refresh platform overview" className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} /></button></div><p className="mt-3 text-sm leading-6 text-white/45">Open the central error console to inspect exact source, command, server, channel, likely cause, traceback and resolution state.</p><Button className="mt-5 gap-2" onClick={() => onJump("errors")}><AlertTriangle className="size-4" />ALL ERROR LOGS <ArrowRight className="size-4" /></Button></section><section className="rounded-3xl border border-primary/15 bg-primary/[0.04] p-5 shadow-xl backdrop-blur-xl"><p className="text-[9px] font-bold uppercase tracking-[.25em] text-primary">User support</p><h2 className="mt-1 text-lg font-bold">Users Reports</h2><p className="mt-3 text-sm leading-6 text-white/45">Read concerns and complaints sent from the user dashboard and reply directly. The panel refreshes automatically for near-real-time support handling.</p><Button variant="outline" className="mt-5 gap-2" onClick={() => onJump("reports")}><UserRound className="size-4" />Open Users Reports <ArrowRight className="size-4" /></Button></section></div>
    <section className="rounded-3xl border border-white/[0.09] bg-white/[0.025] p-5 backdrop-blur-xl"><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-semibold text-emerald-300"><span className="size-1.5 rounded-full bg-emerald-400" />Bot {online ? "online" : "offline"}</span><span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-white/50">Database connected</span><span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-white/50">Dashboard operational</span></div></section>
  </div>;
}

function QuickAction({ icon: Icon, label, onClick }: { icon: typeof Users; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="group flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-2 py-3 text-[10px] font-semibold text-white/65 transition hover:border-primary/35 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Icon className="size-4" /><span>{label}</span></button>; }
function PageShell({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: typeof Users; children: ReactNode }) { return <section className="space-y-4"><div className="relative overflow-hidden rounded-3xl border border-white/[0.12] bg-white/[0.035] p-5 shadow-[0_20px_70px_rgba(0,0,0,.25)] backdrop-blur-2xl sm:p-6"><div className="absolute right-0 top-0 size-56 rounded-full bg-primary/[0.055] blur-[70px]" aria-hidden /><div className="relative flex items-center gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary"><Icon className="size-5" /></span><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.28em] text-primary">Administrator module</p><h1 className="mt-1 text-xl font-black sm:text-2xl">{title}</h1><p className="mt-1 text-xs leading-5 text-white/40">{subtitle}</p></div></div></div><div className="rounded-3xl border border-white/[0.09] bg-[#061321]/60 p-2 shadow-[0_20px_70px_rgba(0,0,0,.2)] backdrop-blur-xl sm:p-4">{children}</div></section>; }
function NavigationOverlay({ tab, onSelect }: { tab: TabKey; onSelect: (tab: TabKey) => void }) { return <div className="fixed inset-x-0 top-[72px] z-40 max-h-[calc(100vh-72px)] overflow-auto border-b border-white/[0.09] bg-[#020914]/95 shadow-2xl backdrop-blur-2xl"><div className="mx-auto grid max-w-[1320px] grid-cols-2 gap-2 px-3 py-3 sm:grid-cols-3 lg:grid-cols-4 lg:px-7">{TABS.map(({ key, label, icon: Icon }) => <button key={key} type="button" aria-current={tab === key ? "page" : undefined} onClick={() => onSelect(key)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tab === key ? "border-primary/40 bg-primary/10 text-primary" : "border-white/[0.08] bg-white/[0.025] text-white/60 hover:border-white/[0.16] hover:text-white"}`}><Icon className="size-4" /><span className="text-xs font-semibold">{label}</span></button>)}</div></div>; }
function MobileNav({ tab, onSelect }: { tab: TabKey; onSelect: (tab: TabKey) => void }) { return <nav aria-label="Owner console navigation" className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[#020914]/92 p-2 backdrop-blur-2xl lg:hidden"><div className="mx-auto grid max-w-xl grid-cols-4 gap-1 sm:grid-cols-8">{TABS.map(({ key, short, icon: Icon }) => <button key={key} type="button" aria-label={short} aria-current={tab === key ? "page" : undefined} onClick={() => onSelect(key)} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tab === key ? "bg-primary/10 text-primary" : "text-white/40 hover:text-white/70"}`}><Icon className="size-4" /><span>{short}</span></button>)}</div></nav>; }
function Background() { return <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(22,69,105,.5),transparent_42%),linear-gradient(180deg,#03101d_0%,#020914_55%,#01060d_100%)]" /><div className="absolute -left-40 top-20 size-[480px] rounded-full bg-primary/[0.045] blur-[130px]" /><div className="absolute -right-40 top-1/3 size-[480px] rounded-full bg-cyan-400/[0.04] blur-[140px]" /></div>; }
function getBotOnline(data: AdminOverview, now: number) { const runtime = data.botRuntime; if (!runtime || !runtime.startedAt || runtime.stoppedAt) return false; const heartbeat = runtime.heartbeatAt ? Date.parse(runtime.heartbeatAt) : Number.NaN; return Number.isFinite(heartbeat) && now - heartbeat <= 60_000; }
function formatUptime(totalSeconds: number) { const days = Math.floor(totalSeconds / 86400); const hours = Math.floor((totalSeconds % 86400) / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60; return `${String(days).padStart(2, "0")}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`; }
function LoadingScreen() { return <div className="flex min-h-screen items-center justify-center bg-[#01060d] px-6"><div className="rounded-3xl border border-white/[0.1] bg-white/[0.035] px-8 py-7 text-center shadow-[0_25px_80px_rgba(0,0,0,.35)] backdrop-blur-2xl"><div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary"><Radio className="size-6 animate-pulse" /></div><p className="mt-4 text-[10px] font-bold uppercase tracking-[.3em] text-white/45">Checking clearance</p><p className="mt-2 text-xs text-white/25">Loading owner command center…</p></div></div>; }
function Gate({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <div className="flex min-h-screen items-center justify-center bg-[#01060d] px-5 text-white"><Background /><section className="relative z-10 w-full max-w-md rounded-3xl border border-white/[0.12] bg-[#061321]/85 p-7 text-center shadow-[0_25px_90px_rgba(0,0,0,.4)] backdrop-blur-2xl"><div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary"><Shield className="size-6" /></div><h1 className="mt-5 text-xl font-black">{title}</h1><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/45">{description}</p><div className="mt-6 flex justify-center">{children}</div></section></div>; }
