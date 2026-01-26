import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { WorkflowStep, StepResult } from '../services/playgroundAPI';

interface PlaygroundState {
  steps: WorkflowStep[];
  originalGeneratedSteps: WorkflowStep[];
  aiInput: string;
  executionResults: Map<number, StepResult>;
  currentScreenshot: string | null;
  pageState: { url: string; title: string } | null;
  hasRun: boolean;
  hasModifications: boolean;
  lastSavedWorkflowId: string | null;
}

interface PlaygroundContextType {
  state: PlaygroundState;
  setSteps: (steps: WorkflowStep[]) => void;
  setOriginalGeneratedSteps: (steps: WorkflowStep[]) => void;
  setAiInput: (input: string) => void;
  setExecutionResults: (results: Map<number, StepResult>) => void;
  setCurrentScreenshot: (screenshot: string | null) => void;
  setPageState: (state: { url: string; title: string } | null) => void;
  setHasRun: (hasRun: boolean) => void;
  setHasModifications: (hasModifications: boolean) => void;
  setLastSavedWorkflowId: (id: string | null) => void;
  clearPlayground: () => void;
}

const initialState: PlaygroundState = {
  steps: [],
  originalGeneratedSteps: [],
  aiInput: '',
  executionResults: new Map(),
  currentScreenshot: null,
  pageState: null,
  hasRun: false,
  hasModifications: false,
  lastSavedWorkflowId: null,
};

const PlaygroundContext = createContext<PlaygroundContextType | undefined>(undefined);

export function PlaygroundProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlaygroundState>(initialState);

  // Memoize all setters to prevent infinite update loops
  const setSteps = useCallback((steps: WorkflowStep[]) => {
    setState((prev) => ({ ...prev, steps }));
  }, []);

  const setOriginalGeneratedSteps = useCallback((steps: WorkflowStep[]) => {
    setState((prev) => ({ ...prev, originalGeneratedSteps: steps }));
  }, []);

  const setAiInput = useCallback((aiInput: string) => {
    setState((prev) => ({ ...prev, aiInput }));
  }, []);

  const setExecutionResults = useCallback((executionResults: Map<number, StepResult>) => {
    setState((prev) => ({ ...prev, executionResults }));
  }, []);

  const setCurrentScreenshot = useCallback((currentScreenshot: string | null) => {
    setState((prev) => ({ ...prev, currentScreenshot }));
  }, []);

  const setPageState = useCallback((pageState: { url: string; title: string } | null) => {
    setState((prev) => ({ ...prev, pageState }));
  }, []);

  const setHasRun = useCallback((hasRun: boolean) => {
    setState((prev) => ({ ...prev, hasRun }));
  }, []);

  const setHasModifications = useCallback((hasModifications: boolean) => {
    setState((prev) => ({ ...prev, hasModifications }));
  }, []);

  const setLastSavedWorkflowId = useCallback((lastSavedWorkflowId: string | null) => {
    setState((prev) => ({ ...prev, lastSavedWorkflowId }));
  }, []);

  const clearPlayground = useCallback(() => {
    setState(initialState);
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    state,
    setSteps,
    setOriginalGeneratedSteps,
    setAiInput,
    setExecutionResults,
    setCurrentScreenshot,
    setPageState,
    setHasRun,
    setHasModifications,
    setLastSavedWorkflowId,
    clearPlayground,
  }), [
    state,
    setSteps,
    setOriginalGeneratedSteps,
    setAiInput,
    setExecutionResults,
    setCurrentScreenshot,
    setPageState,
    setHasRun,
    setHasModifications,
    setLastSavedWorkflowId,
    clearPlayground,
  ]);

  return (
    <PlaygroundContext.Provider value={contextValue}>
      {children}
    </PlaygroundContext.Provider>
  );
}

export function usePlayground() {
  const context = useContext(PlaygroundContext);
  if (context === undefined) {
    throw new Error('usePlayground must be used within a PlaygroundProvider');
  }
  return context;
}
