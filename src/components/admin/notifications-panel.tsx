import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteNotification,
  listNotifications,
  listPlatformServers,
  sendNotification,
} from "@/lib/admin.functions";

const LEVELS = ["info", "success", "warning", "critical"] as const;
const TARGETS = [
  { key: "all", label: "Everyone" },
  { key: "user", label: "One user" },
  { key: "guild", label: "One server" },
] as const;

export function NotificationsPanel() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("info");
  const [targetType, setTargetType] = useState<(typeof TARGETS)[number]["key"]>("all");
  const [targetUserId, setTargetUserId] = useState("");
  const [targetGuildId, setTargetGuildId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [viaInbox, setViaInbox] = useState(true);
  const [viaDm, setViaDm] = useState(false);
  const [viaAnnouncement, setViaAnnouncement] = useState(false);

  const { data: history = [] } = useQuery({
    queryKey: ["admin", "notifications"],
    queryFn: () => listNotifications(),
  });
  const { data: servers = [] } = useQuery({
    queryKey: ["admin", "servers"],
    queryFn: () => listPlatformServers(),
  });

  const send = useMutation({
    mutationFn: () =>
      sendNotification({
        data: {
          title,
          body,
          level,
          target_type: targetType,
          target_user_id: targetType === "user" ? targetUserId : null,
          target_guild_id: targetType === "guild" ? targetGuildId : null,
          via_inbox: viaInbox,
          via_dm: viaDm,
          via_announcement: viaAnnouncement,
          announcement_channel_id: viaAnnouncement && channelId ? channelId : null,
        },
      }),
    onSuccess: (result) => {
      toast.success(result.queued ? "Queued — the bot will deliver it shortly." : "Notification published");
      setTitle("");
      setBody("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteNotification({ data: { id } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] }),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <section className="glass space-y-4 rounded-2xl p-5">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Bell className="size-4" /> New notification
        </h3>

        <div className="space-y-2">
          <Label htmlFor="n-title">Title</Label>
          <Input id="n-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="n-body">Message</Label>
          <Textarea id="n-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
        </div>

        <div className="space-y-2">
          <Label>Severity</Label>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={level === option ? "default" : "outline"}
                onClick={() => setLevel(option)}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Audience</Label>
          <div className="flex flex-wrap gap-2">
            {TARGETS.map((option) => (
              <Button
                key={option.key}
                type="button"
                size="sm"
                variant={targetType === option.key ? "default" : "outline"}
                onClick={() => setTargetType(option.key)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          {targetType === "user" ? (
            <Input
              placeholder="Discord user id"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
            />
          ) : null}
          {targetType === "guild" ? (
            <select
              className="hairline w-full rounded-lg bg-transparent px-3 py-2 text-sm"
              value={targetGuildId}
              onChange={(e) => setTargetGuildId(e.target.value)}
            >
              <option value="">Select a server…</option>
              {servers.map((s) => (
                <option key={s.guild_id} value={s.guild_id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>Delivery</Label>
          <label className="hairline flex items-center justify-between rounded-lg px-3 py-2 text-sm">
            <span>Dashboard inbox</span>
            <Switch checked={viaInbox} onCheckedChange={setViaInbox} />
          </label>
          <label className="hairline flex items-center justify-between rounded-lg px-3 py-2 text-sm">
            <span>Discord DM from AHOY</span>
            <Switch checked={viaDm} onCheckedChange={setViaDm} />
          </label>
          <label className="hairline flex items-center justify-between rounded-lg px-3 py-2 text-sm">
            <span>Server announcement</span>
            <Switch checked={viaAnnouncement} onCheckedChange={setViaAnnouncement} />
          </label>
          {viaAnnouncement ? (
            <Input
              placeholder="Channel id (optional — defaults to the log channel)"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
            />
          ) : null}
        </div>

        <Button
          className="w-full"
          disabled={send.isPending || title.length < 2 || body.length < 2}
          onClick={() => send.mutate()}
        >
          <Send className="mr-2 size-4" /> Send notification
        </Button>
      </section>

      <section className="glass space-y-3 rounded-2xl p-5">
        <h3 className="text-lg font-semibold">Sent history</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
        ) : null}
        {history.map((item) => (
          <article key={item.id} className="hairline rounded-xl p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove.mutate(item.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{item.target_type}</Badge>
              <Badge variant="outline">{item.level}</Badge>
              <Badge variant={item.delivery_status === "pending" ? "outline" : "secondary"}>
                {item.delivery_status}
              </Badge>
              <span className="text-muted-foreground">
                {new Date(item.created_at).toLocaleString()}
              </span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
