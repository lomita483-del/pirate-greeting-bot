import { createFileRoute } from "@tanstack/react-router";
import { getRequestHeader } from "@tanstack/react-start/server";

import { googleAuthorizeUrl, sealGoogleState } from "@/lib/google.server";

export const Route = createFileRoute("/api/public/auth/google/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const guildId = url.searchParams.get("guildId");
        if (!guildId || !/^\d{5,25}$/.test(guildId)) {
          return new Response(null, {
            status: 302,
            headers: { location: "/dashboard?error=missing_guild" },
          });
        }

        // Must already be signed in and able to manage this guild — Google
        // access is granted on behalf of a guild, not the bare Discord login.
        const { sessionFromHeader, assertGuildAccess } = await import("@/lib/discord.server");
        const session = await sessionFromHeader(getRequestHeader("cookie") ?? null);
        if (!session) {
          return new Response(null, { status: 302, headers: { location: "/" } });
        }
        try {
          await assertGuildAccess(session, guildId);
        } catch {
          return new Response(null, {
            status: 302,
            headers: { location: `/dashboard/${guildId}?error=no_access` },
          });
        }

        const redirectUri = `${url.origin}/api/public/auth/google/callback`;
        try {
          const state = await sealGoogleState(guildId);
          return new Response(null, {
            status: 302,
            headers: {
              location: googleAuthorizeUrl(redirectUri, state),
              "cache-control": "no-store",
            },
          });
        } catch (error) {
          console.error("Google OAuth start failed", error);
          return new Response(null, {
            status: 302,
            headers: { location: `/dashboard/${guildId}/calendar?error=oauth_unavailable` },
          });
        }
      },
    },
  },
});
