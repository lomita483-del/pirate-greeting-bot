import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bot,
  CalendarClock,
  FileText,
  Gauge,
  Hand,
  MessageSquare,
  ScrollText,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type ModuleLink = {
  label: string;
  to: string;
  icon: LucideIcon;
  exact?: boolean;
};

export const SETTINGS_LINKS: ModuleLink[] = [
  { label: "Home", to: "/dashboard/$guildId", icon: Gauge, exact: true },
  { label: "General settings", to: "/dashboard/$guildId/general", icon: Settings },
  { label: "Commands", to: "/dashboard/$guildId/commands", icon: FileText },
  { label: "Custom commands", to: "/dashboard/$guildId/custom-commands", icon: Bot },
];

export const MODULE_LINKS: ModuleLink[] = [
  { label: "Auto Moderation", to: "/dashboard/$guildId/automod", icon: ShieldAlert },
  { label: "Moderation", to: "/dashboard/$guildId/moderation", icon: Shield },
  { label: "Welcome Messages", to: "/dashboard/$guildId/welcome", icon: Hand },
  { label: "Roles", to: "/dashboard/$guildId/roles", icon: Users },
  { label: "Community", to: "/dashboard/$guildId/community", icon: Sparkles },
  { label: "Automation", to: "/dashboard/$guildId/automation", icon: CalendarClock },
  { label: "Engagement", to: "/dashboard/$guildId/engagement", icon: Trophy },
  { label: "Stats", to: "/dashboard/$guildId/stats", icon: BarChart3 },
  { label: "Logging", to: "/dashboard/$guildId/logging", icon: ScrollText },
  { label: "Activity", to: "/dashboard/$guildId/activity", icon: Activity },
  { label: "Messages", to: "/dashboard/$guildId/messages", icon: MessageSquare },
];

export function GuildNav({
  guildId,
  onNavigate,
}: {
  guildId: string;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/dashboard/${guildId}`;

  const item = (link: ModuleLink) => {
    const href = link.to.replace("$guildId", guildId);
    const active = link.exact ? pathname === base || pathname === `${base}/` : pathname === href;
    return (
      <Link
        key={link.to}
        to={link.to}
        params={{ guildId }}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
          active
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
        )}
      >
        <link.icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{link.label}</span>
      </Link>
    );
  };

  return (
    <nav className="space-y-6">
      <div className="space-y-1">{SETTINGS_LINKS.map(item)}</div>
      <div className="space-y-1">
        <p className="px-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
          Modules
        </p>
        {MODULE_LINKS.map(item)}
      </div>
    </nav>
  );
}
