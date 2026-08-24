import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getStatahoyGuilds } from "@/lib/statahoy.functions";

export const Route = createFileRoute("/statahoy/")({
  head: () => ({
    meta: [
      { title: "Statahoy — Live Discord Analytics" },
      {
        name: "description",
        content: "Message, voice and member analytics for your Discord server, powered by AHOY.",
      },
    ],
  }),
  component: StatahoyPicker,
});

function StatahoyPicker() {
  const { data, isLoading } = useQuery({
    queryKey: ["statahoy-guilds"],
    queryFn: () => getStatahoyGuilds(),
  });

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em]">
          <BarChart3 className="h-4 w-4 text-primary" />
          Statahoy
        </Link>
        <Button asChild size="sm" variant="outline">
          <Link to="/">Back to AHOY</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-10">
        <h1 className="text-3xl font-semibold">Pick a server</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Statahoy shows live message, voice and member analytics for any server where AHOY is
          installed and you have manage-server permission.
        </p>

        {!data?.signedIn && !isLoading && (
          <div className="glass mt-8 rounded-2xl p-6 text-sm">
            <p className="text-muted-foreground">Sign in with Discord to see your servers.</p>
            <Button asChild size="sm" className="mt-4">
              <a href="/api/public/auth/discord/start">Sign in with Discord</a>
            </Button>
          </div>
        )}

        {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading your servers…</p>}

        {data?.signedIn && data.guilds.length === 0 && !isLoading && (
          <div className="glass mt-8 rounded-2xl p-6 text-sm text-muted-foreground">
            None of your servers have AHOY installed yet.{" "}
            <a className="text-primary underline" href="/api/public/invite">
              Invite AHOY
            </a>{" "}
            to get started.
          </div>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {(data?.guilds ?? []).map((guild) => (
            <Link
              key={guild.id}
              to="/statahoy/$guildId"
              params={{ guildId: guild.id }}
              className="glass flex items-center gap-3 rounded-2xl p-4 transition hover:border-primary/40"
            >
              {guild.iconUrl ? (
                <img src={guild.iconUrl} alt="" className="h-10 w-10 rounded-full" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                  {guild.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-medium">{guild.name}</p>
                <p className="text-xs text-muted-foreground">Enter Statahoy</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
