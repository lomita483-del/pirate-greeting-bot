import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listPlatformServers } from "@/lib/admin.functions";

export function ServersPanel() {
  const { data = [], isPending } = useQuery({
    queryKey: ["admin", "servers"],
    queryFn: () => listPlatformServers(),
  });

  if (isPending) return <p className="text-sm text-muted-foreground">Charting the fleet…</p>;
  if (!data.length)
    return <p className="text-sm text-muted-foreground">AHOY has not joined any servers yet.</p>;

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <table className="w-full text-sm">
        <thead className="hairline text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Server</th>
            <th className="px-4 py-3">Members</th>
            <th className="px-4 py-3">Mod actions</th>
            <th className="px-4 py-3">Open tickets</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {data.map((server) => (
            <tr key={server.guild_id} className="hairline">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {server.icon ? (
                    <img
                      src={`https://cdn.discordapp.com/icons/${server.guild_id}/${server.icon}.png?size=48`}
                      alt=""
                      className="size-8 rounded-lg"
                    />
                  ) : (
                    <div className="size-8 rounded-lg bg-muted" />
                  )}
                  <div>
                    <p className="font-medium">{server.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{server.guild_id}</p>
                  </div>
                  {server.bot_present ? null : <Badge variant="outline">bot removed</Badge>}
                </div>
              </td>
              <td className="px-4 py-3">{server.member_count.toLocaleString()}</td>
              <td className="px-4 py-3">{server.moderationActions}</td>
              <td className="px-4 py-3">{server.openTickets}</td>
              <td className="px-4 py-3 text-right">
                <Button asChild size="sm" variant="outline">
                  <Link to="/dashboard/$guildId" params={{ guildId: server.guild_id }}>
                    Open
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
