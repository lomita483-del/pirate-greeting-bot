import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AhoyWordmark } from "@/components/ahoy/brand";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of Service — !HOY BOT" }, { name: "description", content: "Terms of Service for !HOY BOT." }] }),
  component: TermsOfServicePage,
});

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-4">
    <h2>{title}</h2>
    {children}
  </section>
);

function TermsOfServicePage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/" aria-label="Back to !HOY BOT home"><AhoyWordmark subtitle="Privacy & Legal" /></Link>
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back home</Link>
      </header>
      <main className="mx-auto max-w-4xl px-6 pb-20 pt-8">
        <article className="glass rounded-3xl p-6 sm:p-10 lg:p-14">
          <header className="border-b border-border/60 pb-8">
            <p className="text-xs uppercase tracking-[0.22em] text-primary">!HOY BOT</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Terms of Service — !HOY Discord Bot</h1>
            <p className="mt-4 text-sm text-muted-foreground">Last updated: September 14, 2026</p>
          </header>
          <div className="prose prose-invert mt-10 max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-muted-foreground prose-p:leading-7 prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-primary">
            <p>These Terms govern your use of <strong>!HOY</strong> ("we," "us," "the Bot"), a Discord bot and companion dashboard. By adding !HOY to a server, using its commands, or accessing the dashboard, you agree to these Terms. If you don't agree, don't use !HOY.</p>
            <Section title="1. The Service"><p>!HOY provides Discord server tools including moderation, automod, ticketing, XP/leveling, a virtual economy, reminders, calendar sync, custom commands, and related dashboard features. Features are enabled and configured by each server's administrators — we don't control how an individual server chooses to configure the Bot.</p></Section>
            <Section title="2. Acceptable Use">
              <p>You agree not to:</p>
              <ul><li>Use !HOY to violate Discord's Terms of Service or Community Guidelines</li><li>Use !HOY to harass, abuse, or harm other users</li><li>Attempt to exploit, reverse-engineer, or disrupt the Bot's systems or infrastructure</li><li>Use moderation or admin features to circumvent Discord's own moderation or safety tools</li><li>Use the economy or leveling systems for real-money trading or gambling (see Section 4)</li></ul>
              <p>Server administrators are responsible for configuring !HOY (permissions, automod rules, custom commands, etc.) in a way that complies with Discord's Terms of Service and Community Guidelines, and with applicable law.</p>
            </Section>
            <Section title="3. Accounts & Access"><p>Dashboard access is tied to your Discord account via OAuth. You're responsible for anything done through your account. We may suspend or revoke a server's or user's access to !HOY at our discretion — for example, for abuse, violation of these Terms, or a request from Discord.</p></Section>
            <Section title="4. Virtual Currency"><p>!HOY's economy features use virtual, in-app currency only. It has <strong>no real-world monetary value</strong>, cannot be purchased with real money, exchanged for cash, or transferred outside !HOY. It exists solely for engagement within a server.</p></Section>
            <Section title="5. Support Tickets & User Content"><p>Content you submit through !HOY — ticket messages, support reports, custom commands, etc. — remains yours, but you grant us the right to store and process it as needed to operate the relevant feature (see our Privacy Policy for details).</p></Section>
            <Section title="6. Service Availability"><p>!HOY is provided <strong>"as is" and "as available,"</strong> without warranties of any kind, express or implied. We don't guarantee uninterrupted or error-free operation, and features may change, be added, or be removed over time.</p></Section>
            <Section title="7. Limitation of Liability"><p>To the fullest extent permitted by law, !HOY and its operators are not liable for indirect, incidental, or consequential damages arising from your use of the Bot, including data loss, moderation actions taken by server admins, or service interruptions.</p></Section>
            <Section title="8. Termination"><p>We may suspend or terminate access to !HOY for any account or server that violates these Terms, Discord's policies, or applicable law. Server admins can remove !HOY from their server at any time via Discord's server settings.</p></Section>
            <Section title="9. Changes to These Terms"><p>We may update these Terms as !HOY evolves. Material changes will be reflected by updating the "Last updated" date above. Continued use after changes take effect constitutes acceptance of the revised Terms.</p></Section>
            <Section title="10. Contact"><p>Questions about these Terms can be sent through the in-app <strong>Support</strong> panel on the !HOY dashboard.</p></Section>
          </div>
        </article>
      </main>
      <footer className="hairline border-t border-border/60"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground"><span>!HOY — steady as she goes.</span><div className="flex items-center gap-4"><Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link><Link to="/terms" className="hover:text-foreground">Terms of Service</Link></div></div></footer>
    </div>
  );
}
