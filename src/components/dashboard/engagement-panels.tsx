import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Coins, Loader2, Minus, Plus, Trash2, Trophy, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { adminAdjustEconomy, adminAdjustXp } from "@/lib/xp-admin.functions";
import { deleteReminder, getEngagement } from "@/lib/ahoy.functions";

import { SectionHeader } from "./fields";

export function useEngagement(guildId: string) { return useQuery({ queryKey: ["engagement", guildId], queryFn: () => getEngagement({ data: { guildId } }) }); }
function Rank({ index }: { index: number }) { const medal = ["bg-gold/20 text-gold", "bg-primary/15 text-primary", "bg-secondary text-foreground"][index]; return <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${medal ?? "bg-secondary/50 text-muted-foreground"}`}>{index + 1}</span>; }
function Empty({ children }: { children: string }) { return <p className="text-sm text-muted-foreground">{children}</p>; }
function Loading() { return <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>; }

export function LeaderboardPanel({ guildId, currency }: { guildId: string; currency: string }) {
  const engagement = useEngagement(guildId);
  return <div className="grid gap-6 lg:grid-cols-2">
    <Card className="glass border-0"><CardContent className="space-y-4 pt-6"><SectionHeader title="XP leaderboard" description="Top 25 crew members by experience earned." badge="Levels" />{engagement.isPending ? <Loading /> : engagement.data && engagement.data.xp.length > 0 ? <ul className="space-y-2">{engagement.data.xp.map((row, index) => <li key={row.user_id} className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 px-4 py-2.5 text-sm"><Rank index={index} /><span className="truncate font-medium">{row.username ?? row.user_id}</span><Badge variant="outline" className="ml-auto border-primary/40 text-primary"><Trophy className="h-3 w-3" />Lv {row.level}</Badge><span className="w-24 text-right text-xs text-muted-foreground">{row.xp.toLocaleString()} XP</span></li>)}</ul> : <Empty>No XP earned yet — chat activity will fill this board.</Empty>}</CardContent></Card>
    <Card className="glass border-0"><CardContent className="space-y-4 pt-6"><SectionHeader title="Richest crew" description={`Top 25 balances in ${currency}.`} badge="Economy" />{engagement.isPending ? <Loading /> : engagement.data && engagement.data.economy.length > 0 ? <ul className="space-y-2">{engagement.data.economy.map((row, index) => <li key={row.user_id} className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 px-4 py-2.5 text-sm"><Rank index={index} /><span className="truncate font-medium">{row.username ?? row.user_id}</span><span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"><Coins className="h-3.5 w-3.5 text-gold" />{Number(row.balance).toLocaleString()} on hand</span><span className="w-24 text-right text-xs text-muted-foreground">{Number(row.bank).toLocaleString()} banked</span></li>)}</ul> : <Empty>No balances yet — enable the economy and let the crew earn.</Empty>}</CardContent></Card>
  </div>;
}

function AdminAdjustmentCard({ type, guildId }: { type: "xp" | "economy"; guildId: string }) {
  const isXp = type === "xp";
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<"give" | "remove" | "set">("give");
  const adjustXp = useServerFn(adminAdjustXp);
  const adjustEconomy = useServerFn(adminAdjustEconomy);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => isXp
      ? adjustXp({ data: { guildId, userId: userId.trim(), amount, action, reason: reason.trim() || undefined } })
      : adjustEconomy({ data: { guildId, userId: userId.trim(), amount, action, reason: reason.trim() || undefined } }),
    onSuccess: (result) => {
      if (isXp) toast.success(`XP updated: ${result.oldXp.toLocaleString()} → ${result.newXp.toLocaleString()} XP (Level ${result.newLevel})`);
      else toast.success(`Balance updated: ${result.oldBalance.toLocaleString()} → ${result.newBalance.toLocaleString()}`);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["engagement", guildId] });
      queryClient.invalidateQueries({ queryKey: ["ranks", guildId] });
    },
    onError: (error: Error) => toast.error(error.message || `Could not update ${isXp ? "XP" : "economy"}`),
  });
  const max = isXp ? 10_000_000 : 2_000_000_000;
  const valid = /^\d{5,25}$/.test(userId.trim()) && Number.isInteger(amount) && amount >= 0 && amount <= max;
  const label = isXp ? "XP" : "currency";
  return <Card className="glass border-0"><CardContent className="space-y-5 pt-6">
    <SectionHeader title={isXp ? "XP administration" : "Economy administration"} description={isXp ? "Give, remove or set member XP. Changes are audited with old/new values and a reason." : "Give, remove or set a member's wallet balance. Changes are audited for staff accountability."} badge="Admin" />
    <div className="grid gap-4 md:grid-cols-2"><label className="space-y-2 text-sm"><span className="flex items-center gap-2 font-medium"><UserRound className="h-4 w-4 text-primary" />Discord user ID</span><Input value={userId} inputMode="numeric" placeholder="123456789012345678" onChange={(e) => setUserId(e.target.value)} /></label><label className="space-y-2 text-sm"><span className="font-medium">Amount</span><Input type="number" min={0} max={max} value={amount} onChange={(e) => setAmount(Math.max(0, Math.min(max, Number(e.target.value) || 0)))} /></label></div>
    <div className="grid gap-2 sm:grid-cols-3"><Button type="button" variant={action === "give" ? "default" : "outline"} className="gap-2" onClick={() => setAction("give")}><Plus className="h-4 w-4" />Give {label}</Button><Button type="button" variant={action === "remove" ? "default" : "outline"} className="gap-2" onClick={() => setAction("remove")}><Minus className="h-4 w-4" />Remove {label}</Button><Button type="button" variant={action === "set" ? "default" : "outline"} onClick={() => setAction("set")}>Set exact {label}</Button></div>
    <label className="space-y-2 text-sm"><span className="font-medium">Reason <span className="text-muted-foreground">(optional)</span></span><Textarea rows={2} maxLength={500} value={reason} placeholder={isXp ? "e.g. Manual reward for an event" : "e.g. Event prize or correction"} onChange={(e) => setReason(e.target.value)} /></label>
    <div className="flex flex-wrap items-center gap-3"><Button disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{action === "give" ? `Give ${label}` : action === "remove" ? `Remove ${label}` : `Set ${label}`}</Button>{isXp ? <span className="text-xs text-muted-foreground">Uses the same level curve as the Discord bot.</span> : <span className="text-xs text-muted-foreground">Wallet balance never goes below zero.</span>}</div>
  </CardContent></Card>;
}

export function XpAdminPanel({ guildId }: { guildId: string }) { return <AdminAdjustmentCard type="xp" guildId={guildId} />; }
export function EconomyAdminPanel({ guildId }: { guildId: string }) { return <AdminAdjustmentCard type="economy" guildId={guildId} />; }

export function RemindersPanel({ guildId }: { guildId: string }) {
  const engagement = useEngagement(guildId); const queryClient = useQueryClient(); const cancel = useServerFn(deleteReminder);
  const mutation = useMutation({ mutationFn: (id: string) => cancel({ data: { guildId, id } }), onSuccess: () => { toast.success("Reminder cancelled"); queryClient.invalidateQueries({ queryKey: ["engagement", guildId] }); }, onError: (error: Error) => toast.error(error.message || "Could not cancel that reminder") });
  const reminders = engagement.data?.reminders ?? []; const pending = reminders.filter((r) => !r.delivered);
  return <Card className="glass border-0"><CardContent className="space-y-4 pt-6"><SectionHeader title="Reminders" description="Everything the crew has asked ! HOY to remember, newest deadline first." badge={`${pending.length} pending`} />{engagement.isPending ? <Loading /> : reminders.length > 0 ? <ul className="space-y-2">{reminders.map((reminder) => <li key={reminder.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 px-4 py-3 text-sm"><BellRing className={`h-4 w-4 ${reminder.delivered ? "text-muted-foreground" : "text-gold"}`} /><span className="min-w-0 flex-1 truncate">{reminder.message}</span><Badge variant="outline" className="border-border text-muted-foreground">{reminder.delivered ? "Delivered" : "Pending"}</Badge><span className="text-xs text-muted-foreground">{new Date(reminder.remind_at).toLocaleString()}</span><Button variant="ghost" size="icon" aria-label="Cancel reminder" disabled={mutation.isPending} onClick={() => mutation.mutate(reminder.id)}>{mutation.isPending && mutation.variables === reminder.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></li>)}</ul> : <Empty>No reminders scheduled. Crew members can use /remind in Discord.</Empty>}</CardContent></Card>;
}
