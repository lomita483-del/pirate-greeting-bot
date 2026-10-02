import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { XpLevelingPage } from "@/components/dashboard/xp-leveling-page";
import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";

export const Route = createFileRoute("/dashboard/$guildId/engagement")({
  head: () => ({ meta: [
    { title: "XP & Leveling — AHOY BOT Control Center" },
    { name: "description", content: "Automatic message XP, leveling, rank roles, member progression and leaderboard controls." },
    { property: "og:title", content: "XP & Leveling — AHOY BOT Control Center" },
    { property: "og:description", content: "One control center for XP, levels and rank progression." },
  ]}),
  component: () => <div>
    <ModuleHeader icon={Trophy} title="XP & Leveling" description="Automatic XP, levels, rank rewards, member progression and leaderboard — all in one place." />
    <WithConfig>{({ guildId, config, refresh }) => <XpLevelingPage guildId={guildId} config={config} onSaved={refresh} />}</WithConfig>
  </div>,
});