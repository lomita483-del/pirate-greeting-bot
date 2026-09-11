import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Crown, Sparkles } from "lucide-react";

import { AhoyWordmark } from "@/components/ahoy/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PREMIUM_MODULES } from "@/lib/premium-modules";
import { getMyEntitlements } from "@/lib/admin.functions";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Plans & premium modules — !PIRATE" },
      {
        name: "description",
        content:
          "Compare !PIRATE plans and see exactly what moderation, levels, tickets, welcome messages and calendar unlock on the free and premium tiers.",
      },
      { property: "og:title", content: "Plans & premium modules — !PIRATE" },
      {
        property: "og:description",
        content: "See what every !PIRATE plan unlocks across moderation, levels, tickets, welcome and calendar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

const PLANS = [
  {
    key: "free",
    name: "Free crew",
    price: "$0",
    tagline: "Everything you need to get the bot sailing.",
    highlight: false,
    perks: [
      "Custom commands and AutoMod",
      "Event logging and economy",
      "Live server analytics",
      "Unlimited servers",
    ],
  },
  {
    key: "premium",
    name: "Premium",
    price: "Contact owner",
    tagline: "Unlocks every locked module across the bot and the dashboard.",
    highlight: true,
    perks: [
      "Moderation suite and case history",
      "Levels, XP and role rewards",
      "Ticket harbour with panels",
      "Welcome messages and DMs",
      "AHOY Calendar and reminders",
    ],
  },
] as const;

function PricingPage() {
  const { data } = useQuery({ queryKey: ["entitlements"], queryFn: () => getMyEntitlements() });

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6">
        <Link to="/">
          <AhoyWordmark subtitle="Plans" />
        </Link>
        <div className="flex items-center gap-2">
          {data?.signedIn ? (
            <Badge className="bg-gold/15 text-gold hover:bg-gold/20">
              <Crown className="mr-1 size-3" /> Your plan: {data.owner ? "owner" : data.plan}
            </Badge>
          ) : (
            <Button asChild size="sm" variant="secondary">
              <a href="/api/public/auth/discord/start">Sign in with Discord</a>
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-12 px-6 pb-20">
        <section className="text-center">
          <h1 className="text-4xl font-semibold md:text-5xl">Plans &amp; premium modules</h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Free covers the daily running of your server. Premium unlocks the five heavy modules —
            on the bot and in the control center at the same time.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          {PLANS.map((plan) => (
            <Card
              key={plan.key}
              className={plan.highlight ? "glass border-gold/50" : "glass border-0"}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>{plan.name}</span>
                  <span className="font-display text-2xl text-gold">{plan.price}</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2 text-sm">
                  {plan.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-gold" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
                {plan.highlight ? (
                  <Button asChild className="w-full gap-2">
                    <a href="/api/public/invite">
                      <Sparkles className="size-4" /> Get !PIRATE premium
                    </a>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">What each premium module does</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {PREMIUM_MODULES.map((module) => {
              const unlocked = data?.features?.[module.key] === true;
              return (
                <Card key={module.key} className="glass border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-3 text-lg">
                      {module.label}
                      <Badge variant={unlocked ? "default" : "secondary"}>
                        {unlocked ? "Unlocked" : "Premium"}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{module.summary}</p>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {module.includes.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-tide" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
