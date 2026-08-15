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

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Owner console — AHOY" },
      {
        name: "description",
        content:
          "Platform owner console for AHOY: monitor sign-ins, manage users and plans, review servers and broadcast notifications.",
      },
      { property: "og:title", content: "Owner console — AHOY" },
      {
        property: "og:description",
        content: "Monitor users, servers and notifications across every AHOY deployment.",
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
          This area is restricted to the AHOY platform owner.
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
              You have full control over the AHOY platform.
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
    { label: "Plans", icon: Coins, tab: "users" },
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
