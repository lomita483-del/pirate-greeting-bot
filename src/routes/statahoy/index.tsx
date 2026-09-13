import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BarChart3, Loader2 } from "lucide-react";

import { getStatahoyGuilds } from "@/lib/statahoy.functions";

export const Route = createFileRoute("/statahoy/")({
  head: () => ({ meta: [{ title: "Statahoy — !HOY BOT Analytics" }, { name: "description", content: "Live server analytics, member profiles and activity powered by !HOY BOT." }] }),
  component: StatahoyEntry,
});

function StatahoyEntry() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ["statahoy-guilds"], queryFn: () => getStatahoyGuilds() });

  useEffect(() => {
    const guild = data?.guilds?.[0];
    if (data?.signedIn && guild) void navigate({ to: "/statahoy/$guildId", params: { guildId: guild.id }, replace: true });
  }, [data, navigate]);

  return <div className="flex min-h-screen items-center justify-center bg-[#020914] text-white"><div className="text-center"><div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10"><BarChart3 className="size-6 text-primary" /></div><Loader2 className="mx-auto mt-5 size-5 animate-spin text-white/40" aria-hidden="true" /><p className="mt-3 text-sm text-white/55">Opening Statahoy analytics…</p>{!isLoading && error ? <p role="alert" className="mt-2 text-xs text-red-300">{(error as Error).message}</p> : null}{!isLoading && data?.signedIn && !data.guilds.length ? <p className="mt-2 text-xs text-white/40">No connected server is available for analytics.</p> : null}{!isLoading && !data?.signedIn ? <a className="mt-4 inline-block text-sm text-primary underline" href="/api/public/auth/discord/start">Sign in with Discord</a> : null}</div></div>;
}
