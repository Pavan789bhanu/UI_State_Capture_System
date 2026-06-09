import { useState } from 'react';
import { TrendingUp, TrendingDown, Activity, CheckCircle2, XCircle, MessageSquare, Brain, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { playgroundAPI } from '../services/playgroundAPI';
import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { loadAutomationRuns, markRunFeedbackSubmitted, type StoredAutomationRun } from '../utils/automationRuns';

export default function AnalyticsPage() {
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();
  const enabled = isAuthenticated && !authLoading && !!token;
  const [runs, setRuns] = useState<StoredAutomationRun[]>([]);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const { data: overview, refetch: refetchOverview } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: async () => apiClient.getAnalyticsOverview(),
    enabled,
  });

  const { data: topWorkflows, refetch: refetchTop } = useQuery({
    queryKey: ['top-workflows'],
    queryFn: async () => {
      const result = await apiClient.getTopWorkflows();
      return result.workflows;
    },
    enabled,
  });

  const { data: learningStats } = useQuery({
    queryKey: ['learning-stats'],
    queryFn: async () => {
      const result = await playgroundAPI.getLearningStats();
      return result.stats as Record<string, unknown>;
    },
    enabled,
    staleTime: 30_000,
  });

  useEffect(() => {
    setRuns(loadAutomationRuns());
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      refetchOverview();
      refetchTop();
      setRuns(loadAutomationRuns());
    };

    apiClient.on('execution_completed', handleUpdate);
    apiClient.on('workflow_created', handleUpdate);

    return () => {
      apiClient.off('execution_completed', handleUpdate);
      apiClient.off('workflow_created', handleUpdate);
    };
  }, [refetchOverview, refetchTop]);

  const handleSubmitRunFeedback = async (run: StoredAutomationRun) => {
    const notes = feedbackDrafts[run.id]?.trim();
    if (!notes) return;
    setSubmittingId(run.id);
    try {
      await playgroundAPI.submitFeedback(
        run.query,
        [],
        [],
        run.success ? 'success' : 'correction',
        run.url || 'https://example.com',
        notes
      );
      markRunFeedbackSubmitted(run.id, notes);
      setRuns(loadAutomationRuns());
    } finally {
      setSubmittingId(null);
    }
  };

  if (!enabled) return null;

  const feedbackCount = Number(learningStats?.user_feedback_count ?? 0);
  const totalExecutions = Number(learningStats?.total_executions ?? 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-3xl font-bold text-white flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/30"
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
          >
            <TrendingUp className="text-white" size={22} />
          </div>
          <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Analytics</span>
        </h1>
        <p className="text-gray-400 text-base mt-2 ml-16">Performance metrics, AI confidence, and human feedback</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Total Workflows"
          value={overview?.total_workflows || 0}
          change={overview?.active_workflows || 0}
          subtitle={`${overview?.active_workflows || 0} active`}
          trend="up"
        />
        <MetricCard
          label="Total Executions"
          value={overview?.total_executions || 0}
          change={overview?.running_executions || 0}
          subtitle={`${overview?.running_executions || 0} running`}
          trend="neutral"
        />
        <MetricCard
          label="Success Rate"
          value={`${overview?.success_rate || 0}%`}
          change={overview?.success_rate || 0}
          subtitle={`${overview?.success_executions || 0} successful`}
          trend={overview && overview.success_rate >= 80 ? 'up' : 'down'}
        />
        <MetricCard
          label="Human Feedback"
          value={feedbackCount}
          change={totalExecutions}
          subtitle="submissions for model learning"
          trend="neutral"
        />
      </div>

      {/* AI Learning & Feedback */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <Brain className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-semibold text-white">Model Learning</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <StatPill label="Learned patterns" value={String(Object.keys((learningStats?.patterns as object) ?? {}).length || '—')} />
            <StatPill label="Feedback received" value={String(feedbackCount)} />
            <StatPill label="Total automations" value={String(totalExecutions)} />
            <StatPill
              label="Success rate (engine)"
              value={
                totalExecutions > 0
                  ? `${Math.round(((Number(learningStats?.successful_executions) || 0) / totalExecutions) * 100)}%`
                  : '—'
              }
            />
          </div>
          <p className="mt-4 text-xs text-gray-400 leading-relaxed">
            Your feedback on playground runs trains the workflow learner. Describe what worked and what the AI should do
            differently — e.g. &quot;great until step 4, then use the Create button not the menu.&quot;
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="text-lg font-semibold text-white mb-5">Execution Status</h2>
          <div className="space-y-4">
            <StatusBar icon={CheckCircle2} label="Successful" count={overview?.success_executions || 0} total={overview?.total_executions || 1} color="#22c55e" />
            <StatusBar icon={XCircle} label="Failed" count={overview?.failed_executions || 0} total={overview?.total_executions || 1} color="#ef4444" />
            <StatusBar icon={Activity} label="Running" count={overview?.running_executions || 0} total={overview?.total_executions || 1} color="#3b82f6" />
          </div>
        </div>
      </div>

      {/* Recent automation runs with feedback */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <MessageSquare className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-white">Recent Playground Runs</h2>
        </div>
        {runs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Run an automation in the Playground — results and confidence scores will appear here for feedback.
          </p>
        ) : (
          <div className="space-y-4">
            {runs.map((run) => (
              <div key={run.id} className="p-4 rounded-xl border border-white/10 bg-white/5">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-white flex-1 min-w-0">{run.query}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {run.confidence !== null && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-500/15 text-violet-300 text-xs font-semibold">
                        <Sparkles className="w-3 h-3" />
                        {Math.round(run.confidence * 100)}% confidence
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${
                        run.success ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                      }`}
                    >
                      {run.success ? 'Success' : 'Needs work'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  {run.stepCount} steps · {new Date(run.completedAt).toLocaleString()}
                  {run.url ? ` · ${run.url}` : ''}
                </p>
                {run.feedbackSubmitted ? (
                  <p className="text-xs text-emerald-400">Feedback submitted: {run.feedbackNotes}</p>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={feedbackDrafts[run.id] ?? ''}
                      onChange={(e) => setFeedbackDrafts((d) => ({ ...d, [run.id]: e.target.value }))}
                      placeholder="What was good? What should the AI do differently?"
                      className="flex-1 px-3 py-2 text-xs rounded-lg border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <button
                      onClick={() => handleSubmitRunFeedback(run)}
                      disabled={!feedbackDrafts[run.id]?.trim() || submittingId === run.id}
                      className="px-4 py-2 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition"
                    >
                      {submittingId === run.id ? 'Saving…' : 'Send feedback'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
        <h2 className="text-lg font-semibold text-white mb-5">Top Workflows</h2>
        <div className="space-y-3">
          {topWorkflows && topWorkflows.length > 0 ? (
            topWorkflows.map((workflow, index) => (
              <WorkflowRankCard key={workflow.id} workflow={workflow} rank={index + 1} />
            ))
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No workflow data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-bold text-white mt-1">{value}</p>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  change: number;
  subtitle: string;
  trend: 'up' | 'down' | 'neutral';
}

function MetricCard({ label, value, change, subtitle, trend }: MetricCardProps) {
  const trendColors = { up: '#22c55e', down: '#ef4444', neutral: '#9ca3af' };
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Activity;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 hover:bg-white/10 hover:border-indigo-500/30 transition-all duration-300">
      <p className="text-sm font-medium text-gray-400">{label}</p>
      <p className="text-3xl font-bold text-white mt-2">{value}</p>
      <div className="flex items-center mt-3 text-xs">
        <TrendIcon style={{ color: trendColors[trend] }} className="w-4 h-4 mr-1.5" strokeWidth={2.5} />
        <span style={{ color: trendColors[trend] }} className="font-semibold">{change}</span>
        <span className="text-gray-500 ml-2">{subtitle}</span>
      </div>
    </div>
  );
}

interface StatusBarProps {
  icon: React.ElementType;
  label: string;
  count: number;
  total: number;
  color: string;
}

function StatusBar({ icon: Icon, label, count, total, color }: StatusBarProps) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={16} style={{ color }} strokeWidth={2} />
          <span className="text-sm font-medium text-white">{label}</span>
        </div>
        <span className="text-sm text-gray-400">
          {count} ({percentage.toFixed(0)}%)
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-white/10">
        <div style={{ backgroundColor: color, width: `${percentage}%` }} className="h-full transition-all duration-500" />
      </div>
    </div>
  );
}

interface WorkflowRankCardProps {
  workflow: { id: string; name: string; execution_count: number; success_rate: number };
  rank: number;
}

function WorkflowRankCard({ workflow, rank }: WorkflowRankCardProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white">{rank}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{workflow.name}</p>
          <p className="text-xs text-gray-400">{workflow.execution_count} executions</p>
        </div>
      </div>
      <div className="px-2.5 py-1 rounded-lg bg-emerald-500/15">
        <span className="text-xs font-semibold text-emerald-400">{workflow.success_rate.toFixed(0)}%</span>
      </div>
    </div>
  );
}
