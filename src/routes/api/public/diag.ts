import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/diag")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = process.env["DISCORD_TOKEN"];
        const url = new URL(request.url);
        const guild = url.searchParams.get("guild");
        let guildStatus: number | null = null;
        if (token && guild) {
          const res = await fetch(
            `https://discord.com/api/v10/guilds/${guild}/channels`,
            { headers: { authorization: `Bot ${token}` } },
          );
          guildStatus = res.status;
        }
        let me: number | null = null;
        if (token) {
          const res = await fetch("https://discord.com/api/v10/users/@me", {
            headers: { authorization: `Bot ${token}` },
          });
          me = res.status;
        }
        return Response.json({ hasToken: Boolean(token), me, guildStatus });
      },
    },
  },
});
