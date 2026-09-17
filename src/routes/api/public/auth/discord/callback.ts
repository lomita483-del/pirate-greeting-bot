import { createFileRoute } from "@tanstack/react-router";

import {
  buildSessionCookie,
  exchangeCode,
  fetchCurrentUser,
  openState,
  sealSession,
} from "@/lib/discord.server";

function getDiscordRedirectUri(request: Request): string {
  const configured = process.env.DISCORD_REDIRECT_URI?.trim();
  if (configured) return configured;

  const url = new URL(request.url);
  return `${url.origin}/api/public/auth/discord/callback`;
}

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
            headers: {
              location: `/?error=${encodeURIComponent(reason)}`,
              "cache-control": "no-store",
            },
          });

        if (!code) return fail("oauth_missing_code");
        if (!state) return fail("oauth_missing_state");
        if (!(await openState(state))) return fail("oauth_invalid_state");

        try {
          const redirectUri = getDiscordRedirectUri(request);
          const token = await exchangeCode(code, redirectUri);
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

          const headers = new Headers({
            location: "/dashboard",
            "cache-control": "no-store",
          });
          headers.append("set-cookie", buildSessionCookie(sealed));
          return new Response(null, { status: 302, headers });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error("Discord OAuth callback failed", {
            message,
            hasClientId: Boolean(process.env.DISCORD_CLIENT_ID),
            hasClientSecret: Boolean(process.env.DISCORD_CLIENT_SECRET),
            redirectUri: getDiscordRedirectUri(request),
          });

          if (message === "Discord sign-in failed.") return fail("oauth_token_exchange_failed");
          if (message.includes("Missing required environment variable")) return fail("oauth_server_config");
          if (message.includes("rate limiting")) return fail("oauth_discord_rate_limit");
          if (message.includes("session expired")) return fail("oauth_discord_session_failed");
          return fail("oauth_callback_failed");
        }
      },
    },
  },
});
