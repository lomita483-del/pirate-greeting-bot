import { createFileRoute } from "@tanstack/react-router";

/**
 * Multipart image upload for the dashboard. A plain HTTP route is used instead
 * of a server function because the server-function transport does not carry
 * multipart bodies reliably. Access is still gated by the AHOY session cookie
 * plus a live Discord permission check for the target guild.
 */
export const Route = createFileRoute("/api/public/media/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json" },
          });

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ error: "Choose an image to upload." }, 400);
        }

        const guildId = String(form.get("guildId") ?? "");
        if (!/^\d{5,25}$/.test(guildId)) return json({ error: "Unknown server." }, 400);

        const file = form.get("file");
        if (!(file instanceof File)) return json({ error: "Choose an image to upload." }, 400);
        if (!file.type.startsWith("image/")) {
          return json({ error: "Only image files are supported." }, 400);
        }
        if (file.size > 8 * 1024 * 1024) {
          return json({ error: "Images must be 8 MB or smaller." }, 400);
        }

        const { sessionFromHeader, assertGuildAccess } = await import("@/lib/discord.server");
        const session = await sessionFromHeader(request.headers.get("cookie"));
        if (!session) return json({ error: "Please sign in with Discord." }, 401);
        try {
          await assertGuildAccess(session, guildId);
        } catch (error) {
          return json({ error: (error as Error).message }, 403);
        }

        const extension =
          file.name
            .split(".")
            .pop()
            ?.toLowerCase()
            .replace(/[^a-z0-9]/g, "") || "png";
        const fileName = `${guildId}-${crypto.randomUUID()}.${extension}`;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.storage
          .from("dashboard-images")
          .upload(fileName, file, { contentType: file.type, upsert: false });
        if (error) {
          console.error("Dashboard image upload failed", error);
          return json({ error: "Could not upload that image." }, 500);
        }

        const url = new URL(request.url);
        const host = request.headers.get("x-forwarded-host") ?? url.host;
        const protocol = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
        return json({ url: `${protocol}://${host}/api/public/media/${fileName}` });
      },
    },
  },
});
