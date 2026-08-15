import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { SectionHeader } from "./fields";
import type { PanelProps } from "./types";

type CommandEntry = { name: string; description: string };
type CommandGroup = { group: string; blurb: string; commands: CommandEntry[] };

const COMMAND_GROUPS: CommandGroup[] = [
  {
    group: "General",
    blurb: "Everyday utilities available to every member.",
    commands: [
      { name: "/ahoy", description: "Greet AHOY." },
      { name: "/ping", description: "Show AHOY's latency." },
      { name: "/help", description: "Browse AHOY's commands." },
      { name: "/server", description: "Show information about this server." },
      { name: "/userinfo", description: "Show a member's AHOY summary (text)." },
      { name: "/stats", description: "Show AHOY statistics." },
    ],
  },
  {
    group: "Moderation",
    blurb: "Staff-only tools. Every action is written to the case log.",
    commands: [
      { name: "/warn", description: "Warn a member." },
      { name: "/warnings", description: "List a member's active warnings." },
      { name: "/clear", description: "Bulk delete recent messages." },
      { name: "/timeout", description: "Temporarily mute a member." },
      { name: "/untimeout", description: "Remove a member's timeout." },
      { name: "/kick", description: "Remove a member from the server." },
      { name: "/ban", description: "Ban a member." },
      { name: "/unban", description: "Lift a ban using the user ID." },
      { name: "/role add", description: "Give a role to a member." },
      { name: "/role remove", description: "Remove a role from a member." },
    ],
  },
  {
    group: "Levels & profile",
    blurb: "XP progression and profile cards.",
    commands: [
      { name: "/rank", description: "Show XP and level progress." },
      { name: "/leaderboard", description: "Top members in this server." },
      { name: "/profile", description: "Show a member's AHOY profile card." },
    ],
  },
  {
    group: "Economy",
    blurb: "Currency, rewards and transfers.",
    commands: [
      { name: "/balance", description: "Check a wallet balance." },
      { name: "/daily", description: "Claim your daily reward." },
      { name: "/give", description: "Send currency to another member." },
    ],
  },
  {
    group: "Community",
    blurb: "Engagement features you can also configure from the dashboard.",
    commands: [
      { name: "/giveaway start", description: "Start a giveaway in this channel." },
      { name: "/giveaway end", description: "End a running giveaway now." },
      { name: "/giveaway reroll", description: "Draw new winners for a finished giveaway." },
      { name: "/poll create", description: "Post a poll with up to 10 options." },
      { name: "/poll end", description: "Close a poll and post the results." },
      { name: "/reactionrole create", description: "Post a reaction-role message." },
      { name: "/reactionrole add", description: "Attach an emoji → role option to a message." },
      { name: "/reactionrole remove", description: "Remove an emoji → role option." },
      { name: "/reactionrole list", description: "Show every reaction role in this server." },
    ],
  },
  {
    group: "Support & stats",
    blurb: "Tickets, reminders and live server insight.",
    commands: [
      { name: "/ticket", description: "Open a private support ticket." },
      { name: "/remind", description: "Set a personal reminder." },
      { name: "/serverstats", description: "Live statistics for this server." },
      { name: "/voicestats", description: "Who is in voice right now." },
    ],
  },
];

export function CommandListPanel({ config }: PanelProps) {
  const [query, setQuery] = useState("");
  const prefix = config.settings?.prefix ?? "!";

  const groups = useMemo(() => {
    const custom: CommandGroup[] = config.commands.length
      ? [
          {
            group: "Custom commands",
            blurb: `Server-specific replies triggered with the ${prefix} prefix.`,
            commands: config.commands.map((command) => ({
              name: `${prefix}${command.name}`,
              description: command.enabled
                ? command.response.slice(0, 120)
                : `(disabled) ${command.response.slice(0, 110)}`,
            })),
          },
        ]
      : [];

    const all = [...COMMAND_GROUPS, ...custom];
    const term = query.trim().toLowerCase();
    if (!term) return all;
    return all
      .map((group) => ({
        ...group,
        commands: group.commands.filter(
          (command) =>
            command.name.toLowerCase().includes(term) ||
            command.description.toLowerCase().includes(term),
        ),
      }))
      .filter((group) => group.commands.length > 0);
  }, [config.commands, prefix, query]);

  const total = groups.reduce((sum, group) => sum + group.commands.length, 0);

  return (
    <div className="space-y-6">
      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Command list"
            description="Everything AHOY responds to in this server."
            badge={`${total} commands`}
          />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search commands…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {groups.length === 0 ? (
        <Card className="glass border-0">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No commands match “{query}”.
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.group} className="glass border-0">
            <CardContent className="space-y-3 pt-6">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{group.group}</h2>
                <Badge variant="outline" className="text-[10px]">
                  {group.commands.length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{group.blurb}</p>
              <ul className="grid gap-2 md:grid-cols-2">
                {group.commands.map((command) => (
                  <li
                    key={command.name}
                    className="rounded-xl border border-border/70 bg-secondary/30 px-4 py-3"
                  >
                    <p className="font-mono text-sm text-primary">{command.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{command.description}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
