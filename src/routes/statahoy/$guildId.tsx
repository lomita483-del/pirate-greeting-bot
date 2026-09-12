import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bot,
  Clock3,
  MessageSquare,
  Mic,
  Search,
  Users,
  Wifi,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getStatahoyOverview, getStatahoyUserActivity } from "@/lib/statahoy.functions";

export const Route = createFileRoute("/statahoy/$guildId")({
  component: StatahoyDashboard,
});

type ActivityUser = {
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  joinedAt: string | null;
  leftAt: string | null;
  lastSeenAt: string | null;
  lastOnlineStatus: string;
  lastMessageAt: string | null;
  lastMessageContent: string | null;
  lastMessageChannelId: string | null;
  lastCommandAt: string | null;
  lastCommandName: string | null;
  commandCount: number;
  voiceSeconds: number;
  voiceSessions: number;
  lastVoiceJoinAt: string | null;
  lastVoiceLeaveAt: string | null;
};

function humanizeSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function relative(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const diff = Math.round((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${Math.max(diff, 0)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fullDate(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function statusLabel(status: string): string {
  if (status === "online") return "Online";
  if (status === "idle") return "Idle";
  if (status === "dnd") return "Do Not Disturb";
  if (status === "offline") return "Offline";
  return status || "Unknown";
}

function statusClass(status: string): string {
  if (status === "online") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (status === "idle") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (status === "dnd") return "bg-red-500/15 text-red-400 border-red-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MessageSquare;
  label: string;
  value: string;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function RankTable({
  title,
  rows,
  format,
  label,
}: {
  title: string;
  rows: Array<{ id: string; value: number; name?: string }>;
  format: (value: number) => string;
  label: (row: { id: string; name?: string }) => string;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No tracked activity yet in this window.</p>
      ) : (
        <ol className="mt-4 space-y-2 text-sm">
          {rows.map((row, index) => (
            <li key={row.id} className="flex items-center justify-between gap-3">
              <span className="truncate text-muted-foreground">
                <span className="mr-2 text-foreground">{index + 1}.</span>
                {label(row)}
              </span>
              <span className="shrink-0 font-medium">{format(row.value)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ActivityCard({ user }: { user: ActivityUser }) {
  const initials = user.displayName.slice(0, 2).toUpperCase();
  return (
    <article className="glass overflow-hidden rounded-2xl p-5 transition-colors hover:border-primary/30">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {user.avatar ? (
            <img src={user.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-semibold">{user.displayName}</h3>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusClass(user.lastOnlineStatus)}`}>
                {statusLabel(user.lastOnlineStatus)}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">@{user.username} · {user.userId}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/30 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Last active</span>
          <div className="mt-1 font-medium">{relative(user.lastSeenAt)}</div>
          {user.lastSeenAt && <div className="text-muted-foreground">{fullDate(user.lastSeenAt)}</div>}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border/60 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><MessageSquare className="h-3.5 w-3.5" /> Messages</div>
          <p className="mt-2 text-lg font-semibold">Tracked in Statahoy</p>
          <p className="text-xs text-muted-foreground">Last: {relative(user.lastMessageAt)}</p>
        </div>
        <div className="rounded-xl border border-border/60 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Bot className="h-3.5 w-3.5" /> Bot usage</div>
          <p className="mt-2 text-lg font-semibold">{user.commandCount.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Last: {user.lastCommandName ? `/${user.lastCommandName} · ${relative(user.lastCommandAt)}` : "Never"}</p>
        </div>
        <div className="rounded-xl border border-border/60 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Mic className="h-3.5 w-3.5" /> Voice</div>
          <p className="mt-2 text-lg font-semibold">{humanizeSeconds(user.voiceSeconds)}</p>
          <p className="text-xs text-muted-foreground">{user.voiceSessions.toLocaleString()} sessions · joined {relative(user.lastVoiceJoinAt)}</p>
        </div>
        <div className="rounded-xl border border-border/60 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Joined server</div>
          <p className="mt-2 text-sm font-semibold">{user.joinedAt ? fullDate(user.joinedAt) : "Unknown"}</p>
          <p className="text-xs text-muted-foreground">{user.leftAt ? `Left ${relative(user.leftAt)}` : "Currently a member"}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-background/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium"><MessageSquare className="h-3.5 w-3.5 text-primary" /> Last message sent</div>
            <span className="text-xs text-muted-foreground">{relative(user.lastMessageAt)}</span>
          </div>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {user.lastMessageContent || "No text message recorded yet."}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/20 p-4">
          <div className="flex items-center gap-2 text-xs font-medium"><Wifi className="h-3.5 w-3.5 text-primary" /> Voice history</div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Last join</span><p className="font-medium">{fullDate(user.lastVoiceJoinAt)}</p></div>
            <div><span className="text-muted-foreground">Last leave</span><p className="font-medium">{fullDate(user.lastVoiceLeaveAt)}</p></div>
          </div>
        </div>
      </div>
    </article>
  );
}

function StatahoyDashboard() {
  const { guildId } = Route.useParams();
  const [days, setDays] = useState(14);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"last_seen" | "messages" | "commands" | "voice">("last_seen");

  const { data, isLoading, error } = useQuery({
    queryKey: ["statahoy-overview", guildId, days],
    queryFn: () => getStatahoyOverview({ data: { guildId, days } }),
  });

  const { data: activityData, isLoading: activityLoading, error: activityError } = useQuery({
    queryKey: ["statahoy-user-activity", guildId, search, sort],
    queryFn: () => getStatahoyUserActivity({ data: { guildId, search, sort, limit: 100 } }),
  });

  const users = useMemo(() => (activityData?.users ?? []) as ActivityUser[], [activityData]);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-6">
        <div className="flex items-center gap-2">
          <Link to="/statahoy" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em]">
            <BarChart3 className="h-4 w-4 text-primary" />
            Statahoy
          </Link>
          {data?.guild.name && <span className="text-sm text-muted-foreground">/ {data.guild.name}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild size="sm" variant="outline"><Link to="/statahoy">Switch server</Link></Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-24">
        {error && <div className="glass rounded-2xl p-6 text-sm text-destructive">{(error as Error).message || "Could not load analytics."}</div>}
        {isLoading && <p className="text-sm text-muted-foreground">Loading analytics…</p>}

        {data && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={MessageSquare} label="Messages" value={data.totalMessages.toLocaleString()} />
              <StatCard icon={Mic} label="Voice time" value={humanizeSeconds(data.totalVoiceSeconds)} />
              <StatCard icon={Users} label="Members now" value={data.memberCount !== null ? data.memberCount.toLocaleString() : "—"} />
            </div>

            <div className="glass mt-6 rounded-2xl p-5">
              <h3 className="text-sm font-semibold">Message activity</h3>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.messageSeries}>
                    <defs>
                      <linearGradient id="msgFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} minTickGap={20} />
                    <YAxis tick={{ fontSize: 11 }} width={36} allowDecimals={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#msgFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <RankTable title="Top message senders" rows={data.topUsers} format={(v) => v.toLocaleString()} label={(row) => row.name ?? row.id} />
              <RankTable title="Top voice members" rows={data.topVoiceUsers} format={humanizeSeconds} label={(row) => row.name ?? row.id} />
              <RankTable title="Top channels" rows={data.topChannels} format={(v) => v.toLocaleString()} label={(row) => `#${row.id}`} />
            </div>

            <section className="mt-8">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">User Activity</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Last online, messages, bot usage, voice activity and the last message for each tracked member.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search member or ID" className="pl-9 sm:w-64" />
                  </div>
                  <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                    <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last_seen">Last active</SelectItem>
                      <SelectItem value="commands">Bot usage</SelectItem>
                      <SelectItem value="messages">Last message</SelectItem>
                      <SelectItem value="voice">Voice time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {activityError && <div className="glass rounded-2xl p-5 text-sm text-destructive">{(activityError as Error).message || "Could not load user activity."}</div>}
              {activityLoading && <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Loading user activity…</div>}
              {!activityLoading && !activityError && users.length === 0 && (
                <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">No tracked users match your search. Tracking begins when the bot observes activity.</div>
              )}
              <div className="space-y-4">
                {users.map((user) => <ActivityCard key={user.userId} user={user} />)}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
