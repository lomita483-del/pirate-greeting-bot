import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { closePoll, getPolls } from "@/lib/ahoy.functions";

import { SectionHeader } from "./fields";
import type { GuildStructure } from "./types";

function voteMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, count]) => [key, Number(count) || 0]));
}

export function PollsPanel({ guildId, structure }: { guildId: string; structure: GuildStructure }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["polls", guildId], queryFn: () => getPolls({ data: { guildId } }) });
  const close = useServerFn(closePoll);
  const mutation = useMutation({
    mutationFn: (id: string) => close({ data: { guildId, id } }),
    onSuccess: () => { toast.success("Poll closed"); queryClient.invalidateQueries({ queryKey: ["polls", guildId] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = query.data?.polls ?? [];
  const open = rows.filter((row) => row.status === "open").length;
  const channelName = (id: string) => structure.channels.find((c) => c.id === id)?.name ?? id;

  return (
    <Card className="glass border-0"><CardContent className="space-y-5 pt-6">
      <SectionHeader title="Polls" description="Monitor live polls, inspect vote distribution and close polls directly from the control center." badge={`${open} open`} />
      {query.isPending ? <Skeleton className="h-24 rounded-2xl" /> : rows.length === 0 ? <p className="text-sm text-muted-foreground">No polls yet. Run <code>/poll create</code> in your server.</p> : (
        <div className="space-y-3">
          {rows.map((row) => {
            const votes = voteMap(row.votes);
            const options = Array.isArray(row.options) ? row.options : [];
            const counts = options.map((_, index) => Number(votes[String(index)] ?? votes[String(index + 1)] ?? 0));
            const totalVotes = counts.reduce((sum, count) => sum + count, 0);
            const max = Math.max(1, ...counts);
            return <article key={row.id} className="rounded-2xl border border-border/70 bg-secondary/20 p-4">
              <div className="flex flex-wrap items-start gap-3">
                <Badge variant="outline" className={row.status === "open" ? "border-primary/40 text-primary" : "border-border text-muted-foreground"}>{row.status}</Badge>
                <div className="min-w-0 flex-1"><h3 className="font-semibold">{row.question}</h3><p className="mt-1 text-xs text-muted-foreground">{options.length} options · #{channelName(row.channel_id)} · {totalVotes.toLocaleString()} total vote{totalVotes === 1 ? "" : "s"}</p></div>
                <span className="text-xs text-muted-foreground">{row.ends_at ? `Closes ${new Date(row.ends_at).toLocaleString()}` : "No end time"}</span>
                {row.status === "open" ? <Button variant="outline" size="sm" className="gap-2" disabled={mutation.isPending} onClick={() => mutation.mutate(row.id)}><CheckCircle2 className="h-4 w-4" />Close poll</Button> : null}
              </div>
              <div className="mt-4 space-y-2">
                {options.map((option, index) => { const count = counts[index] ?? 0; const percent = totalVotes ? Math.round((count / totalVotes) * 100) : 0; return <div key={`${row.id}-${index}`} className="space-y-1"><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate">{String(option)}</span><span className="shrink-0 text-muted-foreground">{count.toLocaleString()} · {percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.round((count / max) * 100))}%` }} /></div></div>; })}
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><BarChart3 className="h-3.5 w-3.5 text-primary" />{row.multi_choice ? "Multiple choice" : "Single choice"} · vote distribution updates from the Discord poll record.</div>
            </article>;
          })}
        </div>
      )}
    </CardContent></Card>
  );
}
