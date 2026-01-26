import { Play, Edit3, Trash2, Clock, TrendingUp, Plus, X, Search, AlertTriangle, LayoutGrid, List, Columns, RefreshCw, Zap } from 'lucide-react';
import { useRipple } from '../hooks/useRipple';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type Workflow } from '../services/api';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';

type ViewMode = 'grid' | 'list' | 'compact';

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('workflowViewMode') as ViewMode) || 'grid';
  });
  const { addNotification } = useNotifications();
  
  const { data: workflowsData, refetch, isFetching } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      return await apiClient.getWorkflows();
    },
    enabled: isAuthenticated && !authLoading, // Only fetch when authenticated
  });

  // Save view mode preference
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('workflowViewMode', mode);
  };

  const runWorkflowMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      return await apiClient.createExecution({ workflow_id: workflowId, headless: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['executions'] });
    },
  });

  const deleteWorkflowMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      return await apiClient.deleteWorkflow(workflowId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      addNotification({
        type: 'success',
        title: 'Workflow Deleted',
        message: `"${workflowToDelete?.name}" has been successfully deleted.`,
      });
      setWorkflowToDelete(null);
    },
    onError: () => {
      addNotification({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete the workflow. Please try again.',
      });
    },
  });

  // Listen for real-time updates
  useEffect(() => {
    const handleUpdate = () => {
      refetch();
    };

    apiClient.on('workflow_created', handleUpdate);
    apiClient.on('workflow_updated', handleUpdate);
    apiClient.on('workflow_deleted', handleUpdate);
    apiClient.on('execution_completed', handleUpdate);

    return () => {
      apiClient.off('workflow_created', handleUpdate);
      apiClient.off('workflow_updated', handleUpdate);
      apiClient.off('workflow_deleted', handleUpdate);
      apiClient.off('execution_completed', handleUpdate);
    };
  }, [refetch]);

  // Listen for create workflow event from header
  useEffect(() => {
    const handleCreateWorkflow = () => {
      setShowCreateModal(true);
    };

    window.addEventListener('create-workflow', handleCreateWorkflow);
    return () => window.removeEventListener('create-workflow', handleCreateWorkflow);
  }, []);

  const workflows = workflowsData?.workflows || [];
  
  // Filter workflows based on search query
  const filteredWorkflows = workflows.filter((workflow: Workflow) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      workflow.name?.toLowerCase().includes(query) ||
      workflow.description?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ color: 'rgb(var(--text-primary))' }} className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, rgb(var(--brand)) 0%, #8b5cf6 100%)' }}>
                <Zap className="text-white" size={18} />
              </div>
              Workflows
            </h1>
            <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm mt-1">
              Manage and monitor your automation workflows
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ 
                backgroundColor: 'rgb(var(--bg-tertiary))',
                color: 'rgb(var(--text-secondary))',
                border: '1px solid rgb(var(--border-color))'
              }}
            >
              <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={() => setShowCreateModal(true)} 
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
              style={{ background: 'linear-gradient(135deg, rgb(var(--brand)) 0%, #8b5cf6 100%)' }}
            >
              <Plus size={18} strokeWidth={2} />
              New Workflow
            </button>
          </div>
        </div>
      </div>

      {/* Search and View Controls */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Search Bar */}
        <div className="relative w-full sm:max-w-md">
          <Search style={{ color: 'rgb(var(--text-secondary))' }} className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4" strokeWidth={2} />
          <input
            type="text"
            placeholder="Search workflows by name, description..."
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

      {/* Workflow Count */}
      {filteredWorkflows.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <span 
            className="px-2.5 py-1 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: 'rgb(var(--bg-tertiary))', color: 'rgb(var(--text-secondary))' }}
          >
            {filteredWorkflows.length} workflow{filteredWorkflows.length !== 1 ? 's' : ''}
          </span>
          {searchQuery && (
            <span style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm">
              matching "{searchQuery}"
            </span>
          )}
        </div>
      )}

      {/* Workflows Display */}
      {filteredWorkflows.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkflows.map((workflow: Workflow, index: number) => (
              <div key={workflow.id} className="animate-scale-in" style={{ animationDelay: `${index * 0.05}s` }}>
                <WorkflowCard 
                  workflow={workflow} 
                  onRun={() => runWorkflowMutation.mutate(workflow.id)}
                  onEdit={() => {
                    setSelectedWorkflow(workflow);
                    setShowEditModal(true);
                  }}
                  onDelete={() => {
                    setWorkflowToDelete(workflow);
                    setShowDeleteDialog(true);
                  }}
                />
              </div>
            ))}
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-3">
            {filteredWorkflows.map((workflow: Workflow, index: number) => (
              <div key={workflow.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 0.03}s` }}>
                <WorkflowListItem 
                  workflow={workflow} 
                  onRun={() => runWorkflowMutation.mutate(workflow.id)}
                  onEdit={() => {
                    setSelectedWorkflow(workflow);
                    setShowEditModal(true);
                  }}
                  onDelete={() => {
                    setWorkflowToDelete(workflow);
                    setShowDeleteDialog(true);
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead style={{ borderColor: 'rgb(var(--border-color))' }} className="border-b">
                <tr>
                  <th style={{ color: 'rgb(var(--text-secondary))' }} className="text-left px-4 py-3 text-xs font-semibold uppercase">Name</th>
                  <th style={{ color: 'rgb(var(--text-secondary))' }} className="text-left px-4 py-3 text-xs font-semibold uppercase">Status</th>
                  <th style={{ color: 'rgb(var(--text-secondary))' }} className="text-left px-4 py-3 text-xs font-semibold uppercase hidden md:table-cell">Last Run</th>
                  <th style={{ color: 'rgb(var(--text-secondary))' }} className="text-left px-4 py-3 text-xs font-semibold uppercase hidden lg:table-cell">Success Rate</th>
                  <th style={{ color: 'rgb(var(--text-secondary))' }} className="text-right px-4 py-3 text-xs font-semibold uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkflows.map((workflow: Workflow) => (
                  <WorkflowTableRow 
                    key={workflow.id}
                    workflow={workflow} 
                    onRun={() => runWorkflowMutation.mutate(workflow.id)}
                    onEdit={() => {
                      setSelectedWorkflow(workflow);
                      setShowEditModal(true);
                    }}
                    onDelete={() => {
                      setWorkflowToDelete(workflow);
                      setShowDeleteDialog(true);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }}>
            <Zap size={36} style={{ color: 'rgb(var(--text-secondary))' }} />
          </div>
          <h3 style={{ color: 'rgb(var(--text-primary))' }} className="text-lg font-semibold mb-2">
            {searchQuery ? 'No matching workflows' : 'No workflows yet'}
          </h3>
          <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm mb-6 max-w-md mx-auto">
            {searchQuery 
              ? `No workflows found matching "${searchQuery}". Try a different search term.`
              : 'Create your first workflow to start automating your tasks.'}
          </p>
          {!searchQuery && (
            <button 
              onClick={() => setShowCreateModal(true)} 
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
              style={{ background: 'linear-gradient(135deg, rgb(var(--brand)) 0%, #8b5cf6 100%)' }}
            >
              <Plus size={20} strokeWidth={2} />
              Create Your First Workflow
            </button>
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateWorkflowModal onClose={() => setShowCreateModal(false)} />
      )}
      {showEditModal && selectedWorkflow && (
        <EditWorkflowModal 
          workflow={selectedWorkflow}
          onClose={() => {
            setShowEditModal(false);
            setSelectedWorkflow(null);
          }} 
        />
      )}
      
      {/* Professional Delete Confirmation Dialog */}
      {showDeleteDialog && workflowToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div 
            className="relative max-w-md w-full m-4 rounded-2xl overflow-hidden shadow-2xl animate-scale-in"
            style={{ backgroundColor: 'rgb(var(--bg-primary))' }}
          >
            {/* Header with gradient */}
            <div className="relative px-6 py-5 bg-gradient-to-r from-red-500 to-orange-500">
              <div className="absolute inset-0 bg-black/10" />
              <div className="relative flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <AlertTriangle className="w-6 h-6 text-white" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Delete Workflow</h2>
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
                  You are about to delete:
                </p>
                <p style={{ color: 'rgb(var(--text-primary))' }} className="font-semibold text-lg">
                  "{workflowToDelete.name}"
                </p>
                {workflowToDelete.execution_count && workflowToDelete.execution_count > 0 && (
                  <p className="text-sm text-amber-500 mt-2 flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    This workflow has {workflowToDelete.execution_count} execution(s)
                  </p>
                )}
              </div>
              
              <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm leading-relaxed">
                All associated data including execution history, logs, and configurations will be permanently removed from the system.
              </p>
            </div>
            
            {/* Actions */}
            <div 
              className="flex gap-3 p-6 pt-0"
            >
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setWorkflowToDelete(null);
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
                onClick={() => {
                  deleteWorkflowMutation.mutate(workflowToDelete.id);
                  setShowDeleteDialog(false);
                }}
                disabled={deleteWorkflowMutation.isPending}
                className="flex-1 px-4 py-2.5 rounded-xl font-medium text-white transition-all duration-200 hover:scale-105 active:scale-95 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/25 disabled:opacity-50 disabled:hover:scale-100"
              >
                {deleteWorkflowMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Deleting...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Trash2 size={16} strokeWidth={2} />
                    Delete Workflow
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

function WorkflowCard({ workflow, onRun, onEdit, onDelete }: { workflow: Workflow; onRun: () => void; onEdit: () => void; onDelete: () => void }) {
  const createRipple = useRipple();
  
  const successRate = (workflow.execution_count ?? 0) > 0 
    ? Math.round(((workflow.success_count ?? 0) / (workflow.execution_count ?? 1)) * 100)
    : 0;
  
  const lastRun = workflow.last_executed 
    ? new Date(workflow.last_executed).toLocaleString()
    : 'Never';
  
  return (
    <div className="card p-4 hover-glow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 style={{ color: 'rgb(var(--text-primary))' }} className="text-base font-semibold">{workflow.name}</h3>
          <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mt-1 line-clamp-2">{workflow.description}</p>
        </div>
        <span 
          style={{ 
            backgroundColor: workflow.status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgb(var(--bg-tertiary))',
            color: workflow.status === 'active' ? '#22c55e' : 'rgb(var(--text-secondary))'
          }} 
          className="px-2 py-1 rounded-md text-xs font-medium capitalize"
        >
          {workflow.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} style={{ color: 'rgb(var(--text-secondary))' }} strokeWidth={2} />
            <span style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs">Last Run</span>
          </div>
          <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">{lastRun}</p>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} style={{ color: 'rgb(var(--text-secondary))' }} strokeWidth={2} />
            <span style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs">Success</span>
          </div>
          <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">{successRate}%</p>
        </div>
      </div>

      <div style={{ borderColor: 'rgb(var(--border-color))' }} className="flex items-center gap-2 pt-4 border-t">
        <button 
          onClick={(e) => {
            createRipple(e);
            onRun();
          }} 
          style={{ backgroundColor: 'rgb(var(--brand))' }} 
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-all duration-200 ripple-container hover:scale-105 active:scale-95 shadow-sm hover:shadow-md"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--brand-hover))'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--brand))'}
        >
          <Play size={16} strokeWidth={2} />
          Run
        </button>
        <button 
          onClick={(e) => {
            createRipple(e);
            onEdit();
          }} 
          style={{ 
            backgroundColor: 'rgb(var(--bg-tertiary))', 
            color: 'rgb(var(--text-secondary))',
            borderColor: 'rgb(var(--border-color))'
          }} 
          className="p-2 rounded-lg transition-all duration-200 ripple-container hover:scale-105 active:scale-95 border"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgb(var(--border-color))';
            e.currentTarget.style.color = 'rgb(var(--text-primary))';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgb(var(--bg-tertiary))';
            e.currentTarget.style.color = 'rgb(var(--text-secondary))';
          }}
        >
          <Edit3 size={16} strokeWidth={2} />
        </button>
        <button 
          onClick={(e) => {
            createRipple(e);
            onDelete();
          }} 
          style={{ 
            backgroundColor: 'rgb(var(--bg-tertiary))', 
            color: 'rgb(var(--text-secondary))',
            borderColor: 'rgb(var(--border-color))'
          }} 
          className="p-2 rounded-lg transition-all duration-200 ripple-container hover:scale-105 active:scale-95 border"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            e.currentTarget.style.color = '#ef4444';
            e.currentTarget.style.borderColor = '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgb(var(--bg-tertiary))';
            e.currentTarget.style.color = 'rgb(var(--text-secondary))';
            e.currentTarget.style.borderColor = 'rgb(var(--border-color))';
          }}
        >
          <Trash2 size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// List View Item Component
function WorkflowListItem({ workflow, onRun, onEdit, onDelete }: { workflow: Workflow; onRun: () => void; onEdit: () => void; onDelete: () => void }) {
  const createRipple = useRipple();
  
  const successRate = (workflow.execution_count ?? 0) > 0 
    ? Math.round(((workflow.success_count ?? 0) / (workflow.execution_count ?? 1)) * 100)
    : 0;
  
  const lastRun = workflow.last_executed 
    ? new Date(workflow.last_executed).toLocaleString()
    : 'Never';
  
  return (
    <div className="card p-4 hover-glow">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {/* Main Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 style={{ color: 'rgb(var(--text-primary))' }} className="text-base font-semibold truncate">{workflow.name}</h3>
            <span 
              style={{ 
                backgroundColor: workflow.status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgb(var(--bg-tertiary))',
                color: workflow.status === 'active' ? '#22c55e' : 'rgb(var(--text-secondary))'
              }} 
              className="px-2 py-0.5 rounded-md text-xs font-medium capitalize shrink-0"
            >
              {workflow.status}
            </span>
          </div>
          <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm line-clamp-1">{workflow.description || 'No description'}</p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-center">
            <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mb-0.5">Last Run</p>
            <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium whitespace-nowrap">{lastRun}</p>
          </div>
          <div className="text-center">
            <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mb-0.5">Success</p>
            <p style={{ color: successRate >= 70 ? '#22c55e' : successRate >= 40 ? '#eab308' : '#ef4444' }} className="text-sm font-semibold">{successRate}%</p>
          </div>
          <div className="text-center">
            <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mb-0.5">Runs</p>
            <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">{workflow.execution_count ?? 0}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={(e) => {
              createRipple(e);
              onRun();
            }} 
            style={{ backgroundColor: 'rgb(var(--brand))' }} 
            className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-all duration-200 ripple-container hover:scale-105 active:scale-95 shadow-sm"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--brand-hover))'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--brand))'}
          >
            <Play size={14} strokeWidth={2} />
            Run
          </button>
          <button 
            onClick={(e) => {
              createRipple(e);
              onEdit();
            }} 
            style={{ 
              backgroundColor: 'rgb(var(--bg-tertiary))', 
              color: 'rgb(var(--text-secondary))',
              borderColor: 'rgb(var(--border-color))'
            }} 
            className="p-2 rounded-lg transition-all duration-200 ripple-container hover:scale-105 active:scale-95 border"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgb(var(--border-color))';
              e.currentTarget.style.color = 'rgb(var(--text-primary))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgb(var(--bg-tertiary))';
              e.currentTarget.style.color = 'rgb(var(--text-secondary))';
            }}
          >
            <Edit3 size={16} strokeWidth={2} />
          </button>
          <button 
            onClick={(e) => {
              createRipple(e);
              onDelete();
            }} 
            style={{ 
              backgroundColor: 'rgb(var(--bg-tertiary))', 
              color: 'rgb(var(--text-secondary))',
              borderColor: 'rgb(var(--border-color))'
            }} 
            className="p-2 rounded-lg transition-all duration-200 ripple-container hover:scale-105 active:scale-95 border"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.borderColor = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgb(var(--bg-tertiary))';
              e.currentTarget.style.color = 'rgb(var(--text-secondary))';
              e.currentTarget.style.borderColor = 'rgb(var(--border-color))';
            }}
          >
            <Trash2 size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Compact Table Row Component
function WorkflowTableRow({ workflow, onRun, onEdit, onDelete }: { workflow: Workflow; onRun: () => void; onEdit: () => void; onDelete: () => void }) {
  const successRate = (workflow.execution_count ?? 0) > 0 
    ? Math.round(((workflow.success_count ?? 0) / (workflow.execution_count ?? 1)) * 100)
    : 0;
  
  const lastRun = workflow.last_executed 
    ? new Date(workflow.last_executed).toLocaleDateString()
    : 'Never';
  
  return (
    <tr 
      style={{ borderColor: 'rgb(var(--border-color))' }} 
      className="border-b last:border-b-0 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }}>
            <Zap size={14} style={{ color: 'rgb(var(--brand))' }} />
          </div>
          <div className="min-w-0">
            <p style={{ color: 'rgb(var(--text-primary))' }} className="font-medium text-sm truncate">{workflow.name}</p>
            <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs truncate max-w-[200px]">{workflow.description || 'No description'}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span 
          style={{ 
            backgroundColor: workflow.status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgb(var(--bg-tertiary))',
            color: workflow.status === 'active' ? '#22c55e' : 'rgb(var(--text-secondary))'
          }} 
          className="px-2 py-1 rounded-md text-xs font-medium capitalize"
        >
          {workflow.status}
        </span>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm">{lastRun}</span>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }}>
            <div 
              className="h-full rounded-full transition-all duration-300"
              style={{ 
                width: `${successRate}%`,
                backgroundColor: successRate >= 70 ? '#22c55e' : successRate >= 40 ? '#eab308' : '#ef4444'
              }}
            />
          </div>
          <span style={{ color: successRate >= 70 ? '#22c55e' : successRate >= 40 ? '#eab308' : '#ef4444' }} className="text-sm font-medium">{successRate}%</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button 
            onClick={onRun}
            className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110"
            style={{ color: 'rgb(var(--brand))' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(var(--brand), 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title="Run workflow"
          >
            <Play size={16} strokeWidth={2} />
          </button>
          <button 
            onClick={onEdit}
            className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110"
            style={{ color: 'rgb(var(--text-secondary))' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgb(var(--bg-tertiary))';
              e.currentTarget.style.color = 'rgb(var(--text-primary))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'rgb(var(--text-secondary))';
            }}
            title="Edit workflow"
          >
            <Edit3 size={16} strokeWidth={2} />
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
            title="Delete workflow"
          >
            <Trash2 size={16} strokeWidth={2} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function CreateWorkflowModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    app_name: '',
    start_url: '',
    login_email: '',
    login_password: '',
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiClient.createWorkflow(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
      <div className="card p-6 max-w-md w-full m-4 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-xl font-semibold">Create Workflow</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} style={{ color: 'rgb(var(--text-secondary))' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              style={{ 
                borderColor: 'rgb(var(--border-color))',
                backgroundColor: 'rgb(var(--bg-primary))',
                color: 'rgb(var(--text-primary))'
              }}
              placeholder="Enter workflow name"
            />
          </div>

          <div>
            <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium mb-1">
              Description *
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              style={{ 
                borderColor: 'rgb(var(--border-color))',
                backgroundColor: 'rgb(var(--bg-primary))',
                color: 'rgb(var(--text-primary))'
              }}
              placeholder="Describe the task (e.g., 'Create a new project in ProjectApp')"
              rows={3}
            />
          </div>

          <div>
            <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium mb-1">
              App Name *
            </label>
            <input
              type="text"
              required
              value={formData.app_name}
              onChange={(e) => setFormData({ ...formData, app_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              style={{ 
                borderColor: 'rgb(var(--border-color))',
                backgroundColor: 'rgb(var(--bg-primary))',
                color: 'rgb(var(--text-primary))'
              }}
              placeholder="e.g., Asana, Jira, Notion"
            />
          </div>

          <div>
            <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium mb-1">
              Start URL (optional)
            </label>
            <input
              type="url"
              value={formData.start_url}
              onChange={(e) => setFormData({ ...formData, start_url: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              style={{ 
                borderColor: 'rgb(var(--border-color))',
                backgroundColor: 'rgb(var(--bg-primary))',
                color: 'rgb(var(--text-primary))'
              }}
              placeholder="https://..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg font-medium"
              style={{ 
                borderColor: 'rgb(var(--border-color))',
                color: 'rgb(var(--text-primary))'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 btn-primary"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Workflow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditWorkflowModal({ workflow, onClose }: { workflow: Workflow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: workflow.name,
    description: workflow.description,
    status: workflow.status,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiClient.updateWorkflow(workflow.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div 
        className="relative max-w-md w-full m-4 rounded-2xl overflow-hidden shadow-2xl animate-scale-in"
        style={{ backgroundColor: 'rgb(var(--bg-primary))' }}
      >
        {/* Header with gradient */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500">
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <Edit3 className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Edit Workflow</h2>
                <p className="text-sm text-white/80">Update workflow details</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={20} className="text-white" />
            </button>
          </div>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-semibold mb-2">
              Workflow Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              style={{ 
                borderColor: 'rgb(var(--border-color))',
                backgroundColor: 'rgb(var(--bg-secondary))',
                color: 'rgb(var(--text-primary))'
              }}
              placeholder="Enter workflow name"
            />
          </div>

          <div>
            <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-semibold mb-2">
              Description
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 border rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              style={{ 
                borderColor: 'rgb(var(--border-color))',
                backgroundColor: 'rgb(var(--bg-secondary))',
                color: 'rgb(var(--text-primary))'
              }}
              placeholder="Describe the workflow task"
              rows={3}
            />
          </div>

          <div>
            <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-semibold mb-2">
              Status
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, status: 'active' })}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all duration-200 font-medium ${
                  formData.status === 'active' 
                    ? 'border-green-500 bg-green-500/10 text-green-600' 
                    : 'border-transparent'
                }`}
                style={{ 
                  backgroundColor: formData.status === 'active' ? undefined : 'rgb(var(--bg-secondary))',
                  color: formData.status === 'active' ? undefined : 'rgb(var(--text-secondary))',
                  borderColor: formData.status === 'active' ? undefined : 'rgb(var(--border-color))'
                }}
              >
                <div className={`w-2 h-2 rounded-full ${formData.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                Active
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, status: 'paused' })}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all duration-200 font-medium ${
                  formData.status === 'paused' 
                    ? 'border-amber-500 bg-amber-500/10 text-amber-600' 
                    : 'border-transparent'
                }`}
                style={{ 
                  backgroundColor: formData.status === 'paused' ? undefined : 'rgb(var(--bg-secondary))',
                  color: formData.status === 'paused' ? undefined : 'rgb(var(--text-secondary))',
                  borderColor: formData.status === 'paused' ? undefined : 'rgb(var(--border-color))'
                }}
              >
                <div className={`w-2 h-2 rounded-full ${formData.status === 'paused' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                Paused
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
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
              type="submit"
              disabled={updateMutation.isPending}
              className="flex-1 px-4 py-2.5 rounded-xl font-medium text-white transition-all duration-200 hover:scale-105 active:scale-95 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:hover:scale-100"
            >
              {updateMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </span>
              ) : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
