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

          const { data: saved, error } = existing
            ? await supabaseAdmin.from("google_accounts").update(base).eq("id", existing.id).select("id").maybeSingle()
            : await supabaseAdmin.from("google_accounts").insert({
                ...base,
                encrypted_refresh_token: await encryptToken(token.refresh_token ?? ""),
              }).select("id").maybeSingle();

          if (error || !saved) {
            console.error("google_accounts save failed", {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code,
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
