import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/$guildId/calendar")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/calendar/$guildId", params: { guildId: params.guildId } });
  },
  component: () => null,
});
