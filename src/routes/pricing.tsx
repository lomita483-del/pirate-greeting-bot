import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Crown, Sparkles, Clock3, Send, Server, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AhoyWordmark } from "@/components/ahoy/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PREMIUM_MODULES } from "@/lib/premium-modules";
import { getMyEntitlements } from "@/lib/admin.functions";
import { getPlansAndTasks, listMyPlanUnlockRequests, requestPlanUnlock } from "@/lib/plan-unlock.functions";
import { getStatahoyGuilds } from "@/lib/statahoy.functions";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [{ title: "Plans & Premium modules — !HOY BOT" }, { name: "description", content: "Compare !HOY BOT plans, complete unlock tasks per server, or request a plan from the owner." }] }),
  component: PricingPage,
});

const PLANS = [
  { key: "free", name: "Free crew", price: "$0", tagline: "Everything you need to get the bot sailing.", highlight: false, perks: ["Custom commands and AutoMod", "Event logging and economy", "Live server analytics", "Unlimited servers"] },
  { key: "premium", name: "Premium", price: "Unlock / Request", tagline: "Complete requirements on a selected server or request owner review.", highlight: true, perks: ["Moderation suite and case history", "Levels, XP and role rewards", "Ticket harbour with panels", "Welcome messages and DMs", "!HOY Calendar and reminders"] },
] as const;

