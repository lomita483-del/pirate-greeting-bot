import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/ahoy.functions";

export const Route = createFileRoute("/calendar/")({
  head: () => ({
    meta: [
      { title: "!HOY CALENDAR — Discord event reminders" },
      { name: "description", content: "Premium calendar sync, events, reminders and Discord automation for !HOY BOT." },
      { property: "og:title", content: "!HOY CALENDAR — Discord event reminders" },
      { property: "og:description", content: "Manage calendars, events and Discord reminders from the !HOY CALENDAR dashboard." },
    ],
  }),
  component: CalendarEntry,
});

function CalendarEntry() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["viewer"], queryFn: () => getViewer() });
  const guilds = data?.signedIn && !data.guildsError ? data.guilds : [];

  // There is intentionally no intermediate server-selection screen. Open the
  // first manageable server immediately; the dashboard itself contains the
  // server selector for switching between servers.
  useEffect(() => {
    if (guilds.length > 0) {
      void navigate({ to: "/calendar/$guildId", params: { guildId: guilds[0].id }, replace: true });
    }
  }, [guilds, navigate]);

  if (isLoading || guilds.length > 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#02070d] px-6">
        <div className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-white/[0.12] bg-white/[0.04] p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,.45)] backdrop-blur-2xl">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(32,199,183,.14),transparent_55%)]" />
          <span className="relative mx-auto flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary"><CalendarDays className="size-7" /></span>
          <p className="relative mt-5 text-[9px] font-bold uppercase tracking-[.3em] text-primary">!HOY CALENDAR</p>
          <h1 className="relative mt-2 text-2xl font-black">Opening your calendar workspace</h1>
          <p className="relative mt-2 text-sm text-muted-foreground">Loading your managed servers and calendar controls…</p>
          <Loader2 className="relative mx-auto mt-5 size-5 animate-spin text-primary" aria-label="Loading" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#02070d] px-6">
      <div className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-white/[0.12] bg-white/[0.04] p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,.45)] backdrop-blur-2xl">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary"><CalendarDays className="size-7" /></span>
        <p className="mt-5 text-[9px] font-bold uppercase tracking-[.3em] text-primary">!HOY CALENDAR</p>
        <h1 className="mt-2 text-2xl font-black">Sign in to !HOY CALENDAR</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in with Discord to load the servers you manage. Once signed in, the calendar opens directly and you can switch servers from the dashboard.</p>
        <Button asChild className="mt-6 gap-2"><a href="/api/public/auth/discord/start"><ShieldCheck className="size-4" />Sign in with Discord</a></Button>
      </div>
    </main>
  );
}
