import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calculator, CheckCircle2, Gauge, MessageSquare, Plus, Search, Shield, Trophy, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getEngagement, searchXpMembers } from "@/lib/ahoy.functions";
import { useDraft } from "./use-draft";
import { SaveBar } from "./save-bar";
import { Field, PickerSelect, SectionHeader, ToggleRow } from "./fields";
import type { PanelProps } from "./types";
import { PremiumGate } from "./premium-gate";
import { adminAdjustXp } from "@/lib/xp-admin.functions";

function num(value: unknown, fallback: number) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function levelForXp(xp: number, perLevel: number) { return Math.max(0, Math.floor((Math.max(0, xp) + perLevel - 0.0000001) / perLevel)); }
function xpForLevel(level: number, perLevel: number) { return Math.max(0, Math.floor(level) * perLevel); }
function formatXp(value: number) { return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 1 }); }

export function XpLevelingPage({ guildId, config, onSaved }: PanelProps) {
  const settings = (config.settings ?? {}) as Record<string, any>;
  const roleSettings = (config.roles ?? {}) as Record<string, any>;
  const channels = config.structure.channels.filter((c) => c.kind === "text");
  const engagement = useQuery({ queryKey: ["xp-leveling", guildId], queryFn: () => getEngagement({ data: { guildId } }) });
  const general = useDraft(guildId, "general", {
    xp_enabled: settings.xp_enabled ?? true, xp_per_message: settings.xp_per_message ?? 7.5, xp_per_level: settings.xp_per_level ?? 200,
    rank_every_levels: settings.rank_every_levels ?? 2, xp_cooldown_seconds: settings.xp_cooldown_seconds ?? 60,
    xp_ignored_channel_ids: settings.xp_ignored_channel_ids ?? [], xp_ignored_role_ids: settings.xp_ignored_role_ids ?? [],
    level_up_message: settings.level_up_message ?? "Ahoy {user}, you reached level {level}! ⚓", level_up_channel_id: settings.level_up_channel_id ?? null,
  }, onSaved);
  const roles = useDraft(guildId, "roles", { level_roles: Array.isArray(roleSettings.level_roles) ? roleSettings.level_roles : [] }, onSaved);
  const [calculatorXp, setCalculatorXp] = useState(0);
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState(100);
  const adjust = useServerFn(adminAdjustXp);
  const perLevel = num(general.draft.xp_per_level, 200);
  const calculatedLevel = levelForXp(num(calculatorXp, 0), perLevel);
  const calculatedTarget = xpForLevel(calculatedLevel + 1, perLevel);
  const progress = calculatedTarget > 0 ? Math.min(100, Math.max(0, (num(calculatorXp, 0) / calculatedTarget) * 100)) : 0;
  const memberSearch = useQuery({ queryKey: ["xp-member-search", guildId, memberQuery.trim()], queryFn: () => searchXpMembers({ data: { guildId, query: memberQuery.trim() } }), enabled: memberQuery.trim().length >= 2 });
  const adjustment = useMutation({
    mutationFn: async (action: "give" | "remove") => adjust({ data: { guildId, userId: selectedMember.user_id, amount: adjustAmount, action, reason: "XP & Leveling dashboard adjustment" } }),
    onSuccess: (result) => { toast.success(`XP updated: ${formatXp(result.oldXp)} → ${formatXp(result.newXp)} XP (Level ${result.newLevel})`); setSelectedMember((m: any) => m ? { ...m, xp: result.newXp, level: result.newLevel } : m); void engagement.refetch(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const addRoleRule = () => roles.set("level_roles", [...(roles.draft.level_roles ?? []), { level: 1, role_id: config.structure.roles[0]?.id ?? "" }]);
  const updateRule = (index: number, key: "level" | "role_id", value: string) => { const next = [...(roles.draft.level_roles ?? [])]; next[index] = { ...next[index], [key]: key === "level" ? Math.max(1, Number(value) || 1) : value }; roles.set("level_roles", next); };
  const removeRule = (index: number) => roles.set("level_roles", (roles.draft.level_roles ?? []).filter((_: any, i: number) => i !== index));
  const previewLevels = useMemo(() => Array.from({ length: 10 }, (_, i) => { const level = i + 1; return { level, xp: xpForLevel(level, perLevel), rank: Math.floor(level / Math.max(1, num(general.draft.rank_every_levels, 2))) }; }), [perLevel, general.draft.rank_every_levels]);

  return <PremiumGate feature="levels"><div className="space-y-6">
    <Card className="glass border-0 overflow-hidden"><CardContent className="space-y-5 pt-6">
      <SectionHeader title="XP & Leveling Control Center" description="One place for automatic message XP, leveling, rank rewards, member progression and the leaderboard." badge={general.draft.xp_enabled ? "ACTIVE" : "DISABLED"} />
      <div className="grid gap-3 sm:grid-cols-4">{[
        ["Automatic XP", general.draft.xp_enabled ? "ON" : "OFF", MessageSquare], ["XP / message", formatXp(num(general.draft.xp_per_message, 7.5)), Gauge],
        ["XP / level", formatXp(perLevel), Trophy], ["Cooldown", `${num(general.draft.xp_cooldown_seconds, 60)}s`, Shield],
      ].map(([label, value, Icon]: any) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><Icon className="mb-3 size-4 text-primary" /><p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>)}</div>
      <ToggleRow label="Award XP automatically from eligible messages" description="Bots and DMs are excluded by the real Discord message handler." checked={general.draft.xp_enabled} onChange={(v) => general.set("xp_enabled", v)} />
    </CardContent></Card>

    <Card className="glass border-0"><CardContent className="space-y-5 pt-6">
      <SectionHeader title="Automatic XP rules" description="These values control the actual XP awarded by the bot." badge="LIVE BOT CONFIG" />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <Field label="XP per message" hint="0.1–500 XP"><Input type="number" min={0.1} max={500} step={0.1} value={general.draft.xp_per_message} onChange={(e) => general.set("xp_per_message", num(e.target.value, 7.5))} /></Field>
        <Field label="XP required per level" hint="Each completed block is one level."><Input type="number" min={1} max={100000} step={1} value={general.draft.xp_per_level} onChange={(e) => general.set("xp_per_level", num(e.target.value, 200))} /></Field>
        <Field label="Message cooldown" hint="0 = every eligible message."><Input type="number" min={0} max={3600} value={general.draft.xp_cooldown_seconds} onChange={(e) => general.set("xp_cooldown_seconds", Math.max(0, Math.min(3600, num(e.target.value, 60))))} /></Field>
        <Field label="Rank every N levels" hint="Used for the displayed crew rank."><Input type="number" min={1} max={100} step={1} value={general.draft.rank_every_levels} onChange={(e) => general.set("rank_every_levels", num(e.target.value, 2))} /></Field>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Level-up channel"><PickerSelect value={general.draft.level_up_channel_id} options={channels} onChange={(v) => general.set("level_up_channel_id", v)} placeholder="Select a channel" /></Field>
        <Field label="Level-up message" hint="Placeholders: {user}, {username}, {server}, {level}"><Input value={general.draft.level_up_message} onChange={(e) => general.set("level_up_message", e.target.value)} maxLength={500} /></Field>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Ignored XP channels" hint="Messages here earn no XP."><div className="space-y-2">
          {(general.draft.xp_ignored_channel_ids ?? []).map((id: string) => <div key={id} className="flex gap-2"><PickerSelect value={id} options={channels} onChange={(v) => general.set("xp_ignored_channel_ids", (general.draft.xp_ignored_channel_ids ?? []).map((x: string) => x === id ? v : x))} placeholder="Select channel" /><Button type="button" variant="ghost" size="icon" onClick={() => general.set("xp_ignored_channel_ids", (general.draft.xp_ignored_channel_ids ?? []).filter((x: string) => x !== id))}><X className="size-4" /></Button></div>)}
          <Button type="button" variant="outline" className="w-full" onClick={() => general.set("xp_ignored_channel_ids", [...(general.draft.xp_ignored_channel_ids ?? []), channels[0]?.id ?? ""])}><Plus className="mr-2 size-4" />Ignore channel</Button>
        </div></Field>
        <Field label="Ignored XP roles" hint="Members with any selected role earn no XP."><div className="space-y-2">
          {(general.draft.xp_ignored_role_ids ?? []).map((id: string) => <div key={id} className="flex gap-2"><PickerSelect value={id} options={config.structure.roles} onChange={(v) => general.set("xp_ignored_role_ids", (general.draft.xp_ignored_role_ids ?? []).map((x: string) => x === id ? v : x))} placeholder="Select role" /><Button type="button" variant="ghost" size="icon" onClick={() => general.set("xp_ignored_role_ids", (general.draft.xp_ignored_role_ids ?? []).filter((x: string) => x !== id))}><X className="size-4" /></Button></div>)}
          <Button type="button" variant="outline" className="w-full" onClick={() => general.set("xp_ignored_role_ids", [...(general.draft.xp_ignored_role_ids ?? []), config.structure.roles[0]?.id ?? ""])}><Plus className="mr-2 size-4" />Ignore role</Button>
        </div></Field>
      </div>
      <SaveBar {...general} />
    </CardContent></Card>

    <Card className="glass border-0"><CardContent className="space-y-5 pt-6">
      <SectionHeader title="Level curve & calculator" description="The current bot uses a linear cumulative curve: level × XP required per level." badge="PREVIEW" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-primary/15 bg-primary/[.04] p-5"><div className="flex items-center gap-2 text-primary"><Calculator className="size-4" /><span className="font-semibold">XP calculator</span></div><Input className="mt-4" type="number" min={0} value={calculatorXp} onChange={(e) => setCalculatorXp(Math.max(0, num(e.target.value, 0)))} placeholder="Enter total XP" /><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-white/[.04] p-3"><p className="text-[10px] text-muted-foreground">LEVEL</p><p className="text-xl font-black">{calculatedLevel}</p></div><div className="rounded-xl bg-white/[.04] p-3"><p className="text-[10px] text-muted-foreground">NEXT</p><p className="text-xl font-black">{formatXp(calculatedTarget)}</p></div><div className="rounded-xl bg-white/[.04] p-3"><p className="text-[10px] text-muted-foreground">PROGRESS</p><p className="text-xl font-black">{Math.round(progress)}%</p></div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div></div>
        <div className="overflow-hidden rounded-2xl border border-white/10"><div className="grid grid-cols-3 border-b border-white/10 bg-white/[.03] px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"><span>Level</span><span>XP threshold</span><span>Rank</span></div>{previewLevels.map((row) => <div key={row.level} className="grid grid-cols-3 border-b border-white/5 px-4 py-2.5 text-sm last:border-0"><span>Lv {row.level}</span><span>{formatXp(row.xp)} XP</span><span>Rank {row.rank}</span></div>)}</div>
      </div>
    </CardContent></Card>

    <Card className="glass border-0"><CardContent className="space-y-5 pt-6">
      <SectionHeader title="Automatic rank roles" description="Roles are granted when members reach their configured level threshold." badge="ROLE REWARDS" />
      <div className="space-y-3">{(roles.draft.level_roles ?? []).map((rule: any, index: number) => <div key={index} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-3 sm:grid-cols-[140px_1fr_auto]"><Field label="Level"><Input type="number" min={1} max={500} value={rule.level} onChange={(e) => updateRule(index, "level", e.target.value)} /></Field><Field label="Discord role"><PickerSelect value={rule.role_id} options={config.structure.roles} onChange={(v) => updateRule(index, "role_id", v)} placeholder="Select role" /></Field><Button type="button" variant="ghost" size="icon" className="self-end" onClick={() => removeRule(index)}><X className="size-4" /></Button></div>)}</div>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={addRoleRule}><Plus className="mr-2 size-4" />Add level role</Button><SaveBar {...roles} /></div>
      <p className="text-xs text-muted-foreground">The bot must have Manage Roles and its highest role must be above each reward role.</p>
    </CardContent></Card>

    <Card className="glass border-0"><CardContent className="space-y-5 pt-6">
      <SectionHeader title="Member progression" description="Search a real tracked member and adjust XP without leaving this page." badge="ADMIN" />
      <div className="flex gap-2"><Input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="Discord username or user ID" /><Button type="button" variant="outline"><Search className="size-4" /></Button></div>
      {memberSearch.data?.members?.length ? <div className="space-y-2">{memberSearch.data.members.map((member: any) => <button key={member.user_id} type="button" onClick={() => { setSelectedMember(member); setMemberQuery(member.username ?? member.user_id); }} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3 text-left hover:bg-white/[.06]"><Users className="size-4 text-primary" /><span className="min-w-0 flex-1 truncate">{member.username ?? member.user_id}</span><Badge>Lv {member.level}</Badge><span className="text-xs text-muted-foreground">{formatXp(Number(member.xp))} XP</span></button>)}</div> : null}
      {selectedMember ? <div className="rounded-2xl border border-primary/20 bg-primary/[.04] p-4"><div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="font-semibold">{selectedMember.username ?? selectedMember.user_id}</p><p className="text-xs text-muted-foreground">{selectedMember.user_id}</p></div><Badge variant="outline">Level {selectedMember.level}</Badge><Badge variant="outline">{formatXp(Number(selectedMember.xp))} XP</Badge></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><Input type="number" min={1} value={adjustAmount} onChange={(e) => setAdjustAmount(Math.max(1, num(e.target.value, 100)))} /><Button disabled={adjustment.isPending} onClick={() => adjustment.mutate("give")}>Give XP</Button><Button variant="outline" disabled={adjustment.isPending} onClick={() => adjustment.mutate("remove")}>Remove XP</Button></div></div> : null}
    </CardContent></Card>

    <Card className="glass border-0"><CardContent className="space-y-5 pt-6">
      <SectionHeader title="XP leaderboard" description="Top 25 members by real stored XP." badge="LIVE" />
      {engagement.isPending ? <p className="text-sm text-muted-foreground">Loading leaderboard…</p> : engagement.data?.xp?.length ? <div className="space-y-2">{engagement.data.xp.map((row: any, index: number) => <div key={row.user_id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3"><span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span><span className="min-w-0 flex-1 truncate font-medium">{row.username ?? row.user_id}</span><Badge variant="outline">Lv {row.level}</Badge><span className="text-xs text-muted-foreground">{formatXp(Number(row.xp))} XP</span></div>)}</div> : <p className="text-sm text-muted-foreground">No XP profiles yet.</p>}
    </CardContent></Card>

    <Card className="glass border-0"><CardContent className="space-y-4 pt-6"><SectionHeader title="Progression pipeline" description="How the live bot processes chat activity." badge="CONNECTED" /><div className="flex flex-wrap items-center gap-2 text-xs"><Badge>Message</Badge><span>→</span><Badge>Cooldown / exclusions</Badge><span>→</span><Badge>+ XP</Badge><span>→</span><Badge>Level calculation</Badge><span>→</span><Badge>Role reward</Badge><span>→</span><Badge>Level-up card</Badge></div><div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/[.04] p-4"><CheckCircle2 className="size-5 text-primary" /><p className="text-sm text-muted-foreground">All controls on this page use the same server configuration and XP profiles used by the Discord bot.</p></div></CardContent></Card>
  </div></PremiumGate>;
}
