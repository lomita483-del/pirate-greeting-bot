import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/discord-status")({
  server: {
    handlers: {
      GET: async () => {
        const token = process.env["DISCORD_TOKEN"]?.trim();
        if (!token) return Response.json({ configured: false, discordStatus: null });

        try {
          const response = await fetch("https://discord.com/api/v10/users/@me", {
            headers: { authorization: `Bot ${token}` },
          });
          return Response.json({ configured: true, discordStatus: response.status });
        } catch {
          return Response.json({ configured: true, discordStatus: 0 });
        }
      },
    },
  },
});