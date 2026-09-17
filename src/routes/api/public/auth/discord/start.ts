import { createFileRoute } from "@tanstack/react-router";

import { authorizeUrl, sealState } from "@/lib/discord.server";

function getDiscordRedirectUri(request: Request): string {
  const configured = process.env.DISCORD_REDIRECT_URI?.trim();
  if (configured) return configured;

  const url = new URL(request.url);
  return `${url.origin}/api/public/auth/discord/callback`;
}

export const Route = createFileRoute("/api/public/auth/discord/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const redirectUri = getDiscordRedirectUri(request);

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
