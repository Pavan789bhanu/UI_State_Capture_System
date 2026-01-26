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

// Component-based architecture for better maintainability

export default function PlaygroundPage() {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [originalGeneratedSteps, setOriginalGeneratedSteps] = useState<WorkflowStep[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [executionResults, setExecutionResults] = useState<Map<number, StepResult>>(new Map());
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);
  const [pageState, setPageState] = useState<{ url: string; title: string } | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSavedWorkflowId, setLastSavedWorkflowId] = useState<string | null>(null);
  const [previewSteps, setPreviewSteps] = useState<WorkflowStep[]>([]);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [hasModifications, setHasModifications] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasRun, setHasRun] = useState(false); // Track if workflow has been executed
  const [showClearDialog, setShowClearDialog] = useState(false); // Professional clear confirmation
  const debounceTimerRef = useRef<number | null>(null);

  // Initialize browser on mount (headless mode)
  useEffect(() => {
    playgroundAPI.initializeBrowser(true).catch(console.error);
    
    return () => {
      // Cleanup on unmount
      playgroundAPI.cleanupBrowser().catch(console.error);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Debounced preview generation as user types
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (aiInput.trim().length > 10) {
      setIsGeneratingPreview(true);
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const workflow = await playgroundAPI.parseTask(aiInput);
          setPreviewSteps(workflow.steps);
        } catch (error) {
          console.error('Preview generation failed:', error);
        } finally {
          setIsGeneratingPreview(false);
        }
      }, 1000); // 1 second debounce
    } else {
      setPreviewSteps([]);
      setIsGeneratingPreview(false);
    }
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
        if (suggestionsResult.suggestions && suggestionsResult.suggestions.length > 0) {
          setSuggestions(suggestionsResult.suggestions);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.log('No suggestions available:', err);
      }
      
      // Auto-save workflow to database
      await autoSaveWorkflow(generatedSteps, aiInput);
      
      // Show warnings if any
      if (workflow.warnings && workflow.warnings.length > 0) {
        const warningMessage = workflow.warnings.join('\n');
        console.warn('Workflow warnings:', warningMessage);
      }
    } catch (error) {
      console.error('Failed to generate workflow:', error);
      alert('Failed to generate workflow. Please try again.');
    } finally {
      setIsGenerating(false);
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
      
      for (let i = 0; i < steps.length; i++) {
        setCurrentStep(i);
        
        const step = steps[i];
        const result = await playgroundAPI.executeStep(step);
        
        // Store result
        setExecutionResults(prev => new Map(prev).set(i, result.result));
        
        // Update screenshot
        if (result.result.screenshot) {
          setCurrentScreenshot(result.result.screenshot);
        }
        
        // Update page state
        try {
          const state = await playgroundAPI.getPageState();
          setPageState(state);
        } catch (err) {
          console.warn('Could not fetch page state:', err);
        }
        
        // Stop on error
        if (result.result.status === 'error') {
          alert(`Error at step ${i + 1}: ${result.result.message}`);
          break;
        }
        
        // Small delay between steps
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Execution failed:', error);
      alert(`Execution failed: ${error}`);
    } finally {
      setIsRunning(false);
      setCurrentStep(-1);
    }
  };

  const handleExecuteStep = async (index: number) => {
    const step = steps[index];
    
    try {
      // Ensure browser is initialized
      await playgroundAPI.initializeBrowser(true);
      
      setCurrentStep(index);
      const result = await playgroundAPI.executeStep(step);
      
      setExecutionResults(prev => new Map(prev).set(index, result.result));
      
      if (result.result.screenshot) {
        setCurrentScreenshot(result.result.screenshot);
      }
      
      try {
        const state = await playgroundAPI.getPageState();
        setPageState(state);
      } catch (err) {
        console.warn('Could not fetch page state:', err);
      }
      
    } catch (error) {
      console.error('Step execution failed:', error);
      alert(`Failed to execute step: ${error}`);
    } finally {
      setCurrentStep(-1);
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
    
    // Optionally cleanup and reinitialize browser
    try {
      await playgroundAPI.cleanupBrowser();
      await playgroundAPI.initializeBrowser(true);
    } catch (err) {
      console.warn('Browser reset warning:', err);
    }
  };

  const handleSaveWorkflow = async () => {
    if (!workflowName.trim()) {
      alert('Please enter a workflow name');
      return;
    }

    try {
      await playgroundAPI.saveWorkflow(workflowName, workflowDescription, steps);
      alert('Workflow saved successfully!');
      setShowSaveDialog(false);
      navigate('/workflows');
    } catch (error) {
      console.error('Failed to save workflow:', error);
      alert('Failed to save workflow');
    }
  };

  const handleSubmitFeedback = async (feedbackType: 'correction' | 'success' | 'failure') => {
    if (!aiInput || originalGeneratedSteps.length === 0) {
      alert('No workflow to provide feedback on');
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
      
      alert(result.message + '\n\nThank you for helping improve the AI! 🎉');
      setShowFeedbackDialog(false);
      setFeedbackNotes('');
      setHasModifications(false);
      
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }} className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ color: 'rgb(var(--text-primary))' }} className="text-2xl font-bold flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, rgb(var(--brand)) 0%, rgb(139 92 246) 100%)' }}>
                <Sparkles className="text-white" size={20} />
              </span>
              Workflow Playground
            </h1>
            <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm mt-1 ml-13">
              Build, test, and debug automation workflows in real-time
              {pageState && ` • ${pageState.title || pageState.url}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Clear All button - appears when there are steps */}
            {steps.length > 0 && (
              <button
                onClick={() => setShowClearDialog(true)}
                disabled={isRunning}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-orange-600 hover:bg-orange-50 border border-orange-200 hover:border-orange-300"
                title="Clear all steps and reset playground"
              >
                <Eraser size={18} />
                Clear
              </button>
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
              <div className="flex items-center gap-2 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                <Loader size={16} className="animate-spin" />
                Saving...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Workflow Builder */}
        <div style={{ backgroundColor: 'rgb(var(--bg-primary))', borderColor: 'rgb(var(--border-color))' }} className="w-1/2 border-r flex flex-col">
          {/* AI Input */}
          <div style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }} className="p-6 border-b">
            <div style={{ background: 'linear-gradient(135deg, rgb(59 130 246 / 0.1) 0%, rgb(139 92 246 / 0.1) 100%)', borderColor: 'rgb(var(--border-color))' }} className="rounded-xl p-4 border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-500 rounded-lg text-white shadow-sm">
                    <Sparkles size={16} />
                  </div>
                  <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-semibold">
                    AI Workflow Generator
                  </h2>
                </div>
                {(isGeneratingPreview || previewSteps.length > 0) && (
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
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
                  style={{ backgroundColor: 'rgb(var(--bg-primary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                  className="w-full p-3 pr-4 border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm placeholder:text-gray-400"
                  rows={4}
                />
                
                <div className="flex justify-between items-center mt-3">
                  <div className="flex gap-2 overflow-x-auto pb-1 max-w-[60%] no-scrollbar">
                    {['Create project in Linear', 'Login to GitHub', 'Search on Amazon', 'Fill contact form'].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setAiInput(suggestion)}
                        style={{ backgroundColor: 'rgb(var(--bg-primary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-secondary))' }}
                        className="text-[10px] px-2 py-1 rounded-full border hover:border-blue-400 hover:text-blue-500 transition-colors whitespace-nowrap"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  
                  <button
                    onClick={handleGenerateFromAI}
                    disabled={!aiInput.trim() || isGenerating}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }} className="p-4 border-b">
            <label style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-semibold block mb-3">
              Add Action
            </label>
            <div className="flex flex-wrap gap-2">
              {(['navigate', 'click', 'type', 'wait', 'select', 'extract'] as const).map((actionType) => (
                <button
                  key={actionType}
                  onClick={() => addStep(actionType)}
                  style={{ borderColor: 'rgb(var(--border-color))' }}
                  className="px-3 py-1.5 text-sm border rounded-lg hover-glow transition-all"
                >
                  <span style={{ color: 'rgb(var(--text-primary))' }} className="capitalize">{actionType}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Steps List */}
          <div className="flex-1 overflow-y-auto p-4">
            {steps.length > 0 && (
              <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)' }} className="mb-4 p-3 rounded-lg border">
                <p style={{ color: 'rgb(var(--text-primary))' }} className="text-xs font-medium flex items-center gap-2">
                  <span className="text-blue-500">💡</span>
                  Click any field below to edit it directly. Your changes help the AI learn!
                </p>
              </div>
            )}
            {steps.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }} className="w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Plus style={{ color: 'rgb(var(--text-secondary))' }} size={28} />
                </div>
                <p style={{ color: 'rgb(var(--text-primary))' }} className="font-medium mb-1">No steps yet</p>
                <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm text-center">
                  Use AI to generate a workflow or add actions manually
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

        {/* Right Panel - Preview */}
        <div style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }} className="w-1/2 flex flex-col border-l">
          <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'rgb(var(--border-color))' }}>
            <div>
              <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-lg font-semibold flex items-center gap-2">
                Live Preview
                {isRunning && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                )}
              </h2>
              <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm mt-1">
                Real-time browser automation view
              </p>
            </div>
            {pageState && (
              <div style={{ backgroundColor: 'rgb(34 197 94 / 0.1)', color: 'rgb(34 197 94)' }} className="flex items-center gap-2 px-2 py-1 rounded text-xs font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                Connected
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-hidden p-6 flex flex-col" style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }}>
            {/* Browser Window Chrome */}
            <div style={{ backgroundColor: 'rgb(var(--bg-primary))', borderColor: 'rgb(var(--border-color))' }} className="rounded-t-xl shadow-xl overflow-hidden border border-b-0 flex flex-col h-full">
              {/* Browser Toolbar */}
              <div style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }} className="border-b p-3 flex items-center gap-4">
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
                <div style={{ backgroundColor: 'rgb(var(--bg-tertiary))', borderColor: 'rgb(var(--border-color))' }} className="flex-1 rounded-md border px-3 py-1.5 flex items-center gap-2 text-sm">
                  <Lock size={12} className="text-green-500" />
                  <span style={{ color: 'rgb(var(--text-secondary))' }} className="truncate flex-1 font-mono text-xs">
                    {pageState?.url || 'about:blank'}
                  </span>
                </div>
              </div>

              {/* Browser Viewport */}
              <div style={{ backgroundColor: 'rgb(var(--bg-primary))' }} className="flex-1 relative overflow-auto">
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
                        <div style={{ backgroundColor: 'rgb(var(--bg-primary) / 0.95)', borderColor: 'rgb(var(--border-color))' }} className="border px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium">
                          <Loader className="animate-spin text-blue-500" size={16} />
                          <span style={{ color: 'rgb(var(--text-primary))' }}>Executing step {currentStep + 1}...</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : steps.length > 0 ? (
                  /* Show generated steps (live-synced with edits) */
                  <div className="h-full p-6 overflow-y-auto">
                    <div className="max-w-2xl mx-auto space-y-4">
                      <div className="text-center mb-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 mb-3">
                          <Check size={16} />
                          <span className="text-sm font-medium">Workflow Ready</span>
                        </div>
                        <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm">
                          {steps.length} steps configured • Click "Run All" to execute
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        {steps.map((step: any, index) => (
                          <div
                            key={step.id}
                            style={{ 
                              backgroundColor: executionResults.has(index) 
                                ? executionResults.get(index)?.status === 'success' ? '#10b98110' : '#ef444410'
                                : 'rgb(var(--bg-secondary))', 
                              borderColor: executionResults.has(index)
                                ? executionResults.get(index)?.status === 'success' ? '#10b981' : '#ef4444'
                                : 'rgb(var(--border-color))',
                            }}
                            className="border rounded-lg p-4 transition-all"
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
                                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#3b82f6' }}>
                                    {step.type}
                                  </span>
                                  {currentStep === index && isRunning && (
                                    <Loader size={12} className="animate-spin text-blue-500" />
                                  )}
                                </div>
                                <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">
                                  {step.description || `${step.type} action`}
                                </p>
                                {step.url && (
                                  <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs font-mono truncate">
                                    📍 {step.url}
                                  </p>
                                )}
                                {step.selector && (
                                  <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs font-mono truncate">
                                    🎯 {step.selector}
                                  </p>
                                )}
                                {step.value && (
                                  <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs font-mono truncate">
                                    ✏️ "{step.value}"
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {!hasRun && (
                        <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20">
                          <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Play size={16} className="text-green-500" />
                            Ready to run!
                          </p>
                          <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs">
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
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-3">
                          <Zap size={16} />
                          <span className="text-sm font-medium">Workflow Preview</span>
                        </div>
                        <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm">
                          {isGeneratingPreview ? 'Analyzing your task...' : `${previewSteps.length} automated steps`}
                        </p>
                      </div>
                      
                      {isGeneratingPreview ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <Loader className="animate-spin text-blue-500 mb-4" size={32} />
                          <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm">
                            Generating workflow steps...
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {previewSteps.map((step, index) => (
                            <div
                              key={index}
                              style={{ 
                                backgroundColor: 'rgb(var(--bg-secondary))', 
                                borderColor: 'rgb(var(--border-color))',
                                animationDelay: `${index * 50}ms`
                              }}
                              className="border rounded-lg p-4 hover:shadow-md transition-all animate-fade-in-up"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0">
                                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-600 flex items-center justify-center text-sm font-semibold">
                                    {index + 1}
                                  </div>
                                </div>
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-blue-600" style={{ color: '#3b82f6' }}>
                                      {step.type}
                                    </span>
                                  </div>
                                  <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">
                                    {step.description}
                                  </p>
                                  {step.url && (
                                    <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs font-mono truncate">
                                      {step.url}
                                    </p>
                                  )}
                                  {step.selector && (
                                    <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs font-mono">
                                      {step.selector}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                            <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium mb-2">
                              Ready to automate!
                            </p>
                            <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs">
                              Click "Generate" to create this workflow and save it to your Workflows page.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                    <div style={{ backgroundColor: 'rgb(var(--bg-secondary))' }} className="w-24 h-24 rounded-full flex items-center justify-center mb-6">
                      <Globe size={48} strokeWidth={1} style={{ color: 'rgb(var(--text-secondary))' }} />
                    </div>
                    <h3 style={{ color: 'rgb(var(--text-primary))' }} className="text-lg font-medium mb-2">
                      Ready to Browse
                    </h3>
                    <p style={{ color: 'rgb(var(--text-secondary))' }} className="max-w-xs mx-auto text-sm">
                      Start typing your task description to see a live preview of the workflow steps.
                    </p>
                  </div>
                )}
              </div>
              
              {/* Status Bar */}
              <div style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-secondary))' }} className="border-t px-3 py-1 text-xs flex justify-between items-center">
                <span>{pageState?.title || 'New Tab'}</span>
                <span>{currentScreenshot ? '1280 x 720' : 'No active session'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div style={{ backgroundColor: 'rgb(var(--bg-secondary))' }} className="rounded-xl p-6 max-w-md w-full mx-4">
            <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-xl font-bold mb-4">Save Workflow</h2>
            <div className="space-y-4">
              <div>
                <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium mb-2">
                  Workflow Name *
                </label>
                <input
                  type="text"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  placeholder="My Automation Workflow"
                  style={{ backgroundColor: 'rgb(var(--bg-primary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium mb-2">
                  Description
                </label>
                <textarea
                  value={workflowDescription}
                  onChange={(e) => setWorkflowDescription(e.target.value)}
                  placeholder="Describe what this workflow does..."
                  style={{ backgroundColor: 'rgb(var(--bg-primary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div style={{ backgroundColor: 'rgb(var(--bg-secondary))' }} className="rounded-xl p-6 max-w-lg w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white">
                <Lightbulb size={24} />
              </div>
              <div>
                <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-xl font-bold">Help AI Learn</h2>
                <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm">Your feedback helps improve workflow generation</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div style={{ backgroundColor: 'rgb(var(--bg-primary))', borderColor: 'rgb(var(--border-color))' }} className="p-4 border rounded-lg">
                <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm mb-2">You made <span className="font-bold text-purple-500">{steps.length - originalGeneratedSteps.length !== 0 ? Math.abs(steps.length - originalGeneratedSteps.length) : steps.filter((s, i) => JSON.stringify(s) !== JSON.stringify(originalGeneratedSteps[i])).length}</span> changes to the AI-generated workflow</p>
                <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs">By submitting feedback, you help the AI learn correct selectors, timeouts, and step sequences for this website.</p>
              </div>
              
              <div>
                <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  placeholder="E.g., 'Amazon needs longer timeouts', 'Search box selector was wrong', etc."
                  style={{ backgroundColor: 'rgb(var(--bg-primary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
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

      {/* Professional Clear Confirmation Dialog */}
      {showClearDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div 
            style={{ backgroundColor: 'rgb(var(--bg-secondary))' }} 
            className="rounded-2xl p-0 max-w-md w-full mx-4 shadow-2xl overflow-hidden animate-scale-in"
          >
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Eraser size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Clear Workspace</h2>
                  <p className="text-white/80 text-sm">This action cannot be undone</p>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-4">
              <div style={{ backgroundColor: 'rgb(var(--bg-primary))', borderColor: 'rgb(var(--border-color))' }} className="p-4 border rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Trash2 size={20} className="text-orange-600" />
                  </div>
                  <div>
                    <p style={{ color: 'rgb(var(--text-primary))' }} className="font-medium mb-1">
                      You're about to clear {steps.length} workflow step{steps.length !== 1 ? 's' : ''}
                    </p>
                    <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm">
                      All generated steps, AI input, and execution history will be permanently removed. The browser session will be reset.
                    </p>
                  </div>
                </div>
              </div>
              
              <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)' }} className="p-3 border rounded-lg">
                <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm flex items-center gap-2">
                  <Lightbulb size={16} className="text-blue-500" />
                  <span>Tip: Use <strong>Reset</strong> to keep your steps but clear execution results.</span>
                </p>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowClearDialog(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-medium transition-all border-2 hover:bg-gray-50"
                  style={{ borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-4 py-3 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  <Eraser size={18} />
                  Clear Everything
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suggestions Panel */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="fixed bottom-4 right-4 w-96 z-40">
          <div style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }} className="border-2 rounded-xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-3 flex items-center justify-between">
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
              <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm mb-3">
                Based on past user corrections for similar tasks:
              </p>
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  style={{ backgroundColor: 'rgb(var(--bg-primary))', borderColor: suggestion.priority === 'high' ? '#ef4444' : suggestion.priority === 'medium' ? '#f59e0b' : 'rgb(var(--border-color))' }}
                  className="p-3 border-2 rounded-lg"
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      suggestion.priority === 'high' ? 'bg-red-500' :
                      suggestion.priority === 'medium' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`} />
                    <div className="flex-1">
                      <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">
                        {suggestion.message}
                      </p>
                      {suggestion.frequency && (
                        <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mt-1">
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
    if (isActive) return '#3b82f6';
    return 'rgb(var(--text-secondary))';
  };

  const getStepBg = () => {
    if (isError) return '#ef444420';
    if (isCompleted) return '#10b98120';
    if (isActive) return '#3b82f620';
    return 'rgb(var(--bg-primary))';
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
        borderColor: isActive ? '#3b82f6' : isError ? '#ef4444' : 'rgb(var(--border-color))',
        zIndex: isDragging ? 1000 : 'auto',
      }}
      className={`border-2 rounded-xl p-4 hover-glow step-card ${isDragging ? 'shadow-2xl ring-2 ring-blue-400' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          
          <div
            {...attributes}
            {...listeners}
            className={`
              p-1 rounded-lg transition-all duration-200 
              ${isRunning ? 'cursor-not-allowed opacity-50' : 'cursor-grab hover:bg-gray-100 hover:scale-110 active:cursor-grabbing active:scale-95'}
              ${isDragging ? 'cursor-grabbing bg-blue-100' : ''}
            `}
            title="Drag to reorder"
            aria-label="Drag handle to reorder step"
          >
            <GripVertical 
              style={{ color: isDragging ? '#3b82f6' : 'rgb(var(--text-secondary))' }} 
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
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
              className="w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
              className="w-full px-3 py-2 border-2 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
              className="w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                  className="w-full px-3 py-2 border-2 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-400 transition-all duration-200 mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                className="w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
            style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-secondary))' }}
            className="w-full px-3 py-2 border-2 rounded-lg text-xs italic focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {result && (
            <div style={{ backgroundColor: isError ? '#ef444410' : '#10b98110' }} className="p-2 rounded text-xs">
              <p style={{ color: isError ? '#ef4444' : '#10b981' }} className="font-medium">
                {result.message}
              </p>
              {result.duration_ms && (
                <p style={{ color: 'rgb(var(--text-secondary))' }} className="mt-1">
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
