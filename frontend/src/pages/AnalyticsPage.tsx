import { TrendingUp, TrendingDown, Activity, CheckCircle2, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function AnalyticsPage() {
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();
  
  // Safety check: don't render if not authenticated
  if (!isAuthenticated || authLoading || !token) {
    return null;
  }
  
  const { data: overview, refetch: refetchOverview } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: async () => {
      return await apiClient.getAnalyticsOverview();
    },
    enabled: isAuthenticated && !authLoading,
  });

  const { data: topWorkflows, refetch: refetchTop } = useQuery({
    queryKey: ['top-workflows'],
    queryFn: async () => {
      const result = await apiClient.getTopWorkflows();
      return result.workflows;
    },
    enabled: isAuthenticated && !authLoading,
  });

  // Listen for real-time updates
  useEffect(() => {
    const handleUpdate = () => {
      refetchOverview();
      refetchTop();
    };

    apiClient.on('execution_completed', handleUpdate);
    apiClient.on('workflow_created', handleUpdate);

    return () => {
      apiClient.off('execution_completed', handleUpdate);
      apiClient.off('workflow_created', handleUpdate);
    };
  }, [refetchOverview, refetchTop]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-3xl font-bold text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/30" 
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
            <TrendingUp className="text-white" size={22} />
          </div>
          <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Analytics
          </span>
        </h1>
        <p className="text-gray-400 text-base mt-2 ml-16">Performance metrics and insights</p>
      </div>

      {/* Overview Metrics */}
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
          label="Avg Duration"
          value={`${overview?.average_duration || 0}s`}
          change={0}
          subtitle="Per execution"
          trend="neutral"
        />
      </div>

      {/* Success vs Failed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="text-lg font-semibold text-white mb-5">Execution Status</h2>
          <div className="space-y-4">
            <StatusBar
              icon={CheckCircle2}
              label="Successful"
              count={overview?.success_executions || 0}
              total={overview?.total_executions || 1}
              color="#22c55e"
            />
            <StatusBar
              icon={XCircle}
              label="Failed"
              count={overview?.failed_executions || 0}
              total={overview?.total_executions || 1}
              color="#ef4444"
            />
            <StatusBar
              icon={Activity}
              label="Running"
              count={overview?.running_executions || 0}
              total={overview?.total_executions || 1}
              color="#3b82f6"
            />
          </div>
        </div>

        {/* Top Workflows */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="text-lg font-semibold text-white mb-5">Top Workflows</h2>
          <div className="space-y-3">
            {topWorkflows && topWorkflows.length > 0 ? (
              topWorkflows.map((workflow, index) => (
                <WorkflowRankCard key={workflow.id} workflow={workflow} rank={index + 1} />
              ))
            ) : (
              <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm text-center py-4">
                No workflow data yet
              </p>
            )}
          </div>
        </div>
      </div>
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
  const trendColors = {
    up: '#22c55e',
    down: '#ef4444',
    neutral: '#9ca3af',
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Activity;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 
      hover:bg-white/10 hover:border-indigo-500/30 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-400">{label}</p>
          <p className="text-3xl font-bold text-white mt-2">{value}</p>
          <div className="flex items-center mt-3 text-xs">
            <TrendIcon style={{ color: trendColors[trend] }} className="w-4 h-4 mr-1.5" strokeWidth={2.5} />
            <span style={{ color: trendColors[trend] }} className="font-semibold">
              {change}
            </span>
            <span className="text-gray-500 ml-2">{subtitle}</span>
          </div>
        </div>
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
        <div
          style={{ backgroundColor: color, width: `${percentage}%` }}
          className="h-full transition-all duration-500"
        />
      </div>
    </div>
  );
}

interface WorkflowRankCardProps {
  workflow: {
    id: string;
    name: string;
    execution_count: number;
    success_rate: number;
  };
  rank: number;
}

function WorkflowRankCard({ workflow, rank }: WorkflowRankCardProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white">
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{workflow.name}</p>
          <p className="text-xs text-gray-400">{workflow.execution_count} executions</p>
        </div>
      </div>
      <div className="text-right ml-3">
        <div className="px-2.5 py-1 rounded-lg bg-emerald-500/15">
          <span className="text-xs font-semibold text-emerald-400">{workflow.success_rate.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}
