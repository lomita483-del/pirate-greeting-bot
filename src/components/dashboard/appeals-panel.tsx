import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { getAppeals, resolveAppeal } from "@/lib/appeals.functions";
import { SectionHeader } from "./fields";

const STATUSES = ["pending", "accepted", "rejected", "all"] as const;

export function AppealsPanel({ guildId }: { guildId: string }) {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("pending");
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["appeals", guildId, status],
    queryFn: () => getAppeals({ data: { guildId, status } }),
  });

  const resolve = useServerFn(resolveAppeal);
  const resolveMutation = useMutation({
    mutationFn: (input: { id: string; status: "accepted" | "rejected"; liftPunishment?: boolean }) =>
      resolve({ data: { guildId, ...input } }),
    onSuccess: () => {
      toast.success("Appeal updated");
      queryClient.invalidateQueries({ queryKey: ["appeals", guildId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = query.data?.appeals ?? [];
  const appealUrl = typeof window !== "undefined" ? `${window.location.origin}/appeal/${guildId}` : `/appeal/${guildId}`;

  return (
    <Card className="glass border-0">
      <CardContent className="space-y-5 pt-6">
        <SectionHeader
          title="Case appeals"
          description="Punished members can request a review from a public form."
          badge={`${rows.length} shown`}
        />
        <div className="rounded-lg border border-dashed border-border/70 p-3 text-xs text-muted-foreground">
          Share this link with anyone who wants to appeal a case:{" "}
          <code className="rounded bg-secondary/50 px-1.5 py-0.5">{appealUrl}</code>
        </div>

        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All statuses" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {query.isPending ? (
          <Skeleton className="h-32 rounded-2xl" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No appeals here.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const r = row as Record<string, unknown>;
              return (
                <li
                  key={r["id"] as string}
                  className="space-y-2 rounded-xl border border-border/70 bg-secondary/30 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{r["status"] as string}</Badge>
                    {r["case_number"] != null && (
                      <Badge variant="outline" className="border-gold/40 text-gold">
                        Case #{r["case_number"] as number}
                      </Badge>
                    )}
                    <span className="font-medium">{r["username"] as string}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(r["created_at"] as string).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{r["message"] as string}</p>
                  {r["status"] === "pending" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          resolveMutation.mutate({
                            id: r["id"] as string,
                            status: "accepted",
                            liftPunishment: true,
                          })
                        }
                      >
                        Accept + lift punishment
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          resolveMutation.mutate({ id: r["id"] as string, status: "accepted" })
                        }
                      >
                        Accept only
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          resolveMutation.mutate({ id: r["id"] as string, status: "rejected" })
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
