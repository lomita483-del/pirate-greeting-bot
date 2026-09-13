import { createFileRoute, Navigate, useLocation } from "@tanstack/react-router";
import { StatahoyUserActivityContent } from "./statahoy/$guildId.activity";

export const Route = createFileRoute("/$")({
  component: CatchAllRoute,
});

function CatchAllRoute() {
  const location = useLocation();
  const match = location.pathname.match(/^\/statahoy\/([^/]+)\/activity\/?$/);

  if (match) {
    return <StatahoyUserActivityContent guildId={match[1]} />;
  }

  return <Navigate to="/" replace />;
}
