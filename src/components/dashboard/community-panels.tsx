import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  cancelGiveaway,
  deleteReactionRole,
  getCommunityFeatures,
} from "@/lib/ahoy.functions";

import { SectionHeader } from "./fields";
import type { GuildStructure } from "./types";

function useCommunity(guildId: string) {
  return useQuery({
    queryKey: ["community", guildId],
    queryFn: () => getCommunityFeatures({ data: { guildId } }),
  });
}

function roleName(structure: GuildStructure, id: string) {
  return structure.roles.find((r) => r.id === id)?.name ?? `Role ${id}`;
}

function channelName(structure: GuildStructure, id: string) {
  return structure.channels.find((c) => c.id === id)?.name ?? id;
}

export function ReactionRolesPanel({
  guildId,
  structure,
}: {
  guildId: string;
  structure: GuildStructure;
}) {
  const queryClient = useQueryClient();
  const query = useCommunity(guildId);
  const remove = useServerFn(deleteReactionRole);
  const mutation = useMutation({
    mutationFn: (id: string) => remove({ data: { guildId, id } }),
    onSuccess: () => {
      toast.success("Reaction role removed");
      queryClient.invalidateQueries({ queryKey: ["community", guildId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = query.data?.reactionRoles ?? [];

  return (
    <Card className="glass border-0">
      <CardContent className="space-y-5 pt-6">
        <SectionHeader
          title="Reaction roles"
          description="Members react on a message to grant themselves a role, and lose it when the reaction is removed. Create them in Discord with /reactionrole create then /reactionrole add."
          badge={`${rows.length} option${rows.length === 1 ? "" : "s"}`}
        />
        {query.isPending ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No reaction roles yet. Run <code>/reactionrole create</code> in your server to post a
            picker message, then <code>/reactionrole add</code> for each emoji.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 px-4 py-3 text-sm"
              >
                <span className="text-base">
                  {/^\d+$/.test(row.emoji) ? "🖼️" : row.emoji}
                </span>
                <span className="font-medium">{roleName(structure, row.role_id)}</span>
                <span className="text-muted-foreground">
                  #{channelName(structure, row.channel_id)} · message {row.message_id}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto"
                  aria-label="Remove reaction role"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate(row.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function GiveawaysPanel({
  guildId,
  structure,
}: {
  guildId: string;
  structure: GuildStructure;
}) {
  const queryClient = useQueryClient();
  const query = useCommunity(guildId);
  const cancel = useServerFn(cancelGiveaway);
  const mutation = useMutation({
    mutationFn: (id: string) => cancel({ data: { guildId, id } }),
    onSuccess: () => {
      toast.success("Giveaway cancelled");
      queryClient.invalidateQueries({ queryKey: ["community", guildId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = query.data?.giveaways ?? [];
  const running = rows.filter((row) => row.status === "running").length;

  return (
    <Card className="glass border-0">
      <CardContent className="space-y-5 pt-6">
        <SectionHeader
          title="Giveaways"
          description="Start giveaways in Discord with /giveaway start — AHOY draws and announces winners automatically when the timer ends."
          badge={`${running} running`}
        />
        {query.isPending ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No giveaways yet. Run <code>/giveaway start</code> in your server.
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
                    row.status === "running"
                      ? "border-primary/40 text-primary"
                      : "border-border text-muted-foreground"
                  }
                >
                  {row.status}
                </Badge>
                <span className="font-medium">{row.prize}</span>
                <span className="text-muted-foreground">
                  {row.winner_count} winner{row.winner_count === 1 ? "" : "s"} · #
                  {channelName(structure, row.channel_id)}
                </span>
                {row.winner_ids && row.winner_ids.length > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    Won by {row.winner_ids.map((id) => `@${id}`).join(", ")}
                  </span>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(row.ends_at).toLocaleString()}
                </span>
                {row.status === "running" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate(row.id)}
                  >
                    Cancel
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
