import { createFileRoute } from "@tanstack/react-router";

import {
  buildSessionCookie,
  exchangeCode,
  fetchCurrentUser,
  openState,
  sealSession,
} from "@/lib/discord.server";

export const Route = createFileRoute("/api/public/auth/discord/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");

        const fail = (reason: string) =>
          new Response(null, {
            status: 302,
            headers: { location: `/?error=${reason}` },
          });

        if (!code || !state || !(await openState(state))) {
          return fail("invalid_state");
        }

        try {
          const token = await exchangeCode(
            code,
            `${url.origin}/api/public/auth/discord/callback`,
          );
          const user = await fetchCurrentUser(token.access_token);

          const { recordSignIn } = await import("@/lib/admin.server");
          const { banned } = await recordSignIn(user);
          if (banned) return fail("banned");

          const sealed = await sealSession({
            userId: user.id,
            username: user.username,
            globalName: user.global_name,
            avatar: user.avatar,
            accessToken: token.access_token,
            expiresAt: Date.now() + Math.min(token.expires_in, 604800) * 1000,
          });

          const headers = new Headers({ location: "/dashboard", "cache-control": "no-store" });
          headers.append("set-cookie", buildSessionCookie(sealed));
          return new Response(null, { status: 302, headers });
        } catch (error) {
          console.error("Discord OAuth callback failed", error);
          return fail("signin_failed");
        }
      },
    },
  },
});
