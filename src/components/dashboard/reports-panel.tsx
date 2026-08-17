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

import { getReports, resolveReport } from "@/lib/reports.functions";
import { SectionHeader } from "./fields";

const STATUSES = ["pending", "accepted", "ignored", "all"] as const;

export function ReportsPanel({ guildId }: { guildId: string }) {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("pending");
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["reports", guildId, status],
    queryFn: () => getReports({ data: { guildId, status } }),
  });

  const resolve = useServerFn(resolveReport);
  const resolveMutation = useMutation({
    mutationFn: (input: { id: string; status: "accepted" | "ignored"; openCase?: boolean }) =>
      resolve({ data: { guildId, ...input } }),
    onSuccess: () => {
      toast.success("Report updated");
      queryClient.invalidateQueries({ queryKey: ["reports", guildId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = query.data?.reports ?? [];

  return (
    <Card className="glass border-0">
      <CardContent className="space-y-5 pt-6">
        <SectionHeader
          title="User reports"
          description="Reports members file via /report or the right-click Report menu."
          badge={`${rows.length} shown`}
        />

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
          <p className="text-sm text-muted-foreground">No reports here.</p>
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
                    <span className="font-medium">{r["reported_user_name"] as string}</span>
                    <span className="text-muted-foreground">
                      reported by {r["reporter_name"] as string}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(r["created_at"] as string).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{r["reason"] as string}</p>
                  {r["status"] === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          resolveMutation.mutate({
                            id: r["id"] as string,
                            status: "accepted",
                            openCase: true,
                          })
                        }
                      >
                        Accept + open case
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          resolveMutation.mutate({ id: r["id"] as string, status: "ignored" })
                        }
                      >
                        Ignore
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
