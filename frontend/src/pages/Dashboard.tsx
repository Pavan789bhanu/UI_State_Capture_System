import { 
  Workflow, Activity, ArrowRight, Plus, Zap, BarChart3, 
  Sparkles, Settings, Clock, CheckCircle2, XCircle, Loader2
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: executions, refetch: refetchExecutions, refetch } = useQuery({
    queryKey: ['recent-executions'],
    queryFn: async () => {
      const result = await apiClient.getExecutions();
      return result.executions.slice(0, 5);
    },
    enabled: isAuthenticated && !authLoading,
    refetchInterval: 2000,
    staleTime: 0,
  });

  const { data: workflows } = useQuery({
    queryKey: ['recent-workflows'],
    queryFn: async () => {
      const result = await apiClient.getWorkflows();
      return result.workflows
        .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5);
    },
    enabled: isAuthenticated && !authLoading,
    refetchInterval: 5000,
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
    <div className="min-h-full py-8 px-4 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Hero Section */}
        <div className="mb-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 
                  flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <Sparkles className="text-white" size={28} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-400">Welcome back</p>
                  <h1 className="text-2xl lg:text-3xl font-bold text-white">
                    Pavan Kumar
                  </h1>
                </div>
              </div>
              <p className="text-gray-400 max-w-xl">
                Your automation platform is running smoothly. Here's what's happening with your workflows today.
              </p>
            </div>
            
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => {
                  navigate('/workflows');
                  window.dispatchEvent(new CustomEvent('create-workflow'));
                }}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 
                  text-white font-semibold hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-105 
                  transition-all duration-300"
              >
                <Plus size={18} />
                New Workflow
              </button>
              <button 
                onClick={() => navigate('/playground')}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/10 
                  text-white font-semibold hover:bg-white/5 hover:border-white/20 transition-all duration-300"
              >
                <Zap size={18} />
                Playground
              </button>
            </div>
          </div>
        </div>

        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <QuickAccessCard
            icon={Zap}
            title="AI Playground"
            description="Build workflows with natural language"
            gradient="from-amber-500 to-orange-500"
            onClick={() => navigate('/playground')}
          />
          <QuickAccessCard
            icon={BarChart3}
            title="Analytics"
            description="Track performance and insights"
            gradient="from-emerald-500 to-teal-500"
            onClick={() => navigate('/analytics')}
          />
          <QuickAccessCard
            icon={Settings}
            title="Settings"
            description="Configure your workspace"
            gradient="from-blue-500 to-indigo-500"
            onClick={() => navigate('/settings')}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Recent Workflows */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 
                    flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Workflow className="text-white" size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Recent Workflows</h2>
                    <p className="text-sm text-gray-400">Your latest automations</p>
                  </div>
                </div>
                <Link 
                  to="/workflows"
                  className="flex items-center gap-1 text-sm font-medium text-indigo-400 
                    hover:text-indigo-300 hover:gap-2 transition-all"
                >
                  View all <ArrowRight size={16} />
                </Link>
              </div>
              
              <div className="space-y-2">
                {workflows && workflows.length > 0 ? (
                  workflows.map((workflow: any, index: number) => (
                    <WorkflowRow key={workflow.id} workflow={workflow} index={index} />
                  ))
                ) : (
                  <EmptyState 
                    icon={Workflow}
                    title="No workflows yet"
                    description="Create your first workflow to get started"
                    action={
                      <button 
                        onClick={() => {
                          navigate('/workflows');
                          window.dispatchEvent(new CustomEvent('create-workflow'));
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 
                          text-white font-medium hover:shadow-lg hover:shadow-indigo-500/25 transition-all"
                      >
                        <Plus size={16} /> Create Workflow
                      </button>
                    }
                  />
                )}
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 
                  flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Activity className="text-white" size={20} />
                </div>
                <h2 className="text-lg font-semibold text-white">Activity</h2>
              </div>
              <Link 
                to="/executions"
                className="flex items-center gap-1 text-sm font-medium text-indigo-400 
                  hover:text-indigo-300 hover:gap-2 transition-all"
              >
                View all <ArrowRight size={16} />
              </Link>
            </div>
            
            <div className="space-y-3">
              {executions && executions.length > 0 ? (
                executions.map((execution: any) => (
                  <ActivityItem key={execution.id} execution={execution} />
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                    <Activity className="text-purple-400" size={20} />
                  </div>
                  <p className="text-sm text-gray-400">No recent activity</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// WORKFLOW ROW COMPONENT
// ============================================
interface WorkflowRowProps {
  workflow: {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
    execution_count?: number;
  };
  index: number;
}

function WorkflowRow({ workflow, index }: WorkflowRowProps) {
  const navigate = useNavigate();
  
  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
    }
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
    if (seconds < 604800) {
      const days = Math.floor(seconds / 86400);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
    if (seconds < 2592000) {
      const weeks = Math.floor(seconds / 604800);
      return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    }
    const months = Math.floor(seconds / 2592000);
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  };

  return (
    <div
      onClick={() => navigate('/workflows')}
      className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all 
        hover:bg-white/5 group"
      style={{ animationDelay: (index * 0.05) + 's' }}
    >
      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
        <Workflow className="text-indigo-400" size={18} />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">{workflow.name}</p>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock size={12} />
          Created {getTimeAgo(workflow.created_at)}
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {workflow.execution_count !== undefined && (
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white">{workflow.execution_count}</p>
            <p className="text-xs text-gray-400">runs</p>
          </div>
        )}
        <ArrowRight size={16} className="text-gray-500 opacity-0 group-hover:opacity-100 
          group-hover:translate-x-1 transition-all" />
      </div>
    </div>
  );
}

// ============================================
// ACTIVITY ITEM COMPONENT
// ============================================
interface ActivityItemProps {
  execution: {
    id: string;
    workflow_name: string;
    status: string;
    started_at?: string;
  };
}

function ActivityItem({ execution }: ActivityItemProps) {
  const navigate = useNavigate();
  
  const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
    SUCCESS: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Completed' },
    COMPLETED: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Completed' },
    RUNNING: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Running' },
    PENDING: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Pending' },
    FAILED: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Failed' },
    STOPPED: { icon: XCircle, color: 'text-gray-400', bg: 'bg-gray-500/10', label: 'Stopped' },
  };
  
  const config = statusConfig[execution.status] || statusConfig.PENDING;
  const StatusIcon = config.icon;
  
  const timeSince = (date?: string) => {
    if (!date) return 'Just now';
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
  };

  return (
    <div 
      onClick={() => navigate('/executions')}
      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-white/5"
    >
      <div className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center`}>
        <StatusIcon size={16} className={`${config.color} ${execution.status === 'RUNNING' ? 'animate-spin' : ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{execution.workflow_name}</p>
        <p className="text-xs text-gray-400">{timeSince(execution.started_at)}</p>
      </div>
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
        {config.label}
      </span>
    </div>
  );
}

// ============================================
// QUICK ACCESS CARD
// ============================================
interface QuickAccessCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  gradient: string;
  onClick: () => void;
}

function QuickAccessCard({ icon: Icon, title, description, gradient, onClick }: QuickAccessCardProps) {
  return (
    <button
      onClick={onClick}
      className="relative group p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm 
        text-left transition-all duration-300 hover:bg-white/10 hover:border-indigo-500/50 
        hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10"
    >
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} 
        flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
        <Icon className="text-white" size={22} />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-indigo-300 transition-colors">
        {title}
      </h3>
      <p className="text-sm text-gray-400 mb-4">{description}</p>
      <div className="flex items-center gap-1 text-sm font-medium text-indigo-400 
        group-hover:gap-2 group-hover:text-indigo-300 transition-all">
        Get started <ArrowRight size={16} />
      </div>
    </button>
  );
}

// ============================================
// EMPTY STATE
// ============================================
interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}

function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 
        flex items-center justify-center mx-auto mb-4">
        <Icon className="text-gray-400" size={28} />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">{description}</p>
      {action}
    </div>
  );
}
