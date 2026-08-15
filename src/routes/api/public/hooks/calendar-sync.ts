import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint: syncs every enabled calendar source and delivers any reminder
 * that is due. Safe to call repeatedly — both steps are idempotent.
 *
 * Schedule with pg_cron every 5 minutes, sending the Supabase anon key as
 * the `apikey` header.
 */
export const Route = createFileRoute("/api/public/hooks/calendar-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
        const expected =
          process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
        if (!expected || key !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncAllSources, dispatchDueReminders } = await import("@/lib/calendar.server");

        const sync = await syncAllSources(supabaseAdmin);
        const reminders = await dispatchDueReminders(supabaseAdmin);

        return new Response(JSON.stringify({ ok: true, sync, reminders }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
