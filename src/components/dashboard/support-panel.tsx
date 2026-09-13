import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareText, Send, LifeBuoy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createSupportReport, getMySupportReports } from "@/lib/support.functions";

export function SupportPanel() {
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<"bug"|"feature"|"complaint"|"account"|"general">("bug");
  const [priority, setPriority] = useState<"low"|"normal"|"high"|"urgent">("normal");
  const [message, setMessage] = useState("");
  const reports = useQuery({ queryKey: ["my-support-reports"], queryFn: getMySupportReports });
  const send = useMutation({ mutationFn: () => createSupportReport({ data: { subject, category, priority, message } }), onSuccess: () => { setSubject(""); setMessage(""); qc.invalidateQueries({ queryKey: ["my-support-reports"] }); } });
  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-[28px] border border-primary/20 bg-gradient-to-br from-primary/10 via-white/[0.035] to-transparent p-6 shadow-2xl backdrop-blur-2xl">
      <div className="relative flex items-start gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><LifeBuoy className="size-6" /></span><div><p className="text-[9px] font-bold uppercase tracking-[.25em] text-primary">!HOY BOT Support</p><h2 className="mt-1 text-2xl font-black">Send feedback or report an issue</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Tell the support team what happened. Your report is delivered directly to the Owner Console for review and reply.</p></div></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2"><Input aria-label="Support subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short subject" /><Select value={category} onValueChange={(v) => setCategory(v as typeof category)}><SelectTrigger aria-label="Support category"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bug">Bug / broken feature</SelectItem><SelectItem value="feature">Feature request</SelectItem><SelectItem value="complaint">Complaint</SelectItem><SelectItem value="account">Account / access</SelectItem><SelectItem value="general">General question</SelectItem></SelectContent></Select></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]"><Textarea aria-label="Support message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Explain the issue, what you expected, and what happened..." className="min-h-32" /><Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}><SelectTrigger aria-label="Priority" className="sm:w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select></div>
      <Button disabled={send.isPending || subject.trim().length < 3 || message.trim().length < 5} onClick={() => send.mutate()} className="mt-3 gap-2"><Send className="size-4" />{send.isPending ? "Sending…" : "Send to support"}</Button>
      {send.isSuccess ? <p role="status" className="mt-3 text-sm text-emerald-300">Sent successfully. Support can now review and reply.</p> : null}
      {send.error ? <p role="alert" className="mt-3 text-sm text-red-300">{(send.error as Error).message}</p> : null}
    </section>
    <section className="rounded-3xl border border-white/[0.1] bg-white/[0.03] p-5 backdrop-blur-xl"><div className="flex items-center gap-2"><MessageSquareText className="size-5 text-primary" /><h3 className="font-bold">My support conversations</h3></div><div className="mt-4 space-y-3">{reports.data?.length ? reports.data.map((r: any) => <article key={r.id} className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">{r.subject}</div><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-wider text-white/50">{r.status}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-white/60">{r.message}</p>{r.admin_reply ? <div className="mt-3 rounded-xl border border-primary/15 bg-primary/[0.05] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-primary">Support reply</p><p className="mt-1 whitespace-pre-wrap text-sm text-white/75">{r.admin_reply}</p></div> : null}</article>) : <p className="text-sm text-muted-foreground">No support conversations yet.</p>}</div></section>
  </div>;
}