import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock3,
  Flame,
  MessageSquare,
  Mic,
  Search,
  User,
  Users,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStatahoyOverview, getStatahoyUserActivity } from "@/lib/statahoy.functions";

export const Route = createFileRoute("/statahoy/$guildId/activity")({ component: StatahoyUserActivityPage });

type ActivityUser = {
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  joinedAt: string | null;
  leftAt: string | null;
  lastSeenAt: string | null;
  lastOnlineAt: string | null;
  lastOnlineStatus: string;
  messageCount: number;
  lastMessageAt: string | null;
  lastMessageContent: string | null;
  commandCount: number;
  lastCommandAt: string | null;
  lastCommandName: string | null;
  voiceSeconds: number;
  voiceSessions: number;
  lastVoiceJoinAt: string | null;
  lastVoiceLeaveAt: string | null;
  rollCallStreak: number;
  rollCallLongestStreak: number;
  lastRollCallAt: string | null;
};

function humanizeSeconds(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (total < 60) return `${Math.max(0, Math.floor(total))}s`;
  return `${m}m`;
}

function relative(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const diff = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fullDate(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function statusLabel(status: string) {
  if (status === "online") return "Online";
  if (status === "idle") return "Idle";
  if (status === "dnd") return "Do Not Disturb";
  if (status === "offline") return "Offline";
  return status || "Unknown";
}

function statusClass(status: string) {
  if (status === "online") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (status === "idle") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (status === "dnd") return "bg-red-500/15 text-red-400 border-red-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function ActivityCard({ user }: { user: ActivityUser }) {
  const initials = user.displayName.slice(0, 2).toUpperCase();
  return (
    <article className="glass overflow-hidden rounded-2xl p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {user.avatar ? <img src={user.avatar} alt="" className="h-14 w-14 rounded-full object-cover" /> : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">{initials}</div>}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-lg font-semibold">{user.displayName}</h2><span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusClass(user.lastOnlineStatus)}`}>{statusLabel(user.lastOnlineStatus)}</span></div>
            <p className="truncate text-sm text-muted-foreground">@{user.username}</p>
            <p className="truncate text-xs text-muted-foreground">ID: {user.userId}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/30 px-4 py-3 text-xs"><span className="text-muted-foreground">Last active</span><div className="mt-1 font-medium">{relative(user.lastSeenAt)}</div><div className="text-muted-foreground">{fullDate(user.lastSeenAt)}</div></div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-border/60 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Wifi className="h-3.5 w-3.5" />Last online</div><p className="mt-2 font-semibold">{relative(user.lastOnlineAt)}</p></div>
        <div className="rounded-xl border border-border/60 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><MessageSquare className="h-3.5 w-3.5" />Messages</div><p className="mt-2 font-semibold">{user.messageCount.toLocaleString()}</p><p className="text-xs text-muted-foreground">Last {relative(user.lastMessageAt)}</p></div>
        <div className="rounded-xl border border-border/60 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Bot className="h-3.5 w-3.5" />Bot usage</div><p className="mt-2 font-semibold">{user.commandCount.toLocaleString()}</p><p className="text-xs text-muted-foreground">{user.lastCommandName ? `/${user.lastCommandName}` : "Never used"}</p></div>
        <div className="rounded-xl border border-border/60 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Mic className="h-3.5 w-3.5" />Voice</div><p className="mt-2 font-semibold">{humanizeSeconds(user.voiceSeconds)}</p><p className="text-xs text-muted-foreground">{user.voiceSessions.toLocaleString()} sessions</p></div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3"><div className="flex items-center gap-2 text-xs text-primary"><Flame className="h-3.5 w-3.5" />Roll Call</div><p className="mt-2 font-semibold">{user.rollCallStreak} day{user.rollCallStreak === 1 ? "" : "s"}</p><p className="text-xs text-muted-foreground">Best {user.rollCallLongestStreak}</p></div>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-background/20 p-4 lg:col-span-2"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs font-medium"><MessageSquare className="h-3.5 w-3.5 text-primary" />Last message sent</div><span className="text-xs text-muted-foreground">{relative(user.lastMessageAt)}</span></div><p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{user.lastMessageContent || "No text message recorded yet."}</p></div>
        <div className="rounded-xl border border-border/60 bg-background/20 p-4"><div className="flex items-center gap-2 text-xs font-medium"><Clock3 className="h-3.5 w-3.5 text-primary" />Server membership</div><div className="mt-3 space-y-2 text-sm"><div><span className="text-muted-foreground">Joined</span><p className="font-medium">{fullDate(user.joinedAt)}</p></div><div><span className="text-muted-foreground">Status</span><p className="font-medium">{user.leftAt ? `Left ${relative(user.leftAt)}` : "Currently a member"}</p></div></div></div>
      </div>
      <div className="mt-3 rounded-xl border border-primary/15 bg-primary/[0.03] p-4"><div className="flex items-center gap-2 text-xs font-medium"><Flame className="h-3.5 w-3.5 text-primary" />Roll Call Check-In</div><div className="mt-3 flex flex-wrap gap-8 text-sm"><div><span className="text-muted-foreground">Current streak</span><p className="font-semibold">{user.rollCallStreak} day{user.rollCallStreak === 1 ? "" : "s"}</p></div><div><span className="text-muted-foreground">Longest streak</span><p className="font-semibold">{user.rollCallLongestStreak} day{user.rollCallLongestStreak === 1 ? "" : "s"}</p></div><div><span className="text-muted-foreground">Last check-in</span><p className="font-semibold">{fullDate(user.lastRollCallAt)}</p></div><div><span className="text-muted-foreground">Last voice join</span><p className="font-semibold">{fullDate(user.lastVoiceJoinAt)}</p></div></div></div>
    </article>
  );
}

function UserTable({ users }: { users: ActivityUser[] }) {
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="border-b border-border/60 p-5"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h2 className="font-semibold">Member Directory</h2></div><p className="mt-1 text-sm text-muted-foreground">Simple member information for quick reference.</p></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border/60 bg-background/40 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Username</th><th className="px-5 py-3">User ID</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Messages</th><th className="px-5 py-3">Last active</th></tr></thead>
          <tbody className="divide-y divide-border/50">
            {users.map((user) => <tr key={user.userId} className="transition-colors hover:bg-muted/30"><td className="px-5 py-3 font-medium">{user.displayName}</td><td className="px-5 py-3 text-muted-foreground">@{user.username}</td><td className="px-5 py-3 font-mono text-xs text-muted-foreground">{user.userId}</td><td className="px-5 py-3"><span className={`rounded-full border px-2 py-1 text-[11px] ${statusClass(user.lastOnlineStatus)}`}>{statusLabel(user.lastOnlineStatus)}</span></td><td className="px-5 py-3">{user.messageCount.toLocaleString()}</td><td className="px-5 py-3 text-muted-foreground">{relative(user.lastSeenAt)}</td></tr>)}
            {users.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No members found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatahoyUserActivityContent({ guildId }: { guildId: string }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"last_seen" | "messages" | "commands" | "voice">("last_seen");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: overview } = useQuery({ queryKey: ["statahoy-overview", guildId, "activity-page"], queryFn: () => getStatahoyOverview({ data: { guildId, days: 14 } }) });
  const { data: activityData, isLoading, error } = useQuery({ queryKey: ["statahoy-user-activity", guildId, search, sort], queryFn: () => getStatahoyUserActivity({ data: { guildId, search, sort, limit: 100 } }) });

  const users = useMemo(() => (activityData?.users ?? []) as ActivityUser[], [activityData]);
  const selectedUser = users.find((user) => user.userId === selectedUserId) ?? null;
  const trackedMessages = users.reduce((sum, user) => sum + user.messageCount, 0);
  const trackedCommands = users.reduce((sum, user) => sum + user.commandCount, 0);
  const trackedVoice = users.reduce((sum, user) => sum + user.voiceSeconds, 0);
  const activeStreaks = users.filter((user) => user.rollCallStreak > 0).length;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur-xl"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4"><div className="flex items-center gap-2"><Link to="/statahoy/$guildId" params={{ guildId }} className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em]"><BarChart3 className="h-4 w-4 text-primary" />Statahoy</Link>{overview?.guild.name && <span className="text-sm text-muted-foreground">/ {overview.guild.name} / User Activity</span>}</div><Button asChild variant="outline" size="sm"><Link to="/statahoy/$guildId" params={{ guildId }}>← Back to Statahoy</Link></Button></div></header>
      <main className="mx-auto max-w-7xl px-6 pb-24"><div className="pt-6">
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5"><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /><h1 className="text-xl font-semibold">Discord User Activity</h1></div><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Select a member from the name list to open their detailed activity card. A simple member table is provided below for quick reference.</p><div className="mt-5 grid gap-3 sm:grid-cols-4"><div className="rounded-xl border border-border/60 bg-background/40 p-4"><div className="text-xs text-muted-foreground">Tracked members</div><div className="mt-1 text-2xl font-semibold">{users.length.toLocaleString()}</div></div><div className="rounded-xl border border-border/60 bg-background/40 p-4"><div className="text-xs text-muted-foreground">Messages tracked</div><div className="mt-1 text-2xl font-semibold">{trackedMessages.toLocaleString()}</div></div><div className="rounded-xl border border-border/60 bg-background/40 p-4"><div className="text-xs text-muted-foreground">Bot commands</div><div className="mt-1 text-2xl font-semibold">{trackedCommands.toLocaleString()}</div></div><div className="rounded-xl border border-border/60 bg-background/40 p-4"><div className="text-xs text-muted-foreground">Voice / Roll Call</div><div className="mt-1 text-2xl font-semibold">{humanizeSeconds(trackedVoice)} · {activeStreaks}</div></div></div></div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <section className="glass rounded-2xl p-4"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h2 className="font-semibold">User Names</h2></div><p className="mt-1 text-xs text-muted-foreground">Click any name to expose the full activity card.</p><div className="relative mt-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or username..." className="pl-9" /></div><div className="mt-3 space-y-1">{users.map((user) => { const active = selectedUserId === user.userId; return <button key={user.userId} type="button" onClick={() => setSelectedUserId(user.userId)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${active ? "border-primary/40 bg-primary/10" : "border-transparent hover:border-border/60 hover:bg-muted/30"}`}>{user.avatar ? <img src={user.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{user.displayName.slice(0, 2).toUpperCase()}</div>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user.displayName}</p><p className="truncate text-xs text-muted-foreground">@{user.username}</p></div>{active && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}</button>; })}{!isLoading && users.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">No users found.</p>}</div></section>

          <section className="min-w-0"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Selected User</h2><p className="text-sm text-muted-foreground">Choose a name from the list to view details.</p></div><Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}><SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="last_seen">Last active</SelectItem><SelectItem value="messages">Messages</SelectItem><SelectItem value="commands">Bot usage</SelectItem><SelectItem value="voice">Voice time</SelectItem></SelectContent></Select></div>{isLoading && <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Loading user activity…</div>}{error && <div className="glass rounded-2xl p-6 text-sm text-destructive">{(error as Error).message || "Could not load user activity."}</div>}{!isLoading && !error && (selectedUser ? <ActivityCard user={selectedUser} /> : <div className="glass rounded-2xl p-10 text-center"><User className="mx-auto h-8 w-8 text-muted-foreground" /><h3 className="mt-3 font-semibold">Select a user</h3><p className="mt-1 text-sm text-muted-foreground">Click any member name on the left to expose their complete activity card.</p></div>)}</section>
        </div>
        <div className="mt-6"><UserTable users={users} /></div>
      </div></main>
    </div>
  );
}

function StatahoyUserActivityPage() {
  const { guildId } = Route.useParams();
  return <StatahoyUserActivityContent guildId={guildId} />;
}
