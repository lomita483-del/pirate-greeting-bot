import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAuditLog } from "@/lib/ahoy.functions";

import { SectionHeader } from "./fields";

function when(iso: string): string {
  return new Date(iso).toLocaleString();
}

/** Command-level audit trail for this server only. */
export function AuditTrailPanel({ guildId }: { guildId: string }) {
  const query = useQuery({
    queryKey: ["audit-log", guildId],
    queryFn: () => getAuditLog({ data: { guildId, limit: 50 } }),
  });

  const entries = query.data?.entries ?? [];

  return (
    <Card className="glass border-0">
      <CardContent className="space-y-4 pt-6">
        <SectionHeader
          title="Command audit trail"
          description="Every configured command run in this server, with who ran it and what happened."
          badge={`${entries.length} entries`}
        />

        {query.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing recorded yet. Audit entries appear once commands with logging enabled are used.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-border/40 bg-background/30 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <code className="text-sm font-medium text-primary">{entry.action}</code>
                  {entry.resourceType && (
                    <Badge variant="outline" className="text-[10px]">
                      {entry.resourceType}
                    </Badge>
                  )}
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {when(entry.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {entry.actorId ? `By <@${entry.actorId}>` : "By AHOY"}
                  {entry.targetId ? ` · target <@${entry.targetId}>` : ""}
                  {entry.reason ? ` · ${entry.reason}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
