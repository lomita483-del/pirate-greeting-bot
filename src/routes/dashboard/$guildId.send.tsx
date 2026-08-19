import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Save, Trash2, Plus, X } from "lucide-react";
import { useState } from "react";

import { WithConfig } from "@/components/dashboard/module-page";
import { ImageUrlField } from "@/components/dashboard/fields";
import {
  listEmbedTemplates,
  saveEmbedTemplate,
  deleteEmbedTemplate,
  sendMessage,
  type EmbedShape,
} from "@/lib/send.functions";

export const Route = createFileRoute("/dashboard/$guildId/send")({
  head: () => ({
    meta: [
      { title: "Send a message — AHOY Control Center" },
      { name: "description", content: "Compose and send messages with rich embeds to any channel." },
    ],
  }),
  component: () => (
    <WithConfig>{({ guildId, config }) => <SendPage guildId={guildId} config={config} />}</WithConfig>
  ),
});

type RoleOption = { id: string; name: string };
type ChannelOption = { id: string; name: string; type?: string };

const emptyEmbed: EmbedShape = { fields: [] };
const builtInTemplates: Array<{ name: string; embed: EmbedShape }> = [
  { name: "Announcement", embed: { title: "Important announcement", description: "Add your announcement here.", color: "D4AF37", fields: [] } },
  { name: "Server update", embed: { title: "Server update", description: "Share what changed with your community.", color: "3498DB", fields: [] } },
  { name: "Event", embed: { title: "Upcoming event", description: "Add the date, time, and event details.", color: "2ECC71", fields: [] } },
  { name: "Alert", embed: { title: "Attention", description: "Add the important information here.", color: "E74C3C", fields: [] } },
];

