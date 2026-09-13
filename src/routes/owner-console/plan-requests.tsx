import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Crown, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listPlanUnlockRequests, reviewPlanUnlockRequest } from "@/lib/plan-unlock.functions";

export const Route = createFileRoute("/owner-console/plan-requests")({ component: PlanRequestsPage });

function PlanRequestsPage() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: ["owner-plan-requests"], queryFn: () => listPlanUnlockRequests() });
  const mutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "declined" }) => reviewPlanUnlockRequest({ data: { requestId: id, decision, note: note[id] } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["owner-plan-requests"] }),
  });

  return <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
    <div><h1 className="flex items-center gap-2 text-3xl font-semibold"><Crown className="size-7 text-gold" /> Plan unlock requests</h1><p className="mt-2 text-sm text-muted-foreground">Approve or decline manual unlock requests. Approval immediately applies the selected plan features to the user's platform account.</p></div>
    {query.isPending ? <Card><CardContent className="p-6">Loading requests…</CardContent></Card> : null}
    {query.error ? <Card><CardContent className="p-6 text-sm text-destructive">{(query.error as Error).message}</CardContent></Card> : null}
    <div className="space-y-4">{(query.data ?? []).map((r: any) => { const plan = Array.isArray(r.plans) ? r.plans[0] : r.plans; return <Card key={r.id} className="glass border-0"><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>{plan?.name ?? "Plan"}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{r.requester_username ?? r.requester_user_id} · {r.requester_user_id}</p></div><Badge variant={r.status === "approved" ? "default" : r.status === "declined" ? "destructive" : "secondary"}>{r.status}</Badge></div></CardHeader><CardContent className="space-y-3"><div className="text-xs text-muted-foreground">Method: {r.unlock_method} · Requested: {new Date(r.requested_at).toLocaleString()}</div>{r.status === "pending" ? <><textarea className="w-full rounded-md border bg-background px-3 py-2 text-sm" rows={2} maxLength={500} placeholder="Optional owner note" value={note[r.id] ?? ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} /><div className="flex gap-2"><Button className="gap-2" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: r.id, decision: "approved" })}><Check className="size-4" />Accept &amp; unlock</Button><Button variant="destructive" className="gap-2" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: r.id, decision: "declined" })}><X className="size-4" />Decline</Button></div></> : r.review_note ? <p className="text-sm text-muted-foreground">Owner note: {r.review_note}</p> : null}</CardContent></Card>; })}</div>
    {!query.isPending && !(query.data ?? []).length ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No plan unlock requests yet.</CardContent></Card> : null}
  </main>;
}
