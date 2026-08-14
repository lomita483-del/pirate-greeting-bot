import { createFileRoute } from "@tanstack/react-router";

import { authorizeUrl } from "@/lib/discord.server";

export const Route = createFileRoute("/api/public/auth/discord/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const redirectUri = `${url.origin}/api/public/auth/discord/callback`;
        const state = crypto.randomUUID();

        try {
          return new Response(null, {
            status: 302,
            headers: {
              location: authorizeUrl(redirectUri, state),
              "set-cookie": `ahoy_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
              "cache-control": "no-store",
            },
          });
        } catch (error) {
          console.error("Discord OAuth start failed", error);
          return new Response(null, {
            status: 302,
            headers: { location: "/?error=oauth_unavailable" },
          });
        }
      },
    },
  },
});
