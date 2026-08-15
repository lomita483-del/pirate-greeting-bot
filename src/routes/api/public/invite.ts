import { createFileRoute } from "@tanstack/react-router";

/** Manage Roles, Kick, Ban, Manage Channels, Manage Messages, Moderate Members, Embed Links, Read History, Send Messages */
const PERMISSIONS = "1099780064310";

export const Route = createFileRoute("/api/public/invite")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = process.env["DISCORD_CLIENT_ID"];
        if (!clientId) {
          return new Response(null, {
            status: 302,
            headers: { location: "/?error=invite_unavailable" },
          });
        }

        const url = new URL(request.url);
        const guildId = url.searchParams.get("guild");
        const invite = new URL("https://discord.com/oauth2/authorize");
        invite.searchParams.set("client_id", clientId);
        invite.searchParams.set("scope", "bot applications.commands");
        invite.searchParams.set("permissions", PERMISSIONS);
        if (guildId && /^\d{5,25}$/.test(guildId)) {
          invite.searchParams.set("guild_id", guildId);
          invite.searchParams.set("disable_guild_select", "true");
        }

        return new Response(null, {
          status: 302,
          headers: { location: invite.toString(), "cache-control": "no-store" },
        });
      },
    },
  },
});
