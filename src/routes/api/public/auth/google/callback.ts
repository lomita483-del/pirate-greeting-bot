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

          const email = await fetchGoogleEmail(token.access_token);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Google only issues a refresh_token on the first consent for an
          // account. If we already hold one for this guild + user + email we
          // simply refresh the cached access token instead of failing the link.
          const { data: existing } = await supabaseAdmin
            .from("google_accounts")
            .select("id")
            .eq("guild_id", opened.guildId)
            .eq("connected_by", session.userId)
            .eq("google_email", email)
            .maybeSingle();

          if (!token.refresh_token && !existing) {
            return fail("no_refresh_token");
          }

          const base = {
            guild_id: opened.guildId,
            connected_by: session.userId,
            google_email: email,
            access_token: token.access_token,
            access_token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
            ...(token.refresh_token
              ? { encrypted_refresh_token: await encryptToken(token.refresh_token) }
              : {}),
          };

          let saved: { id: string } | null = null;
          let error: { code?: string; message?: string; details?: string; hint?: string } | null = null;

          if (existing) {
            ({ data: saved, error } = await supabaseAdmin
              .from("google_accounts")
              .update(base)
              .eq("id", existing.id)
              .select("id")
              .maybeSingle());
          } else {
            ({ data: saved, error } = await supabaseAdmin
              .from("google_accounts")
              .insert({
                ...base,
                encrypted_refresh_token: await encryptToken(token.refresh_token ?? ""),
              })
              .select("id")
              .maybeSingle());

            // Race condition: two requests (double-tap, retry after a
            // slow response) can both pass the `existing` check above
            // before either write commits. The loser hits the unique
            // constraint on (guild_id, connected_by, google_email) — that's
            // not a real failure, the account IS connected (by the other
            // request), so fall back to updating that row instead of
            // reporting storage_failed for what is actually a success.
            if (error?.code === "23505") {
              const { data: nowExisting } = await supabaseAdmin
                .from("google_accounts")
                .select("id")
                .eq("guild_id", opened.guildId)
                .eq("connected_by", session.userId)
                .eq("google_email", email)
                .maybeSingle();
              if (nowExisting) {
                ({ data: saved, error } = await supabaseAdmin
                  .from("google_accounts")
                  .update(base)
                  .eq("id", nowExisting.id)
                  .select("id")
                  .maybeSingle());
              }
            }
          }

          if (error || !saved) {
            console.error("google_accounts save failed", {
              message: error?.message,
              details: error?.details,
              hint: error?.hint,
              code: error?.code,
            });
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
