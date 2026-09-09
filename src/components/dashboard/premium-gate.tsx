import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Lock, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyEntitlements, type PremiumFeature } from "@/lib/admin.functions";

/** Pass guildId so a server that unlocked a plan via tasks is honored too,
 * not just the signed-in user's own paid account. */
export function useEntitlements(guildId?: string) {
  return useQuery({
    queryKey: ["entitlements", guildId ?? null],
    queryFn: () => getMyEntitlements({ data: { guildId } }),
    staleTime: 60_000,
  });
}

const LABELS: Record<PremiumFeature, string> = {
  moderation: "Moderation",
  levels: "Levels & XP",
  tickets: "Tickets",
  welcome: "Welcome messages",
  calendar: "Calendar",
};

export function PremiumGate({
  feature,
  guildId,
  children,
}: {
  feature: PremiumFeature;
  guildId?: string;
  children: ReactNode;
}) {
  const { data, isPending } = useEntitlements(guildId);

  if (isPending) return <Skeleton className="h-64 rounded-2xl" />;
  if (data?.features[feature]) return <>{children}</>;

  return (
    <Card className="glass border-0">
      <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
        <span className="rounded-2xl border border-gold/40 bg-gold/10 p-3">
          <Lock className="h-6 w-6 text-gold" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">{LABELS[feature]} is a premium module</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Upgrade this account, or complete this server's task list, to unlock{" "}
            {LABELS[feature].toLowerCase()} in the control center and on the bot. Your settings
            stay saved while it is locked.
          </p>
        </div>
        <Button asChild variant="secondary" className="gap-2">
          <Link to={guildId ? `/dashboard/$guildId/plans` : "/plans/"} params={guildId ? { guildId } : undefined}>
            <Sparkles className="h-4 w-4" /> See plans
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
