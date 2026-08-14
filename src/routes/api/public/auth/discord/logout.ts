import { createFileRoute } from "@tanstack/react-router";

import { clearSessionCookie } from "@/lib/discord.server";

export const Route = createFileRoute("/api/public/auth/discord/logout")({
  server: {
    handlers: {
      GET: async () =>
        new Response(null, {
          status: 302,
          headers: { location: "/", "set-cookie": clearSessionCookie() },
        }),
    },
  },
});