function SendPage({
  guildId,
  config,
}: {
  guildId: string;
  config: {
    structure?: { roles?: RoleOption[]; channels?: ChannelOption[] } | null;
  };
}) {
  const roles = config.structure?.roles ?? [];
  const channels = (config.structure?.channels ?? []).filter(
    (c) => !c.type || c.type === "text" || c.type === "0",
  );

  const [channelId, setChannelId] = useState("");
  const [content, setContent] = useState("");
  const [mentionRoleId, setMentionRoleId] = useState("");
  const [mentionEveryone, setMentionEveryone] = useState(false);
  const [embed, setEmbed] = useState<EmbedShape>(emptyEmbed);
  const [templateName, setTemplateName] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const templatesQuery = useQuery({
    queryKey: ["embed-templates", guildId],
    queryFn: () => listEmbedTemplates({ data: { guildId } }),
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      sendMessage({
        data: {
          guildId,
          channelId,
          content: content || undefined,
          mentionRoleId: mentionRoleId || undefined,
          mentionEveryone,
          embed: hasEmbedContent(embed) ? embed : undefined,
        },
      }),
    onSuccess: () => setStatus("Queued — AHOY will post it within a few seconds."),
    onError: (e: Error) => setStatus(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: () => saveEmbedTemplate({ data: { guildId, name: templateName, embed } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["embed-templates", guildId] });
      setStatus(`Saved template "${templateName}".`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEmbedTemplate({ data: { guildId, id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["embed-templates", guildId] }),
  });

  function loadTemplate(id: string) {
    const t = templatesQuery.data?.find((t) => t.id === id);
    if (t) {
      setEmbed(t);
      setTemplateName(t.name);
    }
  }

  function setField(index: number, patch: Partial<{ name: string; value: string; inline: boolean }>) {
    const fields = [...(embed.fields ?? [])];
    fields[index] = { name: "", value: "", ...fields[index], ...patch };
    setEmbed({ ...embed, fields });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Send className="h-5 w-5" /> Send a message
        </h1>
        <p className="text-sm text-muted-foreground">
          Post plain text and/or a rich embed to any channel AHOY can see — same builder Discohook
          uses, sent through AHOY.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* -- Composer -- */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Channel</label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
              >
                <option value="">Select a channel…</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Mention</label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={mentionEveryone ? "everyone" : mentionRoleId}
                onChange={(e) => {
                  if (e.target.value === "everyone") {
                    setMentionEveryone(true);
                    setMentionRoleId("");
                  } else {
                    setMentionEveryone(false);
                    setMentionRoleId(e.target.value);
                  }
                }}
              >
                <option value="">No mention</option>
                <option value="everyone">@everyone</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    @{r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Message content</label>
            <textarea
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              rows={3}
              maxLength={2000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Plain text above the embed (optional)"
            />
          </div>

          <div className="rounded-lg border p-4">
            <h2 className="font-semibold">Embed</h2>

            <div className="mt-3 grid gap-3">
              <Field label="Title" value={embed.title} onChange={(v) => setEmbed({ ...embed, title: v })} />
              <div>
                <label className="text-xs text-muted-foreground">Description</label>
                <textarea
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  rows={3}
                  maxLength={4000}
                  value={embed.description ?? ""}
                  onChange={(e) => setEmbed({ ...embed, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="URL" value={embed.url} onChange={(v) => setEmbed({ ...embed, url: v })} />
                <div>
                  <label className="text-xs text-muted-foreground">Color</label>
                  <input
                    type="color"
                    className="mt-1 h-9 w-full rounded-md border bg-background"
                    value={embed.color ? `#${embed.color.replace("#", "")}` : "#5865f2"}
                    onChange={(e) => setEmbed({ ...embed, color: e.target.value.replace("#", "") })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Author name" value={embed.authorName} onChange={(v) => setEmbed({ ...embed, authorName: v })} />
                <Field label="Author URL" value={embed.authorUrl} onChange={(v) => setEmbed({ ...embed, authorUrl: v })} />
                <div>
                  <label className="text-xs text-muted-foreground">Author icon</label>
                  <ImageUrlField guildId={guildId} value={embed.authorIconUrl} onChange={(value) => setEmbed({ ...embed, authorIconUrl: value ?? undefined })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Image</label>
                  <ImageUrlField guildId={guildId} value={embed.imageUrl} onChange={(value) => setEmbed({ ...embed, imageUrl: value ?? undefined })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Thumbnail</label>
                  <ImageUrlField guildId={guildId} value={embed.thumbnailUrl} onChange={(value) => setEmbed({ ...embed, thumbnailUrl: value ?? undefined })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Footer text" value={embed.footerText} onChange={(v) => setEmbed({ ...embed, footerText: v })} />
                <div>
                  <label className="text-xs text-muted-foreground">Footer icon</label>
                  <ImageUrlField guildId={guildId} value={embed.footerIconUrl} onChange={(value) => setEmbed({ ...embed, footerIconUrl: value ?? undefined })} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(embed.timestamp)}
                  onChange={(e) => setEmbed({ ...embed, timestamp: e.target.checked })}
                />
                Show current timestamp
              </label>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">
                    Fields ({(embed.fields ?? []).length}/25)
                  </label>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-primary"
                    disabled={(embed.fields ?? []).length >= 25}
                    onClick={() =>
                      setEmbed({
                        ...embed,
                        fields: [...(embed.fields ?? []), { name: "", value: "", inline: false }],
                      })
                    }
                  >
                    <Plus className="h-3 w-3" /> Add field
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  {(embed.fields ?? []).map((field, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-md border p-2">
                      <div className="flex-1 space-y-1">
                        <input
                          className="w-full rounded border bg-background px-2 py-1 text-xs"
                          placeholder="Field name"
                          value={field.name}
                          onChange={(e) => setField(i, { name: e.target.value })}
                        />
                        <textarea
                          className="w-full rounded border bg-background px-2 py-1 text-xs"
                          placeholder="Field value"
                          rows={2}
                          value={field.value}
                          onChange={(e) => setField(i, { value: e.target.value })}
                        />
                        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={Boolean(field.inline)}
                            onChange={(e) => setField(i, { inline: e.target.checked })}
                          />
                          Inline
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setEmbed({
                            ...embed,
                            fields: (embed.fields ?? []).filter((_, idx) => idx !== i),
                          })
                        }
                        className="text-muted-foreground hover:text-red-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Templates */}
          <div className="rounded-lg border p-4">
            <h2 className="font-semibold">Templates</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {builtInTemplates.map((template) => (
                <button
                  key={template.name}
                  type="button"
                  className="rounded-md border px-3 py-1.5 text-xs hover:bg-secondary"
                  onClick={() => {
                    setEmbed(template.embed);
                    setTemplateName(template.name);
                  }}
                >
                  {template.name}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(templatesQuery.data ?? []).map((t) => (
                <span key={t.id} className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs">
                  <button type="button" onClick={() => loadTemplate(t.id)}>
                    {t.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(t.id)}
                    className="text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
              <button
                type="button"
                disabled={!templateName || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm disabled:opacity-40"
              >
                <Save className="h-4 w-4" /> Save
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={!channelId || sendMutation.isPending}
            onClick={() => {
              setStatus(null);
              sendMutation.mutate();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            {sendMutation.isPending ? "Queuing…" : "Send"}
          </button>
          {status && <p className="text-sm text-muted-foreground">{status}</p>}
        </div>

        {/* -- Live preview -- */}
        <div>
          <label className="text-xs text-muted-foreground">Preview</label>
          <div className="mt-1 rounded-lg bg-[#313338] p-4 text-sm text-gray-100">
            {content && <p className="mb-2 whitespace-pre-wrap">{content}</p>}
            {hasEmbedContent(embed) && (
              <div
                className="max-w-md rounded border-l-4 bg-[#2b2d31] p-3"
                style={{ borderColor: embed.color ? `#${embed.color}` : "#5865f2" }}
              >
                {embed.authorName && (
                  <div className="mb-1 flex items-center gap-2 text-xs font-medium">
                    {embed.authorIconUrl && (
                      <img src={embed.authorIconUrl} alt="" className="h-5 w-5 rounded-full" />
                    )}
                    {embed.authorName}
                  </div>
                )}
                {embed.title && <div className="font-semibold text-white">{embed.title}</div>}
                {embed.description && (
                  <p className="mt-1 whitespace-pre-wrap text-gray-300">{embed.description}</p>
                )}
                {(embed.fields ?? []).length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(embed.fields ?? []).map((f, i) => (
                      <div key={i} className={f.inline ? "" : "col-span-2"}>
                        <div className="text-xs font-semibold text-white">{f.name || "\u200b"}</div>
                        <div className="text-xs text-gray-300">{f.value || "\u200b"}</div>
                      </div>
                    ))}
                  </div>
                )}
                {embed.imageUrl && (
                  <img src={embed.imageUrl} alt="" className="mt-2 max-h-64 rounded" />
                )}
                {embed.thumbnailUrl && (
                  <img
                    src={embed.thumbnailUrl}
                    alt=""
                    className="float-right ml-2 h-16 w-16 rounded"
                  />
                )}
                {(embed.footerText || embed.timestamp) && (
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-400">
                    {embed.footerIconUrl && (
                      <img src={embed.footerIconUrl} alt="" className="h-4 w-4 rounded-full" />
                    )}
                    {embed.footerText}
                    {embed.footerText && embed.timestamp && " • "}
                    {embed.timestamp && "Today"}
                  </div>
                )}
              </div>
            )}
            {!content && !hasEmbedContent(embed) && (
              <p className="text-gray-500">Nothing to preview yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function hasEmbedContent(embed: EmbedShape): boolean {
  return Boolean(
    embed.title ||
      embed.description ||
      embed.imageUrl ||
      embed.thumbnailUrl ||
      embed.authorName ||
      embed.footerText ||
      (embed.fields ?? []).length > 0,
  );
}
