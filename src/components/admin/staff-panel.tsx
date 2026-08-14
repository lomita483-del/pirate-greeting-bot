import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, ShieldPlus, UserMinus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listAdmins, setAdmin } from "@/lib/admin.functions";

export function StaffPanel({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"admin" | "owner">("admin");

  const { data } = useQuery({ queryKey: ["admin", "staff"], queryFn: () => listAdmins() });

  const mutation = useMutation({
    mutationFn: (input: { userId: string; role: "admin" | "owner" | null }) =>
      setAdmin({ data: input }),
    onSuccess: () => {
      toast.success("Staff updated");
      setUserId("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="glass space-y-3 rounded-2xl p-5">
        <h3 className="text-lg font-semibold">Platform staff</h3>
        {(data?.owners ?? []).map((id) => (
          <div key={id} className="hairline flex items-center justify-between rounded-xl px-3 py-2">
            <span className="font-mono text-sm">{id}</span>
            <Badge>
              <Crown className="mr-1 size-3" /> owner
            </Badge>
          </div>
        ))}
        {(data?.staff ?? []).map((member) => (
          <div
            key={member.discord_user_id}
            className="hairline flex items-center justify-between rounded-xl px-3 py-2"
          >
            <div>
              <p className="text-sm">{member.username ?? member.discord_user_id}</p>
              <p className="font-mono text-xs text-muted-foreground">{member.discord_user_id}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{member.role}</Badge>
              {canEdit ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => mutation.mutate({ userId: member.discord_user_id, role: null })}
                >
                  <UserMinus className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </section>

      <section className="glass space-y-3 rounded-2xl p-5">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldPlus className="size-4" /> Grant panel access
        </h3>
        <p className="text-xs text-muted-foreground">
          Only owners can change staff. Admins can manage users and send notifications.
        </p>
        <div className="space-y-2">
          <Label htmlFor="staff-id">Discord user id</Label>
          <Input
            id="staff-id"
            value={userId}
            placeholder="123456789012345678"
            onChange={(event) => setUserId(event.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(["admin", "owner"] as const).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={role === option ? "default" : "outline"}
              onClick={() => setRole(option)}
            >
              {option}
            </Button>
          ))}
        </div>
        <Button
          className="w-full"
          disabled={!canEdit || !/^\d{5,25}$/.test(userId) || mutation.isPending}
          onClick={() => mutation.mutate({ userId, role })}
        >
          Add staff member
        </Button>
      </section>
    </div>
  );
}
