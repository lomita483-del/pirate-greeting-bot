import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, MessageSquare, Mic, Users } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getStatahoyOverview } from "@/lib/statahoy.functions";

export const Route = createFileRoute("/statahoy/$guildId")({
  component: StatahoyDashboard,
});

function humanizeSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
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

function StatahoyDashboard() {
  const { guildId } = Route.useParams();
  const [days, setDays] = useState(14);

  const { data, isLoading, error } = useQuery({
    queryKey: ["statahoy-overview", guildId, days],
    queryFn: () => getStatahoyOverview({ data: { guildId, days } }),
  });

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6">
        <div className="flex items-center gap-2">
          <Link to="/statahoy" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em]">
            <BarChart3 className="h-4 w-4 text-primary" />
            Statahoy
          </Link>
          {data?.guild.name && (
            <span className="text-sm text-muted-foreground">/ {data.guild.name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild size="sm" variant="outline">
            <Link to="/statahoy">Switch server</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        {error && (
          <div className="glass rounded-2xl p-6 text-sm text-destructive">
            {(error as Error).message || "Could not load analytics for this server."}
          </div>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Loading analytics…</p>}

        {data && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={MessageSquare} label="Messages" value={data.totalMessages.toLocaleString()} />
              <StatCard icon={Mic} label="Voice time" value={humanizeSeconds(data.totalVoiceSeconds)} />
              <StatCard
                icon={Users}
                label="Members now"
                value={data.memberCount !== null ? data.memberCount.toLocaleString() : "—"}
              />
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
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      fill="url(#msgFill)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <RankTable
                title="Top message senders"
                rows={data.topUsers}
                format={(v) => v.toLocaleString()}
                label={(row) => row.name ?? row.id}
              />
              <RankTable
                title="Top voice members"
                rows={data.topVoiceUsers}
                format={humanizeSeconds}
                label={(row) => row.name ?? row.id}
              />
              <RankTable
                title="Top channels"
                rows={data.topChannels}
                format={(v) => v.toLocaleString()}
                label={(row) => `#${row.id}`}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
