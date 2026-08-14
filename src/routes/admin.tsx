import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bell,
  ChevronLeft,
  Server,
  ShieldCheck,
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

function AdminConsole() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overview");
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
          This area is restricted to the AHOY platform owner and staff.
        </p>
        <Button asChild variant="outline">
          <Link to="/dashboard">Back to your servers</Link>
        </Button>
      </Gate>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <AhoyWordmark subtitle="Owner console" />
            </Link>
            <Badge variant="secondary">{context.role}</Badge>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard">
              <ChevronLeft className="mr-1 size-4" /> Dashboard
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Fleet command</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything happening across every server running AHOY.
        </p>

        <nav className="mt-6 flex flex-wrap gap-2">
          {TABS.map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              size="sm"
              variant={tab === key ? "default" : "outline"}
              onClick={() => setTab(key)}
            >
              <Icon className="mr-2 size-4" />
              {label}
            </Button>
          ))}
        </nav>

        <div className="mt-8">
          {tab === "overview" ? <Overview /> : null}
          {tab === "users" ? <UserManager /> : null}
          {tab === "servers" ? <ServersPanel /> : null}
          {tab === "notifications" ? <NotificationsPanel /> : null}
          {tab === "staff" ? <StaffPanel canEdit={context.role === "owner"} /> : null}
        </div>
      </main>
    </div>
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

function Overview() {
  const { data, isPending } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => getAdminOverview(),
  });

  if (isPending || !data) {
    return <p className="text-sm text-muted-foreground">Reading the charts…</p>;
  }

  const stats = [
    { label: "Registered users", value: data.totalUsers },
    { label: "Active today", value: data.activeToday },
    { label: "Banned", value: data.bannedUsers },
    { label: "Servers", value: data.totalServers },
    { label: "Bot live in", value: data.liveServers },
    { label: "Members reached", value: data.reachedMembers },
    { label: "Mod actions (7d)", value: data.moderationLast7Days },
    { label: "Open tickets", value: data.openTickets },
    { label: "Tracked profiles", value: data.trackedProfiles },
    { label: "Queued notifications", value: data.pendingNotifications },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="glass rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold">{stat.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Activity className="size-4" /> Recent dashboard activity
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
