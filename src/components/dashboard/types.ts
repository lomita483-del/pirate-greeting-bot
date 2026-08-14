import type { getGuildConfig } from "@/lib/ahoy.functions";

export type GuildConfig = Awaited<ReturnType<typeof getGuildConfig>>;
export type GuildStructure = GuildConfig["structure"];

export type PanelProps = {
  guildId: string;
  config: GuildConfig;
  onSaved: () => void;
};
