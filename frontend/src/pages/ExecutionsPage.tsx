import { Eye, CheckCircle2, XCircle, Clock, Trash2, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type Execution } from '../services/api';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';

export default function ExecutionsPage() {
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  
  // Safety check: don't render if not authenticated
  if (!isAuthenticated || authLoading || !token) {
    return null;
  }
  
  const { data: executionsData, refetch } = useQuery({
    queryKey: ['executions'],
    queryFn: async () => {
      return await apiClient.getExecutions();
    },
    refetchInterval: 3000, // Poll every 3 seconds for running executions
    enabled: isAuthenticated && !authLoading,
  });

  // Listen for real-time updates
  useEffect(() => {
    const handleExecutionUpdate = (data: any) => {
      console.log('Execution update:', data);
      // Trigger refetch to get latest data
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
  
  // Filter executions based on search query
  const filteredExecutions = executions.filter((execution: Execution) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      execution.workflow_name?.toLowerCase().includes(query) ||
      execution.status?.toLowerCase().includes(query) ||
      execution.id?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-6">
      <div className="mb-6 animate-fade-in-up">
        <h1 style={{ color: 'rgb(var(--text-primary))' }} className="text-2xl font-semibold">Executions</h1>
        <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm mt-0.5">View execution history and results</p>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search style={{ color: 'rgb(var(--text-secondary))' }} className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" strokeWidth={2} />
          <input
            type="text"
            placeholder="Search executions by workflow, status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none transition-all placeholder:text-gray-400"
            onFocus={(e) => {
              e.target.style.borderColor = 'rgb(var(--brand))';
              e.target.style.boxShadow = '0 0 0 2px rgba(var(--brand), 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgb(var(--border-color))';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ borderColor: 'rgb(var(--border-color))' }} className="border-b">
              <tr>
                <th style={{ color: 'rgb(var(--text-secondary))' }} className="text-left px-4 py-3 text-xs font-medium uppercase">Workflow</th>
                <th style={{ color: 'rgb(var(--text-secondary))' }} className="text-left px-4 py-3 text-xs font-medium uppercase">Status</th>
                <th style={{ color: 'rgb(var(--text-secondary))' }} className="text-left px-4 py-3 text-xs font-medium uppercase">Started</th>
                <th style={{ color: 'rgb(var(--text-secondary))' }} className="text-left px-4 py-3 text-xs font-medium uppercase">Duration</th>
                <th style={{ color: 'rgb(var(--text-secondary))' }} className="text-left px-4 py-3 text-xs font-medium uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExecutions.length > 0 ? (
                filteredExecutions.map((execution: Execution) => (
                  <ExecutionRow key={execution.id} execution={execution} onDelete={refetch} />
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm">
                      {searchQuery ? `No executions found matching "${searchQuery}"` : 'No executions yet. Run a workflow to see results here.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ExecutionRow({ execution, onDelete }: { execution: Execution; onDelete: () => void }) {
  const [liveDuration, setLiveDuration] = useState(0);
  const queryClient = useQueryClient();
  
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteExecution(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      onDelete();
    },
  });

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this execution?')) {
      deleteMutation.mutate(execution.id);
    }
  };
  
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
  
  const statusConfig = {
    COMPLETED: { icon: CheckCircle2, bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', label: 'Success' },
    SUCCESS: { icon: CheckCircle2, bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', label: 'Success' },
    RUNNING: { icon: Clock, bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', label: 'Running' },
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

  return (
    <tr
      style={{ borderColor: 'rgb(var(--border-color))' }}
      className="border-b last:border-b-0 transition-all duration-200"
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--bg-tertiary))'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      <td className="px-4 py-3">
        <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">{execution.workflow_name || 'Unknown Workflow'}</p>
        <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mt-0.5">ID: {String(execution.id).slice(0, 8)}</p>
      </td>
      <td className="px-4 py-3">
        <span 
          style={{ backgroundColor: config.bg, color: config.text }} 
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
        >
          <StatusIcon size={14} strokeWidth={2} />
          {config.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm">
          {execution.started_at ? new Date(execution.started_at).toLocaleString() : 'Not started'}
        </p>
      </td>
      <td className="px-4 py-3">
        <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">
          {execution.status === 'RUNNING' ? formatDuration(liveDuration) : 
           execution.status === 'PENDING' ? '--' : 
           formatDuration(execution.duration || calculateDuration())}
        </p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              // Open the HTML report in a new window
              const reportUrl = `http://localhost:8000/api/executions/${execution.id}/report`;
              window.open(reportUrl, '_blank', 'width=1400,height=900');
            }}
            disabled={execution.status === 'PENDING' || execution.status === 'RUNNING'}
            style={{
              backgroundColor: execution.status === 'PENDING' || execution.status === 'RUNNING' 
                ? 'rgb(var(--bg-secondary))' 
                : 'rgb(var(--bg-tertiary))',
              color: execution.status === 'PENDING' || execution.status === 'RUNNING'
                ? 'rgb(var(--text-tertiary))'
                : 'rgb(var(--text-secondary))',
              borderColor: 'rgb(var(--border-color))',
              cursor: execution.status === 'PENDING' || execution.status === 'RUNNING' ? 'not-allowed' : 'pointer',
              opacity: execution.status === 'PENDING' || execution.status === 'RUNNING' ? 0.5 : 1,
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border hover:scale-105 active:scale-95 disabled:hover:scale-100"
            onMouseEnter={(e) => {
              if (execution.status !== 'PENDING' && execution.status !== 'RUNNING') {
                e.currentTarget.style.backgroundColor = 'rgb(var(--brand))';
                e.currentTarget.style.color = 'white';
                e.currentTarget.style.borderColor = 'rgb(var(--brand))';
              }
            }}
            onMouseLeave={(e) => {
              if (execution.status !== 'PENDING' && execution.status !== 'RUNNING') {
                e.currentTarget.style.backgroundColor = 'rgb(var(--bg-tertiary))';
                e.currentTarget.style.color = 'rgb(var(--text-secondary))';
                e.currentTarget.style.borderColor = 'rgb(var(--border-color))';
              }
            }}
          >
            <Eye size={14} strokeWidth={2} />
            View
          </button>
          
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            style={{
              backgroundColor: 'rgb(var(--bg-tertiary))',
              color: 'rgb(var(--text-secondary))',
              borderColor: 'rgb(var(--border-color))',
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border hover:scale-105 active:scale-95 disabled:opacity-50"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#ef4444';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.borderColor = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgb(var(--bg-tertiary))';
              e.currentTarget.style.color = 'rgb(var(--text-secondary))';
              e.currentTarget.style.borderColor = 'rgb(var(--border-color))';
            }}
          >
            <Trash2 size={14} strokeWidth={2} />
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
