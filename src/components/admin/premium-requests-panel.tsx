import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Crown, RefreshCw, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listPlanUnlockRequests, reviewPlanUnlockRequest } from "@/lib/plan-unlock.functions";

export function PremiumRequestsPanel() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: ["owner-plan-requests"], queryFn: () => listPlanUnlockRequests(), refetchInterval: 10000 });
  const mutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "declined" }) => reviewPlanUnlockRequest({ data: { requestId: id, decision, note: note[id]?.trim() || undefined } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["owner-plan-requests"] }),
  });

  const requests = query.data ?? [];
  const pendingCount = requests.filter((request: any) => request.status === "pending").length;

  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-[28px] border border-amber-300/15 bg-amber-300/[0.035] p-5 shadow-xl backdrop-blur-2xl sm:p-6">
      <div aria-hidden className="absolute -right-20 -top-20 size-64 rounded-full bg-amber-300/[0.07] blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3"><span className="flex size-11 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-amber-200"><Crown className="size-5" /></span><div><p className="text-[9px] font-bold uppercase tracking-[.25em] text-amber-200">Premium access</p><h2 className="mt-1 text-2xl font-black">Request Review Desk</h2><p className="mt-1 text-sm text-white/45">Approve or decline member Premium requests without leaving the Owner Console.</p></div></div>
        <div className="flex items-center gap-2"><Badge className="border border-amber-300/20 bg-amber-300/10 text-amber-200">{pendingCount} pending</Badge><Button variant="outline" size="icon" onClick={() => void query.refetch()} aria-label="Refresh Premium requests"><RefreshCw className={`size-4 ${query.isFetching ? "animate-spin" : ""}`} /></Button></div>
      </div>
    </section>

    {query.error ? <div role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-200">{(query.error as Error).message}</div> : null}
    {query.isPending ? <Card className="glass border-white/[0.08]"><CardContent className="p-6 text-sm text-white/50">Loading Premium requests…</CardContent></Card> : null}

    <div className="space-y-4">
      {requests.map((r: any) => {
        const plan = Array.isArray(r.plans) ? r.plans[0] : r.plans;
        const isPending = r.status === "pending";
        const noteId = `review-note-${r.id}`;
        return <Card key={r.id} className="glass border-white/[0.08] shadow-xl">
          <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-lg">{plan?.name ?? "Premium plan"}</CardTitle><p className="mt-1 text-sm text-white/45">{r.requester_username ?? "Unknown member"}</p><p className="mt-0.5 font-mono text-[10px] text-white/25">User ID: {r.requester_user_id}{r.guild_id ? ` · Server: ${r.guild_id}` : " · Account request"}</p></div><Badge variant={r.status === "approved" ? "default" : r.status === "declined" ? "destructive" : "secondary"}>{r.status}</Badge></div></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 text-xs text-white/40 sm:grid-cols-3"><span>Method: {r.unlock_method}</span><span>Requested: {new Date(r.requested_at).toLocaleString()}</span><span>Server: {r.guild_id || "Account-wide"}</span></div>
            {isPending ? <><label htmlFor={noteId} className="text-sm font-medium">Owner note <span className="font-normal text-white/35">(optional)</span></label><textarea id={noteId} className="min-h-20 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" maxLength={500} placeholder="Optional message to the member" value={note[r.id] ?? ""} onChange={(e) => setNote((current) => ({ ...current, [r.id]: e.target.value }))} /><div className="flex flex-wrap gap-2"><Button className="gap-2" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: r.id, decision: "approved" })}><Check className="size-4" />Accept & unlock</Button><Button variant="destructive" className="gap-2" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: r.id, decision: "declined" })}><X className="size-4" />Decline</Button></div></> : r.review_note ? <p className="rounded-2xl border border-white/[0.08] bg-black/15 p-3 text-sm text-white/55">Owner note: {r.review_note}</p> : null}
          </CardContent>
        </Card>;
      })}
      {!query.isPending && requests.length === 0 ? <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-white/40">No Premium Access requests yet.</div> : null}
    </div>
  </div>;
}
