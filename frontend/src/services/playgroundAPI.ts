/**
 * Playground API Client
 * Handles all playground-related API calls
 */

const API_BASE_URL = 'http://localhost:8000/api';

export interface WorkflowStep {
  type: 'navigate' | 'click' | 'type' | 'wait' | 'select' | 'extract' | 'screenshot';
  selector?: string;
  value?: string;
  url?: string;
  timeout?: number;
  description: string;
}

export interface StepResult {
  step_type: string;
  status: 'success' | 'error';
  message: string;
  screenshot?: string;
  duration_ms: number;
  timestamp: string;
  data?: any;
}

export interface ExecutionResult {
  success: boolean;
  result: StepResult;
}

export interface WorkflowExecutionResult {
  success: boolean;
  total_steps: number;
  executed_steps: number;
  results: Array<{
    step_index: number;
    step: WorkflowStep;
    result: StepResult;
  }>;
}

export interface ParsedWorkflow {
  steps: WorkflowStep[];
  confidence: number;
  estimated_duration: number;
  requires_auth: boolean;
  warnings: string[];
}

export interface SelectorValidation {
  valid: boolean;
  count?: number;
  previews?: Array<{
    tag: string;
    text: string;
  }>;
  message: string;
}

class PlaygroundAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * Parse natural language task into workflow
   */
  async parseTask(description: string, targetUrl?: string): Promise<ParsedWorkflow> {
    const response = await fetch(`${this.baseUrl}/ai/parse-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        target_url: targetUrl,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to parse task: ${response.statusText}`);
    }

    const data = await response.json();
    return data.workflow;
  }

  /**
   * Execute a single step
   */
  async executeStep(step: WorkflowStep): Promise<ExecutionResult> {
    const response = await fetch(`${this.baseUrl}/playground/execute-step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step,
        continue_from_current: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to execute step: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Execute entire workflow
   */
  async executeWorkflow(steps: WorkflowStep[], headless: boolean = false): Promise<WorkflowExecutionResult> {
    const response = await fetch(`${this.baseUrl}/playground/execute-workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        steps,
        headless,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to execute workflow: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Validate a selector on current page
   */
  async validateSelector(selector: string): Promise<SelectorValidation> {
    const response = await fetch(`${this.baseUrl}/playground/validate-selector`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selector }),
    });

    if (!response.ok) {
      throw new Error(`Failed to validate selector: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get current page state
   */
  async getPageState(): Promise<{ url: string; title: string; viewport: any }> {
    const response = await fetch(`${this.baseUrl}/playground/page-state`);

    if (!response.ok) {
      throw new Error(`Failed to get page state: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Initialize browser
   */
  async initializeBrowser(headless: boolean = false): Promise<void> {
    const response = await fetch(`${this.baseUrl}/playground/initialize?headless=${headless}`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to initialize browser: ${response.statusText}`);
    }
  }

  /**
   * Cleanup browser
   */
  async cleanupBrowser(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/playground/cleanup`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to cleanup browser: ${response.statusText}`);
    }
  }

  /**
   * Validate workflow steps
   */
  async validateWorkflow(steps: any[]): Promise<any> {
    const response = await fetch(`${this.baseUrl}/ai/validate-workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps }),
    });

    if (!response.ok) {
      throw new Error(`Failed to validate workflow: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get workflow templates
   */
  async getTemplates(category?: string, search?: string): Promise<any> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);

    const response = await fetch(`${this.baseUrl}/ai/workflow-templates?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to get templates: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Save workflow to database
   */
  async saveWorkflow(name: string, description: string, steps: WorkflowStep[]): Promise<any> {
    const response = await fetch(`${this.baseUrl}/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        steps: JSON.stringify(steps),
        status: 'DRAFT',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save workflow: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Submit workflow feedback for learning
   */
  async submitFeedback(
    originalTask: string,
    generatedSteps: WorkflowStep[],
    correctedSteps: WorkflowStep[],
    feedbackType: 'correction' | 'success' | 'failure',
    url: string,
    notes?: string
  ): Promise<any> {
    const response = await fetch(`${this.baseUrl}/playground/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        original_task: originalTask,
        generated_steps: generatedSteps,
        corrected_steps: correctedSteps,
        feedback_type: feedbackType,
        url,
        notes,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit feedback: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get workflow suggestions based on learning
   */
  async getSuggestions(taskDescription: string, url?: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/playground/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_description: taskDescription,
        url,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get suggestions: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get learning statistics
   */
  async getLearningStats(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/playground/learning-stats`);

    if (!response.ok) {
      throw new Error(`Failed to get learning stats: ${response.statusText}`);
    }

    return await response.json();
  }
}

export const playgroundAPI = new PlaygroundAPI();
