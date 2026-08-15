import { createContext, useContext } from "react";

import type { GuildConfig } from "@/components/dashboard/types";
import type { getGuildOverview } from "@/lib/ahoy.functions";

export type GuildOverview = Awaited<ReturnType<typeof getGuildOverview>>;

export type GuildContextValue = {
  guildId: string;
  config: GuildConfig | undefined;
  overview: GuildOverview | undefined;
  isPending: boolean;
  refresh: () => void;
};

export const GuildContext = createContext<GuildContextValue | null>(null);

export function useGuild() {
  const value = useContext(GuildContext);
  if (!value) throw new Error("useGuild must be used inside the guild dashboard layout");
  return value;
}
