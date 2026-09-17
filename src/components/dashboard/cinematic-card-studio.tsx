import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Eye, Gem, Sparkles, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { getCardSettings, saveCardSettings } from "@/lib/card-settings.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleRow } from "./fields";

const styles = [
  { value: "glassmorphism", label: "Glassmorphism", note: "Blurred glass + teal/gold glow" },
  { value: "gold", label: "Gold Edition", note: "Warm cinematic brass treatment" },
  { value: "minimal", label: "Minimal", note: "Clean Discord-first presentation" },
] as const;

export function CinematicCardStudio({ guildId }: { guildId: string }) {
  const query = useQuery({ queryKey: ["card-settings", guildId], queryFn: () => getCardSettings({ data: { guildId } }) });
  const save = useServerFn(saveCardSettings);
  const mutation = useMutation({ mutationFn: (values: Record<string, unknown>) => save({ data: { guildId, values } }), onSuccess: () => { toast.success("Cinematic card settings saved"); void query.refetch(); }, onError: (e: Error) => toast.error(e.message) });
  const s = query.data as any;
  if (!s) return null;
  const patch = (key: string, value: unknown) => mutation.mutate({ [key]: value });
  return <Card className="glass border-0 overflow-hidden"><CardContent className="space-y-6 pt-6">
    <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Gem className="size-5 text-primary" /><h2 className="text-lg font-bold">Cinematic Card Studio</h2></div><p className="mt-1 text-sm text-muted-foreground">Control how XP, level-up, welcome and profile cards appear to your Discord community.</p></div><span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary">Live configuration</span></div>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-primary/20 bg-black/20 p-4 space-y-4"><div><p className="font-semibold">XP & Level-up Cards</p><p className="text-xs text-muted-foreground">Every-message XP can announce level changes as a premium embed.</p></div><ToggleRow label="Enable XP rank card" checked={s.xp_card_enabled} onChange={(v) => patch("xp_card_enabled", v)} /><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs">XP card style<Select value={s.xp_card_style} onValueChange={(v) => patch("xp_card_style", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{styles.map(x => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent></Select></label><label className="space-y-1 text-xs">Level-up style<Select value={s.level_up_card_style} onValueChange={(v) => patch("level_up_card_style", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{styles.map(x => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent></Select></label></div><div className="grid gap-2 sm:grid-cols-2"><ToggleRow label="Show XP progress" checked={s.xp_card_show_progress} onChange={(v) => patch("xp_card_show_progress", v)} /><ToggleRow label="Show server rank" checked={s.xp_card_show_rank} onChange={(v) => patch("xp_card_show_rank", v)} /><ToggleRow label="Show profile stats" checked={s.xp_card_show_stats} onChange={(v) => patch("xp_card_show_stats", v)} /><ToggleRow label="Show total XP" checked={s.xp_card_show_total_xp} onChange={(v) => patch("xp_card_show_total_xp", v)} /><ToggleRow label="Enable level-up card" checked={s.level_up_card_enabled} onChange={(v) => patch("level_up_card_enabled", v)} /><ToggleRow label="Level-up progress" checked={s.level_up_card_show_progress} onChange={(v) => patch("level_up_card_show_progress", v)} /><ToggleRow label="Level-up rank" checked={s.level_up_card_show_rank} onChange={(v) => patch("level_up_card_show_rank", v)} /></div></section>
      <section className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4"><div><p className="font-semibold">Welcomer & Profile</p><p className="text-xs text-muted-foreground">One visual language across member-facing cards.</p></div><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs">Welcome style<Select value={s.welcome_card_style} onValueChange={(v) => patch("welcome_card_style", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{styles.map(x => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent></Select></label><label className="space-y-1 text-xs">Profile style<Select value={s.profile_card_style} onValueChange={(v) => patch("profile_card_style", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{styles.map(x => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent></Select></label></div><div className="rounded-xl border border-primary/10 bg-primary/[0.04] p-4"><div className="flex items-center gap-2 text-primary"><Sparkles className="size-4" /><span className="text-sm font-semibold">Preview behaviour</span></div><div className="mt-3 rounded-xl border border-white/10 bg-[#07131d]/90 p-4 shadow-[0_0_30px_rgba(31,182,166,.08)]"><div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-widest text-primary">LEVEL UP</span><span className="text-xs text-white/40">Cinematic Embed</span></div><p className="mt-2 font-semibold">⚓ Your crew reached the next level</p><p className="mt-1 text-xs text-white/45">Progress, rank and total XP appear according to your toggles.</p><div className="mt-3 h-2 rounded-full bg-white/10"><div className="h-2 w-3/4 rounded-full bg-primary shadow-[0_0_14px_rgba(31,182,166,.45)]" /></div></div></div><Button variant="outline" className="w-full" disabled={mutation.isPending} onClick={() => void query.refetch()}><Eye className="mr-2 size-4" />Refresh preview</Button></section>
    </div>
  </CardContent></Card>;
}

export function FeatureTestStudio({ guildId }: { guildId: string }) {
  const [kind, setKind] = React.useState<"welcome" | "send" | "xp">("welcome");
  return null;
}
