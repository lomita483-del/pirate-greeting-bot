// Plan and Task Types
export enum TaskType {
  DAILY_LOGIN = 'daily_login',
  MESSAGE_COUNT = 'message_count',
  REACTION_ADDED = 'reaction_added',
  VOICE_ACTIVITY = 'voice_activity',
  CUSTOM = 'custom',
}

export enum ActivityType {
  DISCORD_ACTIVITY_1 = 1,
  DISCORD_ACTIVITY_2 = 2,
  DISCORD_ACTIVITY_4 = 4,
}

export interface Task {
  id: string;
  planId: string;
  title: string;
  description: string;
  taskType: TaskType;
  activityType?: ActivityType;
  targetValue: number; // e.g., 2 for "login daily for 2 days"
  currentProgress: number;
  isCompleted: boolean;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Plan {
  id: string;
  serverId: string;
  name: string;
  description: string;
  tier: 'basic' | 'premium' | 'vip';
  tasks: Task[];
  isUnlocked: boolean;
  unlockedAt?: Date;
  unlocksServerWide: boolean; // true if completion unlocks for entire server
  maxTasks: number; // 3-10 tasks per plan
  createdAt: Date;
  updatedAt: Date;
}

export interface ServerPlan {
  serverId: string;
  userId: string; // Admin who created it
  plans: Plan[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserTaskProgress {
  userId: string;
  taskId: string;
  planId: string;
  serverId: string;
  progress: number;
  isCompleted: boolean;
  completedAt?: Date;
  lastActivityAt: Date;
}
