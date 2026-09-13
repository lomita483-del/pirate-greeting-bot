import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Send, Plus, Trash2, Link2 } from "lucide-react";
import { useState } from "react";

import { WithConfig } from "@/components/dashboard/module-page";
import { ImageUrlField } from "@/components/dashboard/fields";
import { sendAdvancedMessage, type SendEmbed } from "@/lib/send-advanced.functions";

export const Route = createFileRoute("/dashboard/$guildId/send")({
  head: () => ({ meta: [{ title: "Send a message — !HOY BOT Control Center" }, { name: "description", content: "Compose messages and embeds with clickable link buttons." }] }),
  component: () => <WithConfig>{({ guildId, config }) => <SendPage guildId={guildId} config={config} />}</WithConfig>,
});

type RoleOption = { id: string; name: string };
type ChannelOption = { id: string; name: string; type?: string };

type ButtonDraft = { label: string; url: string; emoji: string; purpose: string };
const blankButton = (): ButtonDraft => ({ label: "Open link", url: "", emoji: "", purpose: "" });

function SendPage({ guildId, config }: { guildId: string; config: { structure?: { roles?: RoleOption[]; channels?: ChannelOption[] } | null } }) {
  const roles = config.structure?.roles ?? [];
  const channels = (config.structure?.channels ?? []).filter((c) => !c.type || c.type === "text" || c.type === "0");
  const [channelId, setChannelId] = useState("");
  const [content, setContent] = useState("");
  const [mentionRoleId, setMentionRoleId] = useState("");
  const [mentionEveryone, setMentionEveryone] = useState(false);
  const [embed, setEmbed] = useState<SendEmbed>({ fields: [], buttons: [] });
  const [status, setStatus] = useState<string | null>(null);

  const sendMutation = useMutation({
    mutationFn: () => sendAdvancedMessage({ data: { guildId, channelId, content: content || undefined, mentionRoleId: mentionRoleId || undefined, mentionEveryone, embed: hasEmbedContent(embed) ? embed : undefined } }),
    onSuccess: () => setStatus("Queued — !HOY BOT will post it within a few seconds."),
    onError: (e: Error) => setStatus(e.message),
  });

  const setButton = (index: number, patch: Partial<ButtonDraft>) => {
    const buttons = [...(embed.buttons ?? [])];
    buttons[index] = { ...blankButton(), ...buttons[index], ...patch };
    setEmbed({ ...embed, buttons });
  };

  return <div className="space-y-6">
    <div><h1 className="flex items-center gap-2 text-xl font-semibold"><Send className="size-5" /> Send a message</h1><p className="text-sm text-muted-foreground">Build a Discord embed and add up to 5 clickable link buttons before sending.</p></div>

    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Channel<select className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={channelId} onChange={(e) => setChannelId(e.target.value)}><option value="">Select a channel…</option>{channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}</select></label>
          <label className="text-sm">Mention<select className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={mentionEveryone ? "everyone" : mentionRoleId} onChange={(e) => { if (e.target.value === "everyone") { setMentionEveryone(true); setMentionRoleId(""); } else { setMentionEveryone(false); setMentionRoleId(e.target.value); } }}><option value="">No mention</option><option value="everyone">@everyone</option>{roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}</select></label>
        </div>
        <label className="block text-sm">Message content<textarea className="mt-1 w-full rounded-md border bg-background px-3 py-2" rows={3} maxLength={2000} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Optional text outside the embed" /></label>

        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold">Embed</h2>
          <input className="w-full rounded-md border bg-background px-3 py-2" placeholder="Title" value={embed.title ?? ""} onChange={(e) => setEmbed({ ...embed, title: e.target.value })} />
          <textarea className="w-full rounded-md border bg-background px-3 py-2" rows={4} maxLength={4000} placeholder="Description" value={embed.description ?? ""} onChange={(e) => setEmbed({ ...embed, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3"><input className="rounded-md border bg-background px-3 py-2" placeholder="Embed URL" value={embed.url ?? ""} onChange={(e) => setEmbed({ ...embed, url: e.target.value })} /><input type="color" className="h-10 w-full rounded-md border bg-background" value={`#${(embed.color || "D4AF37").replace("#", "")}`} onChange={(e) => setEmbed({ ...embed, color: e.target.value.replace("#", "") })} /></div>
          <div className="grid grid-cols-2 gap-3"><ImageUrlField guildId={guildId} value={embed.imageUrl} onChange={(v) => setEmbed({ ...embed, imageUrl: v ?? undefined })} /><ImageUrlField guildId={guildId} value={embed.thumbnailUrl} onChange={(v) => setEmbed({ ...embed, thumbnailUrl: v ?? undefined })} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(embed.timestamp)} onChange={(e) => setEmbed({ ...embed, timestamp: e.target.checked })} /> Show timestamp</label>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between"><div><h2 className="flex items-center gap-2 font-semibold"><Link2 className="size-4" /> Link buttons</h2><p className="text-xs text-muted-foreground">These appear directly underneath the embed. Discord supports up to 5 link buttons in one row group.</p></div><button type="button" disabled={(embed.buttons ?? []).length >= 5} onClick={() => setEmbed({ ...embed, buttons: [...(embed.buttons ?? []), blankButton()] })} className="flex items-center gap-1 rounded-md border px-3 py-2 text-xs disabled:opacity-40"><Plus className="size-3" /> Add button</button></div>
          {(embed.buttons ?? []).map((button, index) => <div key={index} className="rounded-md border p-3 space-y-2"><div className="grid grid-cols-[1fr_1fr_auto] gap-2"><input className="rounded border bg-background px-2 py-1.5 text-sm" placeholder="Button label" value={button.label} onChange={(e) => setButton(index, { label: e.target.value })} /><input className="rounded border bg-background px-2 py-1.5 text-sm" placeholder="https://example.com" value={button.url} onChange={(e) => setButton(index, { url: e.target.value })} /><button type="button" onClick={() => setEmbed({ ...embed, buttons: (embed.buttons ?? []).filter((_, i) => i !== index) })} className="rounded border px-2 text-muted-foreground hover:text-red-400"><Trash2 className="size-4" /></button></div><div className="grid grid-cols-2 gap-2"><input className="rounded border bg-background px-2 py-1.5 text-sm" placeholder="Emoji (optional)" value={button.emoji} onChange={(e) => setButton(index, { emoji: e.target.value })} /><input className="rounded border bg-background px-2 py-1.5 text-sm" placeholder="Purpose (internal note)" value={button.purpose} onChange={(e) => setButton(index, { purpose: e.target.value })} /></div>{button.url && <p className="text-xs text-muted-foreground">Purpose: {button.purpose || "Open the configured link"}</p>}</div>)}
          {!(embed.buttons ?? []).length ? <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">No buttons added. Add one to give members a direct clickable link.</p> : null}
        </div>

        <button type="button" disabled={!channelId || sendMutation.isPending} onClick={() => { setStatus(null); sendMutation.mutate(); }} className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-40"><Send className="size-4" />{sendMutation.isPending ? "Queuing…" : "Send message"}</button>
        {status ? <p className="rounded-md border p-3 text-sm">{status}</p> : null}
      </div>

      <div className="rounded-lg border p-5 h-fit"><h2 className="font-semibold">Preview</h2><div className="mt-4 rounded-md border-l-4 border-gold bg-secondary/30 p-4"><p className="text-xs text-muted-foreground">!HOY BOT</p><h3 className="mt-1 font-semibold">{embed.title || "Embed title"}</h3><p className="mt-2 whitespace-pre-wrap text-sm">{embed.description || "Your embed description will appear here."}</p>{(embed.buttons ?? []).length ? <div className="mt-4 flex flex-wrap gap-2">{embed.buttons?.map((b, i) => <span key={i} className="rounded-md border px-3 py-1.5 text-xs">{b.emoji ? `${b.emoji} ` : ""}{b.label || "Open link"}</span>)}</div> : null}</div><p className="mt-3 text-xs text-muted-foreground">Button purposes are stored with the send configuration for auditing/administration; Discord link buttons open their URL when clicked.</p></div>
    </div>
  </div>;
}

function hasEmbedContent(embed: SendEmbed) {
  return Boolean(embed.title || embed.description || embed.url || embed.imageUrl || embed.thumbnailUrl || embed.fields?.length || embed.buttons?.length);
}
