import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  deleteWelcomeMessage,
  listWelcomeMessages,
  saveWelcomeMessage,
  type WelcomeEmbedShape,
  type WelcomeMessage,
} from "@/lib/welcome-messages.functions";
import { Field, ImageUrlField, PickerSelect, SectionHeader, ToggleRow } from "./fields";
import { SaveBar } from "./save-bar";
import type { PanelProps } from "./types";
import { useDraft } from "./use-draft";

const VARIABLES: Array<[string, string]> = [
  ["{user}", "Mentions the member (@Name)"],
  ["{username}", "The member's display name, no mention"],
  ["{server}", "This server's name"],
  ["{membercount}", "Current member count"],
];

const emptyEmbed: WelcomeEmbedShape = { fields: [] };

function hasEmbedContent(embed: WelcomeEmbedShape): boolean {
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

export function WelcomeMessagesPanel({ guildId, config, onSaved }: PanelProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [content, setContent] = useState("");
  const [embed, setEmbed] = useState<WelcomeEmbedShape>(emptyEmbed);
  const [useEmbed, setUseEmbed] = useState(true);
  const [attachDynamicImage, setAttachDynamicImage] = useState(false);
  const [showVariables, setShowVariables] = useState(false);

  const w = config.welcome;
  const channels = config.structure.channels.filter((c) => c.kind === "text");

  const topForm = useDraft(
    guildId,
    "welcome",
    {
      enabled: w?.enabled ?? false,
      welcome_channel_id: w?.welcome_channel_id ?? null,
      auto_role_id: w?.auto_role_id ?? null,
      dynamic_image_enabled: w?.dynamic_image_enabled ?? false,
      dynamic_image_title: w?.dynamic_image_title ?? "Welcome {username}!",
      dynamic_image_subtitle: w?.dynamic_image_subtitle ?? "to {server} · member #{membercount}",
      dynamic_image_background_url: w?.dynamic_image_background_url ?? null,
    },
    onSaved,
  );
  const top = topForm.draft;

  const query = useQuery({
    queryKey: ["welcome-messages", guildId],
    queryFn: () => listWelcomeMessages({ data: { guildId } }),
  });

  const save = useServerFn(saveWelcomeMessage);
  const saveMutation = useMutation({
    mutationFn: (input: {
      id?: string;
      position: number;
      content: string;
      embed?: WelcomeEmbedShape;
      useEmbed: boolean;
      attachDynamicImage: boolean;
    }) => save({ data: { guildId, enabled: true, ...input } }),
    onSuccess: () => {
      toast.success("Message saved");
      queryClient.invalidateQueries({ queryKey: ["welcome-messages", guildId] });
      setEditingId(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useServerFn(deleteWelcomeMessage);
  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { guildId, id } }),
    onSuccess: () => {
      toast.success("Message removed");
      queryClient.invalidateQueries({ queryKey: ["welcome-messages", guildId] });
    },
  });

  const messages = query.data ?? [];

  function startEdit(message?: WelcomeMessage) {
    if (message) {
      setEditingId(message.id);
      setContent(message.content);
      setEmbed(message.embed ?? emptyEmbed);
      setUseEmbed(message.useEmbed);
      setAttachDynamicImage(message.attachDynamicImage);
    } else {
      setEditingId("new");
      setContent("");
      setEmbed(emptyEmbed);
      setUseEmbed(true);
      setAttachDynamicImage(false);
    }
  }

  function setField(
    index: number,
    patch: Partial<{ name: string; value: string; inline: boolean }>,
  ) {
    const fields = [...(embed.fields ?? [])];
    fields[index] = { name: "", value: "", ...fields[index], ...patch };
    setEmbed({ ...embed, fields });
  }

  return (
    <div className="space-y-6">
      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Welcome"
            description="Where welcome messages go, and who's greeted automatically."
          />
          <ToggleRow
            label="Enable welcome messages"
            checked={top.enabled}
            onChange={(v) => topForm.set("enabled", v)}
          />
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Welcome channel">
              <PickerSelect
                value={top.welcome_channel_id}
                options={channels}
                onChange={(v) => topForm.set("welcome_channel_id", v)}
                placeholder="Select a channel"
              />
            </Field>
            <Field label="Auto role" hint="Assigned to the member automatically on join.">
              <PickerSelect
                value={top.auto_role_id}
                options={config.structure.roles}
                onChange={(v) => topForm.set("auto_role_id", v)}
                placeholder="Select a role"
              />
            </Field>
          </div>

          <div className="space-y-4 rounded-xl border border-border/70 p-4">
            <ToggleRow
              label="Dynamic welcome image"
              description="Render a card with the member's avatar. Attach it to any of the messages below."
              checked={top.dynamic_image_enabled}
              onChange={(v) => topForm.set("dynamic_image_enabled", v)}
            />
            {top.dynamic_image_enabled && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Title" hint="Placeholders: {user}, {username}, {server}, {membercount}">
                  <Input
                    value={top.dynamic_image_title}
                    onChange={(e) => topForm.set("dynamic_image_title", e.target.value)}
                  />
                </Field>
                <Field label="Subtitle">
                  <Input
                    value={top.dynamic_image_subtitle}
                    onChange={(e) => topForm.set("dynamic_image_subtitle", e.target.value)}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Background image">
                    <ImageUrlField
                      guildId={guildId}
                      value={top.dynamic_image_background_url}
                      onChange={(v) => topForm.set("dynamic_image_background_url", v)}
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <SaveBar
        dirty={topForm.dirty}
        saving={topForm.saving}
        onSave={topForm.save}
        onReset={topForm.reset}
      />

      <Card className="glass border-0">
        <CardContent className="space-y-5 pt-6">
          <SectionHeader
            title="Messages"
            description="Every enabled message here is sent every time someone joins. Up to 3."
            badge={`${messages.length}/3`}
          />

          <div className="space-y-2">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/30 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    Message {index + 1}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {message.useEmbed ? "Embed" : "Plain text"}
                      {message.attachDynamicImage ? " · Dynamic image" : ""}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {message.content || (message.embed ? "(embed only)" : "(empty)")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(message)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate(message.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {messages.length < 3 && editingId === null && (
              <Button variant="outline" className="w-full" onClick={() => startEdit()}>
                <Plus className="mr-2 h-4 w-4" />
                New message
              </Button>
            )}
          </div>

          {editingId !== null && (
            <div className="space-y-4 rounded-xl border border-primary/40 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {editingId === "new" ? "New message" : "Edit message"}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="text-xs text-primary underline-offset-2 hover:underline"
                    onClick={() => setShowVariables((v) => !v)}
                  >
                    Variables
                  </button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {showVariables && (
                <div className="rounded-lg bg-secondary/40 p-3 text-xs">
                  {VARIABLES.map(([token, desc]) => (
                    <div key={token} className="flex gap-2 py-0.5">
                      <code className="shrink-0 rounded bg-secondary px-1.5 py-0.5">{token}</code>
                      <span className="text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              )}

              <ToggleRow
                label="Send as embed"
                description="Off sends the plain-text content only, ignoring the embed fields below."
                checked={useEmbed}
                onChange={setUseEmbed}
              />

              {top.dynamic_image_enabled && (
                <ToggleRow
                  label="Attach dynamic welcome image"
                  description="Include the rendered avatar card with this message."
                  checked={attachDynamicImage}
                  onChange={setAttachDynamicImage}
                />
              )}

              <div>
                <label className="text-xs text-muted-foreground">Message content</label>
                <Textarea
                  rows={2}
                  maxLength={2000}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Welcome {user} to {server}!"
                />
              </div>

              {useEmbed && (
                <div className="space-y-3 rounded-lg border border-border/60 p-3">
                  <p className="text-sm font-medium">Embed</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MiniField
                      label="Title"
                      value={embed.title}
                      onChange={(v) => setEmbed({ ...embed, title: v })}
                    />
                    <MiniField
                      label="URL"
                      value={embed.url}
                      onChange={(v) => setEmbed({ ...embed, url: v })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Description</label>
                    <Textarea
                      rows={3}
                      value={embed.description ?? ""}
                      onChange={(e) => setEmbed({ ...embed, description: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Color</label>
                      <input
                        type="color"
                        className="mt-1 h-9 w-full rounded-md border bg-background"
                        value={embed.color ? `#${embed.color.replace("#", "")}` : "#5865f2"}
                        onChange={(e) => setEmbed({ ...embed, color: e.target.value.replace("#", "") })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Image</label>
                      <ImageUrlField
                        guildId={guildId}
                        value={embed.imageUrl}
                        onChange={(value) => setEmbed({ ...embed, imageUrl: value ?? undefined })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Thumbnail</label>
                      <ImageUrlField
                        guildId={guildId}
                        value={embed.thumbnailUrl}
                        onChange={(value) => setEmbed({ ...embed, thumbnailUrl: value ?? undefined })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Author icon</label>
                      <ImageUrlField
                        guildId={guildId}
                        value={embed.authorIconUrl}
                        onChange={(value) => setEmbed({ ...embed, authorIconUrl: value ?? undefined })}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={Boolean(embed.useMemberAvatarAsThumbnail)}
                      onChange={(e) =>
                        setEmbed({ ...embed, useMemberAvatarAsThumbnail: e.target.checked })
                      }
                    />
                    Use the new member's avatar as the thumbnail
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MiniField
                      label="Footer text"
                      value={embed.footerText}
                      onChange={(v) => setEmbed({ ...embed, footerText: v })}
                    />
                    <MiniField
                      label="Author name"
                      value={embed.authorName}
                      onChange={(v) => setEmbed({ ...embed, authorName: v })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Footer icon</label>
                    <ImageUrlField
                      guildId={guildId}
                      value={embed.footerIconUrl}
                      onChange={(value) => setEmbed({ ...embed, footerIconUrl: value ?? undefined })}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground">
                        Fields ({(embed.fields ?? []).length}/25)
                      </label>
                      <button
                        type="button"
                        className="text-xs text-primary"
                        onClick={() =>
                          setEmbed({
                            ...embed,
                            fields: [...(embed.fields ?? []), { name: "", value: "", inline: false }],
                          })
                        }
                      >
                        + Add field
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
                            <input
                              className="w-full rounded border bg-background px-2 py-1 text-xs"
                              placeholder="Field value"
                              value={field.value}
                              onChange={(e) => setField(i, { value: e.target.value })}
                            />
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
              )}

              {/* Preview */}
              <div>
                <label className="text-xs text-muted-foreground">Preview</label>
                <div className="mt-1 rounded-lg bg-[#313338] p-4 text-sm text-gray-100">
                  {content && (
                    <p className="mb-2 whitespace-pre-wrap">
                      {content.replace(/\{[a-z_]+\}/gi, (m) => m)}
                    </p>
                  )}
                  {useEmbed && hasEmbedContent(embed) && (
                    <div
                      className="max-w-md rounded border-l-4 bg-[#2b2d31] p-3"
                      style={{ borderColor: embed.color ? `#${embed.color}` : "#5865f2" }}
                    >
                      {embed.authorName && (
                        <div className="mb-1 text-xs font-medium">{embed.authorName}</div>
                      )}
                      {embed.title && <div className="font-semibold text-white">{embed.title}</div>}
                      {embed.description && (
                        <p className="mt-1 whitespace-pre-wrap text-gray-300">{embed.description}</p>
                      )}
                      {(embed.fields ?? []).length > 0 && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {(embed.fields ?? []).map((f, i) => (
                            <div key={i} className={f.inline ? "" : "col-span-2"}>
                              <div className="text-xs font-semibold text-white">
                                {f.name || "\u200b"}
                              </div>
                              <div className="text-xs text-gray-300">{f.value || "\u200b"}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {embed.imageUrl && (
                        <img src={embed.imageUrl} alt="" className="mt-2 max-h-56 rounded" />
                      )}
                      {embed.footerText && (
                        <div className="mt-2 text-[11px] text-gray-400">{embed.footerText}</div>
                      )}
                    </div>
                  )}
                  {attachDynamicImage && (
                    <p className="mt-2 text-xs text-gray-400">+ dynamic welcome image attached</p>
                  )}
                  {!content && !(useEmbed && hasEmbedContent(embed)) && (
                    <p className="text-gray-500">Nothing to preview yet.</p>
                  )}
                </div>
              </div>

              <Button
                disabled={saveMutation.isPending}
                onClick={() => {
                  const base = {
                    ...(editingId === "new" ? {} : { id: editingId }),
                    position:
                      editingId === "new"
                        ? messages.length
                        : messages.findIndex((m) => m.id === editingId),
                    content,
                    useEmbed,
                    attachDynamicImage,
                  };
                  saveMutation.mutate(
                    useEmbed && hasEmbedContent(embed) ? { ...base, embed } : base,
                  );
                }}
              >
                Save message
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniField({
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
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
