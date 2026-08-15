import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import {
  createCase,
  deleteCase,
  getCases,
  requestBotAction,
  updateCase,
} from "@/lib/ahoy.functions";

import { Field, SectionHeader } from "./fields";

const TYPES = [
  "all",
  "warn",
  "timeout",
  "untimeout",
  "kick",
  "ban",
  "unban",
  "mute",
  "unmute",
  "purge",
  "note",
] as const;

const MANUAL_TYPES = TYPES.filter((t) => t !== "all");

export function CasesPanel({ guildId }: { guildId: string }) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<string>("all");
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<{ id: string; reason: string } | null>(null);
  const [draft, setDraft] = useState({
    action: "note" as string,
    target_id: "",
    target_name: "",
    reason: "",
  });

  const query = useQuery({
    queryKey: ["cases", guildId, action, userId, page],
    queryFn: () =>
      getCases({
        data: {
          guildId,
          action,
          ...(userId.trim() ? { userId: userId.trim() } : {}),
          page,
        },
      }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["cases", guildId] });
  const create = useServerFn(createCase);
  const update = useServerFn(updateCase);
  const remove = useServerFn(deleteCase);
  const queueAction = useServerFn(requestBotAction);

  const createMutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          guildId,
          action: draft.action as "note",
          target_id: draft.target_id.trim(),
          target_name: draft.target_name.trim() || undefined,
          reason: draft.reason.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Case created");
      setDraft({ action: "note", target_id: "", target_name: "", reason: "" });
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; reason?: string; voided?: boolean }) =>
      update({ data: { guildId, ...input } }),
    onSuccess: () => {
      toast.success("Case updated");
      setEditing(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { guildId, id } }),
    onSuccess: () => {
      toast.success("Case deleted");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const liftMutation = useMutation({
    mutationFn: (input: { caseId: string; target_id: string; kind: "unban" | "untimeout" }) =>
      queueAction({
        data: {
          guildId,
          action: input.kind,
          target_id: input.target_id,
          caseId: input.caseId,
          reason: "Lifted from the AHOY dashboard",
        },
      }),
    onSuccess: () => {
      toast.success("Queued — AHOY will apply this within a minute.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = query.data?.cases ?? [];
  const total = query.data?.total ?? 0;
  const pageSize = query.data?.pageSize ?? 25;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Moderation cases"
            description="Every warn, timeout, kick and ban AHOY performs is filed as a numbered case. Edit reasons, void a case, or lift an active punishment straight from here."
            badge={`${total} total`}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type">
              <Select
                value={action}
                onValueChange={(value) => {
                  setAction(value);
                  setPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type === "all" ? "All types" : type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="User ID" hint="Filter to one member's history.">
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
            <Skeleton className="h-40 rounded-2xl" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cases match those filters.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="space-y-2 rounded-xl border border-border/70 bg-secondary/30 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="outline" className="border-gold/40 text-gold">
                      #{row.case_number}
                    </Badge>
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      {row.action}
                    </Badge>
                    {row.active ? (
                      <Badge variant="outline" className="border-primary/40 text-primary">
                        active
                      </Badge>
                    ) : null}
                    {row.voided ? (
                      <Badge variant="outline" className="border-border text-muted-foreground">
                        voided
                      </Badge>
                    ) : null}
                    <span className="font-medium">{row.target_name ?? row.target_id}</span>
                    <span className="text-muted-foreground">
                      by {row.moderator_name ?? "AHOY"}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                  </div>

                  {editing?.id === row.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editing.reason}
                        onChange={(event) =>
                          setEditing({ id: row.id, reason: event.target.value })
                        }
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={updateMutation.isPending}
                          onClick={() =>
                            updateMutation.mutate({ id: row.id, reason: editing.reason })
                          }
                        >
                          Save reason
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">{row.reason ?? "No reason recorded."}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing({ id: row.id, reason: row.reason ?? "" })}
                    >
                      Edit reason
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateMutation.mutate({ id: row.id, voided: !row.voided })
                      }
                    >
                      {row.voided ? "Restore" : "Void"}
                    </Button>
                    {row.active && row.target_id && row.action === "ban" ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          liftMutation.mutate({
                            caseId: row.id,
                            target_id: row.target_id as string,
                            kind: "unban",
                          })
                        }
                      >
                        Unban
                      </Button>
                    ) : null}
                    {row.active && row.target_id && row.action === "timeout" ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          liftMutation.mutate({
                            caseId: row.id,
                            target_id: row.target_id as string,
                            kind: "untimeout",
                          })
                        }
                      >
                        Remove timeout
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => deleteMutation.mutate(row.id)}
                    >
                      Delete
                    </Button>
                  </div>
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

      <Card className="glass border-0">
        <CardContent className="space-y-4 pt-6">
          <SectionHeader
            title="Add a case manually"
            description="Log something that happened outside AHOY — it gets the next case number for this server."
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type">
              <Select
                value={draft.action}
                onValueChange={(value) => setDraft({ ...draft, action: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Target user ID">
              <Input
                value={draft.target_id}
                placeholder="123456789012345678"
                onChange={(event) => setDraft({ ...draft, target_id: event.target.value })}
              />
            </Field>
            <Field label="Target name" hint="Optional, for readability.">
              <Input
                value={draft.target_name}
                onChange={(event) => setDraft({ ...draft, target_name: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Reason">
            <Textarea
              value={draft.reason}
              rows={2}
              onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
            />
          </Field>
          <Button
            disabled={
              createMutation.isPending || !draft.target_id.trim() || !draft.reason.trim()
            }
            onClick={() => createMutation.mutate()}
          >
            Create case
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
