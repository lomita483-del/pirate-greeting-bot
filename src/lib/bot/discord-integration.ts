import { trackDiscordActivity, notifyPlanUnlock } from '@/lib/bot/activity-tracker';
import { ActivityType } from '@/types/plans';

// This file handles integration with the Discord bot
// It bridges Discord events with the task/plan system

export interface DiscordEventPayload {
  type: 'MESSAGE' | 'REACTION' | 'VOICE' | 'LOGIN';
  userId: string;
  serverId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Map Discord event types to our activity types
function mapDiscordEventToActivityType(eventType: string): ActivityType | null {
  switch (eventType) {
    case 'MESSAGE':
      return ActivityType.DISCORD_ACTIVITY_1;
    case 'REACTION':
      return ActivityType.DISCORD_ACTIVITY_2;
    case 'VOICE':
      return ActivityType.DISCORD_ACTIVITY_4;
    case 'LOGIN':
      return ActivityType.DISCORD_ACTIVITY_1;
    default:
      return null;
  }
}

// Handle incoming Discord events
export async function handleDiscordEvent(payload: DiscordEventPayload): Promise<void> {
  try {
    const activityType = mapDiscordEventToActivityType(payload.type);
    if (!activityType) {
      console.warn(`Unknown event type: ${payload.type}`);
      return;
    }

    // Track the activity and auto-complete tasks
    await trackDiscordActivity({
      userId: payload.userId,
      serverId: payload.serverId,
      activityType,
      timestamp: payload.timestamp,
      metadata: payload.metadata,
    });
  } catch (error) {
    console.error('Error handling Discord event:', error);
  }
}

// Example: Called when a user sends a message
export async function onMessageCreate(
  userId: string,
  serverId: string,
  messageContent: string
): Promise<void> {
  await handleDiscordEvent({
    type: 'MESSAGE',
    userId,
    serverId,
    timestamp: new Date(),
    metadata: { messageContent: messageContent.length },
  });
}

// Example: Called when a user reacts to a message
export async function onReactionAdd(
  userId: string,
  serverId: string,
  emoji: string
): Promise<void> {
  await handleDiscordEvent({
    type: 'REACTION',
    userId,
    serverId,
    timestamp: new Date(),
    metadata: { emoji },
  });
}

// Example: Called when a user joins voice channel
export async function onVoiceStateUpdate(
  userId: string,
  serverId: string,
  durationMinutes: number
): Promise<void> {
  await handleDiscordEvent({
    type: 'VOICE',
    userId,
    serverId,
    timestamp: new Date(),
    metadata: { duration: durationMinutes },
  });
}

// Example: Called when a user logs in/joins the server
export async function onUserLogin(
  userId: string,
  serverId: string
): Promise<void> {
  await handleDiscordEvent({
    type: 'LOGIN',
    userId,
    serverId,
    timestamp: new Date(),
  });
}
