import { createFileRoute } from "@tanstack/react-router";
import { Hand } from "lucide-react";
import { PremiumGate } from "@/components/dashboard/premium-gate";
import { ModuleHeader, WithConfig } from "@/components/dashboard/module-page";
import { GoodbyePanel } from "@/components/dashboard/settings-panels";
import { WelcomeMessagesPanel } from "@/components/dashboard/welcome-messages-panel";
import { FeatureTestStudio } from "@/components/dashboard/cinematic-card-studio";
export const Route=createFileRoute("/dashboard/$guildId/welcome")({head:()=>({meta:[{title:"Welcome messages — ! HOY BOT Control Center"},{name:"description",content:"Cinematic welcome and goodbye messages with live testing."}]}),component:()=> <div className="space-y-6"><ModuleHeader icon={Hand} title="Welcome messages" description="Cinematic welcomes, goodbye messages and live Discord testing."/><WithConfig>{({guildId,config,refresh})=>{const channel=config.structure.channels.find(c=>c.kind==="text");return <PremiumGate feature="welcome"><div className="space-y-6"><WelcomeMessagesPanel guildId={guildId} config={config} onSaved={refresh}/><FeatureTestStudio guildId={guildId} channelId={channel?.id??"0"}/><GoodbyePanel guildId={guildId} config={config} onSaved={refresh}/></div></PremiumGate>}}</WithConfig></div>});
