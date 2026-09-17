import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";
import { BotMentionPanel } from "@/components/dashboard/bot-mention-panel";
import { AdvancedGeneralPanel } from "@/components/dashboard/advanced-general-panel";
import { CinematicCardStudio, FeatureTestStudio } from "@/components/dashboard/cinematic-card-studio";
import { RoleManagerPanel } from "@/components/dashboard/role-manager-panel";
export const Route=createFileRoute("/dashboard/$guildId/general")({head:()=>({meta:[{title:"General settings — ! HOY BOT Control Center"},{name:"description",content:"Core ! HOY BOT behaviour, cinematic member cards, XP and live feature testing."}]}),component:()=> <div><ModuleHeader icon={Settings} title="General settings" description="Core ! HOY BOT behaviour, cinematic member cards, XP controls and live feature testing."/><WithConfig>{({guildId,config,refresh})=>{const channel=config.structure.channels.find(c=>c.kind==="text");return <div className="space-y-6"><AdvancedGeneralPanel guildId={guildId} config={config} onSaved={refresh}/><CinematicCardStudio guildId={guildId}/><FeatureTestStudio guildId={guildId} channelId={channel?.id ?? "0"}/><BotMentionPanel guildId={guildId} config={config} onSaved={refresh}/><RoleManagerPanel guildId={guildId} config={config} onSaved={refresh}/></div>}}</WithConfig></div>});
