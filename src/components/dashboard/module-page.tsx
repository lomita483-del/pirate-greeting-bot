import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useGuild } from "@/components/dashboard/guild-context";
import type { GuildConfig } from "@/components/dashboard/types";

export function ModuleHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start gap-4">
      <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/** Renders children once the guild config has loaded. */
export function WithConfig({
  children,
}: {
  children: (args: { guildId: string; config: GuildConfig; refresh: () => void }) => ReactNode;
}) {
  const { config, guildId, refresh, isPending } = useGuild();
  if (isPending || !config) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  return <>{children({ guildId, config, refresh })}</>;
}
