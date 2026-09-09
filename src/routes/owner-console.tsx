import { useQuery } from "@tanstack/react-query";
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
  Edit2,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { AhoyWordmark } from "@/components/ahoy/brand";
import { NotificationsPanel } from "@/components/admin/notifications-panel";
import { ServersPanel } from "@/components/admin/servers-panel";
import { StaffPanel } from "@/components/admin/staff-panel";
import { UserManager } from "@/components/admin/user-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminContext, getAdminOverview } from "@/lib/admin.functions";

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

function PlansManagementPanel() {
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [selectedPlanForEdit, setSelectedPlanForEdit] = useState<string | null>(null);
  const [selectedPlanForTasks, setSelectedPlanForTasks] = useState<string | null>(null);

  // Mock data - replace with actual API calls
  const plans = [
    {
      id: "plan-1",
      name: "Basic Plan",
      tier: "basic",
      description: "Entry level features with 3-5 tasks",
      taskCount: 4,
      tasksCompleted: 0,
    },
    {
      id: "plan-2",
      name: "Premium Plan",
      tier: "premium",
      description: "Advanced features with 5-7 tasks",
      taskCount: 6,
      tasksCompleted: 0,
    },
    {
      id: "plan-3",
      name: "Elite Plan",
      tier: "elite",
      description: "Full suite of features with 7-10 tasks",
      taskCount: 8,
      tasksCompleted: 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Plans Management</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage premium unlock plans. Each plan can have 3-10 tasks linked to Discord activities.
          </p>
        </div>
        <Button 
          onClick={() => setShowCreatePlan(true)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" /> Create Plan
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className="glass rounded-2xl p-6 border-l-4 border-gold/50 space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-1">{plan.name}</h3>
              <p className="text-sm text-muted-foreground">{plan.description}</p>
              <div className="mt-2">
                <Badge variant="outline" className="capitalize">{plan.tier}</Badge>
              </div>
            </div>

            <div className="bg-surface/50 rounded p-3">
              <p className="text-xs text-muted-foreground mb-1">Tasks</p>
              <p className="text-lg font-semibold">{plan.tasksCompleted}/{plan.taskCount}</p>
              <div className="mt-2 w-full bg-background rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                  style={{ width: `${(plan.tasksCompleted / plan.taskCount) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setSelectedPlanForEdit(plan.id)}
                className="flex-1 gap-1"
              >
                <Edit2 className="w-3 h-3" /> Edit
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setSelectedPlanForTasks(plan.id)}
                className="flex-1"
              >
                <Coins className="w-3 h-3" /> Manage Tasks
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Task Management Section */}
      {selectedPlanForTasks && (
        <TaskManagementSection 
          planId={selectedPlanForTasks}
          onClose={() => setSelectedPlanForTasks(null)}
        />
      )}

      {/* Plan Info Section */}
      <div className="glass rounded-2xl p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" /> Plan Configuration Guide
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm mb-2">📋 Task Types</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Type 1:</strong> Message activity (daily messages)</li>
                <li>• <strong>Type 2:</strong> Voice activity (voice hours/minutes)</li>
                <li>• <strong>Type 4:</strong> Reaction activity (emoji reactions)</li>
              </ul>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm mb-2">✅ Auto-Tracking</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ Bot automatically tracks Discord activities</li>
                <li>✓ Tasks complete when targets are reached</li>
                <li>✓ Plans unlock when all tasks done</li>
                <li>✓ Real-time progress updates</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskManagementSection({ planId, onClose }: { planId: string; onClose: () => void }) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    activityType: 1,
    targetValue: 10,
  });

  // Mock tasks data
  const tasks = [
    {
      id: "task-1",
      title: "Send 50 Messages",
      description: "Post 50 messages in any channel",
      activityType: 1,
      targetValue: 50,
      currentProgress: 0,
      isCompleted: false,
    },
    {
      id: "task-2",
      title: "Join Voice for 1 Hour",
      description: "Spend 1 hour in voice channels",
      activityType: 2,
      targetValue: 60,
      currentProgress: 0,
      isCompleted: false,
    },
  ];

  const handleAddTask = () => {
    // TODO: Call API to add task
    setShowAddTask(false);
    setNewTask({ title: "", description: "", activityType: 1, targetValue: 10 });
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-4 border-2 border-gold/30">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Tasks for Plan</h3>
        <div className="flex gap-2">
          <Button 
            size="sm"
            onClick={() => setShowAddTask(!showAddTask)}
            className="gap-2"
          >
            <Plus className="w-3 h-3" /> Add Task
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>

      {showAddTask && (
        <div className="bg-surface/50 rounded-lg p-4 space-y-3 border border-border">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Task Title</label>
            <input
              type="text"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="e.g., Send 50 Messages"
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Description</label>
            <input
              type="text"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              placeholder="Brief description of the task"
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Activity Type</label>
              <select
                value={newTask.activityType}
                onChange={(e) => setNewTask({ ...newTask, activityType: parseInt(e.target.value) })}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm"
              >
                <option value={1}>Type 1 - Messages</option>
                <option value={2}>Type 2 - Voice</option>
                <option value={4}>Type 4 - Reactions</option>
              </select>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Target Value</label>
              <input
                type="number"
                value={newTask.targetValue}
                onChange={(e) => setNewTask({ ...newTask, targetValue: parseInt(e.target.value) })}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddTask} className="flex-1">
              Add Task
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setShowAddTask(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="bg-surface/50 rounded-lg p-4 border border-border space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-semibold">{task.title}</h4>
                <p className="text-sm text-muted-foreground">{task.description}</p>
              </div>
              <Button 
                size="sm" 
                variant="ghost"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Type {task.activityType}</span>
              <span>{task.currentProgress}/{task.targetValue}</span>
              <span>{task.isCompleted ? "✅ Complete" : "⏳ In Progress"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
