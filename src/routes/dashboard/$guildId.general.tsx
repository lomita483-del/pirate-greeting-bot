import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";
import { BotMentionPanel } from "@/components/dashboard/bot-mention-panel";
import { AdvancedGeneralPanel } from "@/components/dashboard/advanced-general-panel";
import { CinematicCardStudio, FeatureTestStudio } from "@/components/dashboard/cinematic-card-studio";
import { XPAdminPanel } from "@/components/dashboard/xp-admin-panel";
import { RoleManagerPanel } from "@/components/dashboard/role-manager-panel";
export const Route=createFileRoute("/dashboard/$guildId/general")({head:()=>({meta:[{title:"General settings — ! HOY BOT Control Center"},{name:"description",content:"Core ! HOY BOT behaviour, XP administration, cinematic cards and live feature tests."}]}),component:()=> <div><ModuleHeader icon={Settings} title="General settings" description="Core ! HOY BOT behaviour, XP administration, cinematic member cards and live feature tests."/><WithConfig>{({guildId,config,refresh})=>{const channel=config.structure.channels.find(c=>c.kind==="text");return <div className="space-y-6"><AdvancedGeneralPanel guildId={guildId} config={config} onSaved={refresh}/><XPAdminPanel guildId={guildId}/><CinematicCardStudio guildId={guildId}/><FeatureTestStudio guildId={guildId} channelId={channel?.id??"0"}/><BotMentionPanel guildId={guildId} config={config} onSaved={refresh}/><RoleManagerPanel guildId={guildId} config={config} onSaved={refresh}/></div>}}</WithConfig></div>});
