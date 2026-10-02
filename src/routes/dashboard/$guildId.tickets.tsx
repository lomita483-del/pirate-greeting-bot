import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Ticket } from "lucide-react";
import { useGuild } from "@/components/dashboard/guild-context";
import { TicketPanelPublisher } from "@/components/dashboard/ticket-panel-publisher";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/$guildId/tickets")({
  head: () => ({ meta: [{ title: "Tickets — !HOY BOT" }, { name: "description", content: "Configure and publish !HOY BOT ticket support panels." }] }),
  component: TicketsPage,
});

function TicketsPage() { const { guildId, config } = useGuild(); return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Ticket className="size-5" /></span><div><p className="text-[9px] font-bold uppercase tracking-[.25em] text-primary">Support operations</p><h1 className="text-2xl font-black">Tickets</h1><p className="text-sm text-muted-foreground">Configure your support panel for {config?.guild.name ?? "this server"}.</p></div></div><Button asChild variant="outline" className="gap-2"><Link to="/dashboard/$guildId" params={{ guildId }}><ArrowLeft className="size-4" />Back to dashboard</Link></Button></div><section className="rounded-3xl border border-white/[0.1] bg-white/[0.03] p-5 shadow-xl backdrop-blur-xl">{config ? <TicketPanelPublisher guildId={guildId} channels={config.structure.channels.filter((c) => c.kind === "text")} categories={config.structure.channels.filter((c) => c.kind === "category")} roles={config.structure.roles} defaultChannelId={config.settings?.ticket_panel_channel_id ?? null} transcriptChannelId={config.settings?.ticket_transcript_channel_id ?? null} dmTranscriptEnabled={Boolean(config.settings?.ticket_dm_transcript_enabled)} /> : null}</section></div>; }