import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Activity, BarChart3, MessageSquare, Mic, Users, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { MemberProfilePanel, RanksPanel, ServerStatsPanel } from "@/components/dashboard/stats-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStatahoyGuilds, getStatahoyOverview } from "@/lib/statahoy.functions";

export const Route = createFileRoute("/statahoy/$guildId")({ component: StatahoyDashboard });

function humanizeSeconds(total: number) { const h = Math.floor(total / 3600); const m = Math.floor((total % 3600) / 60); if (h) return `${h}h ${m}m`; if (total < 60) return `${Math.max(0, Math.floor(total))}s`; return `${m}m`; }

function StatCard({ icon: Icon, label, value, detail }: { icon: typeof MessageSquare; label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-white/[0.1] bg-white/[0.035] p-5 shadow-[0_15px_50px_rgba(0,0,0,.18)] backdrop-blur-xl"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.15em] text-white/40"><Icon className="size-3.5 text-primary" />{label}</div><p className="mt-3 text-2xl font-black">{value}</p><p className="mt-1 text-xs text-white/35">{detail}</p></div>; }

function StatahoyDashboard() {
  const { guildId } = Route.useParams();
  const location = useLocation();
  if (location.pathname.endsWith("/activity")) return <Outlet />;
  return <StatahoyDashboardHome guildId={guildId} />;
}

function StatahoyDashboardHome({ guildId }: { guildId: string }) {
  const [days, setDays] = useState(14);
  const navigate = useNavigate();
  const { data: guilds } = useQuery({ queryKey: ["statahoy-guilds"], queryFn: () => getStatahoyGuilds() });
  const { data, isLoading, error } = useQuery({ queryKey: ["statahoy-overview", guildId, days], queryFn: () => getStatahoyOverview({ data: { guildId, days } }) });

  const switchServer = (nextGuildId: string) => void navigate({ to: "/statahoy/$guildId", params: { guildId: nextGuildId } });
  const openUserActivity = () => void navigate({ to: "/statahoy/$guildId/activity", params: { guildId } });

  return <div className="min-h-screen bg-[#020914] text-white"><header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#020914]/80 backdrop-blur-2xl"><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6"><Link to="/dashboard" className="flex items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><BarChart3 className="size-4 text-primary" /><span className="text-sm font-bold uppercase tracking-[.2em]">Statahoy</span></Link><span className="hidden text-white/20 sm:inline">/</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{data?.guild.name ?? "Analytics"}</p><p className="text-[10px] uppercase tracking-[.16em] text-white/30">!HOY BOT intelligence</p></div><div className="flex w-full flex-wrap gap-2 sm:w-auto"><Select value={guildId} onValueChange={switchServer}><SelectTrigger aria-label="Select Statahoy server" className="w-full border-white/10 bg-white/[0.04] sm:w-[220px]"><SelectValue placeholder="Select server" /></SelectTrigger><SelectContent>{(guilds?.guilds ?? []).map((guild) => <SelectItem key={guild.id} value={guild.id}>{guild.name}</SelectItem>)}</SelectContent></Select><Button type="button" size="sm" className="gap-2" onClick={openUserActivity}><Activity className="size-4" />User Activity</Button><Select value={String(days)} onValueChange={(v) => setDays(Number(v))}><SelectTrigger aria-label="Analytics time range" className="w-[135px] border-white/10 bg-white/[0.04]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="14">Last 14 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem></SelectContent></Select></div></div></header>
    <main className="mx-auto max-w-7xl space-y-6 px-4 pb-24 pt-5 sm:px-6">
      {error ? <div role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-200">{(error as Error).message || "Could not load analytics."}</div> : null}
      {isLoading ? <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-sm text-white/45">Loading live analytics…</div> : null}
      {data ? <>
        <section className="relative overflow-hidden rounded-[30px] border border-primary/20 bg-gradient-to-br from-primary/10 via-white/[0.025] to-transparent p-6 shadow-2xl backdrop-blur-2xl sm:p-8"><div aria-hidden className="absolute -right-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" /><div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><Badge variant="outline" className="border-primary/30 text-primary"><Zap className="mr-1 size-3" />Live analytics command center</Badge><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{data.guild.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Messages, voice, server growth, ranked members, profile lookup and detailed activity — all in one Statahoy workspace.</p></div><Button type="button" className="gap-2" onClick={openUserActivity}><Activity className="size-4" />Open member activity</Button></div></section>
        <div className="grid gap-3 sm:grid-cols-3"><StatCard icon={MessageSquare} label="Messages" value={data.totalMessages.toLocaleString()} detail={`Last ${days} days`} /><StatCard icon={Mic} label="Voice time" value={humanizeSeconds(data.totalVoiceSeconds)} detail="Tracked voice activity" /><StatCard icon={Users} label="Members now" value={data.memberCount !== null ? data.memberCount.toLocaleString() : "—"} detail="Current server population" /></div>
        <section className="rounded-3xl border border-white/[0.1] bg-white/[0.03] p-5 shadow-xl backdrop-blur-xl sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.25em] text-primary">Engagement</p><h2 className="mt-1 text-lg font-bold">Message activity</h2></div><Badge variant="secondary">{days} days</Badge></div><div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.messageSeries}><defs><linearGradient id="msgFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="day" tick={{ fontSize: 11 }} minTickGap={20} /><YAxis tick={{ fontSize: 11 }} width={36} allowDecimals={false} /><Tooltip /><Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#msgFill)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></section>
        <section className="grid gap-5"><ServerStatsPanel guildId={guildId} /><RanksPanel guildId={guildId} /><MemberProfilePanel guildId={guildId} /></section>
      </> : null}
    </main></div>;
}
