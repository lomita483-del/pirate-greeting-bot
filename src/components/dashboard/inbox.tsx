import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMyNotifications, markNotificationRead } from "@/lib/admin.functions";

export function Inbox() {
  const queryClient = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["inbox"],
    queryFn: () => getMyNotifications(),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead({ data: { id } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["inbox"] }),
  });

  const unread = data.filter((n) => !n.read);
  if (unread.length === 0) return null;

  return (
    <section className="glass mt-8 space-y-3 rounded-2xl p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Bell className="size-4 text-gold" /> Notices
        <Badge variant="secondary">{unread.length}</Badge>
      </h2>
      {unread.map((item) => (
        <article key={item.id} className="hairline rounded-xl p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => markRead.mutate(item.id)}>
              Dismiss
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}
