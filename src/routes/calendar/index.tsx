import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/ahoy.functions";

export const Route = createFileRoute("/calendar/")({
  head: () => ({
    meta: [
      { title: "AHOY Calendar — Discord event reminders" },
      {
        name: "description",
        content:
          "Sync Google Calendar and iCalendar feeds to Discord, then send automatic event reminders, RSVPs and daily summaries.",
      },
      { property: "og:title", content: "AHOY Calendar — Discord event reminders" },
      {
        property: "og:description",
        content: "Sync calendars to Discord and automate event reminders with AHOY Calendar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarPicker,
});

function guildIcon(id: string, icon: string | null) {
  return icon ? `https://cdn.discordapp.com/icons/${id}/${icon}.png?size=64` : null;
}

function CalendarPicker() {
  const { data, isLoading } = useQuery({ queryKey: ["viewer"], queryFn: () => getViewer() });
  const guilds = data?.signedIn && !data.guildsError ? data.guilds : [];

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em]"
        >
          <CalendarDays className="h-4 w-4 text-primary" />
          Ahoy Calendar
        </Link>
        <Button asChild size="sm" variant="outline">
          <Link to="/">Back to AHOY</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-10">
        <h1 className="text-3xl font-semibold">Pick a server</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          AHOY Calendar keeps your Google and iCalendar feeds in sync with Discord — reminders,
          RSVPs, daily summaries and event announcements, all in one place.
        </p>

        {!data?.signedIn && !isLoading ? (
          <div className="glass mt-8 rounded-2xl p-6 text-sm">
            <p className="text-muted-foreground">Sign in with Discord to see your servers.</p>
            <Button asChild size="sm" className="mt-4">
              <a href="/api/public/auth/discord/start">Sign in with Discord</a>
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {guilds.map((guild) => {
              const icon = guildIcon(guild.id, guild.icon);
              return (
                <Link
                  key={guild.id}
                  to="/calendar/$guildId"
                  params={{ guildId: guild.id }}
                  className="glass flex items-center gap-3 rounded-2xl p-4 transition-colors hover:bg-surface-2/60"
                >
                  {icon ? (
                    <img src={icon} alt="" className="size-10 rounded-xl" />
                  ) : (
                    <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-xs">
                      {guild.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="truncate text-sm font-medium">{guild.name}</span>
                </Link>
              );
            })}
            {guilds.length === 0 && !isLoading ? (
              <p className="text-sm text-muted-foreground">
                No servers found where you can manage AHOY.
              </p>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
