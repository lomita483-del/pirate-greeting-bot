import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BellRing, Download, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listAppReleases, publishAppRelease } from "@/lib/admin.functions";

export function AppUpdatesPanel() {
  const query = useQuery({ queryKey: ["admin","app-releases"], queryFn: listAppReleases });
  const [platform,setPlatform]=useState<"android"|"ios"|"all">("android");
  const [version,setVersion]=useState("1.0.1");
  const [build,setBuild]=useState("2");
  const [minimum,setMinimum]=useState("1.0.0");
  const [url,setUrl]=useState("");
  const [notes,setNotes]=useState("");
  const [force,setForce]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  async function publish() {
    setSaving(true); setMessage("");
    try {
      await publishAppRelease({
        platform, version, build:Number(build), minimum_supported_version:minimum,
        download_url:url, release_notes:notes.split("\n").map(v=>v.trim()).filter(Boolean),
        force_update:force, published:true,
      });
      setMessage("Update published. Installed Ahoy apps will detect the new build.");
      void query.refetch();
    } catch(e) { setMessage(e instanceof Error ? e.message : "Could not publish update."); }
    finally { setSaving(false); }
  }

  return <div className="space-y-5">
    <div className="rounded-3xl border border-primary/20 bg-primary/[.04] p-5">
      <div className="flex items-start gap-3"><Rocket className="mt-1 text-primary"/><div><h3 className="font-black">App Release Control</h3><p className="text-sm text-muted-foreground">Publish private Ahoy builds before Play Store/App Store distribution.</p></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs text-muted-foreground">Platform<select className="mt-1 w-full rounded-xl border border-white/10 bg-background px-3 py-2 text-foreground" value={platform} onChange={e=>setPlatform(e.target.value as any)}><option value="android">Android</option><option value="ios">iOS</option><option value="all">All</option></select></label>
        <label className="text-xs text-muted-foreground">Version<Input className="mt-1" value={version} onChange={e=>setVersion(e.target.value)}/></label>
        <label className="text-xs text-muted-foreground">Build<Input className="mt-1" value={build} onChange={e=>setBuild(e.target.value)}/></label>
        <label className="text-xs text-muted-foreground">Minimum supported version<Input className="mt-1" value={minimum} onChange={e=>setMinimum(e.target.value)}/></label>
        <label className="text-xs text-muted-foreground sm:col-span-2">Download URL<Input className="mt-1" placeholder="https://..." value={url} onChange={e=>setUrl(e.target.value)}/></label>
        <label className="text-xs text-muted-foreground sm:col-span-2">Release notes<textarea className="mt-1 min-h-24 w-full rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground" placeholder="One change per line" value={notes} onChange={e=>setNotes(e.target.value)}/></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={force} onChange={e=>setForce(e.target.checked)}/> Force update below minimum version</label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><Button onClick={publish} disabled={saving}><Rocket className="mr-2 size-4"/>{saving?"Publishing…":"Publish update"}</Button>{message&&<span className="text-sm text-primary">{message}</span>}</div>
    </div>
    <div className="grid gap-3">
      {(query.data??[]).map((r:any)=><div key={r.id} className="glass flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center"><div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><BellRing className="size-4"/></div><div className="min-w-0 flex-1"><div className="font-bold">{r.platform.toUpperCase()} v{r.version} · build {r.build}</div><div className="text-xs text-muted-foreground">Minimum {r.minimum_supported_version} · {r.force_update?"Required update":"Optional update"} · {r.published?"Published":"Draft"}</div></div>{r.download_url&&<a href={r.download_url} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><Download className="mr-2 size-4"/>Download</Button></a>}</div>)}
      {!query.isPending && !(query.data??[]).length && <div className="rounded-2xl border border-white/10 p-5 text-sm text-muted-foreground">No releases published yet.</div>}
    </div>
  </div>;
}
