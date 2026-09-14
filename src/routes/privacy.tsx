import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AhoyWordmark } from "@/components/ahoy/brand";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — !HOY BOT" }, { name: "description", content: "Privacy Policy for !HOY BOT." }] }),
  component: PrivacyPolicyPage,
});

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-4">
    <h2>{title}</h2>
    {children}
  </section>
);

function PrivacyPolicyPage() {
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
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Privacy Policy — !HOY Discord Bot</h1>
            <p className="mt-4 text-sm text-muted-foreground">Last updated: September 14, 2026</p>
          </header>
          <div className="prose prose-invert mt-10 max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-muted-foreground prose-p:leading-7 prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-primary">
            <p><strong>!HOY</strong> ("we," "us," "the Bot") is a Discord server management bot and dashboard offering moderation, ticketing, leveling, economy, reminders, and calendar sync features. This policy explains what data we collect, why, and how it's handled. !HOY is not affiliated with, endorsed by, or sponsored by Discord Inc.</p>
            <Section title="1. Information We Collect">
              <p>When a server administrator adds !HOY to a Discord server and enables its features, we may collect and store:</p>
              <ul>
                <li><strong>Discord account data:</strong> user IDs, usernames/display names, avatars, and which servers (guilds) you're a member of.</li>
                <li><strong>Message content:</strong> short snippets of message content, used for moderation/automod enforcement and to track when a member was last active. We do not store full message logs beyond what a specific feature needs.</li>
                <li><strong>Moderation records:</strong> warnings, bans, ban reasons, moderator notes, and case history for the servers you're in.</li>
                <li><strong>Support ticket transcripts:</strong> the content of tickets you open through the Bot's ticket system.</li>
                <li><strong>Engagement data:</strong> XP/leveling progress and virtual economy balances (no real money is involved — see Terms of Service).</li>
                <li><strong>Scheduling data:</strong> reminders you set, and calendar events synced from Google Calendar or iCal feeds a server admin connects.</li>
                <li><strong>Server configuration:</strong> settings, custom commands, automod rules, welcome messages, and role setups configured by server admins.</li>
                <li><strong>Notification delivery records:</strong> logs of announcements or reminders sent to you, so we can avoid duplicate sends and troubleshoot delivery issues.</li>
              </ul>
              <p>We only collect what a given feature needs to function, and only for servers where that feature is enabled.</p>
            </Section>
            <Section title="2. How We Use Your Information">
              <p>We use collected data to:</p>
              <ul><li>Enforce moderation and automod rules a server's admins have configured</li><li>Operate support tickets and respond to your reports</li><li>Track XP, levels, and economy balances</li><li>Send reminders and calendar-based notifications</li><li>Apply server-specific settings (custom commands, welcome messages, roles, etc.)</li><li>Diagnose bugs and improve reliability</li></ul>
            </Section>
            <Section title="3. Who Can Access Your Data">
              <ul><li><strong>The Bot's own backend process</strong> and the <strong>dashboard's server-side code</strong> can access stored data, using a private service-role credential.</li><li><strong>Nothing is publicly readable.</strong> All data is stored in a database with row-level security enabled and no public access policies — it cannot be queried directly from a browser or by anyone without that private credential.</li><li><strong>Server moderators/admins</strong> can view moderation history, tickets, and activity data for their own server through the dashboard, consistent with the permissions Discord already grants them in that server.</li><li>We do not sell your data, and we do not share it with third parties except as needed to run the features above (e.g., Google Calendar, if a server admin connects it) or where required by law.</li></ul>
            </Section>
            <Section title="4. Discord Permissions & Privileged Intents">
              <p>To provide moderation, activity tracking, and presence-based features, !HOY requests these privileged Discord intents:</p>
              <ul><li><strong>Server Members Intent</strong> — to see member joins/leaves and roles</li><li><strong>Message Content Intent</strong> — to run moderation, automod, and message-based commands</li><li><strong>Presence Intent</strong> — to show accurate online/member counts</li></ul>
              <p>You can review and revoke !HOY's access at any time via Discord's <strong>User Settings → Authorized Apps</strong>, or by having a server admin remove the Bot from a server.</p>
            </Section>
            <Section title="5. Data Retention & Deletion">
              <p>Data persists for as long as !HOY remains active in a server, so features like moderation history and leveling continue to work correctly. If a server removes the Bot, that server's configuration data is no longer used by the Bot going forward.</p>
              <p>To request deletion of your personal data (e.g., your user profile, ticket transcripts, or activity records), open a request through the in-app <strong>Support</strong> panel on the !HOY dashboard, selecting <strong>"Account / access"</strong> as the category. We will respond to verified deletion requests in a reasonable timeframe.</p>
              <p><em>If you have a dedicated support email or Discord server invite you'd like listed here instead of/alongside the in-app panel, add it before publishing.</em></p>
            </Section>
            <Section title="6. Children's Privacy"><p>!HOY is intended for use in accordance with Discord's own Terms of Service, which require users to meet Discord's minimum age requirements. We do not knowingly collect data from users who do not meet those requirements.</p></Section>
            <Section title="7. Changes to This Policy"><p>We may update this policy as !HOY's features change. Material changes will be reflected by updating the "Last updated" date above. Continued use of !HOY after changes take effect constitutes acceptance of the revised policy.</p></Section>
            <Section title="8. Contact"><p>Questions about this policy or your data can be sent through the in-app <strong>Support</strong> panel on the !HOY dashboard.</p></Section>
          </div>
        </article>
      </main>
      <footer className="hairline border-t border-border/60"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground"><span>!HOY — steady as she goes.</span><div className="flex items-center gap-4"><Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link><Link to="/terms" className="hover:text-foreground">Terms of Service</Link></div></div></footer>
    </div>
  );
}
