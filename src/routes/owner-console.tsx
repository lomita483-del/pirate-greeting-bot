import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  FileText,
  Gauge,
  History,
  Home,
  LifeBuoy,
  ListChecks,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Radio,
  Search,
  Server,
  Settings,
  Shield,
  ShieldBan,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserRound,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
      { title: "Owner Console — AHOY BOT" },
      {
        name: "description",
        content:
          "AHOY BOT command center for platform administration, monitoring, users, servers and moderation.",
      },
      { property: "og:title", content: "Owner Console — AHOY BOT" },
      {
        property: "og:description",
        content:
          "Platform command center for monitoring and managing the AHOY BOT ecosystem.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminConsole,
});

const TABS = [
  { key: "overview", label: "Home", icon: Home },
  { key: "users", label: "Users", icon: Users },
  { key: "servers", label: "Servers", icon: Server },
  { key: "notifications", label: "Logs", icon: FileText },
  { key: "staff", label: "Settings", icon: Settings },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function AdminConsole() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: context, isPending } = useQuery({
    queryKey: ["admin", "context"],
    queryFn: () => getAdminContext(),
  });

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020914] px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-[#e7a927]/30 bg-[#071321] shadow-[0_0_40px_rgba(231,169,39,0.15)]">
            <Radio className="size-6 animate-pulse text-[#f5bd3b]" />
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            Checking clearance
          </p>
        </div>
      </div>
    );
  }

  if (!context?.signedIn) {
    return (
      <Gate title="Sign in required">
        <Button
          asChild
          className="border border-[#e7a927]/40 bg-[#e7a927]/15 text-[#ffd56b] hover:bg-[#e7a927]/25"
        >
          <a href="/api/public/auth/discord/start">
            Sign in with Discord
          </a>
        </Button>
      </Gate>
    );
  }

  if (!context.role) {
    return (
      <Gate title="Owner console">
        <p className="max-w-md text-sm leading-6 text-white/50">
          This command center is restricted to authorized AHOY platform
          administrators.
        </p>

        <Button asChild variant="outline">
          <Link to="/dashboard">
            <ChevronLeft className="mr-2 size-4" />
            Back to your servers
          </Link>
        </Button>
      </Gate>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#020914] text-white">
      <DashboardBackground />

      <div className="relative z-10 min-h-screen pb-28 lg:pb-8">
        <TopBar
          context={context}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          setTab={setTab}
        />

        {mobileMenuOpen ? (
          <MobileMenu
            tab={tab}
            setTab={setTab}
            close={() => setMobileMenuOpen(false)}
          />
        ) : null}

        <main className="mx-auto w-full max-w-[1180px] px-3 pb-8 pt-3 sm:px-5 lg:px-6">
          {tab === "overview" ? (
            <Overview
              context={context}
              onJump={setTab}
            />
          ) : null}

          {tab === "users" ? (
            <PageShell
              title="User Management"
              subtitle="Manage platform access, plans and feature permissions."
              icon={Users}
            >
              <UserManager />
            </PageShell>
          ) : null}

          {tab === "servers" ? (
            <PageShell
              title="Server Management"
              subtitle="Monitor connected Discord servers and bot presence."
              icon={Server}
            >
              <ServersPanel />
            </PageShell>
          ) : null}

          {tab === "notifications" ? (
            <PageShell
              title="Notifications & Logs"
              subtitle="Broadcast and review platform notifications."
              icon={Bell}
            >
              <NotificationsPanel />
            </PageShell>
          ) : null}

          {tab === "staff" ? (
            <PageShell
              title="Staff & Settings"
              subtitle="Manage authorized platform administrators."
              icon={Settings}
            >
              <StaffPanel canEdit={context.role === "owner"} />
            </PageShell>
          ) : null}
        </main>

        <MobileBottomNav tab={tab} setTab={setTab} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Background                                                                 */
/* -------------------------------------------------------------------------- */

function DashboardBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(21,62,96,0.5),transparent_42%),linear-gradient(180deg,#03101d_0%,#020914_55%,#010711_100%)]" />

      <div className="absolute left-[-15%] top-[12%] size-[420px] rounded-full bg-[#f2a900]/[0.045] blur-[120px]" />
      <div className="absolute right-[-12%] top-[30%] size-[420px] rounded-full bg-[#00a7ff]/[0.04] blur-[130px]" />
      <div className="absolute bottom-[-15%] left-[20%] size-[500px] rounded-full bg-[#a42cff]/[0.035] blur-[150px]" />

      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:52px_52px]" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Top bar                                                                    */
/* -------------------------------------------------------------------------- */

function TopBar({
  context,
  mobileMenuOpen,
  setMobileMenuOpen,
  setTab,
}: {
  context: Awaited<ReturnType<typeof getAdminContext>>;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (value: boolean) => void;
  setTab: (tab: TabKey) => void;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#020914]/80 backdrop-blur-2xl">
      <div className="mx-auto flex h-[72px] max-w-[1180px] items-center gap-3 px-3 sm:px-5 lg:px-6">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.035] text-white/80 transition hover:border-[#e7a927]/40 hover:text-[#ffd56b]"
        >
          {mobileMenuOpen ? (
            <ChevronLeft className="size-5" />
          ) : (
            <Menu className="size-5" />
          )}
        </button>

        <Link
          to="/dashboard"
          className="min-w-0 flex-1 transition-opacity hover:opacity-90"
        >
          <AhoyWordmark subtitle="Command Center" />
        </Link>

        <button
          type="button"
          onClick={() => setTab("notifications")}
          className="relative flex size-11 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.035] text-white/75 transition hover:border-[#e7a927]/40 hover:text-[#ffd56b]"
        >
          <Bell className="size-[18px]" />
          <span className="absolute right-[8px] top-[7px] size-2 rounded-full bg-[#ff315f] shadow-[0_0_10px_rgba(255,49,95,0.8)]" />
        </button>

        <div className="hidden h-11 items-center gap-3 rounded-2xl border border-white/[0.12] bg-white/[0.035] px-3 sm:flex">
          <div className="flex size-8 items-center justify-center rounded-full border border-[#e7a927]/30 bg-black/30">
            <Shield className="size-4 text-[#f5bd3b]" />
          </div>

          <div className="min-w-0">
            <p className="max-w-[130px] truncate text-xs font-semibold text-white">
              {context.user?.username ?? "Administrator"}
            </p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">
              {context.role}
            </p>
          </div>

          <ChevronDown className="size-4 text-white/35" />
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile menu                                                                */
/* -------------------------------------------------------------------------- */

function MobileMenu({
  tab,
  setTab,
  close,
}: {
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  close: () => void;
}) {
  return (
    <div className="relative z-40 border-b border-white/[0.08] bg-[#030b15]/95 px-3 py-3 backdrop-blur-xl sm:hidden">
      <div className="grid grid-cols-2 gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key);
              close();
            }}
            className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
              tab === key
                ? "border-[#e7a927]/40 bg-[#e7a927]/10 text-[#ffd56b]"
                : "border-white/[0.08] bg-white/[0.025] text-white/55"
            }`}
          >
            <Icon className="size-4" />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */

function Overview({
  context,
  onJump,
}: {
  context: Awaited<ReturnType<typeof getAdminContext>>;
  onJump: (tab: TabKey) => void;
}) {
  const { data, isPending } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => getAdminOverview(),
    refetchInterval: 30_000,
  });

  const [activityOpen, setActivityOpen] = useState(false);
  const [uptimeSeconds, setUptimeSeconds] = useState(() => {
    if (typeof window === "undefined") return 0;

    const storageKey = "ahoy-owner-console-uptime-start";
    const existing = window.localStorage.getItem(storageKey);

    if (existing) {
      const parsed = Number(existing);

      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.max(0, Math.floor((Date.now() - parsed) / 1000));
      }
    }

    const now = Date.now();
    window.localStorage.setItem(storageKey, String(now));
    return 0;
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setUptimeSeconds((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  if (isPending || !data) {
    return (
      <div className="space-y-4">
        <SkeletonBlock className="h-[145px]" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-[125px]" />
          ))}
        </div>
      </div>
    );
  }

  const uptime = formatUptime(uptimeSeconds);

  const stats = [
    {
      label: "Registered Users",
      hint: "Total users on platform",
      value: data.totalUsers,
      delta: "+12%",
      icon: Users,
      tone: "blue",
    },
    {
      label: "Servers",
      hint: "Connected servers",
      value: data.totalServers,
      delta: "+0%",
      icon: Server,
      tone: "cyan",
    },
    {
      label: "Live Now",
      hint: "Users online",
      value: data.activeToday,
      delta: "+18%",
      icon: UserRound,
      tone: "pink",
    },
    {
      label: "Members Reached",
      hint: "Total members",
      value: data.reachedMembers,
      delta: "+8%",
      icon: Users,
      tone: "gold",
    },
    {
      label: "Banned",
      hint: "Banned users",
      value: data.bannedUsers,
      delta: "-100%",
      icon: ShieldBan,
      tone: "red",
    },
    {
      label: "Bot Uptime",
      hint: "This dashboard session",
      value: uptime,
      delta: "+0.02%",
      icon: Gauge,
      tone: "teal",
      isString: true,
    },
    {
      label: "Total Commands",
      hint: "Executed activity",
      value: data.recentActivity.length
        ? data.recentActivity.length * 12
        : 0,
      delta: "+22%",
      icon: BarChart3,
      tone: "indigo",
    },
    {
      label: "Mod Actions",
      hint: "Moderation actions",
      value: data.moderationLast7Days,
      delta: "-100%",
      icon: Zap,
      tone: "emerald",
    },
  ];

  return (
    <div className="space-y-3">
      <CommandDeck
        context={context}
        uptime={uptime}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            hint={stat.hint}
            value={stat.value}
            delta={stat.delta}
            icon={stat.icon}
            tone={stat.tone}
            isString={stat.isString}
          />
        ))}
      </div>

      <QuickActions onJump={onJump} />

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <ServerActivity
          totalUsers={data.totalUsers}
          totalServers={data.totalServers}
          activeToday={data.activeToday}
          reachedMembers={data.reachedMembers}
        />

        <RecentEvents data={data} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <SystemControl />
        <ModerationTools onJump={onJump} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#e7a927]/25 bg-[#06111e]/90 shadow-[0_15px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setActivityOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#e7a927]/30 bg-[#e7a927]/10 text-[#f5bd3b]">
              <ListChecks className="size-4" />
            </span>

            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">
                Recent Dashboard Activity
              </h2>
              <p className="truncate text-[10px] text-white/40">
                View recent actions, logs and system events.
              </p>
            </div>
          </div>

          <span className="flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[10px] font-medium text-white/60">
            {activityOpen ? "Collapse" : "Tap to expand"}
            <ChevronDown
              className={`size-3 transition-transform ${
                activityOpen ? "rotate-180" : ""
              }`}
            />
          </span>
        </button>

        {activityOpen ? (
          <div className="border-t border-white/[0.07] px-4 pb-4 pt-2">
            {data.recentActivity.length === 0 ? (
              <p className="py-4 text-xs text-white/40">
                No activity recorded yet.
              </p>
            ) : (
              <div className="space-y-1.5">
                {data.recentActivity.map((entry, index) => (
                  <div
                    key={`${entry.created_at}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-white/85">
                        {entry.discord_username ?? entry.discord_user_id}
                      </span>{" "}
                      <span className="text-xs text-white/40">
                        {entry.action}
                      </span>
                    </div>

                    <span className="shrink-0 text-[10px] text-white/30">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Command deck                                                               */
/* -------------------------------------------------------------------------- */

function CommandDeck({
  context,
  uptime,
}: {
  context: Awaited<ReturnType<typeof getAdminContext>>;
  uptime: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-white/[0.16] bg-[#061321]/90 shadow-[0_20px_70px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(245,189,59,0.12),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(0,174,255,0.1),transparent_35%)]"
      />

      <div
        aria-hidden
        className="absolute right-[-8%] top-[-60%] size-[420px] rounded-full border border-[#f5bd3b]/10"
      />

      <div className="relative flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative flex size-[68px] shrink-0 items-center justify-center rounded-2xl border border-[#e7a927]/35 bg-[#0a1624] shadow-[0_0_40px_rgba(231,169,39,0.12)]">
            <img
              src="/favicon.png"
              alt="AHOY BOT"
              className="size-12 rounded-xl object-cover"
            />

            <span className="absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-[#061321] bg-[#00e5a0] shadow-[0_0_12px_rgba(0,229,160,0.8)]" />
          </div>

          <div className="min-w-0">
            <p className="text-[9px] font-medium uppercase tracking-[0.35em] text-[#f5bd3b]">
              Command Deck
            </p>

            <h1 className="truncate text-[24px] font-bold uppercase leading-none tracking-[0.08em] text-[#f4b82d] sm:text-[28px]">
              Administrator
            </h1>

            <p className="mt-1 truncate text-[10px] font-medium uppercase tracking-[0.28em] text-white/75">
              {context.user?.username ?? "LIFE_OF_A_PIRATE"}
            </p>

            <p className="mt-2 text-[11px] text-white/45">
              You have full control over the AHOY platform.
            </p>

            <p className="mt-0.5 text-[10px] font-medium text-[#f5bd3b]">
              Monitor. Manage. Protect. Command.
            </p>
          </div>
        </div>

        <div className="shrink-0 rounded-2xl border border-[#e7a927]/35 bg-black/25 px-5 py-3 text-center shadow-[0_0_30px_rgba(231,169,39,0.08)]">
          <div className="flex items-center justify-center gap-2">
            <span className="size-2 rounded-full bg-[#00e5a0] shadow-[0_0_10px_rgba(0,229,160,0.9)]" />
            <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-white/75">
              Bot Active For
            </span>
          </div>

          <p className="mt-1 font-mono text-[24px] font-bold tracking-[0.04em] text-[#ffd35a] sm:text-[28px]">
            {uptime}
          </p>

          <div className="grid grid-cols-4 gap-4 text-[8px] uppercase tracking-[0.12em] text-white/40">
            <span>Days</span>
            <span>Hrs</span>
            <span>Min</span>
            <span>Sec</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat cards                                                                 */
/* -------------------------------------------------------------------------- */

type Tone =
  | "blue"
  | "cyan"
  | "pink"
  | "gold"
  | "red"
  | "teal"
  | "indigo"
  | "emerald";

function StatCard({
  label,
  hint,
  value,
  delta,
  icon: Icon,
  tone,
  isString,
}: {
  label: string;
  hint: string;
  value: number | string;
  delta: string;
  icon: typeof Users;
  tone: Tone;
  isString?: boolean;
}) {
  const styles = toneStyles[tone];

  return (
    <div
      className={`group relative min-h-[122px] overflow-hidden rounded-2xl border bg-[#061321]/90 p-3 backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 ${styles.border}`}
    >
      <div
        aria-hidden
        className={`absolute -right-8 -top-8 size-20 rounded-full blur-2xl ${styles.glow}`}
      />

      <div className="relative flex items-start justify-between gap-2">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-full border ${styles.iconBg} ${styles.iconBorder}`}
        >
          <Icon className={`size-4 ${styles.icon}`} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-white/70">
            {label}
          </p>
          <p className="mt-0.5 truncate text-[8px] text-white/35">
            {hint}
          </p>
        </div>
      </div>

      <div className="relative mt-3 flex items-end justify-between gap-2">
        <p
          className={`truncate font-display text-[24px] font-semibold leading-none ${
            isString ? "font-mono text-[17px]" : "text-white"
          }`}
        >
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>

        <span
          className={`shrink-0 text-[9px] font-semibold ${
            delta.startsWith("-") && tone !== "red"
              ? "text-[#ff5878]"
              : "text-[#00e5a0]"
          }`}
        >
          {delta.startsWith("-") ? "↓ " : "↑ "}
          {delta}
        </span>
      </div>

      <div className="relative mt-3 h-4 overflow-hidden opacity-70">
        <Sparkline tone={tone} />
      </div>
    </div>
  );
}

const toneStyles: Record<
  Tone,
  {
    border: string;
    glow: string;
    iconBg: string;
    iconBorder: string;
    icon: string;
  }
> = {
  blue: {
    border: "border-[#2588ff]/50",
    glow: "bg-[#2588ff]/20",
    iconBg: "bg-[#2588ff]/15",
    iconBorder: "border-[#2588ff]/40",
    icon: "text-[#48a1ff]",
  },
  cyan: {
    border: "border-[#00d8d8]/45",
    glow: "bg-[#00d8d8]/20",
    iconBg: "bg-[#00d8d8]/15",
    iconBorder: "border-[#00d8d8]/40",
    icon: "text-[#28f1eb]",
  },
  pink: {
    border: "border-[#f13fd5]/50",
    glow: "bg-[#f13fd5]/20",
    iconBg: "bg-[#f13fd5]/15",
    iconBorder: "border-[#f13fd5]/40",
    icon: "text-[#ff63e2]",
  },
  gold: {
    border: "border-[#e7a927]/45",
    glow: "bg-[#e7a927]/20",
    iconBg: "bg-[#e7a927]/15",
    iconBorder: "border-[#e7a927]/40",
    icon: "text-[#ffd15a]",
  },
  red: {
    border: "border-[#ff1670]/55",
    glow: "bg-[#ff1670]/20",
    iconBg: "bg-[#ff1670]/15",
    iconBorder: "border-[#ff1670]/40",
    icon: "text-[#ff4b89]",
  },
  teal: {
    border: "border-[#00d8c4]/45",
    glow: "bg-[#00d8c4]/20",
    iconBg: "bg-[#00d8c4]/15",
    iconBorder: "border-[#00d8c4]/40",
    icon: "text-[#25e9d4]",
  },
  indigo: {
    border: "border-[#3284ff]/55",
    glow: "bg-[#3284ff]/20",
    iconBg: "bg-[#3284ff]/15",
    iconBorder: "border-[#3284ff]/40",
    icon: "text-[#6ca7ff]",
  },
  emerald: {
    border: "border-[#00d6a0]/45",
    glow: "bg-[#00d6a0]/20",
    iconBg: "bg-[#00d6a0]/15",
    iconBorder: "border-[#00d6a0]/40",
    icon: "text-[#32e7b2]",
  },
};

function Sparkline({ tone }: { tone: Tone }) {
  const stroke = {
    blue: "#2588ff",
    cyan: "#00d8d8",
    pink: "#f13fd5",
    gold: "#f5bd3b",
    red: "#ff1670",
    teal: "#00d8c4",
    indigo: "#3284ff",
    emerald: "#00d6a0",
  }[tone];

  return (
    <svg
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      className="h-full w-full"
    >
      <path
        d="M0 19 C8 16, 10 20, 18 15 S28 18, 34 12 S45 16, 51 9 S61 13, 68 7 S78 10, 84 5 S93 8, 100 2"
        fill="none"
        stroke={stroke}
        strokeWidth="1.7"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Quick actions                                                              */
/* -------------------------------------------------------------------------- */

function QuickActions({ onJump }: { onJump: (tab: TabKey) => void }) {
  const actions = [
    {
      label: "Manage Users",
      icon: UserRound,
      tone: "blue",
      action: () => onJump("users"),
    },
    {
      label: "Ban / Unban",
      icon: ShieldBan,
      tone: "pink",
      action: () => onJump("users"),
    },
    {
      label: "Kick Member",
      icon: UserRound,
      tone: "red",
      action: () => onJump("servers"),
    },
    {
      label: "Send Announcement",
      icon: Radio,
      tone: "gold",
      action: () => onJump("notifications"),
    },
    {
      label: "Create Ticket",
      icon: Ticket,
      tone: "cyan",
      action: () => onJump("notifications"),
    },
    {
      label: "AutoMod Settings",
      icon: Shield,
      tone: "teal",
      action: () => onJump("servers"),
    },
    {
      label: "View Logs",
      icon: History,
      tone: "indigo",
      action: () => onJump("notifications"),
    },
    {
      label: "Server Settings",
      icon: Settings,
      tone: "gold",
      action: () => onJump("servers"),
    },
  ] as const;

  return (
    <section className="rounded-2xl border border-[#e7a927]/30 bg-[#061321]/90 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#e7a927]/10 text-[#f5bd3b]">
            <Zap className="size-5" />
          </span>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
              Quick Actions
            </h2>
            <p className="truncate text-[9px] text-white/40">
              Manage your server and users with ease.
            </p>
          </div>
        </div>

        <span className="hidden items-center gap-1 rounded-xl border border-white/[0.1] bg-white/[0.025] px-3 py-2 text-[10px] text-white/50 sm:flex">
          View all
          <ChevronRight className="size-3" />
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {actions.map((action) => {
          const color = quickActionColors[action.tone];

          return (
            <button
              key={action.label}
              type="button"
              onClick={action.action}
              className="group flex min-h-[74px] flex-col items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-[#071625]/90 px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.055]"
            >
              <action.icon
                className={`size-4 ${color} transition group-hover:scale-110`}
              />
              <span className="text-[10px] font-medium text-white/80">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const quickActionColors: Record<string, string> = {
  blue: "text-[#3d9aff]",
  pink: "text-[#ff4fca]",
  red: "text-[#ff6577]",
  gold: "text-[#ffd15a]",
  cyan: "text-[#2be8ef]",
  teal: "text-[#29e4d0]",
  indigo: "text-[#639dff]",
};

/* -------------------------------------------------------------------------- */
/* Server activity                                                            */
/* -------------------------------------------------------------------------- */

function ServerActivity({
  totalUsers,
  totalServers,
  activeToday,
  reachedMembers,
}: {
  totalUsers: number;
  totalServers: number;
  activeToday: number;
  reachedMembers: number;
}) {
  const activity = [
    {
      label: "Messages",
      value: Math.max(totalUsers * 10, 0),
      delta: "+18%",
      icon: MessageSquare,
      tone: "purple",
    },
    {
      label: "Commands",
      value: Math.max(totalUsers * 6, 0),
      delta: "+22%",
      icon: BarChart3,
      tone: "blue",
    },
    {
      label: "Joins",
      value: activeToday,
      delta: "+34%",
      icon: UserRound,
      tone: "cyan",
    },
    {
      label: "Leaves",
      value: Math.max(Math.floor(totalUsers * 0.03), 0),
      delta: "+12%",
      icon: Users,
      tone: "red",
    },
  ];

  return (
    <section className="rounded-2xl border border-[#e7a927]/25 bg-[#061321]/90 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:p-4">
      <SectionHeader
        icon={Zap}
        title="Server Activity"
        subtitle="Live overview of your server activity."
        action={
          <span className="flex items-center gap-1 rounded-xl border border-white/[0.1] bg-white/[0.025] px-3 py-2 text-[9px] text-white/50">
            Today
            <ChevronDown className="size-3" />
          </span>
        }
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-white/[0.07] bg-[#030c17]/70 p-3">
          <ActivityChart />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
          {activity.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2"
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${activityTone[item.tone]}`}
              >
                <item.icon className="size-3.5" />
              </span>

              <div className="min-w-0">
                <p className="text-[9px] text-white/45">{item.label}</p>
                <p className="text-xs font-semibold text-white">
                  {item.value.toLocaleString()}
                </p>
              </div>

              <span className="ml-auto text-[8px] text-[#00e5a0]">
                ↑ {item.delta}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-2 text-[8px] text-white/25">
        {totalServers.toLocaleString()} connected servers ·{" "}
        {reachedMembers.toLocaleString()} members reached
      </p>
    </section>
  );
}

const activityTone: Record<string, string> = {
  purple: "bg-[#9b45ff]/15 text-[#c27bff]",
  blue: "bg-[#3187ff]/15 text-[#5ea0ff]",
  cyan: "bg-[#00d8d8]/15 text-[#28e7e7]",
  red: "bg-[#ff316b]/15 text-[#ff5d89]",
};

function ActivityChart() {
  const bars = [
    30, 48, 38, 62, 43, 68, 52, 79, 48, 72, 92, 60, 84, 52, 76, 46,
  ];

  return (
    <div>
      <div className="flex h-[130px] items-end gap-[3px] border-b border-white/[0.08]">
        {bars.map((height, index) => (
          <div
            key={index}
            className="group relative flex h-full flex-1 items-end"
          >
            <div
              className={`w-full rounded-t-[3px] ${
                index % 3 === 0
                  ? "bg-[#a946ff]/80"
                  : index % 3 === 1
                    ? "bg-[#2e88ff]/80"
                    : "bg-[#00d8df]/75"
              }`}
              style={{ height: `${height}%` }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[7px] text-white/25">
        <span>12AM</span>
        <span>4AM</span>
        <span>8AM</span>
        <span>12PM</span>
        <span>4PM</span>
        <span>8PM</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Recent events                                                              */
/* -------------------------------------------------------------------------- */

function RecentEvents({
  data,
}: {
  data: Awaited<ReturnType<typeof getAdminOverview>>;
}) {
  const events = useMemo(() => {
    return data.recentActivity.slice(0, 6).map((entry, index) => ({
      action: entry.action,
      user: entry.discord_username ?? entry.discord_user_id,
      time: relativeTime(entry.created_at),
      icon:
        index === 0
          ? UserRound
          : index === 1
            ? ShieldBan
            : index === 2
              ? MessageSquare
              : index === 3
                ? Ticket
                : Users,
      tone:
        index === 0
          ? "cyan"
          : index === 1
            ? "pink"
            : index === 2
              ? "blue"
              : index === 3
                ? "gold"
                : "purple",
    }));
  }, [data.recentActivity]);

  return (
    <section className="rounded-2xl border border-[#e7a927]/25 bg-[#061321]/90 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:p-4">
      <SectionHeader
        icon={Bell}
        title="Recent Events"
        subtitle="Latest platform activities."
      />

      <div className="mt-3 space-y-1.5">
        {events.length === 0 ? (
          <div className="rounded-xl border border-white/[0.07] px-3 py-5 text-center text-[10px] text-white/35">
            No recent events.
          </div>
        ) : (
          events.map((event, index) => (
            <div
              key={`${event.time}-${index}`}
              className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${eventTone[event.tone]}`}
              >
                <event.icon className="size-3.5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-medium text-white/80">
                  {event.action}
                </p>
                <p className="truncate text-[8px] text-white/35">
                  @{event.user}
                </p>
              </div>

              <span className="shrink-0 text-[8px] text-white/35">
                {event.time}
              </span>
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        className="mt-3 flex items-center gap-1 text-[9px] font-medium text-[#f5bd3b] hover:text-[#ffd86b]"
      >
        View all events
        <ChevronRight className="size-3" />
      </button>
    </section>
  );
}

const eventTone: Record<string, string> = {
  cyan: "bg-[#00d8d8]/15 text-[#29e7e7]",
  pink: "bg-[#ff3177]/15 text-[#ff5d91]",
  blue: "bg-[#3187ff]/15 text-[#5ea0ff]",
  gold: "bg-[#f5bd3b]/15 text-[#ffd15a]",
  purple: "bg-[#a94cff]/15 text-[#c879ff]",
};

/* -------------------------------------------------------------------------- */
/* System control                                                             */
/* -------------------------------------------------------------------------- */

function SystemControl() {
  const controls = [
    {
      label: "AutoMod",
      description: "Filter & protect your server",
      icon: Wrench,
    },
    {
      label: "Economy System",
      description: "Virtual currency & rewards",
      icon: Coins,
    },
    {
      label: "Welcome Messages",
      description: "New member greetings",
      icon: MessageSquare,
    },
    {
      label: "Leveling System",
      description: "XP, ranks & progression",
      icon: Sparkles,
    },
    {
      label: "Ticket System",
      description: "Support & reports",
      icon: Ticket,
    },
    {
      label: "Moderation Logs",
      description: "Track all moderation actions",
      icon: History,
    },
    {
      label: "Custom Commands",
      description: "Slash commands & triggers",
      icon: FileText,
    },
    {
      label: "Analytics & Reports",
      description: "Detailed server insights",
      icon: BarChart3,
    },
  ];

  return (
    <section className="rounded-2xl border border-[#e7a927]/25 bg-[#061321]/90 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:p-4">
      <SectionHeader
        icon={Shield}
        title="System Control"
        subtitle="Core bot settings & quick controls."
      />

      <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {controls.map((control) => (
          <div
            key={control.label}
            className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#8b4cff]/12 text-[#c083ff]">
              <control.icon className="size-3.5" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[9px] font-medium text-white/80">
                {control.label}
              </p>
              <p className="truncate text-[7px] text-white/30">
                {control.description}
              </p>
            </div>

            <span className="relative h-5 w-9 shrink-0 rounded-full bg-[#00d6a0]/80 shadow-[0_0_10px_rgba(0,214,160,0.2)]">
              <span className="absolute right-0.5 top-0.5 size-4 rounded-full bg-white shadow" />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Moderation tools                                                           */
/* -------------------------------------------------------------------------- */

function ModerationTools({
  onJump,
}: {
  onJump: (tab: TabKey) => void;
}) {
  const tools = [
    {
      label: "User Lookup",
      description: "View user details & history",
      icon: Search,
      action: () => onJump("users"),
    },
    {
      label: "Message Logs",
      description: "Search & view messages",
      icon: MessageSquare,
      action: () => onJump("notifications"),
    },
    {
      label: "Audit Logs",
      description: "Track all admin actions",
      icon: History,
      action: () => onJump("notifications"),
    },
    {
      label: "Automod Logs",
      description: "View filtered content",
      icon: Shield,
      action: () => onJump("servers"),
    },
    {
      label: "Reports & Investigations",
      description: "User reports & investigations",
      icon: FileText,
      action: () => onJump("notifications"),
    },
  ];

  return (
    <section className="rounded-2xl border border-[#e7a927]/25 bg-[#061321]/90 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:p-4">
      <SectionHeader
        icon={Wrench}
        title="Moderation Tools"
        subtitle="Keep your server safe and clean."
      />

      <div className="mt-3 space-y-1.5">
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            onClick={tool.action}
            className="flex w-full items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2 text-left transition hover:border-[#e7a927]/25 hover:bg-white/[0.045]"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#f5bd3b]/10 text-[#ffd15a]">
              <tool.icon className="size-3.5" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[9px] font-medium text-white/80">
                {tool.label}
              </p>
              <p className="truncate text-[7px] text-white/30">
                {tool.description}
              </p>
            </div>

            <ChevronRight className="size-3.5 shrink-0 text-white/25" />
          </button>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared UI                                                                  */
/* -------------------------------------------------------------------------- */

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: typeof Bell;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f5bd3b]/10 text-[#ffd15a]">
          <Icon className="size-4" />
        </span>

        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-white">
            {title}
          </h2>
          <p className="truncate text-[9px] text-white/35">{subtitle}</p>
        </div>
      </div>

      {action}
    </div>
  );
}

function PageShell({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: typeof Bell;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#e7a927]/25 bg-[#061321]/90 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl border border-[#e7a927]/25 bg-[#e7a927]/10 text-[#ffd15a]">
            <Icon className="size-5" />
          </div>

          <div>
            <h1 className="text-xl font-semibold text-white">{title}</h1>
            <p className="mt-0.5 text-xs text-white/40">{subtitle}</p>
          </div>
        </div>
      </section>

      {children}
    </div>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.035] ${className}`}
    />
  );
}

function Gate({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#020914] px-6 text-center">
      <AhoyWordmark subtitle="Owner Console" />

      <div className="mt-4 rounded-3xl border border-[#e7a927]/20 bg-white/[0.025] p-8 backdrop-blur-xl">
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile bottom navigation                                                   */
/* -------------------------------------------------------------------------- */

function MobileBottomNav({
  tab,
  setTab,
}: {
  tab: TabKey;
  setTab: (tab: TabKey) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 lg:hidden">
      <div className="mx-auto flex h-[68px] max-w-[520px] items-center justify-around rounded-[26px] border border-white/[0.13] bg-[#030b15]/90 px-2 shadow-[0_-10px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        {TABS.slice(0, 2).map(({ key, label, icon: Icon }) => (
          <BottomNavItem
            key={key}
            active={tab === key}
            label={label}
            icon={Icon}
            onClick={() => setTab(key)}
          />
        ))}

        <button
          type="button"
          onClick={() => setTab("overview")}
          className="relative -mt-7 flex size-[62px] items-center justify-center rounded-full border border-[#e7a927]/55 bg-[#071524] shadow-[0_0_35px_rgba(231,169,39,0.35)]"
        >
          <span className="absolute inset-1 rounded-full border border-[#e7a927]/20" />
          <img
            src="/favicon.png"
            alt="AHOY"
            className="size-10 rounded-full object-cover"
          />
        </button>

        {TABS.slice(2, 4).map(({ key, label, icon: Icon }) => (
          <BottomNavItem
            key={key}
            active={tab === key}
            label={label}
            icon={Icon}
            onClick={() => setTab(key)}
          />
        ))}

        <button
          type="button"
          onClick={() => setTab("staff")}
          className={`hidden flex-col items-center justify-center gap-1 px-2 sm:flex ${
            tab === "staff" ? "text-[#ffd15a]" : "text-white/40"
          }`}
        >
          <Settings className="size-4" />
          <span className="text-[8px]">Settings</span>
        </button>
      </div>
    </nav>
  );
}

function BottomNavItem({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: typeof Home;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-[46px] flex-col items-center justify-center gap-1 px-1.5 ${
        active ? "text-[#ffd15a]" : "text-white/40"
      }`}
    >
      <Icon className="size-4" />
      <span className="text-[8px]">{label}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatUptime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return [
    String(days).padStart(2, "0"),
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(secs).padStart(2, "0"),
  ].join(":");
}

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) return "recently";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);

  return `${days}d ago`;
}
