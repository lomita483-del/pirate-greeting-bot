# Task & Plan System Documentation

## Overview
The Task & Plan System is a Discord bot feature that allows server admins to create plans (Basic, Premium, VIP) with multiple tasks that users complete through Discord activities. When users complete all tasks in a plan, the plan unlocks, granting them premium features.

## Architecture

### Key Components

#### 1. **Types** (`src/types/plans.ts`)
- `Plan`: Represents a plan with 3-10 tasks
- `Task`: Individual tasks within a plan
- `ActivityType`: Discord activities (1, 2, 4)
- `TaskType`: Types of tasks (daily login, message count, reactions, voice, custom)
- `UserTaskProgress`: Tracks user progress on specific tasks

#### 2. **Database Layer** (`src/lib/database/plans.ts`)
Handles all CRUD operations:
- Plan management (create, read, update, delete)
- Task management within plans
- User progress tracking
- Plan completion checking

#### 3. **Activity Tracker** (`src/lib/bot/activity-tracker.ts`)
Automatically tracks Discord activities and:
- Updates user task progress
- Checks if tasks are completed
- Verifies if entire plan is completed
- Notifies about plan unlocks

#### 4. **Discord Integration** (`src/lib/bot/discord-integration.ts`)
Bridges Discord events with the task system:
- Listens to MESSAGE, REACTION, VOICE, and LOGIN events
- Converts Discord events to activity types
- Triggers task progress updates

#### 5. **Frontend Routes**
- `/plans/`: User view - see all plans, click "See Plan" to view tasks
- `/admin/plans`: Admin panel - create/edit plans and tasks

## Task Types

### 1. Daily Login
- **Target**: "Login daily for 2 days" (configurable)
- **Progress**: Tracked by unique days logged in
- **Auto-complete**: When target days reached

### 2. Message Count
- **Target**: Number of messages to send
- **Progress**: Increments with each message
- **Auto-complete**: When message count reached

### 3. Reaction Added
- **Target**: Number of reactions to add
- **Progress**: Increments with each reaction
- **Auto-complete**: When reaction count reached

### 4. Voice Activity
- **Target**: Minutes or sessions in voice
- **Progress**: Accumulated voice time
- **Auto-complete**: When duration target reached

### 5. Custom
- **Target**: Admin-defined
- **Progress**: Manual or automatic

## Workflow

### User Journey
1. User sees "See Plan" button in `/plans/`
2. Clicks to view plan details and task list
3. Each task shows:
   - Title and description
   - Required activity type (1, 2, 4)
   - Progress bar (current/target)
   - Status (✅ completed or ⏳ in progress)
4. As user performs Discord activities:
   - Bot auto-tracks the activity
   - Task progress updates automatically
   - User sees real-time progress updates
5. When all tasks are complete:
   - Plan unlocks (🔓)
   - If server-wide setting enabled, all admins notified
   - User gets premium features for this plan

### Admin Journey
1. Admin goes to `/admin/plans`
2. Clicks "+ Create New Plan"
3. Fills in:
   - Plan name and description
   - Tier (Basic, Premium, VIP)
   - Max tasks (3-10)
   - Server-wide unlock option
4. Creates tasks with:
   - Title, description
   - Task type (daily login, messages, reactions, voice)
   - Discord activity type (1, 2, 4)
   - Target value
5. Can add up to max tasks per plan
6. Can edit/delete plans and tasks

## Server-Wide Unlocks

If a plan has "Server-wide unlock" enabled:
- Completion unlocks the plan for **all users/admins in the server**
- Useful for collective goals
- Admin notified via Discord message

If disabled:
- Plan unlocks only for the user who completed it
- Individual progression

## Database Integration

The system uses in-memory storage by default. To integrate with a real database:

1. **Supabase** (recommended):
   ```typescript
   // Replace the in-memory stores in src/lib/database/plans.ts
   // with Supabase calls
   ```

2. **PostgreSQL**:
   ```typescript
   // Create tables for plans, tasks, user_progress
   // Update database functions accordingly
   ```

3. **MongoDB**:
   ```typescript
   // Adapt the database layer for document-based storage
   ```

## Discord Bot Commands

The bot should handle these events:

```typescript
// When user sends a message
bot.on('messageCreate', async (message) => {
  await onMessageCreate(message.author.id, message.guildId, message.content);
});

// When user adds a reaction
bot.on('messageReactionAdd', async (reaction, user) => {
  await onReactionAdd(user.id, reaction.message.guildId, reaction.emoji.name);
});

// When user joins/leaves voice
bot.on('voiceStateUpdate', async (oldState, newState) => {
  if (newState.channel && !oldState.channel) {
    await onVoiceStateUpdate(newState.member.id, newState.guild.id, 0);
  }
});
```

## API Endpoints Needed

### User Endpoints
- `GET /api/plans/:serverId` - Get all plans for a server
- `GET /api/plans/:planId` - Get plan details with tasks
- `GET /api/progress/:userId/:serverId` - Get user's progress

### Admin Endpoints
- `POST /api/admin/plans` - Create plan
- `PUT /api/admin/plans/:planId` - Update plan
- `DELETE /api/admin/plans/:planId` - Delete plan
- `POST /api/admin/plans/:planId/tasks` - Add task to plan
- `PUT /api/admin/tasks/:taskId` - Update task
- `DELETE /api/admin/tasks/:taskId` - Delete task

## File Structure

```
src/
├── types/
│   └── plans.ts          # Type definitions
├── lib/
│   ├── database/
│   │   └── plans.ts      # Database operations
│   └── bot/
│       ├── activity-tracker.ts    # Activity tracking logic
│       └── discord-integration.ts # Discord event handlers
├── routes/
│   ├── plans/
│   │   └── index.tsx     # User plan view
│   └── admin/
│       └── plans.tsx     # Admin management panel
└── ...
```

## Example Usage

### Creating a Plan
```typescript
const plan = await createPlan('discord-server-123', {
  name: 'Premium Tier',
  description: 'Unlock premium features by completing tasks',
  tier: 'premium',
  tasks: [],
  isUnlocked: false,
  unlocksServerWide: true,
  maxTasks: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

### Adding Tasks
```typescript
const task = await createTask('plan-123', {
  planId: 'plan-123',
  title: 'Daily Login',
  description: 'Login to the server for 2 consecutive days',
  taskType: TaskType.DAILY_LOGIN,
  activityType: ActivityType.DISCORD_ACTIVITY_1,
  targetValue: 2,
  currentProgress: 0,
  isCompleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

### Tracking Activity
```typescript
await trackDiscordActivity({
  userId: 'user-456',
  serverId: 'server-123',
  activityType: ActivityType.DISCORD_ACTIVITY_1,
  timestamp: new Date(),
  metadata: { duration: 30 }, // for voice
});
```

## Future Enhancements

1. **Leaderboards**: Top users by plans unlocked
2. **Rewards**: XP, badges, role assignments
3. **Notifications**: Discord DM/channel notifications
4. **Analytics**: Admin dashboard with completion stats
5. **Seasonal Plans**: Time-limited plans that reset
6. **Plan Templates**: Pre-built plans for quick setup
7. **Milestones**: Achievements within plans
8. **Social Sharing**: Share progress on social media
