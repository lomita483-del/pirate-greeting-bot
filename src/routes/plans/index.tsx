import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { getPlansByServer, createTask } from '@/lib/database/plans';
import { Plan, Task } from '@/types/plans';

export const Route = createFileRoute('/plans/')({});

function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverId, setServerId] = useState(''); // This would come from context/auth

  useEffect(() => {
    loadPlans();
  }, [serverId]);

  const loadPlans = async () => {
    if (!serverId) return;
    setLoading(true);
    try {
      const loadedPlans = await getPlansByServer(serverId);
      setPlans(loadedPlans);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">🏴‍☠️ Pirate Plans</h1>

        {loading ? (
          <div className="text-center text-gray-400">Loading plans...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onSelectPlan={setSelectedPlan}
              />
            ))}
          </div>
        )}

        {selectedPlan && (
          <PlanDetailModal
            plan={selectedPlan}
            onClose={() => setSelectedPlan(null)}
          />
        )}
      </div>
    </div>
  );
}

function PlanCard({ plan, onSelectPlan }: { plan: Plan; onSelectPlan: (plan: Plan) => void }) {
  const completedTasks = plan.tasks.filter((t) => t.isCompleted).length;
  const totalTasks = plan.tasks.length;
  const progressPercentage = (completedTasks / totalTasks) * 100;

  return (
    <div className="bg-slate-700 rounded-lg p-6 hover:bg-slate-600 transition cursor-pointer"
         onClick={() => onSelectPlan(plan)}>
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-white mb-2">{plan.name}</h2>
        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
          plan.isUnlocked
            ? 'bg-green-500/20 text-green-300'
            : 'bg-yellow-500/20 text-yellow-300'
        }`}>
          {plan.isUnlocked ? '✅ Unlocked' : '🔒 Locked'}
        </span>
      </div>

      <p className="text-gray-300 mb-4">{plan.description}</p>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-300 text-sm">Progress</span>
          <span className="text-white font-semibold">{completedTasks}/{totalTasks} tasks</span>
        </div>
        <div className="w-full bg-slate-600 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded">
        See Plan
      </button>
    </div>
  );
}

function PlanDetailModal({
  plan,
  onClose,
}: {
  plan: Plan;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
         onClick={onClose}>
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
           onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-700">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">{plan.name}</h2>
              <p className="text-gray-300">{plan.description}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          <h3 className="text-xl font-bold text-white mb-4">Tasks</h3>
          <div className="space-y-4">
            {plan.tasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskItem({ task }: { task: Task }) {
  const progressPercentage = (task.currentProgress / task.targetValue) * 100;

  return (
    <div className="bg-slate-700 rounded p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-white font-semibold">{task.title}</h4>
          <p className="text-gray-400 text-sm">{task.description}</p>
        </div>
        <span className={`flex-shrink-0 text-xl ${
          task.isCompleted ? '✅' : '⏳'
        }`} />
      </div>

      <div className="mb-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-gray-300 text-sm">Progress</span>
          <span className="text-white font-semibold text-sm">
            {task.currentProgress}/{task.targetValue}
          </span>
        </div>
        <div className="w-full bg-slate-600 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default PlansPage;
