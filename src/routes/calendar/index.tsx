import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/ahoy.functions";

export const Route = createFileRoute("/calendar/")({
  head: () => ({
    meta: [
      { title: "!HOY Calendar — Discord event reminders" },
      { name: "description", content: "Premium calendar sync, events, reminders and Discord automation for !HOY BOT." },
      { property: "og:title", content: "!HOY Calendar — Discord event reminders" },
      { property: "og:description", content: "Manage calendars, events and Discord reminders from the !HOY Calendar dashboard." },
    ],
  }),
  component: CalendarEntry,
});

function CalendarEntry() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["viewer"], queryFn: () => getViewer() });
  const guilds = data?.signedIn && !data.guildsError ? data.guilds : [];

  useEffect(() => {
    if (guilds.length > 0) {
      void navigate({ to: "/calendar/$guildId", params: { guildId: guilds[0].id }, replace: true });
    }
  }, [guilds, navigate]);

  if (isLoading || guilds.length > 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#02070d] px-6">
        <div className="glass w-full max-w-md rounded-[28px] p-8 text-center shadow-2xl">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
            <CalendarDays className="size-7" />
          </span>
          <h1 className="mt-5 text-2xl font-black">Opening !HOY Calendar</h1>
          <p className="mt-2 text-sm text-muted-foreground">Preparing your calendar workspace…</p>
          <Loader2 className="mx-auto mt-5 size-5 animate-spin text-primary" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#02070d] px-6">
      <div className="glass w-full max-w-md rounded-[28px] p-8 text-center shadow-2xl">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
          <CalendarDays className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl font-black">Sign in to !HOY Calendar</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in with Discord so we can load the servers you manage and open your calendar dashboard.</p>
        <Button asChild className="mt-6">
          <a href="/api/public/auth/discord/start">Sign in with Discord</a>
        </Button>
      </div>
    </main>
  );
}
