import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/$guildId/stats")({ component: StatsRedirect });

function StatsRedirect() {
  const { guildId } = Route.useParams();
  return <Navigate to="/dashboard/$guildId/general" params={{ guildId }} replace />;
}
