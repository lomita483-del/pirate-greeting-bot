import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useState } from "react";

import { getErrorLogs, clearErrorLogs } from "@/lib/error-log.functions";

export const Route = createFileRoute("/dashboard/$guildId/errors")({
  head: () => ({
    meta: [
      { title: "Error log — AHOY Control Center" },
      { name: "description", content: "Every error AHOY has encountered for this server." },
    ],
  }),
  component: ErrorLogPage,
});

function ErrorLogPage() {
  const { guildId } = Route.useParams();
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["error-logs", guildId, page],
    queryFn: () => getErrorLogs({ data: { guildId, page } }),
  });

  const clearMutation = useMutation({
    mutationFn: () => clearErrorLogs({ data: { guildId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["error-logs", guildId] }),
  });

  const entries = query.data?.entries ?? [];
  const total = query.data?.total ?? 0;
  const pageSize = query.data?.pageSize ?? 30;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <div>
            <h1 className="text-xl font-semibold">Error log</h1>
            <p className="text-sm text-muted-foreground">
              Every error AHOY has hit while running for this server — command failures, event
              handler exceptions, and background task errors. Use this to spot what needs fixing.
            </p>
          </div>
        </div>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Clear all error log entries for this server?")) clearMutation.mutate();
            }}
            className="flex items-center gap-1.5 rounded-md border border-red-900/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/30"
          >
            <Trash2 className="h-4 w-4" />
            Clear log
          </button>
        )}
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No errors recorded — that's a good sign.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const e = entry as Record<string, unknown>;
            return (
              <details
                key={e["id"] as string}
                className="rounded-lg border border-red-900/30 bg-red-950/10 p-3"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                  <span className="flex-1 truncate">
                    <span className="rounded bg-red-900/40 px-1.5 py-0.5 text-xs font-mono text-red-300">
                      {(e["source"] as string) ?? "unknown"}
                    </span>{" "}
                    {e["command"] ? (
                      <span className="font-mono text-xs text-muted-foreground">
                        /{e["command"] as string}
                      </span>
                    ) : null}{" "}
                    <span className="font-medium">{e["error_type"] as string}</span> —{" "}
                    <span className="text-muted-foreground">{e["message"] as string}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(e["created_at"] as string).toLocaleString()}
                  </span>
                </summary>
                {e["traceback"] ? (
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-black/40 p-2 text-xs text-red-200">
                    {e["traceback"] as string}
                  </pre>
                ) : null}
              </details>
            );
          })}
        </div>
      )}

      {total > pageSize && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-md border px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-muted-foreground">
            Page {page + 1} of {Math.ceil(total / pageSize)}
          </span>
          <button
            type="button"
            disabled={(page + 1) * pageSize >= total}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
