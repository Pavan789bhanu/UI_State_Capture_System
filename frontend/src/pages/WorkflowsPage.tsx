import { Play, Edit3, Trash2, Clock, TrendingUp, Plus, X, Search } from 'lucide-react';
import { useRipple } from '../hooks/useRipple';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type Workflow } from '../services/api';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  
  const { data: workflowsData, refetch } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      return await apiClient.getWorkflows();
    },
    enabled: isAuthenticated && !authLoading, // Only fetch when authenticated
  });

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
    <div className="p-6">
      <div className="mb-6 animate-fade-in-up">
        <h1 style={{ color: 'rgb(var(--text-primary))' }} className="text-2xl font-semibold">Workflows</h1>
        <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm mt-0.5">Manage and monitor your automation workflows</p>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search style={{ color: 'rgb(var(--text-secondary))' }} className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" strokeWidth={2} />
          <input
            type="text"
            placeholder="Search workflows by name, description..."
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredWorkflows.length > 0 ? (
          filteredWorkflows.map((workflow: Workflow, index: number) => (
            <div key={workflow.id} className="animate-scale-in" style={{ animationDelay: `${index * 0.1}s` }}>
              <WorkflowCard 
                workflow={workflow} 
                onRun={() => runWorkflowMutation.mutate(workflow.id)}
                onEdit={() => {
                  setSelectedWorkflow(workflow);
                  setShowEditModal(true);
                }}
                onDelete={() => {
                  if (confirm(`Are you sure you want to delete "${workflow.name}"?`)) {
                    deleteWorkflowMutation.mutate(workflow.id);
                  }
                }}
              />
            </div>
          ))
        ) : (
          <div className="col-span-3 text-center py-12">
            <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm mb-4">
              {searchQuery ? `No workflows found matching "${searchQuery}"` : 'No workflows yet. Create your first workflow to get started!'}
            </p>
            {!searchQuery && (
              <button onClick={() => setShowCreateModal(true)} className="btn-primary ripple-container">
                <Plus size={20} strokeWidth={2} className="mr-1.5" />
                Create Your First Workflow
              </button>
            )}
          </div>
        )}
      </div>

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
      <div className="card p-6 max-w-md w-full m-4 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-xl font-semibold">Edit Workflow</h2>
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
              placeholder="Describe the task"
              rows={3}
            />
          </div>

          <div>
            <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium mb-1">
              Status *
            </label>
            <select
              required
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'paused' })}
              className="w-full px-3 py-2 border rounded-lg"
              style={{ 
                borderColor: 'rgb(var(--border-color))',
                backgroundColor: 'rgb(var(--bg-primary))',
                color: 'rgb(var(--text-primary))'
              }}
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
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
              disabled={updateMutation.isPending}
              className="flex-1 btn-primary"
            >
              {updateMutation.isPending ? 'Updating...' : 'Update Workflow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
