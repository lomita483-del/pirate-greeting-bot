import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import { SupportPanel } from "@/components/dashboard/support-panel";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/$guildId/support")({
  head: () => ({ meta: [{ title: "Support & Feedback — !HOY BOT" }, { name: "description", content: "Send feedback, complaints and issue reports to !HOY BOT support." }] }),
  component: SupportPage,
});

function SupportPage() { const { guildId } = Route.useParams(); return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><LifeBuoy className="size-5" /></span><div><p className="text-[9px] font-bold uppercase tracking-[.25em] text-primary">Support</p><h1 className="text-2xl font-black">Feedback & Issues</h1></div></div><Button asChild variant="outline" className="gap-2"><Link to="/dashboard/$guildId" params={{ guildId }}><ArrowLeft className="size-4" />Back to dashboard</Link></Button></div><SupportPanel /></div>; }