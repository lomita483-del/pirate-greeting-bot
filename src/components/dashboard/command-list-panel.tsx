import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { COMMAND_CATEGORIES, commandPath, type CommandEntry } from "@/lib/command-library";
import { getCommandSettings, setCommandEnabled } from "@/lib/ahoy.functions";

import { CommandConfigDialog, defaultCommandConfig } from "./command-config-dialog";
import { SectionHeader } from "./fields";
import type { PanelProps } from "./types";

/** Settings key shared with the bot: dedicated commands use their own name. */
function settingsKey(category: string, entry: CommandEntry): string {
  return entry.dedicated ? entry.name : `${category} ${entry.sub}`;
}

export function CommandListPanel({ guildId, config }: PanelProps) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ key: string; desc: string } | null>(null);
  const prefix = config.settings?.prefix ?? "!";
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["command-settings", guildId],
    queryFn: () => getCommandSettings({ data: { guildId } }),
  });

  const disabled = useMemo(
    () => new Set(settingsQuery.data?.disabled ?? []),
    [settingsQuery.data],
  );
  const usage = settingsQuery.data?.usage ?? {};
  const configs = settingsQuery.data?.configs ?? {};

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["command-settings", guildId] });

  const toggle = useMutation({
    mutationFn: (vars: { command: string; enabled: boolean }) =>
      setCommandEnabled({ data: { guildId, ...vars } }),
    onSuccess: (_r, vars) => {
      toast.success(`${vars.command} ${vars.enabled ? "enabled" : "disabled"}`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });


  const categories = useMemo(() => {
    const term = query.trim().toLowerCase();
    return COMMAND_CATEGORIES.map((category) => ({
      ...category,
      commands: term
        ? category.commands.filter(
            (entry) =>
              entry.sub.includes(term) ||
              entry.name.toLowerCase().includes(term) ||
              entry.desc.toLowerCase().includes(term) ||
              category.title.toLowerCase().includes(term),
          )
        : category.commands,
    })).filter((category) => category.commands.length > 0);
  }, [query]);

  const total = categories.reduce((sum, category) => sum + category.commands.length, 0);
  const customCommands = config.commands.filter((command) =>
    query.trim() ? command.name.toLowerCase().includes(query.trim().toLowerCase()) : true,
  );

  return (
    <div className="space-y-6">
      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Command list"
            description="Every command AHOY responds to in this server. Switch any command off to block it here."
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

      {customCommands.length > 0 && (
        <Card className="glass border-0">
          <CardContent className="space-y-3 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">Custom commands</h2>
              <Badge variant="outline" className="text-[10px]">
                {customCommands.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Server-specific replies triggered with the {prefix} prefix.
            </p>
            <ul className="grid gap-2 md:grid-cols-2">
              {customCommands.map((command) => (
                <li
                  key={command.id}
                  className="rounded-lg border border-border/40 bg-background/30 p-3"
                >
                  <code className="text-sm font-medium text-primary">
                    {prefix}
                    {command.name}
                  </code>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {command.enabled ? "" : "(disabled) "}
                    {command.response.slice(0, 120)}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {categories.length === 0 ? (
        <Card className="glass border-0">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No commands match “{query}”.
          </CardContent>
        </Card>
      ) : (
        <Card className="glass border-0">
          <CardContent className="pt-6">
            <Accordion type="multiple" className="w-full">
              {categories.map((category) => (
                <AccordionItem key={category.slug} value={category.slug}>
                  <AccordionTrigger className="text-left">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{category.title}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {category.commands.length}
                      </Badge>
                      <code className="text-[11px] text-muted-foreground">/{category.slug}</code>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="grid gap-2">
                      {category.commands.map((entry) => {
                        const key = settingsKey(category.slug, entry);
                        const cfg = configs[key];
                        const isOn = !disabled.has(key);
                        const chips: string[] = [];
                        if (cfg?.allowedRoleIds.length)
                          chips.push(`${cfg.allowedRoleIds.length} allowed role(s)`);
                        if (cfg?.deniedRoleIds.length)
                          chips.push(`${cfg.deniedRoleIds.length} blocked role(s)`);
                        if (cfg?.requiredPermission && cfg.requiredPermission !== "none")
                          chips.push(cfg.requiredPermission.replace(/_/g, " "));
                        if (cfg?.allowedChannelIds.length)
                          chips.push(`${cfg.allowedChannelIds.length} channel(s)`);
                        if (cfg?.outputChannelId) chips.push("routed output");
                        if (cfg?.cooldownSeconds) chips.push(`${cfg.cooldownSeconds}s cooldown`);
                        if (cfg?.customResponse) chips.push("custom reply");
                        return (
                          <li
                            key={key}
                            className="flex items-start justify-between gap-3 rounded-lg border border-border/40 bg-background/30 p-3"
                          >
                            <div className="min-w-0">
                              <code className="text-sm font-medium text-primary">
                                {commandPath(category.slug, entry)}
                              </code>
                              <p className="mt-1 text-xs text-muted-foreground">{entry.desc}</p>
                              {cfg?.notes ? (
                                <p className="mt-1 text-xs text-foreground/80">{cfg.notes}</p>
                              ) : null}
                              {chips.length > 0 ? (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {chips.map((chip) => (
                                    <Badge
                                      key={chip}
                                      variant="outline"
                                      className="text-[10px] font-normal"
                                    >
                                      {chip}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}
                              {usage[key] ? (
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                  Used {usage[key]} time{usage[key] === 1 ? "" : "s"}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label={`Configure ${key}`}
                                onClick={() => setEditing({ key, desc: entry.desc })}
                              >
                                <Settings2 className="h-4 w-4" />
                              </Button>
                              <Switch
                                checked={isOn}
                                disabled={toggle.isPending || settingsQuery.isLoading}
                                onCheckedChange={(checked) =>
                                  toggle.mutate({ command: key, enabled: checked })
                                }
                                aria-label={`Toggle ${key}`}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {editing ? (
        <CommandConfigDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          guildId={guildId}
          command={editing.key}
          description={editing.desc}
          config={configs[editing.key] ?? defaultCommandConfig(editing.key)}
          structure={config.structure}
          onSaved={refresh}
        />
      ) : null}
    </div>

  );
}
