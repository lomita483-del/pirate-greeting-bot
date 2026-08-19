import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/media/$fileName")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^\d{5,25}-[0-9a-f-]{36}\.[a-z0-9]{1,8}$/i.test(params.fileName)) {
          return new Response("Not found", { status: 404 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage
          .from("dashboard-images")
          .download(params.fileName);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data, {
          headers: {
            "content-type": data.type || "application/octet-stream",
            "cache-control": "public, max-age=31536000, immutable",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