function PricingPage() {
  const queryClient = useQueryClient();
  const [guildId, setGuildId] = useState("");
  const entitlement = useQuery({ queryKey: ["entitlements"], queryFn: () => getMyEntitlements() });
  const guilds = useQuery({ queryKey: ["pricing-guilds"], queryFn: () => getStatahoyGuilds() });
  useEffect(() => { if (!guildId && guilds.data?.guilds?.length) setGuildId(guilds.data.guilds[0].id); }, [guildId, guilds.data?.guilds]);
  const plans = useQuery({ queryKey: ["plans-and-tasks", guildId], queryFn: () => getPlansAndTasks({ data: { guildId: guildId || undefined } }) });
  const requests = useQuery({ queryKey: ["my-plan-requests"], queryFn: () => listMyPlanUnlockRequests() });
  const requestMutation = useMutation({
    mutationFn: (planId: string) => requestPlanUnlock({ data: { planId, guildId: guildId || undefined, method: "request" } }),
    onSuccess: () => { toast.success("Premium access request submitted"); void queryClient.invalidateQueries({ queryKey: ["my-plan-requests"] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  const selectedServer = guilds.data?.guilds?.find((guild) => guild.id === guildId);
  const pendingForSelection = (planId: string) => requests.data?.some((request: any) => request.plan_id === planId && request.guild_id === guildId && request.status === "pending") ?? false;

  return <div className="min-h-screen bg-[#020914] text-white"><header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6"><Link to="/"><AhoyWordmark subtitle="Plans" /></Link><div className="flex items-center gap-2">{entitlement.data?.signedIn ? <Badge className="bg-gold/15 text-gold hover:bg-gold/20"><Crown className="mr-1 size-3" /> Your plan: {entitlement.data.owner ? "owner" : entitlement.data.plan}</Badge> : <Button asChild size="sm" variant="secondary"><a href="/api/public/auth/discord/start">Sign in with Discord</a></Button>}<Button asChild size="sm" variant="outline"><Link to="/dashboard">Dashboard</Link></Button></div></header>
    <main className="mx-auto max-w-6xl space-y-8 px-6 pb-20">
      <section className="relative overflow-hidden rounded-[30px] border border-gold/20 bg-gradient-to-br from-gold/10 via-card/60 to-card/20 p-6 shadow-2xl"><div className="relative"><Badge variant="outline" className="border-gold/30 text-gold">Premium Access</Badge><h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Plans built around your server.</h1><p className="mt-3 max-w-2xl text-muted-foreground">Premium task progress is now calculated against the exact server you select, instead of silently using one server from your fleet.</p></div></section>
      <section className="glass rounded-2xl p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><Server className="size-4 text-gold" /><h2 className="font-semibold">Task server</h2></div><p className="mt-1 text-sm text-muted-foreground">Choose which connected server should count toward Premium requirements.</p></div><Select value={guildId} onValueChange={setGuildId} disabled={!guilds.data?.guilds?.length}><SelectTrigger className="w-full md:w-[320px]"><SelectValue placeholder="Select a server" /></SelectTrigger><SelectContent>{(guilds.data?.guilds ?? []).map((guild) => <SelectItem key={guild.id} value={guild.id}>{guild.name}</SelectItem>)}</SelectContent></Select></div>{selectedServer ? <p className="mt-3 text-xs text-muted-foreground">Tracking <span className="font-semibold text-foreground">{selectedServer.name}</span>. Switch servers any time to see that server's own progress.</p> : <p className="mt-3 text-xs text-amber-300">Connect !HOY BOT to a server you manage to use server-based unlock tasks.</p>}</section>
      <section className="grid gap-5 md:grid-cols-2">{PLANS.map((plan) => { const dbPlan = plans.data?.plans?.find((p) => p.key === plan.key); return <Card key={plan.key} className={plan.highlight ? "glass border-gold/50" : "glass border-0"}><CardHeader><CardTitle className="flex items-center justify-between gap-3"><span>{plan.name}</span><span className="font-display text-2xl text-gold">{plan.price}</span></CardTitle><p className="text-sm text-muted-foreground">{plan.tagline}</p></CardHeader><CardContent className="space-y-4"><ul className="space-y-2 text-sm">{plan.perks.map((perk) => <li key={perk} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-gold" /><span>{perk}</span></li>)}</ul>{plan.highlight && dbPlan ? <Button className="w-full gap-2" disabled={requestMutation.isPending || !guildId || pendingForSelection(dbPlan.id)} onClick={() => requestMutation.mutate(dbPlan.id)}><Send className="size-4" />{pendingForSelection(dbPlan.id) ? "Request pending for this server" : "Request owner unlock"}</Button> : null}</CardContent></Card>; })}</section>
      {plans.data?.plans?.filter((p) => p.tasks?.length).map((plan) => <section key={plan.id} className="space-y-4"><div><h2 className="text-2xl font-semibold">{plan.name} unlock tasks</h2><p className="text-sm text-muted-foreground">Requirements are measured only from <span className="font-medium text-foreground">{plans.data.guild?.name ?? "your selected server"}</span>.</p></div><div className="grid gap-4 md:grid-cols-2">{plan.tasks.map((task) => { const pct = task.progress.target ? Math.min(100, Math.round((task.progress.current / task.progress.target) * 100)) : 0; return <Card key={task.id} className="glass border-0"><CardContent className="space-y-3 p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{task.title}</h3><p className="mt-1 text-sm text-muted-foreground">{task.description}</p></div><Badge variant={task.progress.complete ? "default" : "secondary"}>{task.progress.complete ? "Complete" : "In progress"}</Badge></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} /></div><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{task.progress.current.toLocaleString()} / {task.progress.target.toLocaleString()}</span><span>{pct}%</span></div>{task.progress.complete ? <div className="flex items-center gap-2 text-sm text-tide"><Check className="size-4" />Task completed — Premium qualification target reached.</div> : <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-3.5" />Progress is tracked automatically for this server.</div>}</CardContent></Card>; })}</div></section>)}
      {requests.data?.length ? <section className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">My unlock requests</h2><Button size="sm" variant="ghost" onClick={() => void queryClient.invalidateQueries({ queryKey: ["my-plan-requests"] })} aria-label="Refresh unlock requests"><RefreshCw className="size-4" /></Button></div><div className="space-y-2">{requests.data.map((r: any) => <Card key={r.id} className="glass border-0"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><div className="font-medium">{Array.isArray(r.plans) ? r.plans[0]?.name : r.plans?.name ?? "Plan"}</div><div className="text-xs text-muted-foreground">Server: {r.guild_id ?? "Platform-wide"} · Requested {new Date(r.requested_at).toLocaleString()}</div>{r.review_note ? <div className="mt-1 text-xs text-muted-foreground">Review: {r.review_note}</div> : null}</div><Badge variant={r.status === "approved" ? "default" : r.status === "declined" ? "destructive" : "secondary"}>{r.status}</Badge></CardContent></Card>)}</div></section> : null}
      <section className="space-y-4"><h2 className="text-2xl font-semibold">What each Premium module does</h2><div className="grid gap-4 md:grid-cols-2">{PREMIUM_MODULES.map((module) => { const unlocked = entitlement.data?.features?.[module.key] === true; return <Card key={module.key} className="glass border-0"><CardHeader><CardTitle className="flex items-center justify-between gap-3 text-lg">{module.label}<Badge variant={unlocked ? "default" : "secondary"}>{unlocked ? "Unlocked" : "Premium"}</Badge></CardTitle><p className="text-sm text-muted-foreground">{module.summary}</p></CardHeader><CardContent><ul className="space-y-2 text-sm text-muted-foreground">{module.includes.map((item) => <li key={item} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-tide" /><span>{item}</span></li>)}</ul></CardContent></Card>; })}</div></section>
    </main></div>;
}
