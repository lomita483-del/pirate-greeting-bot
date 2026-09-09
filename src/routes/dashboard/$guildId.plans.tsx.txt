import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getServerPlanStatus, setCustomTaskProgress } from "@/lib/plans.functions";

export const Route = createFileRoute("/dashboard/$guildId/plans")({
  component: PlansPage,
});

const TASK_TYPE_LABEL: Record<string, string> = {
  member_count: "Server members",
  boost_count: "Server boosts",
  invite_count: "Invite uses",
  message_count: "Messages sent",
  voice_minutes: "Minutes in voice",
  reaction_count: "Reactions given",
  daily_login_streak: "Daily dashboard check-ins",
  custom: "Custom",
};

function PlansPage() {
  const { guildId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: plans, isPending } = useQuery({
    queryKey: ["server-plan-status", guildId],
    queryFn: () => getServerPlanStatus({ data: { guildId } }),
  });

  const toggleCustom = useMutation({
    mutationFn: (vars: { taskId: string; completed: boolean }) =>
      setCustomTaskProgress({ data: { guildId, ...vars } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-plan-status", guildId] });
      queryClient.invalidateQueries({ queryKey: ["entitlements", guildId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isPending) {
    return <p className="p-10 text-sm text-muted-foreground">Loading plans…</p>;
  }

  if (!plans?.length) {
    return (
      <Card className="glass border-0">
        <CardContent className="py-14 text-center text-sm text-muted-foreground">
          No plans have been set up yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-5">
      <div>
        <h1 className="text-2xl font-semibold">Plans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete every task in a plan to unlock its features for this server — no payment
          needed.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => {
          const tasks = (plan.plan_tasks ?? []) as Array<{
            id: string;
            title: string;
            description: string | null;
            task_type: string;
            target_value: number;
            progress: number;
            completed: boolean;
          }>;
          const done = tasks.filter((t) => t.completed).length;

          return (
            <Card key={plan.id as string} className={`glass border-0 ${plan.unlocked ? "border-l-4 border-l-emerald-500" : ""}`}>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{plan.name as string}</h2>
                    {plan.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{plan.description as string}</p>
                    ) : null}
                  </div>
                  {plan.unlocked ? (
                    <Badge className="gap-1 bg-emerald-500/15 text-emerald-500">
                      <CheckCircle2 className="size-3.5" /> Unlocked
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <Lock className="size-3.5" /> {done}/{tasks.length}
                    </Badge>
                  )}
                </div>

                <div className="space-y-3">
                  {tasks.map((task) => {
                    const pct = Math.min(100, Math.round((task.progress / task.target_value) * 100));
                    return (
                      <div key={task.id} className="rounded-xl border border-border/50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {TASK_TYPE_LABEL[task.task_type] ?? task.task_type}
                              {task.description ? ` · ${task.description}` : ""}
                            </p>
                          </div>
                          {task.completed ? (
                            <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                          ) : task.task_type === "custom" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={toggleCustom.isPending}
                              onClick={() =>
                                toggleCustom.mutate({ taskId: task.id, completed: true })
                              }
                            >
                              Mark done
                            </Button>
                          ) : null}
                        </div>
                        {task.task_type !== "custom" ? (
                          <>
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-gold/60 to-gold"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="mt-1 text-right text-[11px] text-muted-foreground">
                              {Math.floor(task.progress).toLocaleString()} / {task.target_value.toLocaleString()}
                            </p>
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {!plan.unlocked ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Sparkles className="size-3.5 text-gold" /> Finish every task above to unlock
                    this plan for the whole server.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
