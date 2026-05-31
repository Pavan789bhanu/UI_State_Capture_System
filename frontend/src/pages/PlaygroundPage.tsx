/**
 * PlaygroundPage — Natural-language browser automation interface.
 *
 * Type a plain English task, optionally provide a URL, hit Run.
 * The AI plans steps, a live browser executes them, and you watch it all
 * happen in real time with screenshots streaming back step-by-step.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Play,
  Square,
  Globe,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Camera,
  AlertTriangle,
  Download,
  RotateCcw,
  Save,
  ArrowRight,
  Zap,
  Eye,
  FileText,
} from 'lucide-react';
import { playgroundAPI } from '../services/playgroundAPI';
import type { AutomationEvent, WorkflowStep, StepResult } from '../services/playgroundAPI';
import { apiClient } from '../services/api';
import { useNotifications } from '../contexts/NotificationContext';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type RunPhase =
  | 'idle'
  | 'planning'
  | 'browser_starting'
  | 'running'
  | 'complete'
  | 'error';

interface StepState {
  step: WorkflowStep;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: StepResult;
  screenshot?: string;
}

interface RunRecord {
  query: string;
  url?: string;
  startedAt: Date;
  steps: StepState[];
  success: boolean;
  screenshots: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Example queries shown on the idle screen
// ─────────────────────────────────────────────────────────────────────────────

const EXAMPLE_QUERIES = [
  { label: 'Search GitHub', query: 'Go to github.com and search for "fastapi" repositories', url: 'https://github.com' },
  { label: 'Check HN headlines', query: 'Open Hacker News and list the top 5 story titles', url: 'https://news.ycombinator.com' },
  { label: 'Wikipedia lookup', query: 'Open Wikipedia and look up "Playwright browser automation"', url: 'https://en.wikipedia.org' },
  { label: 'Product Hunt trends', query: 'Visit Product Hunt and show me today\'s top products', url: 'https://www.producthunt.com' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Small helper components
// ─────────────────────────────────────────────────────────────────────────────

function StepIcon({ status }: { status: StepState['status'] }) {
  if (status === 'pending') return <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />;
  if (status === 'running') return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
  if (status === 'success') return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
  return <XCircle className="w-5 h-5 text-red-500" />;
}

function StepTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    navigate: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    click: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    type: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    wait: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    extract: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    screenshot: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
    select: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  };
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider ${colors[type] ?? colors.wait}`}>
      {type}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function PlaygroundPage() {
  const { addNotification } = useNotifications();

  // ── Input state ──────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [headless, setHeadless] = useState(false);
  const [showUrlField, setShowUrlField] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Execution state ──────────────────────────────────────────────────────
  const [phase, setPhase] = useState<RunPhase>('idle');
  const [stateMsg, setStateMsg] = useState('');
  const [steps, setSteps] = useState<StepState[]>([]);
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
  const [planConfidence, setPlanConfidence] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  const [runSuccess, setRunSuccess] = useState<boolean | null>(null);

  // ── History ──────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<number | null>(null);

  // ── Save workflow dialog ─────────────────────────────────────────────────
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDesc, setSaveDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // ── Screenshot gallery ───────────────────────────────────────────────────
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  const cancelRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef<HTMLTextAreaElement>(null);

  // Collect screenshots from completed steps
  const screenshots = steps
    .filter((s) => s.screenshot)
    .map((s) => s.screenshot as string);

  // Auto-scroll to bottom during execution
  useEffect(() => {
    if (phase === 'running' || phase === 'planning') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [steps, phase, activeStep]);

  // ── Cancel / reset ───────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setPhase('error');
    setStateMsg('Cancelled by user');
  }, []);

  const handleReset = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setPhase('idle');
    setSteps([]);
    setActiveStep(-1);
    setLiveScreenshot(null);
    setPlanConfidence(null);
    setWarnings([]);
    setRunError(null);
    setRunSuccess(null);
  }, []);

  // ── Run automation ───────────────────────────────────────────────────────
  const handleRun = useCallback(() => {
    if (!query.trim()) return;

    // Reset state
    setPhase('planning');
    setStateMsg('AI is planning your automation…');
    setSteps([]);
    setActiveStep(-1);
    setLiveScreenshot(null);
    setPlanConfidence(null);
    setWarnings([]);
    setRunError(null);
    setRunSuccess(null);

    const collectedScreenshots: string[] = [];
    const stepStates: StepState[] = [];

    const cancel = playgroundAPI.runAutomationLive(
      query.trim(),
      targetUrl.trim() || undefined,
      headless,
      (event: AutomationEvent) => {
        switch (event.type) {
          case 'planning_start':
            setStateMsg(event.message ?? 'Planning…');
            break;

          case 'planning_complete': {
            const planned = (event.steps ?? []).map((s) => ({
              step: s,
              status: 'pending' as const,
            }));
            stepStates.length = 0;
            stepStates.push(...planned);
            setSteps([...stepStates]);
            setPlanConfidence(event.confidence ?? null);
            setWarnings(event.warnings ?? []);
            setStateMsg(`Plan ready — ${planned.length} steps`);
            break;
          }

          case 'browser_starting':
            setPhase('browser_starting');
            setStateMsg(event.message ?? 'Starting browser…');
            break;

          case 'browser_ready':
            setPhase('running');
            setStateMsg('Executing…');
            break;

          case 'step_start': {
            const idx = event.step_index ?? 0;
            setActiveStep(idx);
            if (stepStates[idx]) {
              stepStates[idx] = { ...stepStates[idx], status: 'running' };
              setSteps([...stepStates]);
            }
            break;
          }

          case 'step_complete': {
            const idx = event.step_index ?? 0;
            const result = event.result;
            const screenshot = result?.screenshot ?? undefined;
            if (screenshot) {
              collectedScreenshots.push(screenshot);
              setLiveScreenshot(screenshot);
            }
            if (stepStates[idx]) {
              stepStates[idx] = {
                ...stepStates[idx],
                status: result?.status === 'success' ? 'success' : 'error',
                result,
                screenshot,
              };
              setSteps([...stepStates]);
            }
            break;
          }

          case 'execution_stopped':
            setStateMsg(`Stopped at step ${(event.step_index ?? 0) + 1}: ${event.reason}`);
            break;

          case 'execution_complete': {
            const success = event.success ?? false;
            setRunSuccess(success);
            setPhase('complete');
            setStateMsg(success ? 'Automation completed successfully!' : 'Automation finished with errors.');
            setActiveStep(-1);

            // Add to history
            const record: RunRecord = {
              query: query.trim(),
              url: targetUrl.trim() || undefined,
              startedAt: new Date(),
              steps: [...stepStates],
              success,
              screenshots: [...collectedScreenshots],
            };
            setHistory((h) => [record, ...h.slice(0, 9)]);

            if (success) {
              addNotification({ type: 'success', title: 'Automation Complete', message: 'Automation completed successfully!' });
            } else {
              addNotification({ type: 'error', title: 'Automation Failed', message: 'Automation finished with errors.' });
            }
            break;
          }

          case 'error':
            setRunError(event.message ?? 'Unknown error');
            setPhase('error');
            setStateMsg(event.message ?? 'An error occurred');
            addNotification({ type: 'error', title: 'Automation Error', message: event.message ?? 'Automation error' });
            break;

          case 'ws_closed':
            if (phase !== 'complete' && phase !== 'error') {
              setPhase('error');
              setStateMsg('Connection to backend lost.');
            }
            break;
        }
      }
    );

    cancelRef.current = cancel;
  }, [query, targetUrl, headless, addNotification, phase]);

  // ── Save workflow ────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!saveName.trim()) return;
    setIsSaving(true);
    try {
      await apiClient.createWorkflow({
        name: saveName.trim(),
        description: saveDesc.trim() || query.trim(),
        app_name: new URL(targetUrl || 'https://example.com').hostname,
        start_url: targetUrl || steps.find((s) => s.step.type === 'navigate')?.step.url || '',
      });
      addNotification({ type: 'success', title: 'Saved', message: `Workflow "${saveName}" saved!` });
      setShowSaveDialog(false);
      setSaveName('');
      setSaveDesc('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save workflow';
      addNotification({ type: 'error', title: 'Save Failed', message: msg });
    } finally {
      setIsSaving(false);
    }
  }, [saveName, saveDesc, steps, query, targetUrl, addNotification]);

  // ── Download report ──────────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    const lines: string[] = [
      `# Automation Report`,
      `**Query:** ${query}`,
      targetUrl ? `**URL:** ${targetUrl}` : '',
      `**Date:** ${new Date().toLocaleString()}`,
      `**Result:** ${runSuccess ? '✅ Success' : '❌ Failed'}`,
      '',
      '## Steps',
    ];
    steps.forEach((s, i) => {
      lines.push(`### Step ${i + 1}: ${s.step.description}`);
      lines.push(`- Type: \`${s.step.type}\``);
      if (s.step.selector) lines.push(`- Selector: \`${s.step.selector}\``);
      if (s.step.url) lines.push(`- URL: ${s.step.url}`);
      if (s.step.value) lines.push(`- Value: ${s.step.value}`);
      lines.push(`- Status: ${s.status}`);
      if (s.result?.message) lines.push(`- Message: ${s.result.message}`);
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `automation-report-${Date.now()}.md`;
    a.click();
  }, [query, targetUrl, steps, runSuccess]);

  const isRunning = phase === 'planning' || phase === 'browser_starting' || phase === 'running';
  const hasResults = steps.length > 0;
  const completedSteps = steps.filter((s) => s.status === 'success').length;
  const progress = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Automation Playground</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Describe any task in plain English and watch a live browser execute it</p>
            </div>
          </div>
        </div>

        {/* ── Query Input ─────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            What do you want to automate?
          </label>

          <textarea
            ref={queryRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isRunning) handleRun();
            }}
            placeholder="e.g. Go to github.com, search for 'python automation', and take a screenshot of the results"
            rows={3}
            disabled={isRunning}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none text-sm transition disabled:opacity-50"
          />

          {/* URL row */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setShowUrlField((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
            >
              <Globe className="w-3.5 h-3.5" />
              {showUrlField ? 'Hide URL' : 'Add target URL'}
              {showUrlField ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {showUrlField && (
            <div className="mt-2">
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://example.com"
                disabled={isRunning}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm disabled:opacity-50"
              />
            </div>
          )}

          {/* Advanced options */}
          <div className="mt-3">
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
            >
              {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Advanced
            </button>
            {showAdvanced && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={headless}
                  onChange={(e) => setHeadless(e.target.checked)}
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="text-xs text-gray-600 dark:text-gray-400">Run browser headlessly (invisible)</span>
              </label>
            )}
          </div>

          {/* Action bar */}
          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-400 hidden sm:block">
              Tip: press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono">⌘ Enter</kbd> to run
            </p>
            <div className="flex items-center gap-2 ml-auto">
              {hasResults && !isRunning && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              )}
              {isRunning ? (
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold text-sm transition shadow"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleRun}
                  disabled={!query.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-xl font-semibold text-sm transition shadow-lg disabled:shadow-none disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4" />
                  Run Automation
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Example queries (idle only) ─────────────────────────────────── */}
        {phase === 'idle' && !hasResults && (
          <div className="mb-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Try an example</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {EXAMPLE_QUERIES.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => {
                    setQuery(ex.query);
                    setTargetUrl(ex.url);
                    setShowUrlField(true);
                    queryRef.current?.focus();
                  }}
                  className="group text-left p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-violet-400 dark:hover:border-violet-600 hover:shadow-md transition"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-violet-500 opacity-0 group-hover:opacity-100 transition" />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{ex.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 line-clamp-2">{ex.query}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Status / Progress bar ───────────────────────────────────────── */}
        {hasResults && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                {isRunning && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                {phase === 'complete' && runSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                {phase === 'complete' && !runSuccess && <XCircle className="w-4 h-4 text-red-500" />}
                {phase === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{stateMsg}</span>
              </div>
              <span className="text-xs text-gray-400">
                {completedSteps}/{steps.length} steps
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  phase === 'error' ? 'bg-red-500' : phase === 'complete' && runSuccess ? 'bg-emerald-500' : 'bg-blue-500'
                }`}
                style={{ width: isRunning ? `${Math.max(progress, 5)}%` : `${progress}%` }}
              />
            </div>

            {/* Confidence / warnings */}
            {planConfidence !== null && (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-violet-400" />
                  AI confidence: <strong>{Math.round(planConfidence * 100)}%</strong>
                </span>
                {warnings.map((w, i) => (
                  <span key={i} className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-3 h-3" />
                    {w}
                  </span>
                ))}
              </div>
            )}

            {/* Error message */}
            {runError && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-600 dark:text-red-400">
                {runError}
              </div>
            )}

            {/* Action buttons after completion */}
            {(phase === 'complete' || phase === 'error') && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save as Workflow
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-medium transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Report
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-medium transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  New Automation
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Main execution view ──────────────────────────────────────────── */}
        {hasResults && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

            {/* Steps panel */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Execution Steps
                </h2>
                <span className="ml-auto text-xs text-gray-400">{steps.length} total</span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-[520px] overflow-y-auto">
                {steps.map((s, i) => (
                  <div
                    key={i}
                    className={`px-5 py-3.5 flex items-start gap-3 transition ${
                      i === activeStep ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      <StepIcon status={s.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <StepTypeBadge type={s.step.type} />
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {s.step.description}
                        </span>
                      </div>
                      {s.step.url && (
                        <p className="text-[10px] text-gray-400 font-mono truncate">{s.step.url}</p>
                      )}
                      {s.step.selector && (
                        <p className="text-[10px] text-gray-400 font-mono truncate">{s.step.selector}</p>
                      )}
                      {s.result?.message && s.status === 'error' && (
                        <p className="text-[10px] text-red-500 mt-0.5 truncate">{s.result.message}</p>
                      )}
                    </div>
                    {s.result?.duration_ms !== undefined && (
                      <span className="flex-shrink-0 text-[10px] text-gray-400 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {(s.result.duration_ms / 1000).toFixed(1)}s
                      </span>
                    )}
                    {s.screenshot && (
                      <button
                        onClick={() => {
                          const idx = screenshots.indexOf(s.screenshot as string);
                          setGalleryIndex(idx >= 0 ? idx : null);
                        }}
                        className="flex-shrink-0 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Screenshot panel */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <Camera className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Live Preview</h2>
                {screenshots.length > 0 && (
                  <span className="ml-auto text-xs text-gray-400">{screenshots.length} captured</span>
                )}
              </div>

              <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-[300px]">
                {liveScreenshot ? (
                  <img
                    src={`data:image/png;base64,${liveScreenshot}`}
                    alt="Live browser screenshot"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 object-contain max-h-[460px] shadow"
                  />
                ) : isRunning ? (
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                    <p className="text-sm">{stateMsg}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-300 dark:text-gray-700">
                    <Camera className="w-12 h-12" />
                    <p className="text-sm">Screenshots will appear here during execution</p>
                  </div>
                )}
              </div>

              {/* Screenshot thumbnails */}
              {screenshots.length > 1 && (
                <div className="px-4 pb-4 flex gap-2 overflow-x-auto">
                  {screenshots.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setGalleryIndex(i)}
                      className="flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 border-transparent hover:border-violet-400 transition"
                    >
                      <img
                        src={`data:image/png;base64,${src}`}
                        alt={`Screenshot ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Session history ──────────────────────────────────────────────── */}
        {history.length > 0 && phase === 'idle' && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Runs</h2>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {history.map((run, i) => (
                <div key={i}>
                  <button
                    onClick={() => setExpandedHistory(expandedHistory === i ? null : i)}
                    className="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition text-left"
                  >
                    {run.success
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{run.query}</p>
                      <p className="text-xs text-gray-400">{run.startedAt.toLocaleTimeString()} · {run.steps.length} steps</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuery(run.query);
                        setTargetUrl(run.url ?? '');
                        if (run.url) setShowUrlField(true);
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Re-run
                    </button>
                    {expandedHistory === i ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>

                  {expandedHistory === i && (
                    <div className="px-5 pb-4 bg-gray-50/50 dark:bg-gray-800/30">
                      {run.screenshots.length > 0 && (
                        <div className="flex gap-2 pt-3 overflow-x-auto pb-2">
                          {run.screenshots.map((src, j) => (
                            <img
                              key={j}
                              src={`data:image/png;base64,${src}`}
                              alt={`Run ${i} screenshot ${j + 1}`}
                              className="h-20 rounded-lg border border-gray-200 dark:border-gray-700 object-cover"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Screenshot lightbox ─────────────────────────────────────────────── */}
      {galleryIndex !== null && screenshots[galleryIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setGalleryIndex(null)}
        >
          <div className="relative max-w-5xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={`data:image/png;base64,${screenshots[galleryIndex]}`}
              alt="Screenshot"
              className="max-h-[90vh] max-w-full rounded-xl shadow-2xl"
            />
            <div className="absolute top-3 right-3 flex gap-2">
              {galleryIndex > 0 && (
                <button
                  onClick={() => setGalleryIndex((n) => (n ?? 0) - 1)}
                  className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition"
                >
                  ←
                </button>
              )}
              {galleryIndex < screenshots.length - 1 && (
                <button
                  onClick={() => setGalleryIndex((n) => (n ?? 0) + 1)}
                  className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition"
                >
                  →
                </button>
              )}
              <button
                onClick={() => setGalleryIndex(null)}
                className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition"
              >
                ✕
              </button>
            </div>
            <p className="text-center text-white/60 text-xs mt-2">
              Screenshot {galleryIndex + 1} of {screenshots.length}
            </p>
          </div>
        </div>
      )}

      {/* ── Save workflow dialog ─────────────────────────────────────────────── */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowSaveDialog(false)}>
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Save as Workflow</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="My automation workflow"
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={saveDesc}
                  onChange={(e) => setSaveDesc(e.target.value)}
                  placeholder={query}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!saveName.trim() || isSaving}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
