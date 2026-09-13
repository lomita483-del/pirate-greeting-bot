import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deletePlanTask, listPlanTasksForOwner, savePlanTask } from "@/lib/plan-unlock.functions";

type TaskType = "message_count" | "messages" | "voice_minutes" | "reaction_count" | "reactions" | "member_count";
type Task = { id: string; plan_id: string; title: string; description: string | null; task_type: TaskType; target_value: number; sort_order: number };

type Draft = { id?: string; planId: string; title: string; description: string; taskType: TaskType; targetValue: string; sortOrder: string };

const emptyDraft: Draft = { planId: "", title: "", description: "", taskType: "message_count", targetValue: "1000", sortOrder: "0" };

const TYPE_LABELS: Record<TaskType, string> = {
  message_count: "Messages",
  messages: "Messages (legacy)",
  voice_minutes: "Voice minutes",
  reaction_count: "Reactions",
  reactions: "Reactions (legacy)",
  member_count: "Members",
};

export function PlanTaskManager() {
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery({ queryKey: ["admin", "plan-tasks"], queryFn: listPlanTasksForOwner });
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const save = useMutation({
    mutationFn: () => savePlanTask({ data: { id: draft.id, planId: draft.planId, title: draft.title, description: draft.description || null, taskType: draft.taskType, targetValue: Number(draft.targetValue), sortOrder: Number(draft.sortOrder) } }),
    onSuccess: () => { toast.success("Premium task saved"); setDraft(emptyDraft); void queryClient.invalidateQueries({ queryKey: ["admin", "plan-tasks"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePlanTask({ data: { id } }),
    onSuccess: () => { toast.success("Premium task deleted"); void queryClient.invalidateQueries({ queryKey: ["admin", "plan-tasks"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending) return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-sm text-white/50">Loading Premium task configuration…</div>;
  if (error) return <div role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-200">{(error as Error).message}</div>;

  const plans = data?.plans ?? [];
  const tasks = data?.tasks ?? [];
  const grouped = plans.map((plan) => ({ plan, tasks: tasks.filter((task) => task.plan_id === plan.id) }));

  const edit = (task: Task) => setDraft({ id: task.id, planId: task.plan_id, title: task.title, description: task.description ?? "", taskType: task.task_type, targetValue: String(task.target_value), sortOrder: String(task.sort_order) });

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[#e7a927]/20 bg-[#e7a927]/[0.045] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-[9px] font-bold uppercase tracking-[.28em] text-[#f5bd3b]">Premium access engine</p><h2 className="mt-1 text-xl font-black">Task Studio</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-white/45">Create and modify the tasks members must complete for Premium qualification. Changes apply to the live unlock progress engine.</p></div>
          <Button type="button" variant="outline" onClick={() => setDraft(emptyDraft)} className="gap-2"><Plus className="size-4" /> New task</Button>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold">{draft.id ? "Edit task" : "Create task"}</h3><p className="text-xs text-white/35">Owner-only configuration</p></div>{draft.id ? <Button size="icon" variant="ghost" aria-label="Cancel task edit" onClick={() => setDraft(emptyDraft)}><X className="size-4" /></Button> : null}</div>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Plan</Label><select aria-label="Premium plan" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm" value={draft.planId} onChange={(e) => setDraft((d) => ({ ...d, planId: e.target.value }))}><option value="">Select a plan…</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} ({plan.key})</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="task-title">Title</Label><Input id="task-title" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Reach 1,000 messages" maxLength={120} /></div>
            <div className="space-y-2"><Label htmlFor="task-description">Description</Label><Textarea id="task-description" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Send messages in your selected server." maxLength={500} /></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Metric</Label><select aria-label="Task metric" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm" value={draft.taskType} onChange={(e) => setDraft((d) => ({ ...d, taskType: e.target.value as TaskType }))}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="space-y-2"><Label htmlFor="task-target">Target</Label><Input id="task-target" type="number" min={1} value={draft.targetValue} onChange={(e) => setDraft((d) => ({ ...d, targetValue: e.target.value }))} /></div></div>
            <div className="space-y-2"><Label htmlFor="task-order">Display order</Label><Input id="task-order" type="number" min={0} value={draft.sortOrder} onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))} /></div>
            <Button className="w-full gap-2" disabled={save.isPending || !draft.planId || draft.title.trim().length < 2 || Number(draft.targetValue) < 1} onClick={() => save.mutate()}><Save className="size-4" />{save.isPending ? "Saving…" : draft.id ? "Save changes" : "Create task"}</Button>
          </div>
        </div>

        <div className="space-y-4">
          {grouped.map(({ plan, tasks: planTasks }) => <section key={plan.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl"><div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">{plan.name}</h3><p className="text-xs text-white/35">{plan.key} · {plan.enabled ? "Enabled" : "Disabled"}</p></div><Badge variant="outline">{planTasks.length} tasks</Badge></div><div className="mt-4 space-y-2">{planTasks.length ? planTasks.map((task) => <article key={task.id} className="rounded-2xl border border-white/[0.08] bg-black/20 p-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{task.title}</h4><Badge variant="secondary">{TYPE_LABELS[task.task_type]}</Badge><Badge variant="outline">Target {task.target_value.toLocaleString()}</Badge></div><p className="mt-1 text-sm text-white/40">{task.description || "No description"}</p><p className="mt-2 text-[10px] uppercase tracking-[.16em] text-white/25">Order {task.sort_order}</p></div><div className="flex shrink-0 gap-1"><Button size="icon" variant="ghost" aria-label={`Edit ${task.title}`} onClick={() => edit(task)}><Pencil className="size-4" /></Button><Button size="icon" variant="ghost" aria-label={`Delete ${task.title}`} onClick={() => { if (window.confirm(`Delete the task “${task.title}”?`)) remove.mutate(task.id); }}><Trash2 className="size-4" /></Button></div></div></article>) : <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-white/35">No tasks configured for this plan.</p>}</div></section>)}
        </div>
      </section>
    </div>
  );
}
