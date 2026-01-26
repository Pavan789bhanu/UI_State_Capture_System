import { Eye, CheckCircle2, XCircle, Clock, Trash2, Search, AlertTriangle, X, Play, FileText, Calendar, Timer, Filter, ExternalLink, RefreshCw, Loader2, LayoutGrid, List, Columns } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type Execution } from '../services/api';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';

type StatusFilter = 'all' | 'SUCCESS' | 'COMPLETED' | 'RUNNING' | 'FAILED' | 'PENDING';
type ViewMode = 'grid' | 'list' | 'compact';

export default function ExecutionsPage() {
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [executionToDelete, setExecutionToDelete] = useState<Execution | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('executionViewMode') as ViewMode) || 'grid';
  });
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();

  // Save view mode preference
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('executionViewMode', mode);
  };
  
  // Safety check: don't render if not authenticated
  if (!isAuthenticated || authLoading || !token) {
    return null;
  }
  
  const { data: executionsData, refetch, isLoading, isFetching } = useQuery({
    queryKey: ['executions'],
    queryFn: async () => {
      return await apiClient.getExecutions();
    },
    refetchInterval: 5000, // Poll every 5 seconds for running executions
    enabled: isAuthenticated && !authLoading,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteExecution(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      addNotification({
        type: 'success',
        title: 'Execution Deleted',
        message: `Execution has been removed successfully.`,
      });
      setShowDeleteDialog(false);
      setExecutionToDelete(null);
    },
    onError: () => {
      addNotification({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete the execution. Please try again.',
      });
    },
  });

  // Listen for real-time updates
  useEffect(() => {
    const handleExecutionUpdate = () => {
      refetch();
    };

    apiClient.on('execution_created', handleExecutionUpdate);
    apiClient.on('execution_updated', handleExecutionUpdate);
    apiClient.on('execution_completed', handleExecutionUpdate);
    apiClient.on('execution_stopped', handleExecutionUpdate);
    apiClient.on('started', handleExecutionUpdate);
    apiClient.on('progress', handleExecutionUpdate);
    apiClient.on('completed', handleExecutionUpdate);
    apiClient.on('failed', handleExecutionUpdate);

    return () => {
      apiClient.off('execution_created', handleExecutionUpdate);
      apiClient.off('execution_updated', handleExecutionUpdate);
      apiClient.off('execution_completed', handleExecutionUpdate);
      apiClient.off('execution_stopped', handleExecutionUpdate);
      apiClient.off('started', handleExecutionUpdate);
      apiClient.off('progress', handleExecutionUpdate);
      apiClient.off('completed', handleExecutionUpdate);
      apiClient.off('failed', handleExecutionUpdate);
    };
  }, [refetch]);

  const executions = executionsData?.executions || [];
  
  // Filter executions based on search query and status
  const filteredExecutions = useMemo(() => {
    return executions.filter((execution: Execution) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'SUCCESS' && execution.status !== 'SUCCESS' && execution.status !== 'COMPLETED') {
          return false;
        } else if (statusFilter !== 'SUCCESS' && execution.status !== statusFilter) {
          return false;
        }
      }
      
      // Search filter
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        execution.workflow_name?.toLowerCase().includes(query) ||
        execution.status?.toLowerCase().includes(query) ||
        execution.id?.toLowerCase().includes(query)
      );
    });
  }, [executions, searchQuery, statusFilter]);

  // Group executions by date
  const groupedExecutions = useMemo(() => {
    const groups: Record<string, Execution[]> = {};
    
    filteredExecutions.forEach((execution: Execution) => {
      const date = execution.started_at 
        ? new Date(execution.started_at).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        : 'Pending';
      
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(execution);
    });
    
    return groups;
  }, [filteredExecutions]);

  // Status counts for filter badges
  const statusCounts = useMemo(() => {
    const counts = { all: 0, SUCCESS: 0, RUNNING: 0, FAILED: 0, PENDING: 0 };
    executions.forEach((exec: Execution) => {
      counts.all++;
      if (exec.status === 'SUCCESS' || exec.status === 'COMPLETED') counts.SUCCESS++;
      else if (exec.status === 'RUNNING') counts.RUNNING++;
      else if (exec.status === 'FAILED') counts.FAILED++;
      else if (exec.status === 'PENDING') counts.PENDING++;
    });
    return counts;
  }, [executions]);

  const statusFilters: { key: StatusFilter; label: string; color: string; bgColor: string }[] = [
    { key: 'all', label: 'All', color: 'rgb(var(--text-primary))', bgColor: 'rgb(var(--bg-tertiary))' },
    { key: 'SUCCESS', label: 'Success', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)' },
    { key: 'RUNNING', label: 'Running', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
    { key: 'FAILED', label: 'Failed', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
    { key: 'PENDING', label: 'Pending', color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.15)' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ color: 'rgb(var(--text-primary))' }} className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
                <Play className="text-white" size={18} />
              </div>
              Execution History
            </h1>
            <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm mt-1 ml-13">
              Track and monitor your workflow executions
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ 
              backgroundColor: 'rgb(var(--bg-tertiary))',
              color: 'rgb(var(--text-secondary))',
              border: '1px solid rgb(var(--border-color))'
            }}
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search, Filters and View Controls */}
      <div className="mb-6 space-y-4">
        {/* Search Bar and View Mode Switcher */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search style={{ color: 'rgb(var(--text-secondary))' }} className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4" strokeWidth={2} />
            <input
              type="text"
              placeholder="Search by workflow name, status, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
              className="w-full pl-11 pr-4 py-2.5 text-sm border-2 rounded-xl focus:outline-none transition-all placeholder:text-gray-400"
              onFocus={(e) => {
                e.target.style.borderColor = 'rgb(var(--brand))';
                e.target.style.boxShadow = '0 0 0 3px rgba(var(--brand), 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgb(var(--border-color))';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* View Mode Switcher */}
          <div 
            className="flex items-center rounded-xl p-1 shrink-0"
            style={{ backgroundColor: 'rgb(var(--bg-tertiary))', border: '1px solid rgb(var(--border-color))' }}
          >
            {[
              { mode: 'grid' as ViewMode, icon: LayoutGrid, label: 'Grid' },
              { mode: 'list' as ViewMode, icon: List, label: 'List' },
              { mode: 'compact' as ViewMode, icon: Columns, label: 'Compact' },
            ].map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => handleViewModeChange(mode)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  viewMode === mode ? 'shadow-sm' : 'hover:bg-white/50 dark:hover:bg-white/5'
                }`}
                style={{
                  backgroundColor: viewMode === mode ? 'rgb(var(--bg-primary))' : 'transparent',
                  color: viewMode === mode ? 'rgb(var(--brand))' : 'rgb(var(--text-secondary))',
                }}
                title={label}
              >
                <Icon size={16} strokeWidth={2} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={16} style={{ color: 'rgb(var(--text-secondary))' }} />
          {statusFilters.map((filter) => {
            const count = statusCounts[filter.key as keyof typeof statusCounts] || 0;
            const isActive = statusFilter === filter.key;
            
            return (
              <button
                key={filter.key}
                onClick={() => setStatusFilter(filter.key)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${isActive ? 'ring-2 ring-offset-2' : ''}`}
                style={{ 
                  backgroundColor: isActive ? filter.bgColor : 'rgb(var(--bg-tertiary))',
                  color: isActive ? filter.color : 'rgb(var(--text-secondary))',
                  '--tw-ring-color': filter.color,
                } as React.CSSProperties}
              >
                {filter.label}
                <span 
                  className="px-1.5 py-0.5 rounded-md text-xs font-semibold"
                  style={{ 
                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'rgb(var(--bg-secondary))',
                    color: isActive ? filter.color : 'rgb(var(--text-secondary))'
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'rgb(var(--brand))' }} />
        </div>
      ) : Object.keys(groupedExecutions).length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }}>
            <FileText size={32} style={{ color: 'rgb(var(--text-secondary))' }} />
          </div>
          <h3 style={{ color: 'rgb(var(--text-primary))' }} className="text-lg font-semibold mb-2">
            {searchQuery || statusFilter !== 'all' ? 'No matching executions' : 'No executions yet'}
          </h3>
          <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm max-w-md mx-auto">
            {searchQuery || statusFilter !== 'all' 
              ? 'Try adjusting your search or filters to find what you\'re looking for.'
              : 'Run a workflow from the Workflows page or Playground to see execution results here.'}
          </p>
        </div>
      ) : (
        /* Grouped Execution Cards */
        <div className="space-y-8">
          {Object.entries(groupedExecutions).map(([date, dateExecutions]) => (
            <div key={date} className="animate-fade-in-up">
              {/* Date Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }}>
                  <Calendar size={14} style={{ color: 'rgb(var(--text-secondary))' }} />
                  <span style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">{date}</span>
                </div>
                <div className="flex-1 h-px" style={{ backgroundColor: 'rgb(var(--border-color))' }} />
                <span style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs">
                  {dateExecutions.length} execution{dateExecutions.length !== 1 ? 's' : ''}
                </span>
              </div>
              
              {/* Execution Cards - View Mode Dependent */}
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dateExecutions.map((execution: Execution, index: number) => (
                    <ExecutionCard
                      key={execution.id}
                      execution={execution}
                      index={index}
                      onViewReport={() => {
                        setSelectedExecution(execution);
                        setShowReportModal(true);
                      }}
                      onDelete={() => {
                        setExecutionToDelete(execution);
                        setShowDeleteDialog(true);
                      }}
                    />
                  ))}
                </div>
              ) : viewMode === 'list' ? (
                <div className="space-y-3">
                  {dateExecutions.map((execution: Execution, index: number) => (
                    <ExecutionListItem
                      key={execution.id}
                      execution={execution}
                      index={index}
                      onViewReport={() => {
                        setSelectedExecution(execution);
                        setShowReportModal(true);
                      }}
                      onDelete={() => {
                        setExecutionToDelete(execution);
                        setShowDeleteDialog(true);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full">
                    <thead style={{ borderColor: 'rgb(var(--border-color))' }} className="border-b">
                      <tr>
                        <th style={{ color: 'rgb(var(--text-secondary))' }} className="text-left px-4 py-3 text-xs font-semibold uppercase">Workflow</th>
                        <th style={{ color: 'rgb(var(--text-secondary))' }} className="text-left px-4 py-3 text-xs font-semibold uppercase">Status</th>
                        <th style={{ color: 'rgb(var(--text-secondary))' }} className="text-left px-4 py-3 text-xs font-semibold uppercase hidden md:table-cell">Started</th>
                        <th style={{ color: 'rgb(var(--text-secondary))' }} className="text-left px-4 py-3 text-xs font-semibold uppercase hidden lg:table-cell">Duration</th>
                        <th style={{ color: 'rgb(var(--text-secondary))' }} className="text-right px-4 py-3 text-xs font-semibold uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dateExecutions.map((execution: Execution) => (
                        <ExecutionTableRow
                          key={execution.id}
                          execution={execution}
                          onViewReport={() => {
                            setSelectedExecution(execution);
                            setShowReportModal(true);
                          }}
                          onDelete={() => {
                            setExecutionToDelete(execution);
                            setShowDeleteDialog(true);
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Report Viewer Modal */}
      {showReportModal && selectedExecution && (
        <ReportViewerModal
          execution={selectedExecution}
          onClose={() => {
            setShowReportModal(false);
            setSelectedExecution(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && executionToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div 
            className="relative max-w-md w-full m-4 rounded-2xl overflow-hidden shadow-2xl animate-scale-in"
            style={{ backgroundColor: 'rgb(var(--bg-primary))' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with gradient */}
            <div className="relative px-6 py-5 bg-gradient-to-r from-red-500 to-orange-500">
              <div className="absolute inset-0 bg-black/10" />
              <div className="relative flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <AlertTriangle className="w-6 h-6 text-white" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Delete Execution</h2>
                  <p className="text-sm text-white/80">This action cannot be undone</p>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <div 
                className="p-4 rounded-xl mb-4"
                style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }}
              >
                <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm mb-2">
                  Execution Details:
                </p>
                <p style={{ color: 'rgb(var(--text-primary))' }} className="font-semibold">
                  {executionToDelete.workflow_name || 'Unknown Workflow'}
                </p>
                <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mt-1">
                  ID: {String(executionToDelete.id).slice(0, 8)}...
                </p>
              </div>
              
              <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm leading-relaxed">
                All execution data, logs, screenshots, and reports will be permanently removed.
              </p>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setExecutionToDelete(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 hover:scale-105 active:scale-95"
                style={{ 
                  backgroundColor: 'rgb(var(--bg-tertiary))',
                  color: 'rgb(var(--text-primary))',
                  border: '1px solid rgb(var(--border-color))'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(executionToDelete.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2.5 rounded-xl font-medium text-white transition-all duration-200 hover:scale-105 active:scale-95 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/25 disabled:opacity-50 disabled:hover:scale-100"
              >
                {deleteMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin h-4 w-4" />
                    Deleting...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Trash2 size={16} strokeWidth={2} />
                    Delete
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Execution Card Component
function ExecutionCard({ 
  execution, 
  index, 
  onViewReport, 
  onDelete 
}: { 
  execution: Execution; 
  index: number;
  onViewReport: () => void; 
  onDelete: () => void;
}) {
  const [liveDuration, setLiveDuration] = useState(0);
  
  // Update live duration for running executions
  useEffect(() => {
    if (execution.status === 'RUNNING' && execution.started_at) {
      const interval = setInterval(() => {
        const start = new Date(execution.started_at!).getTime();
        const now = Date.now();
        setLiveDuration(Math.floor((now - start) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [execution.status, execution.started_at]);

  const statusConfig: Record<string, { icon: any; bg: string; text: string; label: string; pulse?: boolean }> = {
    COMPLETED: { icon: CheckCircle2, bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', label: 'Success' },
    SUCCESS: { icon: CheckCircle2, bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', label: 'Success' },
    RUNNING: { icon: Loader2, bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', label: 'Running', pulse: true },
    FAILED: { icon: XCircle, bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', label: 'Failed' },
    STOPPED: { icon: XCircle, bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', label: 'Stopped' },
    PENDING: { icon: Clock, bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', label: 'Pending' },
    CANCELLED: { icon: XCircle, bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', label: 'Cancelled' },
  };

  const config = statusConfig[execution.status] || statusConfig.FAILED;
  const StatusIcon = config.icon;

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const calculateDuration = () => {
    if (!execution.started_at) return 0;
    const start = new Date(execution.started_at).getTime();
    const end = execution.completed_at ? new Date(execution.completed_at).getTime() : Date.now();
    return Math.floor((end - start) / 1000);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const canViewReport = execution.status !== 'PENDING' && execution.status !== 'RUNNING';

  return (
    <div 
      className="card p-4 hover-glow transition-all duration-300 animate-scale-in"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 
            style={{ color: 'rgb(var(--text-primary))' }} 
            className="font-semibold text-sm truncate"
            title={execution.workflow_name || 'Unknown Workflow'}
          >
            {execution.workflow_name || 'Unknown Workflow'}
          </h3>
          <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mt-0.5">
            ID: {String(execution.id).slice(0, 8)}
          </p>
        </div>
        <span 
          style={{ backgroundColor: config.bg, color: config.text }} 
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${config.pulse ? 'animate-pulse' : ''}`}
        >
          <StatusIcon size={12} strokeWidth={2} className={config.pulse ? 'animate-spin' : ''} />
          {config.label}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Clock size={14} style={{ color: 'rgb(var(--text-secondary))' }} />
          <div>
            <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs">Started</p>
            <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">
              {execution.started_at ? formatTime(execution.started_at) : '--'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Timer size={14} style={{ color: 'rgb(var(--text-secondary))' }} />
          <div>
            <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs">Duration</p>
            <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">
              {execution.status === 'RUNNING' 
                ? formatDuration(liveDuration) 
                : execution.status === 'PENDING' 
                  ? '--' 
                  : formatDuration(execution.duration || calculateDuration())}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid rgb(var(--border-color))' }}>
        <button
          onClick={onViewReport}
          disabled={!canViewReport}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{ 
            backgroundColor: canViewReport ? 'rgb(var(--brand))' : 'rgb(var(--bg-tertiary))',
            color: canViewReport ? 'white' : 'rgb(var(--text-tertiary))',
          }}
        >
          <Eye size={14} strokeWidth={2} />
          View Report
        </button>
        <button
          onClick={onDelete}
          className="p-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
          style={{ 
            backgroundColor: 'rgb(var(--bg-tertiary))',
            color: 'rgb(var(--text-secondary))',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
            e.currentTarget.style.color = '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgb(var(--bg-tertiary))';
            e.currentTarget.style.color = 'rgb(var(--text-secondary))';
          }}
        >
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// Execution List Item Component (for List view)
function ExecutionListItem({ 
  execution, 
  index,
  onViewReport, 
  onDelete 
}: { 
  execution: Execution; 
  index: number;
  onViewReport: () => void; 
  onDelete: () => void;
}) {
  const [liveDuration, setLiveDuration] = useState(0);
  
  useEffect(() => {
    if (execution.status === 'RUNNING' && execution.started_at) {
      const interval = setInterval(() => {
        const start = new Date(execution.started_at!).getTime();
        const now = Date.now();
        setLiveDuration(Math.floor((now - start) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [execution.status, execution.started_at]);

  const statusConfig: Record<string, { icon: any; bg: string; text: string; label: string; pulse?: boolean }> = {
    COMPLETED: { icon: CheckCircle2, bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', label: 'Success' },
    SUCCESS: { icon: CheckCircle2, bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', label: 'Success' },
    RUNNING: { icon: Loader2, bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', label: 'Running', pulse: true },
    FAILED: { icon: XCircle, bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', label: 'Failed' },
    STOPPED: { icon: XCircle, bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', label: 'Stopped' },
    PENDING: { icon: Clock, bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', label: 'Pending' },
    CANCELLED: { icon: XCircle, bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', label: 'Cancelled' },
  };

  const config = statusConfig[execution.status] || statusConfig.FAILED;
  const StatusIcon = config.icon;

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const calculateDuration = () => {
    if (!execution.started_at) return 0;
    const start = new Date(execution.started_at).getTime();
    const end = execution.completed_at ? new Date(execution.completed_at).getTime() : Date.now();
    return Math.floor((end - start) / 1000);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const canViewReport = execution.status !== 'PENDING' && execution.status !== 'RUNNING';

  return (
    <div 
      className="card p-4 hover-glow transition-all duration-300 animate-fade-in-up"
      style={{ animationDelay: `${index * 0.03}s` }}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {/* Main Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 
              style={{ color: 'rgb(var(--text-primary))' }} 
              className="font-semibold text-sm truncate"
              title={execution.workflow_name || 'Unknown Workflow'}
            >
              {execution.workflow_name || 'Unknown Workflow'}
            </h3>
            <span 
              style={{ backgroundColor: config.bg, color: config.text }} 
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${config.pulse ? 'animate-pulse' : ''}`}
            >
              <StatusIcon size={12} strokeWidth={2} className={config.pulse ? 'animate-spin' : ''} />
              {config.label}
            </span>
          </div>
          <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs">
            ID: {String(execution.id).slice(0, 8)}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-center">
            <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mb-0.5">Started</p>
            <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium whitespace-nowrap">
              {execution.started_at ? formatTime(execution.started_at) : '--'}
            </p>
          </div>
          <div className="text-center">
            <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mb-0.5">Duration</p>
            <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">
              {execution.status === 'RUNNING' 
                ? formatDuration(liveDuration) 
                : execution.status === 'PENDING' 
                  ? '--' 
                  : formatDuration(execution.duration || calculateDuration())}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onViewReport}
            disabled={!canViewReport}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ 
              backgroundColor: canViewReport ? 'rgb(var(--brand))' : 'rgb(var(--bg-tertiary))',
              color: canViewReport ? 'white' : 'rgb(var(--text-tertiary))',
            }}
          >
            <Eye size={14} strokeWidth={2} />
            View Report
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ 
              backgroundColor: 'rgb(var(--bg-tertiary))',
              color: 'rgb(var(--text-secondary))',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgb(var(--bg-tertiary))';
              e.currentTarget.style.color = 'rgb(var(--text-secondary))';
            }}
          >
            <Trash2 size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Execution Table Row Component (for Compact view)
function ExecutionTableRow({ 
  execution, 
  onViewReport, 
  onDelete 
}: { 
  execution: Execution; 
  onViewReport: () => void; 
  onDelete: () => void;
}) {
  const [liveDuration, setLiveDuration] = useState(0);
  
  useEffect(() => {
    if (execution.status === 'RUNNING' && execution.started_at) {
      const interval = setInterval(() => {
        const start = new Date(execution.started_at!).getTime();
        const now = Date.now();
        setLiveDuration(Math.floor((now - start) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [execution.status, execution.started_at]);

  const statusConfig: Record<string, { icon: any; bg: string; text: string; label: string; pulse?: boolean }> = {
    COMPLETED: { icon: CheckCircle2, bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', label: 'Success' },
    SUCCESS: { icon: CheckCircle2, bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', label: 'Success' },
    RUNNING: { icon: Loader2, bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', label: 'Running', pulse: true },
    FAILED: { icon: XCircle, bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', label: 'Failed' },
    STOPPED: { icon: XCircle, bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', label: 'Stopped' },
    PENDING: { icon: Clock, bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', label: 'Pending' },
    CANCELLED: { icon: XCircle, bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', label: 'Cancelled' },
  };

  const config = statusConfig[execution.status] || statusConfig.FAILED;
  const StatusIcon = config.icon;

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const calculateDuration = () => {
    if (!execution.started_at) return 0;
    const start = new Date(execution.started_at).getTime();
    const end = execution.completed_at ? new Date(execution.completed_at).getTime() : Date.now();
    return Math.floor((end - start) / 1000);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const canViewReport = execution.status !== 'PENDING' && execution.status !== 'RUNNING';

  return (
    <tr 
      style={{ borderColor: 'rgb(var(--border-color))' }} 
      className="border-b last:border-b-0 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }}>
            <Play size={14} style={{ color: 'rgb(var(--brand))' }} />
          </div>
          <div className="min-w-0">
            <p style={{ color: 'rgb(var(--text-primary))' }} className="font-medium text-sm truncate">{execution.workflow_name || 'Unknown Workflow'}</p>
            <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs truncate">ID: {String(execution.id).slice(0, 8)}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span 
          style={{ backgroundColor: config.bg, color: config.text }} 
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${config.pulse ? 'animate-pulse' : ''}`}
        >
          <StatusIcon size={12} strokeWidth={2} className={config.pulse ? 'animate-spin' : ''} />
          {config.label}
        </span>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm">
          {execution.started_at ? formatTime(execution.started_at) : '--'}
        </span>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">
          {execution.status === 'RUNNING' 
            ? formatDuration(liveDuration) 
            : execution.status === 'PENDING' 
              ? '--' 
              : formatDuration(execution.duration || calculateDuration())}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button 
            onClick={onViewReport}
            disabled={!canViewReport}
            className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ color: canViewReport ? 'rgb(var(--brand))' : 'rgb(var(--text-tertiary))' }}
            onMouseEnter={(e) => {
              if (canViewReport) e.currentTarget.style.backgroundColor = 'rgba(var(--brand), 0.1)';
            }}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title="View Report"
          >
            <Eye size={16} strokeWidth={2} />
          </button>
          <button 
            onClick={onDelete}
            className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110"
            style={{ color: 'rgb(var(--text-secondary))' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'rgb(var(--text-secondary))';
            }}
            title="Delete Execution"
          >
            <Trash2 size={16} strokeWidth={2} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// Report Viewer Modal Component
function ReportViewerModal({ 
  execution, 
  onClose 
}: { 
  execution: Execution; 
  onClose: () => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(true); // Default to fullscreen
  const reportUrl = `http://localhost:8000/api/executions/${execution.id}/report`;

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setError('Failed to load the execution report. The report may not exist or the server is unavailable.');
  };

  const handleOpenExternal = () => {
    window.open(reportUrl, '_blank', 'width=1400,height=900');
  };

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in">
      <div 
        className={`relative rounded-2xl overflow-hidden shadow-2xl animate-scale-in flex flex-col transition-all duration-300 ${
          isFullscreen 
            ? 'w-[calc(100vw-32px)] h-[calc(100vh-32px)] m-4' 
            : 'w-full max-w-5xl h-[80vh] m-4'
        }`}
        style={{ backgroundColor: 'rgb(var(--bg-primary))' }}
      >
        {/* Header */}
        <div className="relative px-6 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shrink-0">
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <FileText className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Execution Report</h2>
                <p className="text-sm text-white/80">{execution.workflow_name || 'Unknown Workflow'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Size Toggle */}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-all"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                    </svg>
                    Minimize
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    </svg>
                    Fullscreen
                  </>
                )}
              </button>
              <button
                onClick={handleOpenExternal}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-all"
              >
                <ExternalLink size={14} />
                New Tab
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-all"
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Report Info Bar */}
        <div 
          className="flex items-center gap-6 px-6 py-2.5 shrink-0 flex-wrap"
          style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderBottom: '1px solid rgb(var(--border-color))' }}
        >
          <div className="flex items-center gap-2">
            <span style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs font-medium">Status:</span>
            <span 
              className="px-2 py-0.5 rounded-md text-xs font-semibold"
              style={{ 
                backgroundColor: execution.status === 'SUCCESS' || execution.status === 'COMPLETED' 
                  ? 'rgba(34, 197, 94, 0.15)' 
                  : 'rgba(239, 68, 68, 0.15)',
                color: execution.status === 'SUCCESS' || execution.status === 'COMPLETED' 
                  ? '#22c55e' 
                  : '#ef4444'
              }}
            >
              {execution.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs font-medium">ID:</span>
            <code style={{ color: 'rgb(var(--text-primary))' }} className="text-xs font-mono bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded">
              {execution.id}
            </code>
          </div>
          {execution.started_at && (
            <div className="flex items-center gap-2">
              <span style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs font-medium">Started:</span>
              <span style={{ color: 'rgb(var(--text-primary))' }} className="text-xs">
                {new Date(execution.started_at).toLocaleString()}
              </span>
            </div>
          )}
          {execution.duration && (
            <div className="flex items-center gap-2">
              <span style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs font-medium">Duration:</span>
              <span style={{ color: 'rgb(var(--text-primary))' }} className="text-xs">
                {execution.duration < 60 ? `${execution.duration}s` : `${Math.floor(execution.duration / 60)}m ${execution.duration % 60}s`}
              </span>
            </div>
          )}
        </div>

        {/* Report Content */}
        <div className="flex-1 relative overflow-hidden bg-white">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
                <p className="text-gray-500 text-sm font-medium">Loading report...</p>
              </div>
            </div>
          )}
          
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center p-6" style={{ backgroundColor: 'rgb(var(--bg-primary))' }}>
              <div className="text-center max-w-md">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}>
                  <AlertTriangle size={40} className="text-red-500" />
                </div>
                <h3 style={{ color: 'rgb(var(--text-primary))' }} className="text-xl font-bold mb-2">
                  Report Unavailable
                </h3>
                <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm mb-6">
                  {error}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: 'rgb(var(--bg-tertiary))', color: 'rgb(var(--text-primary))' }}
                  >
                    Close
                  </button>
                  <button
                    onClick={handleOpenExternal}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                    style={{ backgroundColor: 'rgb(var(--brand))' }}
                  >
                    <ExternalLink size={14} />
                    Try External
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <iframe
              src={reportUrl}
              className="w-full h-full border-0"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              title="Execution Report"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          )}
        </div>
      </div>
    </div>
  );
}
