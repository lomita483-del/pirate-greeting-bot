import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AhoyWordmark } from "@/components/ahoy/brand";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — !HOY BOT" },
      { name: "description", content: "Privacy Policy for !HOY BOT." },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
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
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Privacy Policy</h1>
            <p className="mt-4 text-sm text-muted-foreground">Last Updated: September 14, 2026</p>
          </header>

          <div className="prose prose-invert mt-10 max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-muted-foreground prose-p:leading-7 prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-primary">
            <p>This Privacy Policy explains how <strong>[YOUR NAME / ORGANIZATION]</strong> ("we", "us", or "our") collects, uses, stores, and protects information when you use <strong>Ahoy / Pirate Bot</strong> (the "Bot"), our Discord bot and related web services.</p>
            <p>By using the Bot, you acknowledge that you have read and understood this Privacy Policy.</p>

            <h2>1. Information We Collect</h2>
            <p>Depending on the features you use, the Bot may process:</p>
            <h3>Discord account information</h3>
            <ul><li>Discord user ID</li><li>Discord username and display name</li><li>Discord server/guild ID</li><li>Discord roles and permissions</li><li>Discord channel and message identifiers</li><li>Avatar information where required by the Bot's functionality</li></ul>
            <h3>Ticket and support information</h3>
            <ul><li>Ticket creator/user ID</li><li>Ticket category</li><li>Ticket channel information</li><li>Information submitted through ticket forms</li><li>Ticket timestamps</li><li>Ticket status</li><li>Ticket transcripts</li><li>Staff responses and administrative actions related to the ticket</li></ul>
            <h3>Moderation information</h3>
            <ul><li>Moderation actions</li><li>Warnings, bans, kicks, mutes, or other disciplinary actions</li><li>Reasons supplied by moderators</li><li>Relevant timestamps</li><li>Administrator/moderator IDs</li><li>Information necessary to maintain moderation and audit logs</li></ul>
            <h3>Activity information</h3>
            <ul><li>Last activity time</li><li>Server activity information</li><li>Message-content snippets where required for a specific moderation or activity feature</li></ul>
            <p>We do not intentionally collect information that is unnecessary for the operation of the Bot.</p>

            <h2>2. How We Use Information</h2>
            <p>We may use collected information to:</p>
            <ul><li>Provide and operate Bot features.</li><li>Create and manage support tickets.</li><li>Process ticket forms.</li><li>Generate and store ticket transcripts.</li><li>Perform moderation and maintain moderation records.</li><li>Maintain security and prevent abuse.</li><li>Provide administrative logs and audit trails.</li><li>Deliver notifications where the recipient has opted in.</li><li>Respond to support requests.</li><li>Improve reliability and functionality.</li><li>Comply with applicable legal obligations.</li></ul>
            <p>We do not sell your personal information.</p>

            <h2>3. Direct Messages and Notifications</h2>
            <p>The Bot may provide notification features through Discord direct messages.</p>
            <p>We will not intentionally use the Bot to send unsolicited mass promotional direct messages.</p>
            <p>Where notification preferences are provided, users may opt in or opt out of eligible notifications.</p>
            <p>A user who has not opted into a particular notification category should not receive that category of optional notification.</p>
            <p>Some transactional or operational messages may be necessary to provide a feature the user has requested, such as a ticket-related response.</p>

            <h2>4. Ticket Transcripts</h2>
            <p>When a ticket is closed, a transcript may be generated for administrative, moderation, support, security, or record-keeping purposes.</p>
            <p>Depending on the configuration of the server, transcripts may be:</p>
            <ul><li>Stored in our database or storage system.</li><li>Sent to an authorized staff/transcript channel.</li><li>Delivered to the ticket owner through Discord direct messages where the feature is enabled.</li></ul>
            <p>Ticket transcripts may contain information voluntarily provided by users during the ticket.</p>
            <p>Users should avoid submitting passwords, payment-card information, authentication codes, or other highly sensitive information through tickets.</p>

            <h2>5. Discord</h2>
            <p>The Bot operates through Discord and uses information made available through Discord's platform and APIs.</p>
            <p>Your use of Discord is also subject to Discord's own policies and terms.</p>
            <p>We do not control Discord's independent handling of your information.</p>

            <h2>6. Data Retention</h2>
            <p>We retain information only for as long as reasonably necessary for the purposes described in this Privacy Policy, including:</p>
            <ul><li>Operating the Bot.</li><li>Maintaining moderation and security records.</li><li>Resolving disputes.</li><li>Maintaining ticket history.</li><li>Preventing abuse.</li><li>Meeting legal or administrative requirements.</li></ul>
            <p>Retention periods may differ depending on the type of information.</p>
            <p>When information is no longer reasonably required, we may delete or anonymize it.</p>

            <h2>7. Data Security</h2>
            <p>We take reasonable technical and organizational measures to protect stored information against unauthorized access, alteration, disclosure, or destruction.</p>
            <p>However, no online service can guarantee absolute security.</p>

            <h2>8. Data Deletion Requests</h2>
            <p>You may request deletion of personal information associated with your use of the Bot, subject to legitimate retention requirements.</p>
            <p>To request deletion, contact:</p>
            <p><strong>Email:</strong> [PRIVACY EMAIL]</p>
            <p>Your request should include enough information for us to identify the relevant account or records.</p>
            <p>We may need to verify the request before processing it.</p>
            <p>Certain information may need to be retained where required for security, legal, fraud-prevention, moderation, or legitimate record-keeping purposes.</p>

            <h2>9. Children's Privacy</h2>
            <p>The Bot is not intentionally designed to collect personal information from children.</p>
            <p>Users should comply with Discord's minimum age requirements and applicable laws in their jurisdiction.</p>

            <h2>10. Third-Party Services</h2>
            <p>The Bot may rely on third-party services to operate, including Discord and infrastructure/database providers.</p>
            <p>Those services may process information according to their own privacy policies and terms.</p>

            <h2>11. Changes to This Privacy Policy</h2>
            <p>We may update this Privacy Policy from time to time.</p>
            <p>When material changes are made, we may update the "Last Updated" date and, where appropriate, provide additional notice.</p>

            <h2>12. Contact</h2>
            <p>For privacy questions, requests, or concerns, contact:</p>
            <ul><li><strong>Developer/Organization:</strong> [NAME]</li><li><strong>Email:</strong> [PRIVACY EMAIL]</li><li><strong>Website:</strong> [WEBSITE URL]</li></ul>
            <p><strong>Privacy Policy Version:</strong> 1.0</p>
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
