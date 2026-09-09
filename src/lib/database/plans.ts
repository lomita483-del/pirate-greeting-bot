import { Plan, Task, UserTaskProgress, TaskType, ActivityType } from '@/types/plans';

// This would be replaced with actual database calls (Supabase, PostgreSQL, etc.)
// For now, using in-memory storage

const plansStore = new Map<string, Plan>();
const tasksStore = new Map<string, Task>();
const userProgressStore = new Map<string, UserTaskProgress>();

// Plan CRUD Operations
export async function createPlan(
  serverId: string,
  planData: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Plan> {
  const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const plan: Plan = {
    ...planData,
    id: planId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  plansStore.set(planId, plan);
  return plan;
}

export async function getPlansByServer(serverId: string): Promise<Plan[]> {
  return Array.from(plansStore.values()).filter((p) => p.serverId === serverId);
}

export async function getPlanById(planId: string): Promise<Plan | null> {
  return plansStore.get(planId) || null;
}

export async function updatePlan(planId: string, updates: Partial<Plan>): Promise<Plan | null> {
  const plan = plansStore.get(planId);
  if (!plan) return null;

  const updated = {
    ...plan,
    ...updates,
    updatedAt: new Date(),
  };
  plansStore.set(planId, updated);
  return updated;
}

export async function deletePlan(planId: string): Promise<boolean> {
  const plan = plansStore.get(planId);
  if (!plan) return false;

  // Delete associated tasks
  plan.tasks.forEach((task) => tasksStore.delete(task.id));
  plansStore.delete(planId);
  return true;
}

// Task CRUD Operations
export async function createTask(
  planId: string,
  taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Task> {
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const task: Task = {
    ...taskData,
    id: taskId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  tasksStore.set(taskId, task);

  // Add to plan
  const plan = plansStore.get(planId);
  if (plan) {
    plan.tasks.push(task);
    plan.updatedAt = new Date();
  }

  return task;
}

export async function getTasksByPlan(planId: string): Promise<Task[]> {
  const plan = plansStore.get(planId);
  return plan ? plan.tasks : [];
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  return tasksStore.get(taskId) || null;
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task | null> {
  const task = tasksStore.get(taskId);
  if (!task) return null;

  const updated = {
    ...task,
    ...updates,
    updatedAt: new Date(),
  };
  tasksStore.set(taskId, updated);

  // Update in plan
  const plan = plansStore.get(task.planId);
  if (plan) {
    const taskIndex = plan.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex !== -1) {
      plan.tasks[taskIndex] = updated;
      plan.updatedAt = new Date();
    }
  }

  return updated;
}

export async function deleteTask(taskId: string): Promise<boolean> {
  const task = tasksStore.get(taskId);
  if (!task) return false;

  // Remove from plan
  const plan = plansStore.get(task.planId);
  if (plan) {
    plan.tasks = plan.tasks.filter((t) => t.id !== taskId);
    plan.updatedAt = new Date();
  }

  tasksStore.delete(taskId);
  return true;
}

// User Progress Operations
export async function updateUserTaskProgress(
  userId: string,
  taskId: string,
  planId: string,
  serverId: string,
  progressUpdate: Partial<UserTaskProgress>
): Promise<UserTaskProgress> {
  const progressId = `${userId}_${taskId}`;
  const existing = userProgressStore.get(progressId) || {
    userId,
    taskId,
    planId,
    serverId,
    progress: 0,
    isCompleted: false,
    lastActivityAt: new Date(),
  };

  const updated = {
    ...existing,
    ...progressUpdate,
    lastActivityAt: new Date(),
  };

  userProgressStore.set(progressId, updated);

  // Update task completion status
  const task = await getTaskById(taskId);
  if (task && updated.isCompleted && !task.isCompleted) {
    await updateTask(taskId, {
      isCompleted: true,
      currentProgress: task.targetValue,
      completedAt: new Date(),
    });
  }

  return updated;
}

export async function getUserTaskProgress(
  userId: string,
  taskId: string
): Promise<UserTaskProgress | null> {
  return userProgressStore.get(`${userId}_${taskId}`) || null;
}

export async function getAllUserProgress(
  userId: string,
  serverId: string
): Promise<UserTaskProgress[]> {
  return Array.from(userProgressStore.values()).filter(
    (p) => p.userId === userId && p.serverId === serverId
  );
}

// Plan Completion Check
export async function checkPlanCompletion(planId: string): Promise<boolean> {
  const plan = await getPlanById(planId);
  if (!plan) return false;

  const allTasksCompleted = plan.tasks.every((task) => task.isCompleted);
  if (allTasksCompleted) {
    await updatePlan(planId, {
      isUnlocked: true,
      unlockedAt: new Date(),
    });
  }
  return allTasksCompleted;
}
