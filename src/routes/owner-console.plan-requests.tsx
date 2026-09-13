import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Crown, X } from "lucide-react";
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
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "declined" }) =>
      reviewPlanUnlockRequest({ data: { requestId: id, decision, note: note[id] } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["owner-plan-requests"] }),
  });

  const pendingCount = (query.data ?? []).filter((request: any) => request.status === "pending").length;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" className="gap-2">
          <Link to="/owner-console" aria-label="Back to owner console">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to owner console
          </Link>
        </Button>
        {pendingCount > 0 ? (
          <Badge className="gap-1.5 bg-gold/15 text-gold hover:bg-gold/20" aria-label={`${pendingCount} pending Premium requests`}>
            {pendingCount} pending
          </Badge>
        ) : null}
      </div>

      <section aria-labelledby="plan-requests-title">
        <h1 id="plan-requests-title" className="flex items-center gap-2 text-3xl font-semibold">
          <Crown className="size-7 text-gold" aria-hidden="true" />
          Premium Access requests
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Review member requests for Premium access. Approval immediately applies the selected plan features to the member account.
        </p>
      </section>

      {query.isPending ? <Card><CardContent className="p-6" role="status" aria-live="polite">Loading Premium requests…</CardContent></Card> : null}
      {query.error ? <Card><CardContent className="p-6 text-sm text-destructive" role="alert">{(query.error as Error).message}</CardContent></Card> : null}

      <div className="space-y-4">
        {(query.data ?? []).map((r: any) => {
          const plan = Array.isArray(r.plans) ? r.plans[0] : r.plans;
          const isPending = r.status === "pending";
          const noteId = `review-note-${r.id}`;

          return (
            <Card key={r.id} className="glass border-0">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{plan?.name ?? "Premium plan"}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {r.requester_username ?? r.requester_user_id} · {r.requester_user_id}
                    </p>
                  </div>
                  <Badge
                    variant={r.status === "approved" ? "default" : r.status === "declined" ? "destructive" : "secondary"}
                    aria-label={`Request status: ${r.status}`}
                  >
                    {r.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  Method: {r.unlock_method} · Requested: {new Date(r.requested_at).toLocaleString()}
                </div>

                {isPending ? (
                  <>
                    <label htmlFor={noteId} className="text-sm font-medium">Owner note <span className="font-normal text-muted-foreground">(optional)</span></label>
                    <textarea
                      id={noteId}
                      className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-gold"
                      rows={2}
                      maxLength={500}
                      placeholder="Optional message to the member"
                      value={note[r.id] ?? ""}
                      onChange={(e) => setNote({ ...note, [r.id]: e.target.value })}
                      aria-describedby={`${noteId}-help`}
                    />
                    <p id={`${noteId}-help`} className="text-xs text-muted-foreground">Up to 500 characters.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="gap-2"
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate({ id: r.id, decision: "approved" })}
                        aria-label={`Accept Premium request from ${r.requester_username ?? r.requester_user_id}`}
                      >
                        <Check className="size-4" aria-hidden="true" />
                        Accept &amp; unlock
                      </Button>
                      <Button
                        variant="destructive"
                        className="gap-2"
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate({ id: r.id, decision: "declined" })}
                        aria-label={`Decline Premium request from ${r.requester_username ?? r.requester_user_id}`}
                      >
                        <X className="size-4" aria-hidden="true" />
                        Decline
                      </Button>
                    </div>
                  </>
                ) : r.review_note ? (
                  <p className="text-sm text-muted-foreground">Owner note: {r.review_note}</p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!query.isPending && !(query.data ?? []).length ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">No Premium Access requests yet.</CardContent>
        </Card>
      ) : null}
    </main>
  );
}
