import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

import { getMyAppealableCases, submitAppeal } from "@/lib/appeals.functions";

export const Route = createFileRoute("/appeal/$guildId")({
  head: () => ({
    meta: [
      { title: "Appeal a case — AHOY" },
      { name: "description", content: "Request a review of a moderation action against you." },
    ],
  }),
  component: AppealPage,
});

function AppealPage() {
  const { guildId } = Route.useParams();
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["my-appealable-cases", guildId],
    queryFn: () => getMyAppealableCases({ data: { guildId } }),
    retry: false,
  });

  const submit = useServerFn(submitAppeal);
  const submitMutation = useMutation({
    mutationFn: (input: { caseId: string; caseNumber?: number; message: string }) =>
      submit({ data: { guildId, ...input } }),
    onSuccess: () => {
      toast.success("Appeal submitted — a moderator will review it.");
      setSelectedCase(null);
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["my-appealable-cases", guildId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (query.isError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Sign in to appeal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {(query.error as Error).message}
        </p>
        <Button className="mt-4" onClick={() => (window.location.href = "/api/public/auth/discord/start")}>
          Sign in with Discord
        </Button>
      </div>
    );
  }

  const cases = query.data?.cases ?? [];

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-16">
      <div>
        <h1 className="text-xl font-semibold">Appeal a case</h1>
        <p className="text-sm text-muted-foreground">
          {query.data ? `${query.data.serverName} — ` : ""}Select one of your cases below to request
          a review.
        </p>
      </div>

      {query.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : cases.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No cases found for you in this server — nothing to appeal.
        </p>
      ) : (
        <div className="space-y-3">
          {cases.map((c) => (
            <Card key={c.id} className={selectedCase === c.id ? "border-primary" : "glass border-0"}>
              <CardContent className="space-y-2 pt-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline">#{c.case_number}</Badge>
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    {c.action}
                  </Badge>
                  {c.voided && <Badge variant="outline">voided</Badge>}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(c.created_at as string).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{c.reason ?? "No reason recorded."}</p>
                {c.appealStatus ? (
                  <Badge variant="outline">Appeal {c.appealStatus}</Badge>
                ) : selectedCase === c.id ? (
                  <div className="space-y-2">
                    <Textarea
                      rows={4}
                      placeholder="Explain why this should be reviewed…"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={message.trim().length < 10 || submitMutation.isPending}
                        onClick={() =>
                          submitMutation.mutate({
                            caseId: c.id,
                            caseNumber: c.case_number as number | undefined,
                            message: message.trim(),
                          })
                        }
                      >
                        Submit appeal
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedCase(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setSelectedCase(c.id)}>
                    Appeal this case
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
