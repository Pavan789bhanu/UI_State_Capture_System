import { Workflow, Activity, CheckCircle2, Clock, ArrowUpRight, ArrowDownRight, Play, Plus, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  useEffect(() => {
    console.log('[Dashboard] Auth state:', { isAuthenticated, authLoading });
  }, [isAuthenticated, authLoading]);
  
  const { data: stats, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      console.log('[Dashboard] Fetching analytics...');
      const analytics = await apiClient.getAnalyticsOverview();
      return {
        totalWorkflows: analytics.active_workflows,
        executions: analytics.total_executions,
        successRate: analytics.success_rate,
        avgDuration: analytics.average_duration,
      };
    },
    enabled: isAuthenticated && !authLoading,
  });

  const { data: executions, refetch: refetchExecutions } = useQuery({
    queryKey: ['recent-executions'],
    queryFn: async () => {
      console.log('[Dashboard] Fetching executions at:', new Date().toLocaleTimeString());
      const result = await apiClient.getExecutions();
      console.log('[Dashboard] Executions received:', result.executions.map((e: any) => ({ id: e.id, name: e.workflow_name, status: e.status })));
      return result.executions.slice(0, 5);
    },
    enabled: isAuthenticated && !authLoading,
    refetchInterval: 2000, // Poll every 2 seconds for real-time status updates
    staleTime: 0, // Always consider data stale to ensure fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: workflows } = useQuery({
    queryKey: ['recent-workflows'],
    queryFn: async () => {
      console.log('[Dashboard] Fetching workflows...');
      const result = await apiClient.getWorkflows();
      // Extract workflows array and sort by updatedAt descending, take top 5
      return result.workflows
        .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5);
    },
    enabled: isAuthenticated && !authLoading,
    refetchInterval: 5000, // Auto-refresh every 5 seconds for real-time updates
  });

  useEffect(() => {
    const handleUpdate = () => {
      refetch();
      refetchExecutions();
    };

    apiClient.on('execution_created', handleUpdate);
    apiClient.on('execution_completed', handleUpdate);
    apiClient.on('workflow_created', handleUpdate);

    return () => {
      apiClient.off('execution_created', handleUpdate);
      apiClient.off('execution_completed', handleUpdate);
      apiClient.off('workflow_created', handleUpdate);
    };
  }, [refetch, refetchExecutions]);

  return (
    <div className="min-h-full">
      {/* Hero Section with Gradient Background */}
      <div 
        className="relative overflow-hidden mb-8"
        style={{
          background: 'linear-gradient(135deg, rgba(var(--brand), 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
          borderRadius: '0 0 32px 32px'
        }}
      >
        {/* Animated Background Shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute w-96 h-96 rounded-full opacity-20 animate-pulse"
            style={{
              background: 'radial-gradient(circle, rgb(var(--brand)) 0%, transparent 70%)',
              top: '-10%',
              right: '10%',
              animationDuration: '4s'
            }}
          />
          <div 
            className="absolute w-64 h-64 rounded-full opacity-20 animate-pulse"
            style={{
              background: 'radial-gradient(circle, rgb(139 92 246) 0%, transparent 70%)',
              bottom: '-5%',
              left: '5%',
              animationDuration: '6s',
              animationDelay: '1s'
            }}
          />
        </div>

        <div className="relative p-8 max-w-7xl mx-auto">
          <div className="animate-fade-in-up">
            <h1 
              className="text-5xl font-bold mb-3"
              style={{ 
                background: 'linear-gradient(135deg, rgb(var(--text-primary)) 0%, rgb(var(--brand)) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              Welcome back, Pavan 👋
            </h1>
            <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-lg mb-6">
              Here's what's happening with your workflows today
            </p>
            
            {/* Quick Actions */}
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  navigate('/workflows');
                  window.dispatchEvent(new CustomEvent('create-workflow'));
                }}
                className="btn-primary flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                style={{
                  background: 'linear-gradient(135deg, rgb(var(--brand)) 0%, rgb(139 92 246) 100%)',
                  padding: '12px 24px',
                  borderRadius: '12px'
                }}
              >
                <Plus size={20} strokeWidth={2.5} />
                <span className="font-semibold">Create Workflow</span>
              </button>
              <button 
                onClick={() => navigate('/playground')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: 'rgb(var(--bg-secondary))',
                  border: '2px solid rgb(var(--border-color))',
                  color: 'rgb(var(--text-primary))'
                }}
              >
                <Play size={18} strokeWidth={2.5} />
                <span>Playground</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 max-w-7xl mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={Workflow}
            iconColor="#0ea5e9"
            iconBg="rgba(14, 165, 233, 0.1)"
            label="Active Workflows"
            value={stats?.totalWorkflows || 0}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            icon={Activity}
            iconColor="#8b5cf6"
            iconBg="rgba(139, 92, 246, 0.1)"
            label="Total Executions"
            value={stats?.executions || 0}
            trend={{ value: 23, isPositive: true }}
          />
          <StatCard
            icon={CheckCircle2}
            iconColor="#10b981"
            iconBg="rgba(16, 185, 129, 0.1)"
            label="Success Rate"
            value={`${Math.round(stats?.successRate || 0)}%`}
            trend={{ value: 5, isPositive: true }}
          />
          <StatCard
            icon={Clock}
            iconColor="#f59e0b"
            iconBg="rgba(245, 158, 11, 0.1)"
            label="Avg Duration"
            value={`${Math.round(stats?.avgDuration || 0)}s`}
            trend={{ value: 8, isPositive: false }}
          />
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Recent Workflows */}
          <div className="card stat-card">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-lg font-semibold">Recent Workflows</h2>
                <Link 
                  to="/workflows"
                  className="text-sm font-medium cursor-pointer"
                  style={{ 
                    color: 'rgb(var(--brand))', 
                    textDecoration: 'none',
                    padding: '8px 12px',
                    margin: '-8px -12px',
                    display: 'inline-block',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                >
                  View all
                </Link>
              </div>
              <div className="space-y-3">
                {workflows && workflows.length > 0 ? (
                  workflows.map((workflow: any) => (
                    <WorkflowItem key={workflow.id} workflow={workflow} />
                  ))
                ) : (
                  <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm py-4 text-center">
                    No workflows yet
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Recent Executions */}
          <div className="card stat-card">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-lg font-semibold">Recent Executions</h2>
                <Link 
                  to="/executions"
                  className="text-sm font-medium cursor-pointer"
                  style={{ 
                    color: 'rgb(var(--brand))', 
                    textDecoration: 'none',
                    padding: '8px 12px',
                    margin: '-8px -12px',
                    display: 'inline-block',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                >
                  View all
                </Link>
              </div>
              <div className="space-y-3">
                {executions && executions.length > 0 ? (
                  executions.map((execution: any) => (
                    <ExecutionItem key={execution.id} execution={execution} />
                  ))
                ) : (
                  <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm py-4 text-center">
                    No recent executions
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card stat-card">
            <div className="p-6">
              <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-lg font-semibold mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <ActionButton
                  icon={Plus}
                  label="Create Workflow"
                  description="Build a new automation"
                  color="rgb(var(--brand))"
                  onClick={() => {
                    navigate('/workflows');
                    window.dispatchEvent(new CustomEvent('create-workflow'));
                  }}
                />
                <ActionButton
                  icon={Play}
                  label="Try Playground"
                  description="Test workflows instantly"
                  color="#8b5cf6"
                  onClick={() => navigate('/playground')}
                />
                <ActionButton
                  icon={TrendingUp}
                  label="View Analytics"
                  description="Track performance metrics"
                  color="#10b981"
                  onClick={() => navigate('/analytics')}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string | number;
  trend?: { value: number; isPositive: boolean };
}

function StatCard({ icon: Icon, iconColor, iconBg, label, value, trend }: StatCardProps) {
  return (
    <div className="card stat-card hover:scale-105 transition-transform duration-300">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md"
            style={{ backgroundColor: iconBg }}
          >
            <Icon style={{ color: iconColor }} size={24} strokeWidth={2.5} />
          </div>
          {trend && (
            <div className="flex items-center gap-1">
              {trend.isPositive ? (
                <ArrowUpRight style={{ color: '#10b981' }} size={16} strokeWidth={2.5} />
              ) : (
                <ArrowDownRight style={{ color: '#ef4444' }} size={16} strokeWidth={2.5} />
              )}
              <span style={{ color: trend.isPositive ? '#10b981' : '#ef4444' }} className="text-sm font-semibold">
                {trend.value}%
              </span>
            </div>
          )}
        </div>
        <div>
          <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm font-medium mb-1">{label}</p>
          <p style={{ color: 'rgb(var(--text-primary))' }} className="text-3xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

interface ExecutionItemProps {
  execution: {
    id: string;
    workflow_name: string;
    status: string;
  };
}

interface WorkflowItemProps {
  workflow: {
    id: string;
    name: string;
    app_name: string;
    updated_at: string;
  };
}

function WorkflowItem({ workflow }: WorkflowItemProps) {
  const navigate = useNavigate();
  const timeSince = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <button
      onClick={() => navigate(`/workflows/${workflow.id}`)}
      className="w-full flex items-center justify-between p-3 rounded-lg transition-all hover:scale-102 text-left"
      style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
          style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)' }}
        >
          <Workflow style={{ color: '#0ea5e9' }} size={16} strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium truncate">
            {workflow.name}
          </p>
          <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs">
            {timeSince(workflow.updated_at)}
          </p>
        </div>
      </div>
      <ArrowUpRight style={{ color: 'rgb(var(--text-secondary))' }} size={14} />
    </button>
  );
}

function ExecutionItem({ execution }: ExecutionItemProps) {
  const navigate = useNavigate();
  const statusConfig = {
    SUCCESS: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', dot: '#22c55e', label: 'Success' },
    COMPLETED: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', dot: '#22c55e', label: 'Success' },
    RUNNING: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', dot: '#3b82f6', label: 'Running' },
    PENDING: { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', dot: '#eab308', label: 'Pending' },
    FAILED: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', dot: '#ef4444', label: 'Failed' },
    STOPPED: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', dot: '#94a3b8', label: 'Stopped' },
    CANCELLED: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', dot: '#94a3b8', label: 'Cancelled' },
  };

  const status = statusConfig[execution.status as keyof typeof statusConfig] || statusConfig.PENDING;

  return (
    <button
      onClick={() => navigate(`/executions/${execution.id}`)}
      className="w-full flex items-center justify-between p-3 rounded-lg transition-all hover:scale-102 text-left"
      style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div 
          className={`w-2 h-2 rounded-full ${execution.status === 'RUNNING' || execution.status === 'PENDING' ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: status.dot }}
        />
        <div className="flex-1 min-w-0">
          <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium truncate">
            {execution.workflow_name}
          </p>
        </div>
      </div>
      <div 
        className="px-3 py-1 rounded-full text-xs font-semibold"
        style={{ backgroundColor: status.bg, color: status.text }}
      >
        {status.label}
      </div>
    </button>
  );
}

interface ActionButtonProps {
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
  onClick: () => void;
}

function ActionButton({ icon: Icon, label, description, color, onClick }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-xl transition-all hover:scale-102 text-left group"
      style={{ backgroundColor: 'rgb(var(--bg-tertiary))', border: '2px solid rgb(var(--border-color))' }}
    >
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon style={{ color }} size={20} strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-semibold">{label}</p>
        <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs">{description}</p>
      </div>
      <ArrowUpRight style={{ color: 'rgb(var(--text-secondary))' }} size={16} className="group-hover:translate-x-1 transition-transform" />
    </button>
  );
}
