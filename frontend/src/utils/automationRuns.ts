/** Persist recent playground automation runs for analytics & human feedback. */

export interface StoredAutomationRun {
  id: string;
  query: string;
  url?: string;
  confidence: number | null;
  success: boolean;
  stepCount: number;
  completedAt: string;
  feedbackSubmitted?: boolean;
  feedbackNotes?: string;
}

const STORAGE_KEY = 'uicapture_automation_runs';
const MAX_RUNS = 20;

export function loadAutomationRuns(): StoredAutomationRun[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredAutomationRun[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAutomationRun(run: Omit<StoredAutomationRun, 'id' | 'completedAt'>): StoredAutomationRun {
  const entry: StoredAutomationRun = {
    ...run,
    id: crypto.randomUUID(),
    completedAt: new Date().toISOString(),
  };
  const runs = [entry, ...loadAutomationRuns()].slice(0, MAX_RUNS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  return entry;
}

export function markRunFeedbackSubmitted(id: string, notes?: string): void {
  const runs = loadAutomationRuns().map((r) =>
    r.id === id ? { ...r, feedbackSubmitted: true, feedbackNotes: notes } : r
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
}

export function parseApiErrorBody(body: unknown, fallback = 'Request failed'): string {
  if (!body || typeof body !== 'object') return fallback;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'object' && item && 'msg' in item) return String((item as { msg: string }).msg);
        return JSON.stringify(item);
      })
      .join(', ');
  }
  return fallback;
}
