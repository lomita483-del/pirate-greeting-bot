import type { PremiumFeature } from "@/lib/admin.functions";

export type PremiumModule = {
  key: PremiumFeature;
  label: string;
  summary: string;
  includes: string[];
};

/** Shared copy so the pricing page and the locked dashboard states stay in sync. */
export const PREMIUM_MODULES: PremiumModule[] = [
  {
    key: "moderation",
    label: "Moderation",
    summary: "Full crew discipline with a permanent record.",
    includes: [
      "Warn, timeout, kick, ban, unban and clear",
      "Numbered moderation cases with history",
      "Channel lock and unlock",
      "Appeals inbox on the dashboard",
    ],
  },
  {
    key: "levels",
    label: "Levels & XP",
    summary: "Reward the members who keep the chat alive.",
    includes: [
      "Message XP with cooldowns",
      "Level-up announcements",
      "Automatic level role rewards",
      "Rank cards and leaderboards",
    ],
  },
  {
    key: "tickets",
    label: "Tickets",
    summary: "Private support threads opened with a button.",
    includes: [
      "Multi-button ticket panels",
      "Support roles and categories",
      "Transcripts on close",
      "Open ticket overview",
    ],
  },
  {
    key: "welcome",
    label: "Welcome messages",
    summary: "Greet every new member the way you want.",
    includes: [
      "Multiple welcome and goodbye messages",
      "Embeds, plain text and dynamic cards",
      "Send to a channel, the member's DM, or both",
      "Auto-roles on join",
    ],
  },
  {
    key: "calendar",
    label: "Calendar",
    summary: "Events and reminders straight into Discord.",
    includes: [
      "iCal and Google Calendar sync",
      "Manual event create, edit and delete",
      "Reminder notifiers with cleanup modes",
      "RSVPs and agenda commands",
    ],
  },
];

export const PREMIUM_MODULE_BY_KEY = Object.fromEntries(
  PREMIUM_MODULES.map((m) => [m.key, m]),
) as Record<PremiumFeature, PremiumModule>;
