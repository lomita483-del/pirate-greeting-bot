import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { createPlan, createTask, getPlansByServer } from '@/lib/database/plans';
import { Plan, Task, TaskType, ActivityType } from '@/types/plans';

export const Route = createFileRoute('/admin/plans')({});

function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [serverId, setServerId] = useState(''); // From auth context

  const handleCreatePlan = async (planData: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newPlan = await createPlan(serverId, planData);
      setPlans([...plans, newPlan]);
      setShowCreatePlan(false);
    } catch (error) {
      console.error('Error creating plan:', error);
    }
  };

  const handleAddTask = async (
    planId: string,
    taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    try {
      await createTask(planId, taskData);
      // Reload plans
      const updated = await getPlansByServer(serverId);
      setPlans(updated);
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">🏴‍☠️ Admin: Manage Plans</h1>
          <button
            onClick={() => setShowCreatePlan(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg"
          >
            + Create New Plan
          </button>
        </div>

        <div className="space-y-6">
          {plans.map((plan) => (
            <PlanManagementCard
              key={plan.id}
              plan={plan}
              onAddTask={(taskData) => handleAddTask(plan.id, taskData)}
              onEdit={setEditingPlan}
            />
          ))}
        </div>

        {showCreatePlan && (
          <CreatePlanModal
            onClose={() => setShowCreatePlan(false)}
            onCreate={handleCreatePlan}
          />
        )}

        {editingPlan && (
          <EditPlanModal
            plan={editingPlan}
            onClose={() => setEditingPlan(null)}
          />
        )}
      </div>
    </div>
  );
}

function PlanManagementCard({
  plan,
  onAddTask,
  onEdit,
}: {
  plan: Plan;
  onAddTask: (taskData: any) => Promise<void>;
  onEdit: (plan: Plan) => void;
}) {
  const [showAddTask, setShowAddTask] = useState(false);

  return (
    <div className="bg-slate-700 rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">{plan.name}</h2>
          <p className="text-gray-300">{plan.description}</p>
        </div>
        <button
          onClick={() => onEdit(plan)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Edit
        </button>
      </div>

      <div className="mb-4 p-3 bg-slate-600 rounded">
        <p className="text-gray-300">
          <span className="text-white font-semibold">Tier:</span> {plan.tier}
        </p>
        <p className="text-gray-300">
          <span className="text-white font-semibold">Server-wide unlock:</span> {plan.unlocksServerWide ? '✅' : '❌'}
        </p>
        <p className="text-gray-300">
          <span className="text-white font-semibold">Status:</span> {plan.isUnlocked ? '🔓 Unlocked' : '🔒 Locked'}
        </p>
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-bold text-white mb-3">Tasks ({plan.tasks.length}/{plan.maxTasks})</h3>
        <div className="space-y-2">
          {plan.tasks.map((task) => (
            <div key={task.id} className="bg-slate-600 rounded p-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-white font-semibold">{task.title}</p>
                  <p className="text-gray-400 text-sm">{task.taskType} - Target: {task.targetValue}</p>
                </div>
                <span>{task.isCompleted ? '✅' : '⏳'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {plan.tasks.length < plan.maxTasks && (
        <button
          onClick={() => setShowAddTask(true)}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
        >
          + Add Task
        </button>
      )}

      {showAddTask && (
        <AddTaskModal
          onClose={() => setShowAddTask(false)}
          onCreate={(taskData) => {
            onAddTask(taskData);
            setShowAddTask(false);
          }}
        />
      )}
    </div>
  );
}

function CreatePlanModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (planData: any) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tier: 'basic',
    unlocksServerWide: false,
    maxTasks: 5,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreate({
      ...formData,
      serverId: '', // Will be filled from context
      tasks: [],
      isUnlocked: false,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
         onClick={onClose}>
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full"
           onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">Create New Plan</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-white font-semibold mb-2">Plan Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-700 text-white rounded px-4 py-2 border border-slate-600"
              required
            />
          </div>

          <div>
            <label className="block text-white font-semibold mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-slate-700 text-white rounded px-4 py-2 border border-slate-600"
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white font-semibold mb-2">Tier</label>
              <select
                value={formData.tier}
                onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                className="w-full bg-slate-700 text-white rounded px-4 py-2 border border-slate-600"
              >
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
                <option value="vip">VIP</option>
              </select>
            </div>

            <div>
              <label className="block text-white font-semibold mb-2">Max Tasks</label>
              <input
                type="number"
                min="3"
                max="10"
                value={formData.maxTasks}
                onChange={(e) => setFormData({ ...formData, maxTasks: parseInt(e.target.value) })}
                className="w-full bg-slate-700 text-white rounded px-4 py-2 border border-slate-600"
                required
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="serverWide"
              checked={formData.unlocksServerWide}
              onChange={(e) => setFormData({ ...formData, unlocksServerWide: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="serverWide" className="text-white font-semibold ml-2">
              Unlock for entire server when completed
            </label>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              Create Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddTaskModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (taskData: any) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    taskType: TaskType.DAILY_LOGIN,
    activityType: ActivityType.DISCORD_ACTIVITY_1,
    targetValue: 5,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreate({
      ...formData,
      currentProgress: 0,
      isCompleted: false,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
         onClick={onClose}>
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full"
           onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">Add New Task</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-white font-semibold mb-2">Task Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-slate-700 text-white rounded px-4 py-2 border border-slate-600"
              required
            />
          </div>

          <div>
            <label className="block text-white font-semibold mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-slate-700 text-white rounded px-4 py-2 border border-slate-600"
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white font-semibold mb-2">Task Type</label>
              <select
                value={formData.taskType}
                onChange={(e) => setFormData({ ...formData, taskType: e.target.value as TaskType })}
                className="w-full bg-slate-700 text-white rounded px-4 py-2 border border-slate-600"
              >
                <option value={TaskType.DAILY_LOGIN}>Daily Login</option>
                <option value={TaskType.MESSAGE_COUNT}>Message Count</option>
                <option value={TaskType.REACTION_ADDED}>Reaction Added</option>
                <option value={TaskType.VOICE_ACTIVITY}>Voice Activity</option>
                <option value={TaskType.CUSTOM}>Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-white font-semibold mb-2">Discord Activity</label>
              <select
                value={formData.activityType}
                onChange={(e) => setFormData({ ...formData, activityType: parseInt(e.target.value) as ActivityType })}
                className="w-full bg-slate-700 text-white rounded px-4 py-2 border border-slate-600"
              >
                <option value={ActivityType.DISCORD_ACTIVITY_1}>Activity Type 1</option>
                <option value={ActivityType.DISCORD_ACTIVITY_2}>Activity Type 2</option>
                <option value={ActivityType.DISCORD_ACTIVITY_4}>Activity Type 4</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-white font-semibold mb-2">Target Value</label>
            <input
              type="number"
              min="1"
              value={formData.targetValue}
              onChange={(e) => setFormData({ ...formData, targetValue: parseInt(e.target.value) })}
              className="w-full bg-slate-700 text-white rounded px-4 py-2 border border-slate-600"
              required
            />
            <p className="text-gray-400 text-sm mt-1">
              For daily login "2 days", for message count enter number of messages, etc.
            </p>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditPlanModal({
  plan,
  onClose,
}: {
  plan: Plan;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
         onClick={onClose}>
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full"
           onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">Edit Plan</h2>
        </div>
        <div className="p-6">
          <p className="text-gray-300">Edit form would go here</p>
        </div>
      </div>
    </div>
  );
}

export default AdminPlansPage;
