import { useState, useEffect, useRef, memo } from 'react';
import { Play, RotateCcw, Sparkles, Plus, Trash2, GripVertical, Eye, Check, X, Loader, Globe, Lock, RefreshCw, ChevronLeft, ChevronRight, Zap, ArrowRight, ThumbsUp, Lightbulb } from 'lucide-react';
import { playgroundAPI } from '../services/playgroundAPI';
import type { WorkflowStep, StepResult } from '../services/playgroundAPI';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

//lets do this in compoonent based architecture

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

  const updateStep = (id: string, updates: Partial<WorkflowStep>) => {
    console.log('Updating step:', id, 'with:', updates);
    setSteps(prevSteps => {
      const newSteps = prevSteps.map((step: any) => 
        step.id === id ? { ...step, ...updates } : step
      );
      console.log('New steps:', newSteps);
      return newSteps;
    });
    setHasModifications(true);
  };

  const removeStep = (id: string) => {
    setSteps(prevSteps => prevSteps.filter((step: any) => step.id !== id));
    setHasModifications(true);
  };

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

  // Handle drag end event from @dnd-kit
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSteps((items) => {
        const oldIndex = items.findIndex((item: any) => item.id === active.id);
        const newIndex = items.findIndex((item: any) => item.id === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
      setHasModifications(true);
    }
  };

  const handleRunWorkflow = async () => {
    if (steps.length === 0) return;

    setIsRunning(true);
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

  const handleReset = () => {
    setIsRunning(false);
    setCurrentStep(-1);
    setExecutionResults(new Map());
    setCurrentScreenshot(null);
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
            <h1 style={{ color: 'rgb(var(--text-primary))' }} className="text-2xl font-bold">Workflow Playground</h1>
            <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm mt-1">
              Build, test, and debug workflows in real-time
              {pageState && ` • ${pageState.title || pageState.url}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasModifications && originalGeneratedSteps.length > 0 && (
              <button
                onClick={() => setShowFeedbackDialog(true)}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-sm hover:shadow flex items-center gap-2"
                title="Help AI learn from your corrections"
              >
                <Lightbulb size={18} />
                Submit Feedback
              </button>
            )}
            <button
              onClick={handleReset}
              disabled={!isRunning && currentStep === -1 && executionResults.size === 0}
              className="btn-secondary flex items-center gap-2"
            >
              <RotateCcw size={18} />
              Reset
            </button>
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
                {currentScreenshot ? (
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
                ) : previewSteps.length > 0 || isGeneratingPreview ? (
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
      }}
      className="border-2 rounded-xl p-4 hover-glow step-card"
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div
            {...attributes}
            {...listeners}
            className="drag-handle transition-all duration-200 touch-none hover:cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
            style={{ 
              cursor: isRunning ? 'not-allowed' : 'grab',
            }}
          >
            <GripVertical 
              style={{ color: 'rgb(var(--text-secondary))' }} 
              size={20}
              className="transition-all duration-200 hover:scale-110" 
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
              onClick={onExecute}
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
              onChange={(e) => {
                onUpdate({ url: e.target.value });
              }}
              placeholder="https://example.com"
              autoComplete="off"
              disabled={isRunning}
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
              className="w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-all duration-200 cursor-text disabled:opacity-50 disabled:cursor-not-allowed"
            />
          )}

          {(step.type === 'click' || step.type === 'type' || step.type === 'select' || step.type === 'extract') && (
            <input
              type="text"
              value={step.selector ?? ''}
              onChange={(e) => {
                onUpdate({ selector: e.target.value });
              }}
              placeholder="CSS selector or XPath"
              autoComplete="off"
              spellCheck="false"
              disabled={isRunning}
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
              className="w-full px-3 py-2 border-2 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-all duration-200 cursor-text disabled:opacity-50 disabled:cursor-not-allowed"
            />
          )}

          {(step.type === 'type' || step.type === 'select') && (
            <input
              type="text"
              value={step.value ?? ''}
              onChange={(e) => {
                onUpdate({ value: e.target.value });
              }}
              placeholder="Value to enter"
              autoComplete="off"
              disabled={isRunning}
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
              className="w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-all duration-200 cursor-text disabled:opacity-50 disabled:cursor-not-allowed"
            />
          )}

          {step.type === 'wait' && (
            <>
              {step.selector && (
                <input
                  type="text"
                  value={step.selector ?? ''}
                  onChange={(e) => {
                    onUpdate({ selector: e.target.value });
                  }}
                  placeholder="CSS selector (optional - wait for element)"
                  autoComplete="off"
                  spellCheck="false"
                  disabled={isRunning}
                  style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                  className="w-full px-3 py-2 border-2 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-all duration-200 cursor-text mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              )}
              <input
                type="number"
                value={step.timeout ?? 5000}
                onChange={(e) => {
                  onUpdate({ timeout: parseInt(e.target.value) || 5000 });
                }}
                placeholder="Timeout (ms)"
                min="100"
                step="1000"
                disabled={isRunning}
                style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                className="w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-all duration-200 cursor-text disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </>
          )}

          <input
            type="text"
            value={step.description ?? ''}
            onChange={(e) => {
              onUpdate({ description: e.target.value });
            }}
            placeholder="Description"
            autoComplete="off"
            disabled={isRunning}
            style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-secondary))' }}
            className="w-full px-3 py-2 border-2 rounded-lg text-xs italic focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-all duration-200 cursor-text disabled:opacity-50 disabled:cursor-not-allowed"
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
          onClick={onRemove}
          disabled={isRunning}
          style={{ color: '#ef4444' }}
          className="p-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Delete step"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
});
