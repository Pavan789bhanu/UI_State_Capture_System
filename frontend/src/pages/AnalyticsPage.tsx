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
    <div className="p-6">
      <div className="mb-6 animate-fade-in-up">
        <h1 style={{ color: 'rgb(var(--text-primary))' }} className="text-2xl font-semibold">Analytics</h1>
        <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm mt-0.5">Performance metrics and insights</p>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-base font-semibold mb-4">Execution Status</h2>
          <div className="space-y-3">
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
        <div className="card p-4">
          <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-base font-semibold mb-4">Top Workflows</h2>
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
    neutral: 'rgb(var(--text-secondary))',
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Activity;

  return (
    <div className="card p-4 hover-glow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm font-medium">{label}</p>
          <p style={{ color: 'rgb(var(--text-primary))' }} className="text-2xl font-semibold mt-2">{value}</p>
          <div className="flex items-center mt-2 text-xs">
            <TrendIcon style={{ color: trendColors[trend] }} className="w-3 h-3 mr-1" strokeWidth={2.5} />
            <span style={{ color: trendColors[trend] }} className="font-medium">
              {change}
            </span>
            <span style={{ color: 'rgb(var(--text-secondary))' }} className="ml-1.5">{subtitle}</span>
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
          <span style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">{label}</span>
        </div>
        <span style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm">
          {count} ({percentage.toFixed(0)}%)
        </span>
      </div>
      <div style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }} className="h-2 rounded-full overflow-hidden">
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
    <div style={{ borderColor: 'rgb(var(--border-color))' }} className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3 flex-1">
        <div
          style={{ backgroundColor: 'rgb(var(--brand))', color: 'white' }}
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
        >
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium truncate">{workflow.name}</p>
          <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs">{workflow.execution_count} executions</p>
        </div>
      </div>
      <div className="text-right ml-3">
        <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)' }} className="px-2 py-1 rounded">
          <span style={{ color: '#22c55e' }} className="text-xs font-medium">{workflow.success_rate.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}
