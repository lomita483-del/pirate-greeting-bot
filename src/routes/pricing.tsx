import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Crown, Sparkles, Clock3, Send } from "lucide-react";

import { AhoyWordmark } from "@/components/ahoy/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PREMIUM_MODULES } from "@/lib/premium-modules";
import { getMyEntitlements } from "@/lib/admin.functions";
import { getPlansAndTasks, listMyPlanUnlockRequests, requestPlanUnlock } from "@/lib/plan-unlock.functions";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Plans & premium modules — !HOY BOT" },
      { name: "description", content: "Compare !HOY BOT plans, complete unlock tasks, or request a plan from the owner." },
    ],
  }),
  component: PricingPage,
});

const PLANS = [
  { key: "free", name: "Free crew", price: "$0", tagline: "Everything you need to get the bot sailing.", highlight: false, perks: ["Custom commands and AutoMod", "Event logging and economy", "Live server analytics", "Unlimited servers"] },
  { key: "premium", name: "Premium", price: "Unlock / Request", tagline: "Unlock premium modules by completing tasks or request an owner review.", highlight: true, perks: ["Moderation suite and case history", "Levels, XP and role rewards", "Ticket harbour with panels", "Welcome messages and DMs", "AHOY Calendar and reminders"] },
] as const;

function PricingPage() {
  const queryClient = useQueryClient();
  const entitlement = useQuery({ queryKey: ["entitlements"], queryFn: () => getMyEntitlements() });
  const plans = useQuery({ queryKey: ["plans-and-tasks"], queryFn: () => getPlansAndTasks() });
  const requests = useQuery({ queryKey: ["my-plan-requests"], queryFn: () => listMyPlanUnlockRequests() });
  const requestMutation = useMutation({
    mutationFn: (planId: string) => requestPlanUnlock({ data: { planId, method: "request" } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-plan-requests"] }),
  });

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6">
        <Link to="/"><AhoyWordmark subtitle="Plans" /></Link>
        <div className="flex items-center gap-2">
          {entitlement.data?.signedIn ? <Badge className="bg-gold/15 text-gold hover:bg-gold/20"><Crown className="mr-1 size-3" /> Your plan: {entitlement.data.owner ? "owner" : entitlement.data.plan}</Badge> : <Button asChild size="sm" variant="secondary"><a href="/api/public/auth/discord/start">Sign in with Discord</a></Button>}
          <Button asChild size="sm" variant="outline"><Link to="/dashboard">Dashboard</Link></Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-6 pb-20">
        <section className="text-center">
          <h1 className="text-4xl font-semibold md:text-5xl">Plans &amp; premium modules</h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">Choose a plan, complete its unlock tasks, or send the owner a request. Payment activation will be added when the payment system is ready.</p>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          {PLANS.map((plan) => {
            const dbPlan = plans.data?.find((p) => p.key === plan.key);
            return <Card key={plan.key} className={plan.highlight ? "glass border-gold/50" : "glass border-0"}>
              <CardHeader><CardTitle className="flex items-center justify-between gap-3"><span>{plan.name}</span><span className="font-display text-2xl text-gold">{plan.price}</span></CardTitle><p className="text-sm text-muted-foreground">{plan.tagline}</p></CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">{plan.perks.map((perk) => <li key={perk} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-gold" /><span>{perk}</span></li>)}</ul>
                {plan.highlight && dbPlan ? <Button className="w-full gap-2" disabled={requestMutation.isPending || requests.data?.some((r: any) => r.plan_id === dbPlan.id && r.status === "pending")} onClick={() => requestMutation.mutate(dbPlan.id)}><Send className="size-4" />{requests.data?.some((r: any) => r.plan_id === dbPlan.id && r.status === "pending") ? "Request pending" : "Request owner unlock"}</Button> : null}
              </CardContent>
            </Card>;
          })}
        </section>

        {plans.data?.filter((p) => p.tasks?.length).map((plan) => <section key={plan.id} className="space-y-4">
          <div><h2 className="text-2xl font-semibold">{plan.name} unlock tasks</h2><p className="text-sm text-muted-foreground">Complete the tasks below to qualify for this plan. You can still request an owner unlock instead.</p></div>
          <div className="grid gap-4 md:grid-cols-2">{plan.tasks.map((task) => { const pct = task.progress.target ? Math.min(100, Math.round((task.progress.current / task.progress.target) * 100)) : 0; return <Card key={task.id} className="glass border-0"><CardContent className="space-y-3 p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{task.title}</h3><p className="mt-1 text-sm text-muted-foreground">{task.description}</p></div><Badge variant={task.progress.complete ? "default" : "secondary"}>{task.progress.complete ? "Complete" : "In progress"}</Badge></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} /></div><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{task.progress.current.toLocaleString()} / {task.progress.target.toLocaleString()}</span><span>{pct}%</span></div>{task.progress.complete ? <div className="flex items-center gap-2 text-sm text-tide"><Check className="size-4" />Task completed — owner approval can unlock the plan.</div> : <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-3.5" />Progress is tracked automatically.</div>}</CardContent></Card>; })}</div>
        </section>)}

        {requests.data?.length ? <section className="space-y-4"><h2 className="text-2xl font-semibold">My unlock requests</h2><div className="space-y-2">{requests.data.map((r: any) => <Card key={r.id} className="glass border-0"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><div className="font-medium">{Array.isArray(r.plans) ? r.plans[0]?.name : r.plans?.name ?? "Plan"}</div><div className="text-xs text-muted-foreground">Requested {new Date(r.requested_at).toLocaleString()}</div></div><Badge variant={r.status === "approved" ? "default" : r.status === "declined" ? "destructive" : "secondary"}>{r.status}</Badge></CardContent></Card>)}</div></section> : null}

        <section className="space-y-4"><h2 className="text-2xl font-semibold">What each premium module does</h2><div className="grid gap-4 md:grid-cols-2">{PREMIUM_MODULES.map((module) => { const unlocked = entitlement.data?.features?.[module.key] === true; return <Card key={module.key} className="glass border-0"><CardHeader><CardTitle className="flex items-center justify-between gap-3 text-lg">{module.label}<Badge variant={unlocked ? "default" : "secondary"}>{unlocked ? "Unlocked" : "Premium"}</Badge></CardTitle><p className="text-sm text-muted-foreground">{module.summary}</p></CardHeader><CardContent><ul className="space-y-2 text-sm text-muted-foreground">{module.includes.map((item) => <li key={item} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-tide" /><span>{item}</span></li>)}</ul></CardContent></Card>; })}</div></section>
      </main>
    </div>
  );
}
