import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

export const uploadDashboardImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Choose an image to upload.");
    return data;
  })
  .handler(async ({ data }) => {
    const guildId = z.string().regex(/^\d{5,25}$/).parse(data.get("guildId"));
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("Choose an image to upload.");
    if (!file.type.startsWith("image/")) throw new Error("Only image files are supported.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Images must be 8 MB or smaller.");

    const { sessionFromHeader, assertGuildAccess } = await import("@/lib/discord.server");
    const session = await sessionFromHeader(getRequestHeader("cookie") ?? null);
    if (!session) throw new Error("Please sign in with Discord.");
    await assertGuildAccess(session, guildId);

    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const fileName = `${guildId}-${crypto.randomUUID()}.${extension}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from("dashboard-images")
      .upload(fileName, file, { contentType: file.type, upsert: false });
    if (error) {
      console.error("Dashboard image upload failed", error);
      throw new Error("Could not upload that image.");
    }

    const forwardedHost = getRequestHeader("x-forwarded-host");
    const host = forwardedHost ?? getRequestHeader("host");
    const protocol = getRequestHeader("x-forwarded-proto") ?? "https";
    if (!host) throw new Error("Could not determine the image address.");
    return { url: `${protocol}://${host}/api/public/media/${fileName}` };
  });