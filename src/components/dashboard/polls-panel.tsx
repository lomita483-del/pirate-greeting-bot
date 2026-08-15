import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { closePoll, getPolls } from "@/lib/ahoy.functions";

import { SectionHeader } from "./fields";
import type { GuildStructure } from "./types";

export function PollsPanel({
  guildId,
  structure,
}: {
  guildId: string;
  structure: GuildStructure;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["polls", guildId],
    queryFn: () => getPolls({ data: { guildId } }),
  });
  const close = useServerFn(closePoll);
  const mutation = useMutation({
    mutationFn: (id: string) => close({ data: { guildId, id } }),
    onSuccess: () => {
      toast.success("Poll closed");
      queryClient.invalidateQueries({ queryKey: ["polls", guildId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = query.data?.polls ?? [];
  const open = rows.filter((row) => row.status === "open").length;

  const channelName = (id: string) =>
    structure.channels.find((c) => c.id === id)?.name ?? id;

  return (
    <Card className="glass border-0">
      <CardContent className="space-y-5 pt-6">
        <SectionHeader
          title="Polls"
          description="Start polls in Discord with /poll create — up to 10 options, live vote counts, and an automatic results post when a duration is set."
          badge={`${open} open`}
        />
        {query.isPending ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No polls yet. Run <code>/poll create</code> in your server.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 px-4 py-3 text-sm"
              >
                <Badge
                  variant="outline"
                  className={
                    row.status === "open"
                      ? "border-primary/40 text-primary"
                      : "border-border text-muted-foreground"
                  }
                >
                  {row.status}
                </Badge>
                <span className="font-medium">{row.question}</span>
                <span className="text-muted-foreground">
                  {(row.options ?? []).length} options · #{channelName(row.channel_id)}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {row.ends_at
                    ? `Closes ${new Date(row.ends_at).toLocaleString()}`
                    : "No end time"}
                </span>
                {row.status === "open" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate(row.id)}
                  >
                    Close
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
