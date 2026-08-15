import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getMemberProfile, getRanks, getServerStats } from "@/lib/ahoy.functions";

import { Field, SectionHeader } from "./fields";

function duration(seconds: number) {
  if (seconds <= 0) return "0m";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-secondary/30 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ServerStatsPanel({ guildId }: { guildId: string }) {
  const query = useQuery({
    queryKey: ["server-stats", guildId],
    queryFn: () => getServerStats({ data: { guildId } }),
  });

  if (query.isPending) return <Skeleton className="h-56 rounded-2xl" />;
  const stats = query.data;
  if (!stats) return null;

  const growth = stats.joins30d - stats.leaves30d;

  return (
    <Card className="glass border-0">
      <CardContent className="space-y-5 pt-6">
        <SectionHeader
          title="Server stats"
          description="Live figures from Discord plus everything AHOY has tracked for this crew."
          badge={stats.hasToken ? "live" : "bot token missing"}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Members"
            value={stats.members?.toLocaleString() ?? "—"}
            hint={stats.online ? `${stats.online.toLocaleString()} online` : undefined}
          />
          <Metric
            label="Boosts"
            value={`${stats.boosts}`}
            hint={`Tier ${stats.boostTier}`}
          />
          <Metric
            label="Channels"
            value={`${stats.channels.text + stats.channels.voice + stats.channels.stage}`}
            hint={`${stats.channels.text} text · ${stats.channels.voice} voice · ${stats.channels.category} categories`}
          />
          <Metric label="Roles" value={`${stats.roles}`} />
          <Metric
            label="Growth (30d)"
            value={`${growth >= 0 ? "+" : ""}${growth}`}
            hint={`${stats.joins30d} joins · ${stats.leaves30d} leaves`}
          />
          <Metric
            label="Voice time"
            value={duration(stats.voiceSeconds)}
            hint={`${stats.voiceSessions.toLocaleString()} sessions`}
          />
          <Metric
            label="Tracked messages"
            value={stats.trackedMessages.toLocaleString()}
          />
          <Metric
            label="This week"
            value={`${stats.activityThisWeek.toLocaleString()} events`}
            hint={`${stats.casesThisWeek} moderation cases`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function RanksPanel({ guildId }: { guildId: string }) {
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ["ranks", guildId, page],
    queryFn: () => getRanks({ data: { guildId, page } }),
  });

  const rows = query.data?.ranks ?? [];
  const total = query.data?.total ?? 0;
  const pageSize = query.data?.pageSize ?? 25;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card className="glass border-0">
      <CardContent className="space-y-5 pt-6">
        <SectionHeader
          title="Full rank list"
          description="Every ranked member, matching the /rank and /profile cards in Discord."
          badge={`${total} members`}
        />
        {query.isPending ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No XP tracked yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.user_id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 px-4 py-3 text-sm"
              >
                <Badge variant="outline" className="border-gold/40 text-gold">
                  #{row.rank}
                </Badge>
                <span className="font-medium">{row.username ?? row.user_id}</span>
                <span className="text-muted-foreground">
                  Level {row.level} · {Number(row.xp ?? 0).toLocaleString()} XP
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {Number(row.messages ?? 0).toLocaleString()} messages ·{" "}
                  {duration(row.voice_seconds)} voice
                </span>
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

export function MemberProfilePanel({ guildId }: { guildId: string }) {
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["member-profile", guildId, userId],
    queryFn: () => getMemberProfile({ data: { guildId, userId: userId as string } }),
    enabled: Boolean(userId),
  });

  const profile = query.data;
  const percent = profile
    ? Math.min(100, Math.round((profile.xpCurrent / profile.xpNeeded) * 100))
    : 0;

  return (
    <Card className="glass border-0">
      <CardContent className="space-y-5 pt-6">
        <SectionHeader
          title="Member profile"
          description="The same data as the /profile card in Discord — level, XP progress, rank, messages, voice time and recent cases."
        />
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Field label="User ID">
              <Input
                value={input}
                placeholder="123456789012345678"
                onChange={(event) => setInput(event.target.value)}
              />
            </Field>
          </div>
          <Button
            disabled={!/^\d{5,25}$/.test(input.trim())}
            onClick={() => setUserId(input.trim())}
          >
            Look up
          </Button>
        </div>

        {userId && query.isPending ? <Skeleton className="h-48 rounded-2xl" /> : null}

        {profile ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-lg font-semibold">
                {profile.member?.display_name ?? profile.member?.username ?? profile.userId}
              </span>
              <Badge variant="outline" className="border-primary/40 text-primary">
                Level {profile.level}
              </Badge>
              <Badge variant="outline" className="border-gold/40 text-gold">
                Rank #{profile.rank}
              </Badge>
            </div>
            <div className="space-y-1">
              <Progress value={percent} />
              <p className="text-xs text-muted-foreground">
                {profile.xpCurrent.toLocaleString()}/{profile.xpNeeded.toLocaleString()} XP to the
                next level · {profile.totalXp.toLocaleString()} total
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Messages" value={profile.messages.toLocaleString()} />
              <Metric
                label="Voice"
                value={duration(profile.voiceSeconds)}
                hint={`${profile.voiceSessions} sessions`}
              />
              <Metric
                label="Wallet"
                value={`${profile.balance.toLocaleString()}`}
                hint={`${profile.bank.toLocaleString()} banked`}
              />
              <Metric
                label="Joined server"
                value={
                  profile.member?.joined_at
                    ? new Date(profile.member.joined_at).toLocaleDateString()
                    : "—"
                }
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Recent cases</p>
              {profile.cases.length === 0 ? (
                <p className="text-sm text-muted-foreground">Clean record.</p>
              ) : (
                <ul className="space-y-2">
                  {profile.cases.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 px-4 py-2 text-sm"
                    >
                      <Badge variant="outline" className="border-gold/40 text-gold">
                        #{row.case_number}
                      </Badge>
                      <span>{row.action}</span>
                      <span className="text-muted-foreground">{row.reason}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
