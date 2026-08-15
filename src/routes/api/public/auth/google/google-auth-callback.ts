import { createFileRoute } from "@tanstack/react-router";
import { getRequestHeader } from "@tanstack/react-start/server";

import {
  encryptToken,
  exchangeGoogleCode,
  fetchGoogleEmail,
  openGoogleState,
} from "@/lib/google.server";

export const Route = createFileRoute("/api/public/auth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");

        const opened = state ? await openGoogleState(state) : null;
        const fail = (reason: string) =>
          new Response(null, {
            status: 302,
            headers: {
              location: opened
                ? `/dashboard/${opened.guildId}/calendar?error=${reason}`
                : `/dashboard?error=${reason}`,
            },
          });

        if (!code || !opened) return fail("invalid_state");

        const { sessionFromHeader, assertGuildAccess } = await import("@/lib/discord.server");
        const session = await sessionFromHeader(getRequestHeader("cookie") ?? null);
        if (!session) return fail("signed_out");
        try {
          await assertGuildAccess(session, opened.guildId);
        } catch {
          return fail("no_access");
        }

        try {
          const token = await exchangeGoogleCode(
            code,
            `${url.origin}/api/public/auth/google/callback`,
          );
          if (!token.refresh_token) {
            // Google only issues a refresh_token the first time an account
            // grants consent. If this account was connected before and then
            // disconnected without revoking access, Google may skip it —
            // sending the user to Google's own permissions page to revoke
            // AHOY's access first fixes this on the next attempt.
            return fail("no_refresh_token");
          }

          const email = await fetchGoogleEmail(token.access_token);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { error } = await supabaseAdmin.from("google_accounts").upsert(
            {
              guild_id: opened.guildId,
              connected_by: session.userId,
              google_email: email,
              encrypted_refresh_token: await encryptToken(token.refresh_token),
              access_token: token.access_token,
              access_token_expires_at: new Date(
                Date.now() + token.expires_in * 1000,
              ).toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "guild_id,connected_by,google_email" },
          );
          if (error) {
            console.error("google_accounts upsert failed", error);
            return fail("storage_failed");
          }

          return new Response(null, {
            status: 302,
            headers: {
              location: `/dashboard/${opened.guildId}/calendar?connected=${encodeURIComponent(email)}`,
              "cache-control": "no-store",
            },
          });
        } catch (error) {
          console.error("Google OAuth callback failed", error);
          return fail("signin_failed");
        }
      },
    },
  },
});
