import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getActivityLog } from "@/lib/ahoy.functions";

import { Field, SectionHeader } from "./fields";

// These must match the category strings the bot actually sends in
// bot/events/activity_events.py's _record() calls — filtering by a
// category the bot never writes silently returns zero results.
const CATEGORIES = [
  "all",
  "message_delete",
  "message_edit",
  "member_join",
  "member_leave",
  "member_nickname",
  "member_roles",
  "channel_create",
  "channel_delete",
  "channel_update",
  "voice_join",
  "voice_leave",
  "voice_move",
  "invite_create",
  "invite_delete",
] as const;

const LABELS: Record<string, string> = {
  message_delete: "Message deleted",
  message_edit: "Message edited",
  member_join: "Member joined",
  member_leave: "Member left",
  member_nickname: "Nickname changed",
  member_roles: "Roles changed",
  channel_create: "Channel created",
  channel_delete: "Channel deleted",
  channel_update: "Channel updated",
  voice_join: "Voice join",
  voice_leave: "Voice leave",
  voice_move: "Voice switch",
  invite_create: "Invite created",
  invite_delete: "Invite deleted",
};

type ActivityMetadata = {
  before?: string;
  after?: string;
  jump_url?: string;
  content?: string;
  added?: Array<{ id: string; name: string }>;
  removed?: Array<{ id: string; name: string }>;
};

function ActivityDetail({ category, metadata }: { category: string; metadata: ActivityMetadata | null }) {
  if (!metadata) return null;

  if (category === "message_edit" && (metadata.before || metadata.after)) {
    return (
      <div className="mt-2 w-full space-y-2 rounded-lg border border-border/60 bg-background/40 p-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Old</p>
          <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-black/30 p-2 text-xs">
            {metadata.before || "—"}
          </pre>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">New</p>
          <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-black/30 p-2 text-xs">
            {metadata.after || "—"}
          </pre>
        </div>
        {metadata.jump_url ? (
          <a
            href={metadata.jump_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Jump to message <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>
    );
  }

  if (category === "message_delete" && metadata.content) {
    return (
      <div className="mt-2 w-full rounded-lg border border-border/60 bg-background/40 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Deleted content
        </p>
        <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-black/30 p-2 text-xs">
          {metadata.content}
        </pre>
      </div>
    );
  }

  if (category === "member_roles" && (metadata.added?.length || metadata.removed?.length)) {
    return (
      <div className="mt-2 flex w-full flex-wrap gap-1.5">
        {(metadata.added ?? []).map((r) => (
          <Badge key={`add-${r.id}`} className="bg-emerald-500/15 text-emerald-500">
            +{r.name}
          </Badge>
        ))}
        {(metadata.removed ?? []).map((r) => (
          <Badge key={`rm-${r.id}`} variant="outline" className="border-destructive/40 text-destructive">
            -{r.name}
          </Badge>
        ))}
      </div>
    );
  }

  return null;
}

export function ActivityLogPanel({ guildId }: { guildId: string }) {
  const [category, setCategory] = useState<string>("all");
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: ["activity-log", guildId, category, userId, page],
    queryFn: () =>
      getActivityLog({
        data: {
          guildId,
          category,
          ...(userId.trim() ? { userId: userId.trim() } : {}),
          page,
        },
      }),
  });

  const rows = query.data?.entries ?? [];
  const total = query.data?.total ?? 0;
  const pageSize = query.data?.pageSize ?? 50;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card className="glass border-0">
      <CardContent className="space-y-5 pt-6">
        <SectionHeader
          title="Activity log"
          description="Everything !PIRATE sees: message edits and deletions, joins and leaves, nickname and role changes, channel changes, voice movement and invites."
          badge={`${total} entries`}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Category">
            <Select
              value={category}
              onValueChange={(value) => {
                setCategory(value);
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === "all" ? "All activity" : (LABELS[value] ?? value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="User ID">
            <Input
              value={userId}
              placeholder="123456789012345678"
              onChange={(event) => {
                setUserId(event.target.value);
                setPage(0);
              }}
            />
          </Field>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => query.refetch()}>
              Refresh
            </Button>
          </div>
        </div>

        {query.isPending ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No activity recorded yet for those filters.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 px-4 py-3 text-sm"
              >
                <Badge variant="outline" className="border-primary/40 text-primary">
                  {LABELS[row.category] ?? row.category}
                </Badge>
                <span className="font-medium">{row.actor_name ?? row.actor_id ?? "Unknown"}</span>
                <span className="text-muted-foreground">{row.summary}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString()}
                </span>
                <ActivityDetail
                  category={row.category}
                  metadata={(row.metadata as ActivityMetadata | null) ?? null}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page + 1} of {pages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page + 1 >= pages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
