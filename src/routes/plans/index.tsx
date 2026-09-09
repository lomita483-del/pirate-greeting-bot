import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Lock, Sparkles } from 'lucide-react';
import { getPlansByServer } from '@/lib/database/plans';
import { getViewer } from '@/lib/ahoy.functions';
import { Plan, Task } from '@/types/plans';

export const Route = createFileRoute('/plans/')({});

function PlansPage() {
  const { data: viewer } = useQuery({ queryKey: ['viewer'], queryFn: () => getViewer() });
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  
  // Get server ID from current guild context or use a default
  // In production, this would come from authentication/Discord context
  const serverId = viewer?.activeGuild?.id || 'default-server';

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plans', serverId],
    queryFn: () => getPlansByServer(serverId),
    enabled: !!serverId,
  });

  if (!viewer?.signedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">🔒 Sign in Required</h1>
          <p className="text-gray-300 mb-8">Please sign in to view available plans.</p>
          <a href="/api/public/auth/discord/start" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg">
            Sign in with Discord
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🏴‍☠️ Unlock Premium Plans</h1>
          <p className="text-gray-300">Complete tasks to unlock premium features for your server</p>
        </div>

        {isLoading ? (
          <div className="text-center text-gray-400 py-12">Loading plans...</div>
        ) : plans.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <p>No plans available yet. Check back soon!</p>
          </div>
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
  const totalTasks = plan.tasks.length || 1;
  const progressPercentage = (completedTasks / totalTasks) * 100;

  return (
    <div className="bg-slate-700 rounded-lg p-6 hover:bg-slate-600 transition cursor-pointer border border-slate-600 hover:border-slate-500">
      <div className="mb-4">
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-2xl font-bold text-white">{plan.name}</h2>
          {plan.isUnlocked ? (
            <span className="bg-green-500/20 text-green-300 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
              <span>✅</span> Unlocked
            </span>
          ) : (
            <span className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
              <Lock className="w-3 h-3" /> Locked
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 capitalize">Tier: <span className="text-gold font-semibold">{plan.tier}</span></p>
      </div>

      <p className="text-gray-300 mb-4 text-sm">{plan.description}</p>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-300 text-sm">Progress</span>
          <span className="text-white font-semibold text-sm">{completedTasks}/{totalTasks} tasks completed</span>
        </div>
        <div className="w-full bg-slate-600 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      <button 
        onClick={() => onSelectPlan(plan)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition flex items-center justify-center gap-2"
      >
        <Sparkles className="w-4 h-4" /> See Plan
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
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-slate-700"
           onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-700 bg-slate-700/50 sticky top-0">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">{plan.name}</h2>
              <p className="text-gray-300 mb-2">{plan.description}</p>
              <p className="text-xs text-gray-400">
                {plan.isUnlocked ? (
                  <span className="text-green-300 flex items-center gap-1"><span>✅</span> Unlocked</span>
                ) : (
                  <span className="text-yellow-300 flex items-center gap-1"><Lock className="w-3 h-3" /> Complete all tasks to unlock</span>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          {plan.tasks.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              No tasks available for this plan yet.
            </div>
          ) : (
            <>
              <h3 className="text-xl font-bold text-white mb-4">Required Tasks ({plan.tasks.length})</h3>
              <div className="space-y-4">
                {plan.tasks.map((task, index) => (
                  <TaskItem key={task.id} task={task} index={index} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskItem({ task, index }: { task: Task; index: number }) {
  const progressPercentage = task.targetValue > 0 ? (task.currentProgress / task.targetValue) * 100 : 0;

  return (
    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-600 text-xs font-bold text-white">
              {index + 1}
            </span>
            <h4 className="text-white font-semibold">{task.title}</h4>
          </div>
          <p className="text-gray-400 text-sm ml-8">{task.description}</p>
        </div>
        <span className={`flex-shrink-0 text-2xl ${task.isCompleted ? '✅' : '⏳'}`} />
      </div>

      <div className="ml-8 mb-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-gray-400 text-xs">Activity Type: <span className="text-gold font-semibold">Type {task.activityType}</span></span>
          <span className="text-white font-semibold text-sm">
            {task.currentProgress}/{task.targetValue}
          </span>
        </div>
        <div className="w-full bg-slate-600 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              task.isCompleted
                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                : 'bg-gradient-to-r from-blue-500 to-cyan-500'
            }`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default PlansPage;
