import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FEATURE_KEYS, listPlatformUsers, updatePlatformUser } from "@/lib/admin.functions";

type FeatureKey = (typeof FEATURE_KEYS)[number];
type PlatformUser = Awaited<ReturnType<typeof listPlatformUsers>>[number];

const PLANS = ["free", "plus", "pro", "staff"] as const;

function avatarUrl(user: PlatformUser) {
  return user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.discord_user_id}/${user.avatar}.png?size=64`
    : null;
}

export function UserManager() {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: users = [], isPending } = useQuery({
    queryKey: ["admin", "users", term],
    queryFn: () => listPlatformUsers({ data: { search: term } }),
  });

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof updatePlatformUser>[0]["data"]) =>
      updatePlatformUser({ data: input }),
    onSuccess: () => {
      toast.success("User updated");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const active = users.find((u) => u.discord_user_id === selected) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <section className="glass rounded-2xl p-5">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setTerm(search);
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by username or Discord id"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <div className="mt-4 space-y-2">
          {isPending ? <p className="text-sm text-muted-foreground">Loading crew…</p> : null}
          {!isPending && users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users have signed in yet.</p>
          ) : null}
          {users.map((user) => (
            <button
              key={user.discord_user_id}
              type="button"
              onClick={() => setSelected(user.discord_user_id)}
              className={`hairline flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-muted/40 ${
                selected === user.discord_user_id ? "bg-muted/50" : ""
              }`}
            >
              {avatarUrl(user) ? (
                <img src={avatarUrl(user)!} alt="" className="size-9 rounded-full" />
              ) : (
                <div className="size-9 rounded-full bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {user.global_name ?? user.username ?? user.discord_user_id}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.login_count} logins · last seen{" "}
                  {new Date(user.last_seen_at).toLocaleDateString()}
                </p>
              </div>
              {user.banned ? <Badge variant="destructive">Banned</Badge> : null}
              {user.plan !== "free" ? <Badge variant="secondary">{user.plan}</Badge> : null}
            </button>
          ))}
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        {!active ? (
          <p className="text-sm text-muted-foreground">
            Select a user to manage their access, plan and feature limits.
          </p>
        ) : (
          <UserEditor
            key={active.discord_user_id}
            user={active}
            saving={mutation.isPending}
            onSave={(input) => mutation.mutate(input)}
          />
        )}
      </section>
    </div>
  );
}

function UserEditor({
  user,
  saving,
  onSave,
}: {
  user: PlatformUser;
  saving: boolean;
  onSave: (input: Parameters<typeof updatePlatformUser>[0]["data"]) => void;
}) {
  const flags = (user.feature_flags ?? {}) as Partial<Record<FeatureKey, boolean>>;
  const [draftFlags, setDraftFlags] = useState<Partial<Record<FeatureKey, boolean>>>(flags);
  const [plan, setPlan] = useState<(typeof PLANS)[number]>(
    (PLANS as readonly string[]).includes(user.plan) ? (user.plan as (typeof PLANS)[number]) : "free",
  );
  const [reason, setReason] = useState(user.ban_reason ?? "");
  const [notes, setNotes] = useState(user.notes ?? "");
  const [botBlocked, setBotBlocked] = useState(user.bot_blocked);

  return (
    <div className="space-y-5">
      <header>
        <h3 className="text-lg font-semibold">
          {user.global_name ?? user.username ?? user.discord_user_id}
        </h3>
        <p className="font-mono text-xs text-muted-foreground">{user.discord_user_id}</p>
      </header>

      <div className="space-y-2">
        <Label>Plan</Label>
        <div className="flex flex-wrap gap-2">
          {PLANS.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={plan === option ? "default" : "outline"}
              onClick={() => setPlan(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Sparkles className="size-4" /> Feature access
        </Label>
        <p className="text-xs text-muted-foreground">
          Off means this user cannot use the module through AHOY, anywhere.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {FEATURE_KEYS.map((key) => (
            <label
              key={key}
              className="hairline flex items-center justify-between rounded-lg px-3 py-2 text-sm"
            >
              <span className="capitalize">{key.replace("_", " ")}</span>
              <Switch
                checked={draftFlags[key] !== false}
                onCheckedChange={(checked) =>
                  setDraftFlags((prev) => ({ ...prev, [key]: checked }))
                }
              />
            </label>
          ))}
        </div>
      </div>

      <label className="hairline flex items-center justify-between rounded-lg px-3 py-2 text-sm">
        <span>Block from bot commands</span>
        <Switch checked={botBlocked} onCheckedChange={setBotBlocked} />
      </label>

      <div className="space-y-2">
        <Label htmlFor="notes">Private notes</Label>
        <Textarea
          id="notes"
          value={notes}
          rows={3}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      <Button
        className="w-full"
        disabled={saving}
        onClick={() =>
          onSave({
            userId: user.discord_user_id,
            plan,
            bot_blocked: botBlocked,
            notes,
            feature_flags: draftFlags as Record<FeatureKey, boolean>,
          })
        }
      >
        Save changes
      </Button>

      <div className="hairline space-y-3 rounded-xl p-4">
        {user.banned ? (
          <>
            <p className="text-sm">
              <Ban className="mr-2 inline size-4 text-destructive" />
              Banned from the website. {user.ban_reason ? `Reason: ${user.ban_reason}` : null}
            </p>
            <Button
              variant="outline"
              className="w-full"
              disabled={saving}
              onClick={() => onSave({ userId: user.discord_user_id, banned: false })}
            >
              <ShieldCheck className="mr-2 size-4" /> Lift ban
            </Button>
          </>
        ) : (
          <>
            <Label htmlFor="reason">Ban reason</Label>
            <Input
              id="reason"
              value={reason}
              placeholder="Abuse of the control center"
              onChange={(event) => setReason(event.target.value)}
            />
            <Button
              variant="destructive"
              className="w-full"
              disabled={saving}
              onClick={() =>
                onSave({ userId: user.discord_user_id, banned: true, ban_reason: reason || null })
              }
            >
              <Ban className="mr-2 size-4" /> Ban from website
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
