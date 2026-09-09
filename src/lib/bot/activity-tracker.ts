import { ActivityType, TaskType } from '@/types/plans';
import { updateUserTaskProgress, checkPlanCompletion, getTasksByPlan, getPlansByServer } from '@/lib/database/plans';

export interface DiscordActivityEvent {
  userId: string;
  serverId: string;
  activityType: ActivityType;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Track Discord activities and auto-complete related tasks
export async function trackDiscordActivity(event: DiscordActivityEvent): Promise<void> {
  try {
    const plans = await getPlansByServer(event.serverId);

    for (const plan of plans) {
      if (plan.isUnlocked) continue; // Skip already unlocked plans

      const tasks = plan.tasks.filter((task) => task.activityType === event.activityType);

      for (const task of tasks) {
        if (task.isCompleted) continue; // Skip completed tasks

        // Get current progress
        const currentProgress = task.currentProgress || 0;

        // Increment progress based on activity type
        let newProgress = currentProgress;
        let isCompleted = false;

        switch (task.taskType) {
          case TaskType.DAILY_LOGIN:
            // Daily login task - track unique days
            newProgress = currentProgress + 1;
            isCompleted = newProgress >= task.targetValue;
            break;

          case TaskType.MESSAGE_COUNT:
            newProgress = currentProgress + 1;
            isCompleted = newProgress >= task.targetValue;
            break;

          case TaskType.REACTION_ADDED:
            newProgress = currentProgress + 1;
            isCompleted = newProgress >= task.targetValue;
            break;

          case TaskType.VOICE_ACTIVITY:
            // For voice activity, progress is tracked in minutes or events
            newProgress = currentProgress + (event.metadata?.duration || 1);
            isCompleted = newProgress >= task.targetValue;
            break;

          default:
            break;
        }

        // Update user task progress
        await updateUserTaskProgress(event.userId, task.id, plan.id, event.serverId, {
          progress: newProgress,
          isCompleted,
          completedAt: isCompleted ? new Date() : undefined,
        });

        // Check if entire plan is now completed
        if (isCompleted) {
          const planCompleted = await checkPlanCompletion(plan.id);
          if (planCompleted && plan.unlocksServerWide) {
            // Notify all members about plan unlock
            await notifyPlanUnlock(event.serverId, plan.id, plan.name);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error tracking Discord activity:', error);
  }
}

// Notify server members when a plan is unlocked
export async function notifyPlanUnlock(
  serverId: string,
  planId: string,
  planName: string
): Promise<void> {
  // This will be called by the Discord bot to send notifications
  // Implementation depends on how the bot sends messages
  console.log(`🎉 Plan "${planName}" unlocked on server ${serverId}!`);
}

// Check daily login streaks
export async function checkDailyLoginStreak(
  userId: string,
  serverId: string
): Promise<number> {
  // This would track consecutive daily logins
  // Returns current streak count
  return 0;
}
