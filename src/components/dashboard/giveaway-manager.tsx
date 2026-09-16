import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Gift, Pencil, RefreshCw, StopCircle, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { createGiveawayFromDashboard, getGiveawayEntries, getGiveawayManager, updateGiveawayFromDashboard, endGiveawayFromDashboard, cancelGiveawayFromDashboard, rerollGiveawayFromDashboard } from "@/lib/giveaway.functions";
import { PickerSelect, Field, SectionHeader } from "./fields";
import type { GuildStructure } from "./types";

function toLocalInput(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function defaultForm() {
  return {
    channel_id: "",
    prize: "",
    description: "Enter below for your chance to win!",
    winner_count: 1,
    ends_at: toLocalInput(),
    required_role_id: null as string | null,
    bonus_role_id: null as string | null,
    bonus_entries: 2,
    min_account_age_days: 0,
  };
}

type FormState = ReturnType<typeof defaultForm>;

export function GiveawaysManagerPanel({ guildId, structure }: { guildId: string; structure: GuildStructure }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["giveaway-manager", guildId], queryFn: () => getGiveawayManager({ data: { guildId } }) });
  const [form, setForm] = useState<FormState>(defaultForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [status, setStatus] = useState<"all" | "running" | "ended" | "cancelled">("all");

  const create = useServerFn(createGiveawayFromDashboard);
  const update = useServerFn(updateGiveawayFromDashboard);
  const end = useServerFn(endGiveawayFromDashboard);
  const cancel = useServerFn(cancelGiveawayFromDashboard);
  const reroll = useServerFn(rerollGiveawayFromDashboard);
  const entries = useServerFn(getGiveawayEntries);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { guildId, ...form, ends_at: new Date(form.ends_at).toISOString() };
      return editingId ? update({ data: { ...payload, id: editingId } }) : create({ data: payload });
    },
    onSuccess: () => {
      toast.success(editingId ? "Giveaway update queued." : "Giveaway creation queued — it will appear in Discord shortly.");
      setForm(defaultForm());
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["giveaway-manager", guildId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const action = useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: "end" | "cancel" | "reroll" }) => {
      if (kind === "end") return end({ data: { guildId, id } });
      if (kind === "cancel") return cancel({ data: { guildId, id } });
      return reroll({ data: { guildId, id } });
    },
    onSuccess: () => {
      toast.success("Giveaway action queued.");
      queryClient.invalidateQueries({ queryKey: ["giveaway-manager", guildId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const entryQuery = useQuery({
    queryKey: ["giveaway-entries", guildId, entryId],
    enabled: Boolean(entryId),
    queryFn: () => getGiveawayEntries({ data: { guildId, id: entryId! } }),
  });

  const rows = query.data?.giveaways ?? [];
  const visible = useMemo(() => status === "all" ? rows : rows.filter((r) => r.status === status), [rows, status]);
  const running = rows.filter((r) => r.status === "running").length;
  const totalEntries = rows.reduce((sum, r) => sum + (r.entry_count ?? 0), 0);

  const startEdit = (row: any) => {
    const settings = row.settings ?? {};
    setEditingId(row.id);
    setForm({
      channel_id: row.channel_id,
      prize: row.prize,
      description: settings.description ?? "Enter below for your chance to win!",
      winner_count: row.winner_count,
      ends_at: toLocalInput(row.ends_at),
      required_role_id: settings.required_role_id ?? null,
      bonus_role_id: settings.bonus_role_id ?? null,
      bonus_entries: Number(settings.bonus_entries ?? 2),
      min_account_age_days: Number(settings.min_account_age_days ?? 0),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Card className="glass border-0">
      <CardContent className="space-y-6 pt-6">
        <SectionHeader
          title="Giveaway Manager"
          description="Create, schedule, edit, monitor, end, cancel and reroll giveaways without leaving the control center."
          badge={`${running} running · ${totalEntries} entries`}
        />

        <div className="rounded-2xl border border-primary/30 bg-background/30 p-4 space-y-4">
          <div className="flex items-center gap-2 font-medium"><Gift className="h-4 w-4 text-primary" /> {editingId ? "Edit giveaway" : "Create giveaway"}</div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Prize"><Input value={form.prize} maxLength={200} placeholder="€100 gift card" onChange={(e) => setForm((f) => ({ ...f, prize: e.target.value }))} /></Field>
            <Field label="Channel"><PickerSelect value={form.channel_id || null} options={structure.channels.filter((c) => c.kind === "text")} onChange={(v) => setForm((f) => ({ ...f, channel_id: v ?? "" }))} placeholder="Select giveaway channel" /></Field>
            <Field label="Ends at"><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} /></Field>
            <Field label="Winners (1–20)"><Input type="number" min={1} max={20} value={form.winner_count} onChange={(e) => setForm((f) => ({ ...f, winner_count: Math.max(1, Math.min(20, Number(e.target.value) || 1)) }))} /></Field>
          </div>
          <Field label="Description"><Textarea rows={3} maxLength={1000} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
          <Separator />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Required role"><PickerSelect value={form.required_role_id} options={structure.roles} onChange={(v) => setForm((f) => ({ ...f, required_role_id: v }))} placeholder="Anyone can enter" /></Field>
            <Field label="Bonus role"><PickerSelect value={form.bonus_role_id} options={structure.roles} onChange={(v) => setForm((f) => ({ ...f, bonus_role_id: v }))} placeholder="No bonus role" /></Field>
            <Field label="Bonus entry weight"><Input type="number" min={1} max={10} value={form.bonus_entries} onChange={(e) => setForm((f) => ({ ...f, bonus_entries: Math.max(1, Math.min(10, Number(e.target.value) || 1)) }))} /></Field>
            <Field label="Minimum account age (days)"><Input type="number" min={0} max={3650} value={form.min_account_age_days} onChange={(e) => setForm((f) => ({ ...f, min_account_age_days: Math.max(0, Math.min(3650, Number(e.target.value) || 0)) }))} /></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!form.prize.trim() || !form.channel_id || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Saving…" : editingId ? "Save giveaway changes" : "Create giveaway"}</Button>
            {editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm(defaultForm()); }}>Cancel edit</Button>}
          </div>
          <p className="text-xs text-muted-foreground">The dashboard queues Discord actions so the control center stays usable even while the bot is restarting.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["all", "running", "ended", "cancelled"] as const).map((value) => <Button key={value} size="sm" variant={status === value ? "default" : "outline"} onClick={() => setStatus(value)}>{value[0].toUpperCase() + value.slice(1)}</Button>)}
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => queryClient.invalidateQueries({ queryKey: ["giveaway-manager", guildId] })}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
        </div>

        {query.isPending ? <div className="rounded-xl border p-6 text-sm text-muted-foreground">Loading giveaways…</div> : visible.length === 0 ? <div className="rounded-xl border p-6 text-sm text-muted-foreground">No giveaways match this filter.</div> : (
          <div className="space-y-3">
            {visible.map((row: any) => (
              <div key={row.id} className="rounded-2xl border border-border/70 bg-secondary/20 p-4 space-y-3">
                <div className="flex flex-wrap items-start gap-3">
                  <Badge variant="outline" className={row.status === "running" ? "border-primary/40 text-primary" : "text-muted-foreground"}>{row.status}</Badge>
                  <div className="min-w-0 flex-1"><p className="font-semibold truncate">{row.prize}</p><p className="text-xs text-muted-foreground">#{structure.channels.find((c) => c.id === row.channel_id)?.name ?? row.channel_id} · {row.winner_count} winner{row.winner_count === 1 ? "" : "s"} · {row.entry_count ?? 0} entries</p></div>
                  <div className="text-right text-xs text-muted-foreground">{row.status === "running" ? "Ends" : "Ended"}<br />{new Date(row.ends_at).toLocaleString()}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEntryId(entryId === row.id ? null : row.id)}><Users className="mr-1 h-4 w-4" />Entries</Button>
                  {row.status === "running" && <Button size="sm" variant="outline" onClick={() => startEdit(row)}><Pencil className="mr-1 h-4 w-4" />Edit</Button>}
                  {row.status === "running" && <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ id: row.id, kind: "end" })}><StopCircle className="mr-1 h-4 w-4" />End now</Button>}
                  {row.status === "running" && <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ id: row.id, kind: "cancel" })}><Trash2 className="mr-1 h-4 w-4" />Cancel</Button>}
                  {row.status === "ended" && <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ id: row.id, kind: "reroll" })}><RefreshCw className="mr-1 h-4 w-4" />Reroll</Button>}
                  {row.message_id && <a className="inline-flex items-center rounded-md border px-3 text-sm" href={`https://discord.com/channels/${guildId}/${row.channel_id}/${row.message_id}`} target="_blank" rel="noreferrer"><Eye className="mr-1 h-4 w-4" />Open</a>}
                </div>
                {entryId === row.id && <div className="rounded-xl border bg-background/30 p-3"><p className="mb-2 text-sm font-medium">Entries ({entryQuery.data?.entries.length ?? row.entry_count ?? 0})</p>{entryQuery.isPending ? <p className="text-xs text-muted-foreground">Loading entries…</p> : entryQuery.data?.entries.length ? <div className="max-h-48 space-y-1 overflow-auto">{entryQuery.data.entries.map((e: any) => <div key={e.user_id} className="flex justify-between rounded-md px-2 py-1 text-xs"><span>@{e.user_id}</span><span>{e.weight}x</span></div>)}</div> : <p className="text-xs text-muted-foreground">No recorded button entries.</p>}</div>}
                {row.winner_ids?.length ? <p className="text-xs text-muted-foreground">Winners: {row.winner_ids.map((id: string) => `@${id}`).join(", ")}</p> : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
