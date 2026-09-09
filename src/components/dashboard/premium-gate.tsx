import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Lock, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyEntitlements, type PremiumFeature } from "@/lib/admin.functions";

export function useEntitlements() {
  return useQuery({
    queryKey: ["entitlements"],
    queryFn: () => getMyEntitlements(),
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
  children,
}: {
  feature: PremiumFeature;
  children: ReactNode;
}) {
  const { data, isPending } = useEntitlements();

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
            Upgrade this account to unlock {LABELS[feature].toLowerCase()} in the control center and
            on the bot. Your settings stay saved while it is locked.
          </p>
        </div>
        <Button asChild variant="secondary" className="gap-2">
          <Link to="/plans/">
            <Sparkles className="h-4 w-4" /> See plans
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
