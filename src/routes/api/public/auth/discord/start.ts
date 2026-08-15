import { createFileRoute } from "@tanstack/react-router";

import { authorizeUrl, sealState } from "@/lib/discord.server";

export const Route = createFileRoute("/api/public/auth/discord/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const redirectUri = `${url.origin}/api/public/auth/discord/callback`;

        try {
          const state = await sealState();
          return new Response(null, {
            status: 302,
            headers: {
              location: authorizeUrl(redirectUri, state),
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
