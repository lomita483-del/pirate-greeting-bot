import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AhoyWordmark } from "@/components/ahoy/brand";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — !HOY BOT" },
      { name: "description", content: "Terms of Service for !HOY BOT." },
    ],
  }),
  component: TermsOfServicePage,
});

function TermsOfServicePage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/" aria-label="Back to !HOY BOT home"><AhoyWordmark subtitle="Privacy & Legal" /></Link>
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-20 pt-8">
        <article className="glass rounded-3xl p-6 sm:p-10 lg:p-14">
          <header className="border-b border-border/60 pb-8">
            <p className="text-xs uppercase tracking-[0.22em] text-primary">!HOY BOT</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Terms of Service</h1>
            <p className="mt-4 text-sm text-muted-foreground">Last Updated: September 14, 2026</p>
          </header>

          <div className="prose prose-invert mt-10 max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-muted-foreground prose-p:leading-7 prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-primary">
            <p>These Terms of Service ("Terms") govern your use of <strong>Ahoy / Pirate Bot</strong> (the "Bot") and any related website or services operated by <strong>[YOUR NAME / ORGANIZATION]</strong>.</p>
            <p>By using the Bot, you agree to these Terms.</p>
            <p>If you do not agree with these Terms, you should stop using the Bot.</p>

            <h2>1. About the Bot</h2>
            <p>Ahoy / Pirate Bot provides Discord server-management functionality that may include:</p>
            <ul><li>Ticket and support systems</li><li>Ticket forms</li><li>Ticket transcripts</li><li>Moderation tools</li><li>Administrative tools</li><li>Notifications</li><li>Activity features</li><li>Server management features</li><li>Logging and audit functionality</li><li>Other features made available by server administrators</li></ul>
            <p>Features may vary between Discord servers.</p>

            <h2>2. Discord Account and Server Rules</h2>
            <p>Your use of the Bot does not replace Discord's rules.</p>
            <p>You must comply with:</p>
            <ul><li>Discord's Terms of Service</li><li>Discord's Community Guidelines</li><li>Applicable laws and regulations</li><li>The rules of the Discord server where the Bot is installed</li></ul>
            <p>Server administrators may impose additional rules.</p>

            <h2>3. Acceptable Use</h2>
            <p>You must not use the Bot to:</p>
            <ul><li>Harass, threaten, or abuse other users.</li><li>Conduct unlawful activities.</li><li>Circumvent security measures.</li><li>Attempt to gain unauthorized access to systems or accounts.</li><li>Abuse, overload, or interfere with the Bot or its infrastructure.</li><li>Exploit bugs or vulnerabilities.</li><li>Use automated systems to abuse Bot functionality.</li><li>Send unsolicited bulk messages or spam through the Bot.</li><li>Use the Bot in a manner that violates Discord's policies.</li></ul>

            <h2>4. Tickets and Forms</h2>
            <p>When submitting a ticket or form, you agree to provide information that is accurate to the best of your knowledge.</p>
            <p>Do not submit:</p>
            <ul><li>Passwords</li><li>Authentication codes</li><li>Private encryption keys</li><li>Payment-card information</li><li>Highly sensitive personal information unless specifically necessary and requested by an authorized administrator</li></ul>
            <p>Server staff may review information submitted through tickets for support, moderation, security, or administrative purposes.</p>

            <h2>5. Notifications</h2>
            <p>Certain notification features may require user consent or an explicit opt-in.</p>
            <p>You may be able to withdraw notification preferences through the available settings or commands.</p>
            <p>Operational communications necessary to provide a service you specifically requested may still be sent where appropriate.</p>
            <p>We do not authorize the Bot to be used as a general-purpose unsolicited mass-DM system.</p>

            <h2>6. Moderation and Administrative Actions</h2>
            <p>The Bot may allow authorized server administrators or moderators to perform actions such as:</p>
            <ul><li>Warnings</li><li>Kicks</li><li>Bans</li><li>Mutes</li><li>Ticket management</li><li>Administrative logging</li><li>Other server-management actions</li></ul>
            <p>We are not responsible for decisions made independently by Discord server administrators.</p>
            <p>Server administrators are responsible for using moderation features appropriately and in accordance with applicable rules and laws.</p>

            <h2>7. Availability</h2>
            <p>We attempt to keep the Bot operational and reliable, but we do not guarantee uninterrupted availability.</p>
            <p>The Bot may become temporarily unavailable because of:</p>
            <ul><li>Maintenance</li><li>Discord API issues</li><li>Infrastructure failures</li><li>Software bugs</li><li>Security incidents</li><li>Network problems</li><li>Third-party service outages</li><li>Other circumstances beyond our reasonable control</li></ul>

            <h2>8. Changes and Feature Removal</h2>
            <p>We may modify, add, suspend, or remove Bot features at any time.</p>
            <p>We may also change these Terms when necessary.</p>
            <p>Continued use of the Bot after an update constitutes acceptance of the updated Terms, where permitted by applicable law.</p>

            <h2>9. Suspension or Termination</h2>
            <p>We may restrict or terminate access to the Bot where reasonably necessary because of:</p>
            <ul><li>Abuse</li><li>Security concerns</li><li>Violation of these Terms</li><li>Violation of Discord policies</li><li>Illegal activity</li><li>Attempts to exploit or compromise the Bot</li><li>Other conduct that creates significant risk to the service or its users</li></ul>
            <p>Discord server administrators may independently remove the Bot from their server.</p>

            <h2>10. Intellectual Property</h2>
            <p>Unless otherwise stated, the Bot's software, branding, original graphics, documentation, and related materials are owned by or licensed to <strong>[YOUR NAME / ORGANIZATION]</strong>.</p>
            <p>You may not copy, redistribute, reverse engineer, or commercially exploit proprietary portions of the Bot except where permitted by applicable law.</p>

            <h2>11. Third-Party Services</h2>
            <p>The Bot depends on third-party services, including Discord and potentially hosting, database, storage, or other infrastructure providers.</p>
            <p>Those services operate independently and may have their own terms and policies.</p>
            <p>We are not responsible for outages or changes made by third-party services.</p>

            <h2>12. Disclaimer</h2>
            <p>The Bot is provided on an "as available" basis.</p>
            <p>To the maximum extent permitted by applicable law, we make no guarantee that the Bot will always be:</p>
            <ul><li>Available</li><li>Error-free</li><li>Secure</li><li>Compatible with every Discord configuration</li><li>Free from interruptions</li></ul>

            <h2>13. Limitation of Liability</h2>
            <p>To the maximum extent permitted by applicable law, <strong>[YOUR NAME / ORGANIZATION]</strong> will not be responsible for indirect, incidental, consequential, or other losses arising from your use of or inability to use the Bot.</p>
            <p>Nothing in these Terms excludes liability that cannot legally be excluded or limited.</p>

            <h2>14. Privacy</h2>
            <p>Information processed through the Bot is handled according to our Privacy Policy.</p>
            <p>Please review the Privacy Policy for information about collection, use, retention, security, and deletion of data.</p>

            <h2>15. Contact</h2>
            <p>For questions regarding these Terms, contact:</p>
            <ul><li><strong>Developer/Organization:</strong> [NAME]</li><li><strong>Email:</strong> [CONTACT EMAIL]</li><li><strong>Website:</strong> [WEBSITE URL]</li></ul>
            <p><strong>Terms of Service Version:</strong> 1.0</p>
          </div>
        </article>
      </main>

      <footer className="hairline border-t border-border/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground">
          <span>!HOY — steady as she goes.</span>
          <div className="flex items-center gap-4"><Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link><Link to="/terms" className="hover:text-foreground">Terms of Service</Link></div>
        </div>
      </footer>
    </div>
  );
}
