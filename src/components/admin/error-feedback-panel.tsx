import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Trash2, RefreshCw, MessageSquareWarning, Server, Hash, UserRound, MapPin, Terminal } from "lucide-react";
import { getAllErrorLogs, updateErrorStatus, deleteErrorLog } from "@/lib/error-log.functions";
import { SupportReportsPanel } from "./support-reports-panel";
import { Button } from "@/components/ui/button";

function explain(entry: any) {
  const type = String(entry.error_type || "UnknownError");
  if (type === "CommandNotFound") return `Discord received a prefix command named '${entry.command || "unknown"}', but !HOY BOT does not have a registered command with that name. This commonly happens when ordinary text is sent with the bot prefix, a custom command is disabled/not loaded, or the command name is incorrect.`;
  if (type.includes("MissingPermissions")) return "The bot or invoking member did not have the Discord permission required by this command.";
  if (type.includes("NotFound")) return "The requested Discord resource could not be found. Check the server, channel, message, role or saved dashboard configuration shown below.";
  if (type.includes("HTTPException")) return "Discord rejected an API request. The traceback and command context below identify the operation that failed.";
  return "The bot captured an exception while processing the recorded source. Review the command, server, channel, user, location, cause and traceback to identify the failing operation.";
}

function contextParts(entry: any) {
  const raw = String(entry.context || "");
  const pick = (label: string) => {
    const match = raw.match(new RegExp(`${label}:\\s*([^;]+)`));
    return match?.[1]?.trim() || "";
  };
  const server = pick("Server");
  const channel = pick("Channel");
  const user = pick("User");
  return {
    serverName: server.replace(/\\s*\\(ID:\\s*\\d+\\)\\s*$/, "") || "Unknown server",
    channelName: channel.replace(/\\s*\\(ID:\\s*\\d+\\)\\s*$/, "") || "Unknown channel",
    userName: user.replace(/\\s*\\(ID:\\s*\\d+\\)\\s*$/, "") || "Unknown user",
  };
}

function ContextCard({ icon: Icon, label, name, id }: { icon: typeof Server; label: string; name: string; id?: string | null }) {
  return <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
    <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.18em] text-white/35"><Icon className="size-3.5 text-primary" />{label}</div>
    <p className="mt-2 break-words text-sm font-semibold text-white/80">{name}</p>
    {id ? <p className="mt-1 break-all font-mono text-[10px] text-white/25">ID: {id}</p> : null}
  </div>;
}

export function ErrorFeedbackPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["all-error-logs"], queryFn: getAllErrorLogs, refetchInterval: 10000 });
  const status = useMutation({ mutationFn: updateErrorStatus, onSuccess: () => qc.invalidateQueries({ queryKey: ["all-error-logs"] }) });
  const del = useMutation({ mutationFn: deleteErrorLog, onSuccess: () => qc.invalidateQueries({ queryKey: ["all-error-logs"] }) });

  return <div className="space-y-6">
    <section className="rounded-3xl border border-red-400/15 bg-red-400/[0.035] p-5 backdrop-blur-xl">
      <div className="flex items-start gap-3"><span className="flex size-11 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10 text-red-300"><AlertTriangle className="size-5" /></span><div><p className="text-[9px] font-bold uppercase tracking-[.25em] text-red-300">ALL ERROR LOGS</p><h2 className="mt-1 text-2xl font-black">Error & Feedback Center</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Every captured bot error is classified with its source, likely cause, location and technical traceback. Server, channel and user names are shown first, with IDs retained only as secondary diagnostic references.</p></div></div>
    </section>

    <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">Bot errors</h3><p className="text-xs text-white/35">Auto-refreshes every 10 seconds</p></div><Button variant="outline" size="sm" onClick={() => void q.refetch()} className="gap-2"><RefreshCw className="size-4" />Refresh</Button></div>

    <div className="space-y-3">
      {q.data?.map((e: any) => {
        const ctx = contextParts(e);
        return <details key={e.id} className={`rounded-3xl border p-5 backdrop-blur-xl ${e.status === "fixed" ? "border-emerald-400/15 bg-emerald-400/[0.025]" : "border-red-400/15 bg-white/[0.025]"}`}>
          <summary className="cursor-pointer list-none"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-white/10 px-2 py-1 text-[9px] uppercase tracking-wider text-white/50">{e.source || "unknown source"}</span><span className="font-mono text-sm text-red-200">{e.error_type}</span><span className="text-sm text-white/65">{e.message}</span></div><p className="mt-2 text-xs text-white/35">{e.command ? `Command: ${e.command} · ` : ""}{ctx.serverName} · {ctx.channelName} · {ctx.userName} · {new Date(e.created_at).toLocaleString()}</p></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${e.status === "fixed" ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>{e.status || "pending"}</span></div></summary>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-amber-400/10 bg-amber-400/[0.035] p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-amber-300">Likely cause</p><p className="mt-1 text-sm leading-6 text-white/70">{e.cause || explain(e)}</p></div>
            <div><p className="mb-2 text-[9px] font-bold uppercase tracking-[.18em] text-white/35">Execution context</p><div className="grid gap-3 md:grid-cols-3"><ContextCard icon={Server} label="Server / Guild" name={ctx.serverName} id={e.guild_id} /><ContextCard icon={Hash} label="Channel" name={ctx.channelName} id={e.channel_id} /><ContextCard icon={UserRound} label="User" name={ctx.userName} id={e.user_id} /></div></div>
            <div className="grid gap-3 sm:grid-cols-2"><Info label="Source" value={e.source || "Unknown"} icon={Terminal} /><Info label="Location" value={e.location || e.command || "Runtime / event handler"} icon={MapPin} /></div>
            {e.context ? <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-white/30">Full context</p><p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-white/55">{e.context}</p></div> : null}
            {e.traceback ? <div><p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-white/35">Technical traceback</p><pre className="max-h-72 overflow-auto rounded-2xl border border-white/[0.08] bg-black/40 p-4 text-xs leading-5 text-red-100/70">{e.traceback}</pre></div> : null}
            <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => status.mutate({ data: { id: e.id, status: "fixed" } })} className="gap-2"><CheckCircle2 className="size-4" />Fixed</Button><Button size="sm" variant="outline" onClick={() => status.mutate({ data: { id: e.id, status: "pending" } })}>Pending fix</Button><Button size="sm" variant="outline" className="text-red-300" onClick={() => { if (confirm("Delete this error log?")) del.mutate({ data: { id: e.id } }); }}><Trash2 className="size-4" />Delete</Button></div>
          </div>
        </details>;
      })}
      {!q.isLoading && !q.data?.length ? <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">No bot errors have been captured.</div> : null}
    </div>

    <section className="pt-2"><div className="mb-4 flex items-center gap-2"><MessageSquareWarning className="size-5 text-primary" /><h3 className="font-bold">User feedback & complaints</h3></div><SupportReportsPanel /></section>
  </div>;
}

function Info({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Terminal }) {
  return <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-3"><div className="flex items-center gap-2 text-[9px] uppercase tracking-wider text-white/30"><Icon className="size-3.5 text-primary" />{label}</div><p className="mt-1 break-words text-xs text-white/60">{value}</p></div>;
}
