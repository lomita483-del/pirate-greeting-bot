import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bell,
  ChevronLeft,
  Coins,
  Gauge,
  LifeBuoy,
  Server,
  ShieldBan,
  ShieldCheck,
  Sparkles,
  Users,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AhoyWordmark } from "@/components/ahoy/brand";
import { NotificationsPanel } from "@/components/admin/notifications-panel";
import { ServersPanel } from "@/components/admin/servers-panel";
import { StaffPanel } from "@/components/admin/staff-panel";
import { UserManager } from "@/components/admin/user-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FEATURE_KEYS, getAdminContext, getAdminOverview } from "@/lib/admin.functions";
import {
  createPlan,
  createPlanTask,
  deletePlan,
  deletePlanTask,
  listPlansAdmin,
  TASK_TYPES,
  type TaskType,
} from "@/lib/plans.functions";

export const Route = createFileRoute("/owner-console")({
  head: () => ({
    meta: [
      { title: "Owner console — !PIRATE" },
      {
        name: "description",
        content:
          "Platform owner console for !PIRATE: monitor sign-ins, manage users and plans, review servers and broadcast notifications.",
      },
      { property: "og:title", content: "Owner console — !PIRATE" },
      {
        property: "og:description",
        content: "Monitor users, servers and notifications across every !PIRATE deployment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminConsole,
});

const TABS = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "users", label: "Users", icon: Users },
  { key: "servers", label: "Servers", icon: Server },
  { key: "plans", label: "Plans", icon: Coins },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "staff", label: "Staff", icon: ShieldCheck },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function AdminConsole() {
  const [tab, setTab] = useState<TabKey>("overview");
  const { data: context, isPending } = useQuery({
    queryKey: ["admin", "context"],
    queryFn: () => getAdminContext(),
  });

  if (isPending) {
    return <p className="p-10 text-sm text-muted-foreground">Checking your clearance…</p>;
  }

  if (!context?.signedIn) {
    return (
      <Gate title="Sign in required">
        <Button asChild>
          <a href="/api/public/auth/discord/start">Sign in with Discord</a>
        </Button>
      </Gate>
    );
  }

  if (!context.role) {
    return (
      <Gate title="Owner console">
        <p className="text-sm text-muted-foreground">
          This area is restricted to the !PIRATE platform owner.
        </p>
        <Button asChild variant="outline">
          <Link to="/dashboard">Back to your servers</Link>
        </Button>
      </Gate>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="hairline sticky top-0 z-20 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link to="/dashboard">
            <AhoyWordmark subtitle="Command centre" />
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.12em] transition-colors ${
                  tab === key
                    ? "border-gold/60 bg-gold/15 text-gold"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
            <Button asChild size="sm" variant="outline">
              <Link to="/dashboard">
                <ChevronLeft className="mr-1 size-4" /> Dashboard
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-6">
        <section className="relative overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-r from-background via-surface to-background p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[url('/favicon.png')] bg-contain bg-right bg-no-repeat opacity-20"
          />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Welcome</p>
            <h1 className="font-display text-3xl font-semibold tracking-[0.12em] text-gold sm:text-4xl">
              ADMINISTRATOR
            </h1>
            <p className="mt-1 font-display text-2xl tracking-[0.16em] text-tide">
              {context.user?.username?.toUpperCase() ?? "OWNER"}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              You have full control over the !PIRATE platform.
            </p>
            <p className="text-sm font-medium text-gold">Monitor. Manage. Restrict.</p>
          </div>
        </section>

        <section className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              Command centre
            </p>
            <h2 className="font-display text-xl tracking-wide">Owner console</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-gold/15 text-gold hover:bg-gold/20">
              <ShieldCheck className="mr-1 size-3" /> {context.role}
            </Badge>
            <Chip icon={ShieldBan} label="Bans" onClick={() => setTab("users")} />
            <Chip icon={Activity} label="Activity" onClick={() => setTab("overview")} />
            <Chip icon={Bell} label="Broadcast" onClick={() => setTab("notifications")} />
          </div>
        </section>

        {tab === "overview" ? <Overview onJump={setTab} /> : null}
        {tab === "users" ? <UserManager /> : null}
        {tab === "servers" ? <ServersPanel /> : null}
        {tab === "plans" ? <PlansManagementPanel /> : null}
        {tab === "notifications" ? <NotificationsPanel /> : null}
        {tab === "staff" ? <StaffPanel canEdit={context.role === "owner"} /> : null}
      </main>
    </div>
  );
}

function Chip({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Bell;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-gold/50 hover:text-gold"
    >
      <Icon className="size-3" />
      {label}
    </button>
  );
}

function Gate({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <AhoyWordmark subtitle="Owner console" />
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}

function Overview({ onJump }: { onJump: (tab: TabKey) => void }) {
  const { data, isPending } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => getAdminOverview(),
  });

  if (isPending || !data) {
    return <p className="text-sm text-muted-foreground">Reading the charts…</p>;
  }

  const stats = [
    { label: "Registered users", hint: "all time", value: data.totalUsers, icon: Users },
    { label: "Active today", hint: "last 24h", value: data.activeToday, icon: Gauge },
    { label: "Banned", hint: "site access", value: data.bannedUsers, icon: ShieldBan },
    { label: "Servers", hint: "linked", value: data.totalServers, icon: Server },
    { label: "Bot live in", hint: "guilds", value: data.liveServers, icon: Sparkles },
    { label: "Members reached", hint: "total", value: data.reachedMembers, icon: Users },
    { label: "Mod actions", hint: "last 7 days", value: data.moderationLast7Days, icon: ShieldCheck },
    { label: "Open tickets", hint: "awaiting", value: data.openTickets, icon: LifeBuoy },
    { label: "Tracked profiles", hint: "xp + economy", value: data.trackedProfiles, icon: Coins },
    { label: "Queued notices", hint: "pending", value: data.pendingNotifications, icon: Bell },
  ];

  const quickActions: { label: string; icon: typeof Bell; tab: TabKey }[] = [
    { label: "Users", icon: Users, tab: "users" },
    { label: "Limit features", icon: ShieldBan, tab: "users" },
    { label: "Bans", icon: ShieldBan, tab: "users" },
    { label: "Plans", icon: Coins, tab: "plans" },
    { label: "Servers", icon: Server, tab: "servers" },
    { label: "Broadcast", icon: Bell, tab: "notifications" },
    { label: "Notices", icon: Bell, tab: "notifications" },
    { label: "Staff", icon: ShieldCheck, tab: "staff" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="glass rounded-2xl border-gold/15 p-4 transition-colors hover:border-gold/40"
          >
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-gold/15 text-gold">
                <stat.icon className="size-3.5" />
              </span>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {stat.label}
                </p>
                <p className="text-[10px] text-muted-foreground/70">{stat.hint}</p>
              </div>
            </div>
            <p className="mt-3 font-display text-2xl font-semibold text-gold">
              {stat.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          Quick actions
        </h2>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {quickActions.map((action, index) => (
            <button
              key={`${action.label}-${index}`}
              onClick={() => onJump(action.tab)}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface-2/40 px-2 py-4 text-center text-[11px] text-muted-foreground transition-colors hover:border-gold/50 hover:text-gold"
            >
              <action.icon className="size-4 text-gold" />
              {action.label}
            </button>
          ))}
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Activity className="size-4 text-gold" /> Recent dashboard activity
        </h2>
        <ul className="mt-4 space-y-2">
          {data.recentActivity.length === 0 ? (
            <li className="text-sm text-muted-foreground">No activity recorded yet.</li>
          ) : null}
          {data.recentActivity.map((entry, index) => (
            <li
              key={`${entry.created_at}-${index}`}
              className="hairline flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">
                  {entry.discord_username ?? entry.discord_user_id}
                </span>{" "}
                <span className="text-muted-foreground">{entry.action}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(entry.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Plans — real data, wired to src/lib/plans.functions.ts              */
/* ------------------------------------------------------------------ */

function PlansManagementPanel() {
  const queryClient = useQueryClient();
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [selectedPlanForTasks, setSelectedPlanForTasks] = useState<string | null>(null);
  const [newPlan, setNewPlan] = useState({ key: "", name: "", description: "", features: [] as string[] });

  const { data: plans, isPending } = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: () => listPlansAdmin(),
  });

  const createPlanMutation = useMutation({
    mutationFn: () =>
      createPlan({
        data: {
          key: newPlan.key.trim(),
          name: newPlan.name.trim(),
          description: newPlan.description.trim() || null,
          features: newPlan.features as never,
          sortOrder: plans?.length ?? 0,
          enabled: true,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });
      setShowCreatePlan(false);
      setNewPlan({ key: "", name: "", description: "", features: [] });
      toast.success("Plan created.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id: string) => deletePlan({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });
      toast.success("Plan deleted.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading plans…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Plans Management</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage premium unlock plans. Each plan can have 3-10 tasks linked to Discord activities.
          </p>
        </div>
        <Button onClick={() => setShowCreatePlan((v) => !v)} className="gap-2">
          <Plus className="w-4 h-4" /> Create Plan
        </Button>
      </div>

      {showCreatePlan ? (
        <div className="glass rounded-2xl p-5 space-y-3 border border-gold/30">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Key (slug)
              </label>
              <input
                value={newPlan.key}
                onChange={(e) => setNewPlan({ ...newPlan, key: e.target.value })}
                placeholder="e.g. growth"
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Name</label>
              <input
                value={newPlan.name}
                onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                placeholder="e.g. Growth Plan"
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Description</label>
            <input
              value={newPlan.description}
              onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Features this plan unlocks
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {FEATURE_KEYS.map((feature) => {
                const active = newPlan.features.includes(feature);
                return (
                  <button
                    key={feature}
                    type="button"
                    onClick={() =>
                      setNewPlan((p) => ({
                        ...p,
                        features: active
                          ? p.features.filter((f) => f !== feature)
                          : [...p.features, feature],
                      }))
                    }
                    className={`rounded-full border px-3 py-1 text-xs ${
                      active ? "border-gold bg-gold/15 text-gold" : "border-border text-muted-foreground"
                    }`}
                  >
                    {feature}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!newPlan.key || !newPlan.name || createPlanMutation.isPending}
              onClick={() => createPlanMutation.mutate()}
            >
              Save plan
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreatePlan(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(plans ?? []).map((plan) => {
          const tasks = (plan as Record<string, unknown>)["plan_tasks"] as unknown[];
          return (
            <div key={plan.id as string} className="glass rounded-2xl p-6 border-l-4 border-gold/50 space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-1">{plan.name as string}</h3>
                <p className="text-sm text-muted-foreground">{plan.description as string}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {((plan.features as string[]) ?? []).map((f) => (
                    <Badge key={f} variant="outline" className="text-[10px]">
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="bg-surface/50 rounded p-3">
                <p className="text-xs text-muted-foreground mb-1">Tasks</p>
                <p className="text-lg font-semibold">{tasks.length} / 10</p>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedPlanForTasks(plan.id as string)}
                  className="flex-1"
                >
                  <Coins className="w-3 h-3 mr-1" /> Manage Tasks
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Delete "${plan.name}"? This cannot be undone.`)) {
                      deletePlanMutation.mutate(plan.id as string);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {selectedPlanForTasks ? (
        <TaskManagementSection
          planId={selectedPlanForTasks}
          tasks={
            ((plans ?? []).find((p) => p.id === selectedPlanForTasks) as Record<string, unknown> | undefined)?.[
              "plan_tasks"
            ] as Array<Record<string, unknown>> ?? []
          }
          onClose={() => setSelectedPlanForTasks(null)}
        />
      ) : null}

      <div className="glass rounded-2xl p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" /> Plan Configuration Guide
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-sm mb-2">📋 Task Types</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>message_count:</strong> messages sent, tracked live by the bot</li>
              <li>• <strong>voice_minutes:</strong> time spent in voice, tracked live by the bot</li>
              <li>• <strong>reaction_count:</strong> reactions given, tracked live by the bot</li>
              <li>• <strong>member_count / boost_count / invite_count:</strong> server growth</li>
              <li>• <strong>daily_login_streak:</strong> consecutive days someone opens this server's dashboard</li>
              <li>• <strong>custom:</strong> ticked by hand by that server's own admins</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-2">✅ How it unlocks</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✓ Every task in a plan must complete</li>
              <li>✓ Unlock is per-server, not per-account</li>
              <li>✓ Progress updates live from the bot's own counters</li>
              <li>✓ Once unlocked, it stays unlocked</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskManagementSection({
  planId,
  tasks,
  onClose,
}: {
  planId: string;
  tasks: Array<Record<string, unknown>>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    taskType: "message_count" as TaskType,
    targetValue: 10,
  });

  const addTask = useMutation({
    mutationFn: () =>
      createPlanTask({
        data: {
          planId,
          title: newTask.title.trim(),
          description: newTask.description.trim() || null,
          taskType: newTask.taskType,
          targetValue: newTask.targetValue,
          sortOrder: tasks.length,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });
      setShowAddTask(false);
      setNewTask({ title: "", description: "", taskType: "message_count", targetValue: 10 });
      toast.success("Task added.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeTask = useMutation({
    mutationFn: (id: string) => deletePlanTask({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });
      toast.success("Task removed.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="glass rounded-2xl p-6 space-y-4 border-2 border-gold/30">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Tasks for Plan ({tasks.length}/10)</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => setShowAddTask((v) => !v)}
            disabled={tasks.length >= 10}
            className="gap-2"
          >
            <Plus className="w-3 h-3" /> Add Task
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {showAddTask ? (
        <div className="bg-surface/50 rounded-lg p-4 space-y-3 border border-border">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Task Title</label>
            <input
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="e.g., Send 50 Messages"
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Description</label>
            <input
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              placeholder="Brief description of the task"
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Task Type</label>
              <select
                value={newTask.taskType}
                onChange={(e) => setNewTask({ ...newTask, taskType: e.target.value as TaskType })}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm"
              >
                {TASK_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Target Value</label>
              <input
                type="number"
                min={1}
                value={newTask.targetValue}
                onChange={(e) => setNewTask({ ...newTask, targetValue: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!newTask.title || addTask.isPending}
              onClick={() => addTask.mutate()}
              className="flex-1"
            >
              Add Task
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAddTask(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task["id"] as string} className="bg-surface/50 rounded-lg p-4 border border-border space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-semibold">{task["title"] as string}</h4>
                {task["description"] ? (
                  <p className="text-sm text-muted-foreground">{task["description"] as string}</p>
                ) : null}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => removeTask.mutate(task["id"] as string)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>{task["task_type"] as string}</span>
              <span>target: {task["target_value"] as number}</span>
            </div>
          </div>
        ))}
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks yet — add 3 to 10 above.</p>
        ) : null}
      </div>
    </div>
  );
}
