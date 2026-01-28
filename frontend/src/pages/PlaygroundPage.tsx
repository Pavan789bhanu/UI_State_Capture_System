import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Play, RotateCcw, Sparkles, Plus, Trash2, GripVertical, Eye, Check, X, Loader, Globe, Lock, RefreshCw, ChevronLeft, ChevronRight, Zap, ArrowRight, ThumbsUp, Lightbulb, Eraser } from 'lucide-react';
import { playgroundAPI } from '../services/playgroundAPI';
import type { WorkflowStep, StepResult } from '../services/playgroundAPI';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePlayground } from '../contexts/PlaygroundContext';
import { useNotifications } from '../contexts/NotificationContext';

// Component-based architecture for better maintainability

export default function PlaygroundPage() {
  const navigate = useNavigate();
  
  // Use PlaygroundContext for persistent state across navigation
  const { 
    state: playgroundState,
    setSteps: setContextSteps,
    setOriginalGeneratedSteps: setContextOriginalSteps,
    setAiInput: setContextAiInput,
    setExecutionResults: setContextExecutionResults,
    setCurrentScreenshot: setContextScreenshot,
    setPageState: setContextPageState,
    setHasRun: setContextHasRun,
    setHasModifications: setContextHasModifications,
    setLastSavedWorkflowId: setContextLastSavedId,
    clearPlayground,
  } = usePlayground();
  
  const { addNotification } = useNotifications();
  
  // Local state derived from context for compatibility
  const [steps, setSteps] = useState<WorkflowStep[]>(playgroundState.steps);
  const [originalGeneratedSteps, setOriginalGeneratedSteps] = useState<WorkflowStep[]>(playgroundState.originalGeneratedSteps);
  const [aiInput, setAiInput] = useState(playgroundState.aiInput);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [executionResults, setExecutionResults] = useState<Map<number, StepResult>>(playgroundState.executionResults);
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(playgroundState.currentScreenshot);
  const [pageState, setPageState] = useState<{ url: string; title: string } | null>(playgroundState.pageState);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSavedWorkflowId, setLastSavedWorkflowId] = useState<string | null>(playgroundState.lastSavedWorkflowId);
  const [previewSteps, setPreviewSteps] = useState<WorkflowStep[]>([]);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [hasModifications, setHasModifications] = useState(playgroundState.hasModifications);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasRun, setHasRun] = useState(playgroundState.hasRun); // Track if workflow has been executed
  const [showClearDialog, setShowClearDialog] = useState(false); // Professional clear confirmation
  const debounceTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  
  // Use refs to track current state for syncing on unmount
  const stateRef = useRef({
    steps,
    originalGeneratedSteps,
    aiInput,
    executionResults,
    currentScreenshot,
    pageState,
    hasRun,
    hasModifications,
    lastSavedWorkflowId,
  });
  
  // Keep refs updated with current state
  useEffect(() => {
    stateRef.current = {
      steps,
      originalGeneratedSteps,
      aiInput,
      executionResults,
      currentScreenshot,
      pageState,
      hasRun,
      hasModifications,
      lastSavedWorkflowId,
    };
  });

  // Sync state to context only on unmount (when navigating away)
  useEffect(() => {
    return () => {
      // Sync final state to context when component unmounts
      const s = stateRef.current;
      setContextSteps(s.steps);
      setContextOriginalSteps(s.originalGeneratedSteps);
      setContextAiInput(s.aiInput);
      setContextExecutionResults(s.executionResults);
      setContextScreenshot(s.currentScreenshot);
      setContextPageState(s.pageState);
      setContextHasRun(s.hasRun);
      setContextHasModifications(s.hasModifications);
      setContextLastSavedId(s.lastSavedWorkflowId);
    };
  }, [
    setContextSteps, setContextOriginalSteps, setContextAiInput, setContextExecutionResults,
    setContextScreenshot, setContextPageState, setContextHasRun, setContextHasModifications, setContextLastSavedId
  ]);

  // Initialize browser on mount (headless mode)
  useEffect(() => {
    isMountedRef.current = true;
    
    // Initialize browser asynchronously without blocking
    playgroundAPI.initializeBrowser(true).catch((err) => {
      if (isMountedRef.current) {
        console.error('Browser initialization failed:', err);
      }
    });
    
    return () => {
      // Mark as unmounted first to prevent state updates
      isMountedRef.current = false;
      
      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Cleanup browser asynchronously - don't wait for it
      playgroundAPI.cleanupBrowser().catch(() => {
        // Silently ignore cleanup errors on unmount
      });
    };
  }, []);

  // Debounced preview generation as user types
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (aiInput.trim().length > 10) {
      setIsGeneratingPreview(true);
      debounceTimerRef.current = window.setTimeout(async () => {
        if (!isMountedRef.current) return;
        try {
          const workflow = await playgroundAPI.parseTask(aiInput);
          if (isMountedRef.current) {
            setPreviewSteps(workflow.steps);
          }
        } catch (error) {
          if (isMountedRef.current) {
            console.error('Preview generation failed:', error);
          }
        } finally {
          if (isMountedRef.current) {
            setIsGeneratingPreview(false);
          }
        }
      }, 1000); // 1 second debounce
    } else {
      setPreviewSteps([]);
      setIsGeneratingPreview(false);
    }
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [aiInput]);

  const handleGenerateFromAI = async () => {
    if (!aiInput.trim()) return;

    setIsGenerating(true);
    
    // Reset execution state for fresh generation
    setExecutionResults(new Map());
    setCurrentStep(-1);
    setCurrentScreenshot(null);
    setHasRun(false);
    
    try {
      const workflow = await playgroundAPI.parseTask(aiInput);
      if (!isMountedRef.current) return;
      
      const generatedSteps = workflow.steps.map((step, index) => ({
        id: `step-${Date.now()}-${index}`,
        ...step,
      })) as any[];

      setSteps(generatedSteps);
      setOriginalGeneratedSteps(JSON.parse(JSON.stringify(generatedSteps))); // Deep copy
      setHasModifications(false);
      
      // Get suggestions based on learning
      try {
        const firstNavigate = generatedSteps.find((s: any) => s.type === 'navigate');
        const url = firstNavigate?.url || '';
        const suggestionsResult = await playgroundAPI.getSuggestions(aiInput, url);
        if (isMountedRef.current && suggestionsResult.suggestions && suggestionsResult.suggestions.length > 0) {
          setSuggestions(suggestionsResult.suggestions);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.log('No suggestions available:', err);
      }
      
      // Auto-save workflow to database
      if (isMountedRef.current) {
        await autoSaveWorkflow(generatedSteps, aiInput);
      }
      
      // Show warnings if any
      if (workflow.warnings && workflow.warnings.length > 0) {
        const warningMessage = workflow.warnings.join('\n');
        console.warn('Workflow warnings:', warningMessage);
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Failed to generate workflow:', error);
      addNotification({
        type: 'error',
        title: 'Generation Failed',
        message: 'Failed to generate workflow from AI. Please check your description and try again.',
      });
    } finally {
      if (isMountedRef.current) {
        setIsGenerating(false);
      }
    }
  };

  const autoSaveWorkflow = async (workflowSteps: any[], taskDescription: string) => {
    setIsAutoSaving(true);
    try {
      // Generate smart workflow name from task description
      const workflowName = generateWorkflowName(taskDescription);
      const firstNavigateStep = workflowSteps.find(s => s.type === 'navigate');
      const startUrl = firstNavigateStep?.url || 'https://example.com';

      // Save to database via API
      const savedWorkflow = await apiClient.createWorkflow({
        name: workflowName,
        description: taskDescription,
        app_name: extractAppName(startUrl),
        start_url: startUrl,
      });

      setLastSavedWorkflowId(savedWorkflow.id);
      
      // Show success toast
      showSuccessToast(`Workflow "${workflowName}" saved successfully!`);
      
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setIsAutoSaving(false);
    }
  };

  const generateWorkflowName = (description: string): string => {
    // Extract key action words
    const cleanDesc = description.trim().slice(0, 50);
    const words = cleanDesc.split(' ');
    
    // Capitalize first letter of each word
    const titleCase = words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return titleCase || 'Automated Workflow';
  };

  const extractAppName = (url: string): string => {
    try {
      const hostname = new URL(url).hostname;
      const parts = hostname.split('.');
      const domain = parts.length > 2 ? parts[parts.length - 2] : parts[0];
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch {
      return 'Web App';
    }
  };

  const showSuccessToast = (message: string) => {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-up';
    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
        </svg>
        <span>${message}</span>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  };

  const addStep = (type: WorkflowStep['type']) => {
    const newStep: any = {
      id: `step-${Date.now()}`,
      type,
      description: `New ${type} action`,
    };

    setSteps(prevSteps => [...prevSteps, newStep]);
    setHasModifications(true);
  };

  const updateStep = useCallback((id: string, updates: Partial<WorkflowStep>) => {
    console.log('Updating step:', id, 'with:', updates);
    setSteps(prevSteps => {
      const newSteps = prevSteps.map((step: any) => 
        step.id === id ? { ...step, ...updates } : step
      );
      console.log('New steps:', newSteps);
      return newSteps;
    });
    setHasModifications(true);
  }, []);

  const removeStep = useCallback((id: string) => {
    setSteps(prevSteps => prevSteps.filter((step: any) => step.id !== id));
    setHasModifications(true);
  }, []);

  // @dnd-kit sensors for smooth drag experience
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to activate drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end event from @dnd-kit - memoized for performance
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSteps((items) => {
        const oldIndex = items.findIndex((item: any) => item.id === active.id);
        const newIndex = items.findIndex((item: any) => item.id === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
      setHasModifications(true);
    }
  }, []);

  const handleRunWorkflow = async () => {
    if (steps.length === 0) return;

    setIsRunning(true);
    setHasRun(true); // Mark that we've run the workflow
    setExecutionResults(new Map());
    setCurrentStep(0);

    try {
      // Ensure browser is initialized
      await playgroundAPI.initializeBrowser(true);
      if (!isMountedRef.current) return;
      
      for (let i = 0; i < steps.length; i++) {
        if (!isMountedRef.current) return;
        
        setCurrentStep(i);
        
        const step = steps[i];
        const result = await playgroundAPI.executeStep(step);
        if (!isMountedRef.current) return;
        
        // Store result
        setExecutionResults(prev => new Map(prev).set(i, result.result));
        
        // Update screenshot
        if (result.result.screenshot) {
          setCurrentScreenshot(result.result.screenshot);
        }
        
        // Update page state
        try {
          const state = await playgroundAPI.getPageState();
          if (isMountedRef.current) {
            setPageState(state);
          }
        } catch (err) {
          console.warn('Could not fetch page state:', err);
        }
        
        // Stop on error
        if (result.result.status === 'error') {
          if (isMountedRef.current) {
            addNotification({
              type: 'error',
              title: `Step ${i + 1} Failed`,
              message: result.result.message || 'An error occurred while executing this step.',
            });
          }
          break;
        }
        
        // Small delay between steps
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error('Execution failed:', error);
        addNotification({
          type: 'error',
          title: 'Execution Failed',
          message: `Workflow execution failed: ${error}`,
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsRunning(false);
        setCurrentStep(-1);
      }
    }
  };

  const handleExecuteStep = async (index: number) => {
    const step = steps[index];
    
    try {
      // Ensure browser is initialized
      await playgroundAPI.initializeBrowser(true);
      if (!isMountedRef.current) return;
      
      setCurrentStep(index);
      const result = await playgroundAPI.executeStep(step);
      if (!isMountedRef.current) return;
      
      setExecutionResults(prev => new Map(prev).set(index, result.result));
      
      if (result.result.screenshot) {
        setCurrentScreenshot(result.result.screenshot);
      }
      
      try {
        const state = await playgroundAPI.getPageState();
        if (isMountedRef.current) {
          setPageState(state);
        }
      } catch (err) {
        console.warn('Could not fetch page state:', err);
      }
      
    } catch (error) {
      if (isMountedRef.current) {
        console.error('Step execution failed:', error);
        addNotification({
          type: 'error',
          title: 'Step Execution Failed',
          message: `Failed to execute step: ${error}`,
        });
      }
    } finally {
      if (isMountedRef.current) {
        setCurrentStep(-1);
      }
    }
  };

  // Soft reset - clears execution state but keeps steps
  const handleReset = () => {
    setIsRunning(false);
    setCurrentStep(-1);
    setExecutionResults(new Map());
    setCurrentScreenshot(null);
    setHasRun(false);
    setPageState(null);
  };

  // Hard reset - clears everything for a fresh start
  const handleClearAll = async () => {
    setShowClearDialog(false);
    
    // Clear local state
    setSteps([]);
    setOriginalGeneratedSteps([]);
    setAiInput('');
    setPreviewSteps([]);
    setIsRunning(false);
    setCurrentStep(-1);
    setExecutionResults(new Map());
    setCurrentScreenshot(null);
    setPageState(null);
    setHasRun(false);
    setHasModifications(false);
    setLastSavedWorkflowId(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setFeedbackNotes('');
    
    // Also clear context state for full reset
    clearPlayground();
    
    // Optionally cleanup and reinitialize browser
    try {
      await playgroundAPI.cleanupBrowser();
      if (isMountedRef.current) {
        await playgroundAPI.initializeBrowser(true);
      }
    } catch (err) {
      console.warn('Browser reset warning:', err);
    }
  };

  const handleSaveWorkflow = async () => {
    if (!workflowName.trim()) {
      addNotification({
        type: 'warning',
        title: 'Missing Name',
        message: 'Please enter a workflow name before saving.',
      });
      return;
    }

    try {
      await playgroundAPI.saveWorkflow(workflowName, workflowDescription, steps);
      addNotification({
        type: 'success',
        title: 'Workflow Saved',
        message: `"${workflowName}" has been saved successfully!`,
      });
      setShowSaveDialog(false);
      navigate('/workflows');
    } catch (error) {
      console.error('Failed to save workflow:', error);
      addNotification({
        type: 'error',
        title: 'Save Failed',
        message: 'Failed to save workflow. Please try again.',
      });
    }
  };

  const handleSubmitFeedback = async (feedbackType: 'correction' | 'success' | 'failure') => {
    if (!aiInput || originalGeneratedSteps.length === 0) {
      addNotification({
        type: 'warning',
        title: 'No Workflow',
        message: 'No workflow available to provide feedback on.',
      });
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      const firstNavigate = steps.find(s => s.type === 'navigate');
      const url = firstNavigate?.url || pageState?.url || 'https://example.com';
      
      const result = await playgroundAPI.submitFeedback(
        aiInput,
        originalGeneratedSteps,
        steps,
        feedbackType,
        url,
        feedbackNotes
      );
      
      addNotification({
        type: 'success',
        title: 'Feedback Submitted',
        message: result.message + ' Thank you for helping improve the AI! 🎉',
      });
      setShowFeedbackDialog(false);
      setFeedbackNotes('');
      setHasModifications(false);
      
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      addNotification({
        type: 'error',
        title: 'Feedback Failed',
        message: 'Failed to submit feedback. Please try again.',
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden relative bg-[#0a0a0f]">
      {/* Animated background with mesh gradient - same as landing page */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/50 via-purple-950/30 to-[#0a0a0f]" />
        
        {/* Mesh gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
        
        {/* Animated orbs */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" 
          style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-[350px] h-[350px] bg-blue-500/8 rounded-full blur-[100px] animate-pulse" 
          style={{ animationDelay: '2s' }} />
        
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBtLTEgMGExIDEgMCAxIDAgMiAwIDEgMSAwIDEgMCAtMiAwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIi8+PC9nPjwvc3ZnPg==')] opacity-40" />
      </div>

      {/* Header */}
      <div className="relative z-30 border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-xl px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl flex items-center justify-center shadow-xl shadow-indigo-500/30" 
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
                <Sparkles className="text-white" size={22} />
              </span>
              <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Workflow Playground
              </span>
            </h1>
            <p className="text-gray-400 text-sm mt-1.5 ml-14">
              Build, test, and debug automation workflows in real-time
              {pageState && ` • ${pageState.title || pageState.url}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Clear All button - appears when there are steps */}
            {steps.length > 0 && (
              <div className="relative z-40">
                <button
                  onClick={() => setShowClearDialog(true)}
                  disabled={isRunning}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-orange-400 hover:bg-orange-500/10 border border-orange-500/30 hover:border-orange-500/50"
                  title="Clear all steps and reset playground"
                >
                  <Eraser size={18} />
                  Clear
                </button>
                
                {/* Inline Clear Confirmation Popover */}
                {showClearDialog && (
                  <div className="absolute top-full right-0 mt-2 w-72 z-[100] animate-scale-in">
                    <div className="bg-[#0a0a0f] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                      <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2">
                        <p className="text-white text-sm font-semibold flex items-center gap-2">
                          <Eraser size={14} />
                          Clear Workspace?
                        </p>
                      </div>
                      <div className="p-3">
                        <p className="text-gray-400 text-xs mb-2">
                          You're about to clear {steps.length} workflow step{steps.length !== 1 ? 's' : ''}
                        </p>
                        <p className="text-gray-500 text-xs mb-3">
                          All steps, AI input, and execution history will be removed.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowClearDialog(false)}
                            className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-white/10 text-white hover:bg-white/10 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleClearAll}
                            className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 transition-colors flex items-center justify-center gap-1"
                          >
                            <Eraser size={12} />
                            Clear All
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {hasModifications && originalGeneratedSteps.length > 0 && (
              <button
                onClick={() => setShowFeedbackDialog(true)}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-sm hover:shadow flex items-center gap-2"
                title="Help AI learn from your corrections"
              >
                <Lightbulb size={18} />
                Feedback
              </button>
            )}
            
            {/* Reset button - only shows after running */}
            {hasRun && (
              <button
                onClick={handleReset}
                disabled={isRunning}
                className="btn-secondary flex items-center gap-2"
                title="Reset execution state (keep steps)"
              >
                <RotateCcw size={18} />
                Reset
              </button>
            )}
            <button
              onClick={handleRunWorkflow}
              disabled={steps.length === 0 || isRunning}
              className="btn-primary flex items-center gap-2"
            >
              {isRunning ? (
                <>
                  <Loader size={18} className="animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play size={18} />
                  Run All
                </>
              )}
            </button>
            {lastSavedWorkflowId && (
              <button
                onClick={() => navigate('/workflows')}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-sm hover:shadow flex items-center gap-2"
              >
                <ArrowRight size={18} />
                Go to Workflows
              </button>
            )}
            {isAutoSaving && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader size={16} className="animate-spin" />
                Saving...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Full Page Layout */}
      <div className="relative z-10 flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 80px)' }}>
        {/* Left Panel - Workflow Builder (50% width - increased) */}
        <div className="w-1/2 border-r border-white/10 flex flex-col bg-[#0a0a0f]/80 backdrop-blur-xl">
          {/* AI Input */}
          <div className="p-5 border-b border-white/10 bg-white/5 flex-shrink-0">
            <div className="rounded-xl p-4 border border-white/10 bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg shadow-indigo-500/25">
                    <Sparkles size={18} />
                  </div>
                  <h2 className="text-base font-bold text-white">
                    AI Workflow Generator
                  </h2>
                </div>
                {(isGeneratingPreview || previewSteps.length > 0) && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    {isGeneratingPreview ? (
                      <>
                        <Loader size={12} className="animate-spin" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <Zap size={12} className="text-blue-500" />
                        <span>{previewSteps.length} steps ready</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              <div className="relative">
                <textarea
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Describe your automation task in plain English...&#10;&#10;Examples:\n• How do I create a project in Linear?\n• Login to GitHub and search for React repositories\n• Scrape product prices from Amazon\n• Fill out a form on example.com"
                  className="w-full p-3 pr-4 border border-white/10 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm placeholder:text-gray-500 bg-white/5 text-white"
                  rows={4}
                />
                
                <div className="flex justify-between items-center mt-3">
                  <div className="flex gap-2 overflow-x-auto pb-1 max-w-[60%] no-scrollbar">
                    {['Create project in Linear', 'Login to GitHub', 'Search on Amazon', 'Fill contact form'].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setAiInput(suggestion)}
                        className="text-[10px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-gray-400 hover:border-indigo-400 hover:text-indigo-400 transition-colors whitespace-nowrap"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  
                  <button
                    onClick={handleGenerateFromAI}
                    disabled={!aiInput.trim() || isGenerating}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-all shadow-lg shadow-indigo-500/25 hover:shadow flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <>
                        <Loader className="animate-spin" size={12} />
                        Thinking...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} />
                        Generate
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Palette */}
          <div className="p-4 border-b border-white/10 bg-white/5 flex-shrink-0">
            <label className="text-base font-bold block mb-3 text-white">
              Add Action
            </label>
            <div className="flex flex-wrap gap-2">
              {(['navigate', 'click', 'type', 'wait', 'select', 'extract'] as const).map((actionType) => (
                <button
                  key={actionType}
                  onClick={() => addStep(actionType)}
                  className="px-4 py-2 text-sm rounded-lg border border-white/10 bg-white/5 hover:bg-indigo-500/20 hover:border-indigo-500/50 transition-all duration-200 text-white capitalize font-medium"
                >
                  {actionType}
                </button>
              ))}
            </div>
          </div>

          {/* Steps List */}
          <div className="flex-1 overflow-y-auto p-4">
            {steps.length > 0 && (
              <div className="mb-4 p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10">
                <p className="text-xs font-medium flex items-center gap-2 text-white">
                  <span className="text-indigo-400">💡</span>
                  Click any field below to edit it directly. Your changes help the AI learn!
                </p>
              </div>
            )}
            {steps.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center mb-6">
                  <Plus className="text-indigo-400" size={36} />
                </div>
                <p className="font-semibold text-lg mb-2 text-white">No steps yet</p>
                <p className="text-base text-center max-w-xs text-gray-400">
                  Use AI to generate a workflow or add actions manually from the palette above
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={steps.map((step: any) => step.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {steps.map((step: any, index) => (
                      <StepCard
                        key={step.id}
                        step={step}
                        index={index}
                        isActive={currentStep === index}
                        isCompleted={executionResults.has(index) && executionResults.get(index)?.status === 'success'}
                        isError={executionResults.has(index) && executionResults.get(index)?.status === 'error'}
                        result={executionResults.get(index)}
                        onUpdate={(updates) => updateStep(step.id, updates)}
                        onRemove={() => removeStep(step.id)}
                        onExecute={() => handleExecuteStep(index)}
                        isRunning={currentStep === index}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* Right Panel - Live Browser Preview (50% width - reduced) */}
        <div className="w-1/2 flex flex-col bg-[#0a0a0f]/80 backdrop-blur-xl">
          <div className="p-4 border-b border-white/10 flex justify-between items-center flex-shrink-0 bg-white/5">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                Live Browser Preview
                {isRunning && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                )}
              </h2>
              <p className="text-sm mt-1 text-gray-400">
                Real-time browser automation view
              </p>
            </div>
            {pageState && (
              <div className="flex items-center gap-2 px-2 py-1 rounded text-xs font-medium bg-emerald-500/15 text-emerald-400">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                Connected
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-hidden p-4 flex flex-col bg-white/5">
            {/* Browser Window Chrome - Full Height */}
            <div className="rounded-xl shadow-2xl overflow-hidden border border-white/10 flex flex-col flex-1 bg-[#0a0a0f]">
              {/* Browser Toolbar */}
              <div className="border-b border-white/10 p-3 flex items-center gap-4 bg-white/5">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                
                <div className="flex gap-2 text-gray-400">
                  <ChevronLeft size={16} />
                  <ChevronRight size={16} />
                  <RefreshCw size={16} className={isRunning ? "animate-spin" : ""} />
                </div>

                {/* Address Bar */}
                <div className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 flex items-center gap-2 text-sm">
                  <Lock size={12} className="text-green-500" />
                  <span className="truncate flex-1 font-mono text-xs text-gray-400">
                    {pageState?.url || 'about:blank'}
                  </span>
                </div>
              </div>

              {/* Browser Viewport */}
              <div className="flex-1 relative overflow-auto bg-[#0a0a0f]">
                {/* Show live screenshot when running or after run */}
                {currentScreenshot && hasRun ? (
                  <div className="relative min-h-full">
                    <img 
                      src={`data:image/png;base64,${currentScreenshot}`}
                      alt="Browser screenshot"
                      className="w-full h-auto block"
                    />
                    {/* Overlay for loading state */}
                    {isRunning && (
                      <div className="absolute inset-0 bg-black/5 backdrop-blur-[1px] flex items-center justify-center transition-all duration-300">
                        <div className="border border-white/10 bg-[#0a0a0f]/95 px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium">
                          <Loader className="animate-spin text-indigo-500" size={16} />
                          <span className="text-white">Executing step {currentStep + 1}...</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : steps.length > 0 ? (
                  /* Show generated steps (live-synced with edits) */
                  <div className="h-full p-6 overflow-y-auto">
                    <div className="max-w-2xl mx-auto space-y-4">
                      <div className="text-center mb-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/15 text-emerald-400 mb-3">
                          <Check size={16} />
                          <span className="text-sm font-medium">Workflow Ready</span>
                        </div>
                        <p className="text-sm text-gray-400">
                          {steps.length} steps configured • Click "Run All" to execute
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        {steps.map((step: any, index) => (
                          <div
                            key={step.id}
                            className={`border rounded-xl p-4 transition-all ${
                              executionResults.has(index)
                                ? executionResults.get(index)?.status === 'success' 
                                  ? 'bg-emerald-500/10 border-emerald-500/30' 
                                  : 'bg-red-500/10 border-red-500/30'
                                : 'bg-white/5 border-white/10'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0">
                                <div 
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold"
                                  style={{
                                    backgroundColor: executionResults.has(index)
                                      ? executionResults.get(index)?.status === 'success' ? '#10b98130' : '#ef444430'
                                      : 'rgba(59, 130, 246, 0.2)',
                                    color: executionResults.has(index)
                                      ? executionResults.get(index)?.status === 'success' ? '#10b981' : '#ef4444'
                                      : '#3b82f6'
                                  }}
                                >
                                  {executionResults.has(index) ? (
                                    executionResults.get(index)?.status === 'success' ? <Check size={16} /> : <X size={16} />
                                  ) : (
                                    index + 1
                                  )}
                                </div>
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-indigo-400">
                                    {step.type}
                                  </span>
                                  {currentStep === index && isRunning && (
                                    <Loader size={12} className="animate-spin text-indigo-500" />
                                  )}
                                </div>
                                <p className="text-sm font-medium text-white">
                                  {step.description || `${step.type} action`}
                                </p>
                                {step.url && (
                                  <p className="text-xs font-mono truncate text-gray-400">
                                    📍 {step.url}
                                  </p>
                                )}
                                {step.selector && (
                                  <p className="text-xs font-mono truncate text-gray-400">
                                    🎯 {step.selector}
                                  </p>
                                )}
                                {step.value && (
                                  <p className="text-xs font-mono truncate text-gray-400">
                                    ✏️ "{step.value}"
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {!hasRun && (
                        <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-indigo-500/10 border border-emerald-500/20">
                          <p className="text-sm font-medium mb-2 flex items-center gap-2 text-white">
                            <Play size={16} className="text-emerald-400" />
                            Ready to run!
                          </p>
                          <p className="text-xs text-gray-400">
                            Edit any step on the left panel - changes sync here instantly. Click "Run All" to start automation.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : previewSteps.length > 0 || isGeneratingPreview ? (
                  /* Show AI preview while typing */
                  <div className="h-full p-6 overflow-y-auto">
                    <div className="max-w-2xl mx-auto space-y-4">
                      <div className="text-center mb-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/15 text-indigo-400 mb-3">
                          <Zap size={16} />
                          <span className="text-sm font-medium">Workflow Preview</span>
                        </div>
                        <p className="text-sm text-gray-400">
                          {isGeneratingPreview ? 'Analyzing your task...' : `${previewSteps.length} automated steps`}
                        </p>
                      </div>
                      
                      {isGeneratingPreview ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <Loader className="animate-spin text-indigo-500 mb-4" size={32} />
                          <p className="text-sm text-gray-400">
                            Generating workflow steps...
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {previewSteps.map((step, index) => (
                            <div
                              key={index}
                              className="border border-white/10 bg-white/5 rounded-xl p-4 hover:bg-white/10 transition-all animate-fade-in-up"
                              style={{ animationDelay: `${index * 50}ms` }}
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0">
                                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-semibold">
                                    {index + 1}
                                  </div>
                                </div>
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-indigo-400">
                                      {step.type}
                                    </span>
                                  </div>
                                  <p className="text-sm font-medium text-white">
                                    {step.description}
                                  </p>
                                  {step.url && (
                                    <p className="text-xs font-mono truncate text-gray-400">
                                      {step.url}
                                    </p>
                                  )}
                                  {step.selector && (
                                    <p className="text-xs font-mono text-gray-400">
                                      {step.selector}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
                            <p className="text-sm font-medium mb-2 text-white">
                              Ready to automate!
                            </p>
                            <p className="text-xs text-gray-400">
                              Click "Generate" to create this workflow and save it to your Workflows page.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 bg-white/5 border border-white/10">
                      <Globe size={48} strokeWidth={1} className="text-gray-500" />
                    </div>
                    <h3 className="text-lg font-medium mb-2 text-white">
                      Ready to Browse
                    </h3>
                    <p className="max-w-xs mx-auto text-sm text-gray-400">
                      Start typing your task description to see a live preview of the workflow steps.
                    </p>
                  </div>
                )}
              </div>
              
              {/* Status Bar */}
              <div className="border-t border-white/10 bg-white/5 px-3 py-1 text-xs flex justify-between items-center text-gray-400">
                <span>{pageState?.title || 'New Tab'}</span>
                <span>{currentScreenshot ? '1280 x 720' : 'No active session'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="rounded-2xl border border-white/10 bg-[#0a0a0f] p-6 max-w-md w-full mx-4 shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-white">Save Workflow</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Workflow Name *
                </label>
                <input
                  type="text"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  placeholder="My Automation Workflow"
                  className="w-full px-4 py-3 border border-white/10 rounded-xl bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Description
                </label>
                <textarea
                  value={workflowDescription}
                  onChange={(e) => setWorkflowDescription(e.target.value)}
                  placeholder="Describe what this workflow does..."
                  className="w-full px-4 py-3 border border-white/10 rounded-xl bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveWorkflow}
                  className="btn-primary flex-1"
                >
                  Save Workflow
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Dialog */}
      {showFeedbackDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="rounded-2xl border border-white/10 bg-[#0a0a0f] p-6 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white shadow-lg shadow-purple-500/25">
                <Lightbulb size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Help AI Learn</h2>
                <p className="text-sm text-gray-400">Your feedback helps improve workflow generation</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 border border-white/10 rounded-xl bg-white/5">
                <p className="text-sm mb-2 text-gray-300">You made <span className="font-bold text-purple-400">{steps.length - originalGeneratedSteps.length !== 0 ? Math.abs(steps.length - originalGeneratedSteps.length) : steps.filter((s, i) => JSON.stringify(s) !== JSON.stringify(originalGeneratedSteps[i])).length}</span> changes to the AI-generated workflow</p>
                <p className="text-xs text-gray-500">By submitting feedback, you help the AI learn correct selectors, timeouts, and step sequences for this website.</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  placeholder="E.g., 'Amazon needs longer timeouts', 'Search box selector was wrong', etc."
                  className="w-full px-4 py-3 border border-white/10 rounded-xl bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  rows={3}
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowFeedbackDialog(false)}
                  className="btn-secondary flex-1"
                  disabled={isSubmittingFeedback}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSubmitFeedback('correction')}
                  disabled={isSubmittingFeedback}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmittingFeedback ? (
                    <>
                      <Loader size={18} className="animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <ThumbsUp size={18} />
                      Submit Feedback
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suggestions Panel */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="fixed bottom-4 right-4 w-96 z-40">
          <div className="border border-white/10 rounded-2xl shadow-2xl overflow-hidden bg-[#0a0a0f]">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Lightbulb size={18} />
                <span className="font-semibold">AI Suggestions</span>
              </div>
              <button
                onClick={() => setShowSuggestions(false)}
                className="text-white hover:bg-white/20 rounded p-1 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              <p className="text-sm mb-3 text-gray-400">
                Based on past user corrections for similar tasks:
              </p>
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={`p-3 border rounded-xl bg-white/5 ${
                    suggestion.priority === 'high' ? 'border-red-500/50' : 
                    suggestion.priority === 'medium' ? 'border-amber-500/50' : 'border-white/10'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      suggestion.priority === 'high' ? 'bg-red-500' :
                      suggestion.priority === 'medium' ? 'bg-yellow-500' :
                      'bg-indigo-500'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">
                        {suggestion.message}
                      </p>
                      {suggestion.frequency && (
                        <p className="text-xs mt-1 text-gray-400">
                          Learned from {suggestion.frequency} correction{suggestion.frequency > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Step Card Component
interface StepCardProps {
  step: any;
  index: number;
  isActive: boolean;
  isCompleted: boolean;
  isError: boolean;
  result?: StepResult;
  onUpdate: (updates: Partial<WorkflowStep>) => void;
  onRemove: () => void;
  onExecute: () => void;
  isRunning: boolean;
}

const StepCard = memo(function StepCard({ step, index, isActive, isCompleted, isError, result, onUpdate, onRemove, onExecute, isRunning }: StepCardProps) {
  // Debug: Log when component renders
  console.log('StepCard render:', step.id, 'url:', step.url, 'description:', step.description);
  
  // Wrapper to ensure onUpdate is called properly
  const handleUpdate = (updates: Partial<WorkflowStep>) => {
    console.log('StepCard handleUpdate called with:', updates);
    onUpdate(updates);
  };

  // Wrapper for onRemove
  const handleRemove = () => {
    console.log('StepCard handleRemove called for step:', step.id);
    onRemove();
  };

  // Use @dnd-kit's useSortable hook
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id, disabled: isRunning });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getStepColor = () => {
    if (isError) return '#ef4444';
    if (isCompleted) return '#10b981';
    if (isActive) return '#6366f1';
    return '#9ca3af';
  };

  const getStepBg = () => {
    if (isError) return 'rgba(239, 68, 68, 0.1)';
    if (isCompleted) return 'rgba(16, 185, 129, 0.1)';
    if (isActive) return 'rgba(99, 102, 241, 0.1)';
    return 'rgba(255, 255, 255, 0.05)';
  };

  const getStatusIcon = () => {
    if (isRunning) return <Loader size={16} className="animate-spin" style={{ color: getStepColor() }} />;
    if (isError) return <X size={16} style={{ color: '#ef4444' }} />;
    if (isCompleted) return <Check size={16} style={{ color: '#10b981' }} />;
    return null;
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: getStepBg(),
        borderColor: isActive ? '#6366f1' : isError ? '#ef4444' : 'rgba(255,255,255,0.1)',
        zIndex: isDragging ? 1000 : 'auto',
      }}
      className={`border rounded-2xl p-4 hover-glow step-card ${isDragging ? 'shadow-2xl ring-2 ring-indigo-400' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          
          <div
            {...attributes}
            {...listeners}
            className={`
              p-1 rounded-lg transition-all duration-200 
              ${isRunning ? 'cursor-not-allowed opacity-50' : 'cursor-grab hover:bg-white/10 hover:scale-110 active:cursor-grabbing active:scale-95'}
              ${isDragging ? 'cursor-grabbing bg-indigo-500/20' : ''}
            `}
            title="Drag to reorder"
            aria-label="Drag handle to reorder step"
          >
            <GripVertical 
              className={isDragging ? 'text-indigo-400' : 'text-gray-400'}
              size={20}
            />
          </div>
          <div
            style={{ backgroundColor: getStepColor() + '30', color: getStepColor() }}
            className="w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-sm"
          >
            {index + 1}
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span style={{ color: getStepColor() }} className="text-xs font-semibold uppercase tracking-wide">
                {step.type}
              </span>
              {getStatusIcon()}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExecute();
              }}
              disabled={isRunning}
              style={{ color: '#0ea5e9' }}
              className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
              title="Test this step"
            >
              <Eye size={16} />
            </button>
          </div>

          
          {step.type === 'navigate' && (
            <input
              type="url"
              value={step.url ?? ''}
              onChange={(e) => handleUpdate({ url: e.target.value })}
              onFocus={(e) => e.target.select()}
              placeholder="https://example.com"
              autoComplete="off"
              readOnly={false}
              disabled={isRunning}
              className="w-full px-3 py-2 border border-white/10 bg-white/5 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-400/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-500"
            />
          )}

          {(step.type === 'click' || step.type === 'type' || step.type === 'select' || step.type === 'extract') && (
            <input
              type="text"
              value={step.selector ?? ''}
              onChange={(e) => handleUpdate({ selector: e.target.value })}
              onFocus={(e) => e.target.select()}
              placeholder="CSS selector or XPath"
              autoComplete="off"
              spellCheck={false}
              readOnly={false}
              disabled={isRunning}
              className="w-full px-3 py-2 border border-white/10 bg-white/5 text-white rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-400/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-500"
            />
          )}

          {(step.type === 'type' || step.type === 'select') && (
            <input
              type="text"
              value={step.value ?? ''}
              onChange={(e) => handleUpdate({ value: e.target.value })}
              onFocus={(e) => e.target.select()}
              placeholder="Value to enter"
              autoComplete="off"
              readOnly={false}
              disabled={isRunning}
              className="w-full px-3 py-2 border border-white/10 bg-white/5 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-400/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-500"
            />
          )}

          {step.type === 'wait' && (
            <>
              {step.selector && (
                <input
                  type="text"
                  value={step.selector ?? ''}
                  onChange={(e) => handleUpdate({ selector: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  placeholder="CSS selector (optional - wait for element)"
                  autoComplete="off"
                  spellCheck={false}
                  readOnly={false}
                  disabled={isRunning}
                  className="w-full px-3 py-2 border border-white/10 bg-white/5 text-white rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-400/50 transition-all duration-200 mb-2 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-500"
                />
              )}
              <input
                type="number"
                value={step.timeout ?? 5000}
                onChange={(e) => handleUpdate({ timeout: parseInt(e.target.value) || 5000 })}
                onFocus={(e) => e.target.select()}
                placeholder="Timeout (ms)"
                min="100"
                step="1000"
                readOnly={false}
                disabled={isRunning}
                className="w-full px-3 py-2 border border-white/10 bg-white/5 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-400/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-500"
              />
            </>
          )}

          {/* Description field - always editable */}
          <input
            type="text"
            value={step.description ?? ''}
            onChange={(e) => handleUpdate({ description: e.target.value })}
            onFocus={(e) => e.target.select()}
            placeholder="Add a description..."
            autoComplete="off"
            readOnly={false}
            disabled={isRunning}
            className="w-full px-3 py-2 border border-white/10 bg-white/5 text-gray-400 rounded-xl text-xs italic focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-400/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-600"
          />

          {result && (
            <div className={`p-2 rounded-xl text-xs ${isError ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
              <p className={`font-medium ${isError ? 'text-red-400' : 'text-emerald-400'}`}>
                {result.message}
              </p>
              {result.duration_ms && (
                <p className="mt-1 text-gray-400">
                  Duration: {result.duration_ms}ms
                </p>
              )}
            </div>
          )}
        </div>

       
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isRunning) {
              handleRemove();
            }
          }}
          disabled={isRunning}
          className="p-2 rounded-lg transition-all duration-200 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-100 hover:scale-110 active:scale-95 group"
          title="Delete this step"
          aria-label="Delete step"
        >
          <Trash2 
            size={18} 
            className="text-red-500 group-hover:text-red-600 transition-colors"
          />
        </button>
      </div>
    </div>
  );
});
