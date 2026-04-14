import { create } from 'zustand';
import { validatePayload } from '../lib/importPayload';
import { InterviewQuestionsSchema } from '../inngest/prompts';
import type { ImportPayload } from '../lib/importPayload';
import type { InterviewQuestion } from '../inngest/types';

export type CurationMode = 'normal' | 'debug';

export type Phase =
  | 'idle'
  | 'started'
  | 'interview'
  | 'planning'
  | 'extracting'
  | 'refining'
  | 'complete'
  | 'error';

export interface ProgressEntry {
  step: string;
  message: string;
  detail?: string;
  ts: number;
}

export interface Result {
  title: string;
  sectionCount: number;
  itemCount: number;
  json?: string;
}

export interface ExtractionEntry {
  url: string;
  domain: string;
  status: 'pending' | 'loading' | 'done' | 'skipped';
  title?: string;
}

export interface ExtractionProgress {
  current: number;
  total: number;
  entries: ExtractionEntry[];
}

interface CuratorState {
  // Session identity
  sessionId: string | null;
  topic: string;
  phase: Phase;
  mode: CurationMode;

  // Interview
  questions: InterviewQuestion[];
  selections: Record<string, string[]>;
  notes: Record<string, string>;

  // Progress
  progress: ProgressEntry[];
  extractionProgress: ExtractionProgress | null;

  // Results
  result: Result | null;
  importPayload: ImportPayload | null;
  tokenUsage: { inputTokens: number; outputTokens: number } | null;

  // Transient UI
  error: string | null;
  copied: boolean;
  importing: boolean;
  realtimeEnabled: boolean;

  // --- Actions ---

  setSessionId: (id: string | null) => void;
  setTopic: (topic: string) => void;
  setPhase: (phase: Phase) => void;
  setMode: (mode: CurationMode) => void;
  setQuestions: (questions: InterviewQuestion[]) => void;
  setSelections: (
    update:
      | Record<string, string[]>
      | ((prev: Record<string, string[]>) => Record<string, string[]>),
  ) => void;
  setNotes: (
    update:
      | Record<string, string>
      | ((prev: Record<string, string>) => Record<string, string>),
  ) => void;
  appendProgress: (entry: ProgressEntry) => void;
  setExtractionProgress: (
    update:
      | ExtractionProgress
      | null
      | ((prev: ExtractionProgress | null) => ExtractionProgress | null),
  ) => void;
  setResult: (result: Result | null) => void;
  setImportPayload: (payload: ImportPayload | null) => void;
  setTokenUsage: (
    usage: { inputTokens: number; outputTokens: number } | null,
  ) => void;
  setError: (message: string | null) => void;
  setCopied: (copied: boolean) => void;
  setImporting: (importing: boolean) => void;
  setRealtimeEnabled: (enabled: boolean) => void;

  /** Atomically hydrate from a KV sync response. */
  hydrateFromKv: (snap: Record<string, unknown>) => void;

  /** Handle a single realtime topic message — phase transitions + state updates. */
  applyRealtimeMessage: (topicName: string, data: unknown) => void;

  reset: () => void;
}

const initialState: Omit<
  CuratorState,
  | 'setSessionId'
  | 'setTopic'
  | 'setPhase'
  | 'setMode'
  | 'setQuestions'
  | 'setSelections'
  | 'setNotes'
  | 'appendProgress'
  | 'setExtractionProgress'
  | 'setResult'
  | 'setImportPayload'
  | 'setTokenUsage'
  | 'setError'
  | 'setCopied'
  | 'setImporting'
  | 'setRealtimeEnabled'
  | 'hydrateFromKv'
  | 'applyRealtimeMessage'
  | 'reset'
> = {
  sessionId: null,
  topic: '',
  phase: 'idle',
  mode: 'debug',
  questions: [],
  selections: {},
  notes: {},
  progress: [],
  extractionProgress: null,
  result: null,
  importPayload: null,
  tokenUsage: null,
  error: null,
  copied: false,
  importing: false,
  realtimeEnabled: true,
};

function tryParsePayload(json: string): ImportPayload | null {
  try {
    return validatePayload(JSON.parse(json));
  } catch {
    return null;
  }
}

// Module-level version tracker — the data object reference from useRealtime is
// stable per unique event (Inngest creates a new object only when new data
// arrives). Tracking it here makes applyRealtimeMessage idempotent: re-renders
// caused by store updates won't re-process the same message.
const _lastSeen: Record<string, unknown> = {};

export const useCuratorStore = create<CuratorState>((set, get) => ({
  ...initialState,

  setSessionId: (sessionId) => set({ sessionId }),
  setTopic: (topic) => set({ topic }),
  setPhase: (phase) => set({ phase }),
  setMode: (mode) => set({ mode }),
  setQuestions: (questions) => set({ questions }),
  setSelections: (update) =>
    set((s) => ({
      selections: typeof update === 'function' ? update(s.selections) : update,
    })),
  setNotes: (update) =>
    set((s) => ({
      notes: typeof update === 'function' ? update(s.notes) : update,
    })),
  appendProgress: (entry) =>
    set((s) => {
      const last = s.progress[s.progress.length - 1];
      if (last?.step === entry.step && last?.message === entry.message)
        return s;
      return { progress: [...s.progress, entry] };
    }),
  setExtractionProgress: (update) =>
    set((s) => ({
      extractionProgress:
        typeof update === 'function' ? update(s.extractionProgress) : update,
    })),
  setResult: (result) => set({ result }),
  setImportPayload: (importPayload) => set({ importPayload }),
  setTokenUsage: (tokenUsage) => set({ tokenUsage }),
  setError: (error) => set({ error }),
  setCopied: (copied) => set({ copied }),
  setImporting: (importing) => set({ importing }),
  setRealtimeEnabled: (realtimeEnabled) => set({ realtimeEnabled }),

  hydrateFromKv: (snap) =>
    set((s) => {
      const patch: Partial<CuratorState> = {};

      if (snap.phase) patch.phase = snap.phase as Phase;
      if (snap.topic && !s.topic) patch.topic = snap.topic as string;
      if (snap.tokenUsage)
        patch.tokenUsage = snap.tokenUsage as CuratorState['tokenUsage'];

      if (Array.isArray(snap.questions) && snap.questions.length > 0) {
        const parsed = InterviewQuestionsSchema.safeParse(snap.questions);
        if (parsed.success) patch.questions = parsed.data;
      }

      if (snap.result) {
        patch.result = snap.result as Result;
        const json = (snap.result as Result).json;
        if (json) {
          const payload = tryParsePayload(json);
          if (payload) patch.importPayload = payload;
        }
      }

      // Synthesize milestone history from persisted phase so the pipeline
      // sidebar and event log are populated after a page refresh.
      if (s.progress.length === 0 && snap.phase) {
        const phase = snap.phase as string;
        const milestoneOrder = [
          'interview',
          'planning',
          'extracting',
          'curating',
          'refining',
          'complete',
        ];
        const idx = milestoneOrder.indexOf(phase);
        const synthesized: ProgressEntry[] = [];
        let ts = 1;
        if (idx >= 0)
          synthesized.push({
            step: 'interview-sent',
            message: 'Interview questions sent — waiting for your answers.',
            ts: ts++,
          });
        if (idx >= 1)
          synthesized.push({
            step: 'answers-received',
            message: 'Answers received. Planning collection...',
            ts: ts++,
          });
        if (idx >= 2) {
          synthesized.push({
            step: 'planned',
            message: 'Plan drafted.',
            ts: ts++,
          });
          synthesized.push({
            step: 'urls-found',
            message: 'URL discovery complete — extracting pages...',
            ts: ts++,
          });
          synthesized.push({
            step: 'extracting',
            message: 'Extraction queued.',
            ts: ts++,
          });
        }
        if (idx >= 3)
          synthesized.push({
            step: 'curating',
            message: 'Extracted items — curating final shortlist...',
            ts: ts++,
          });
        if (idx >= 4) {
          const pass = (snap.refinementPass as number) ?? 1;
          for (let p = 1; p <= pass; p++) {
            synthesized.push({
              step: `refining-${p}`,
              message: `Refinement pass ${p}: analysing warnings...`,
              ts: ts++,
            });
            synthesized.push({
              step: `refine-complete-${p}`,
              message: `Refinement pass ${p} complete.`,
              ts: ts++,
            });
          }
        }
        if (phase === 'complete')
          synthesized.push({
            step: 'complete',
            message: 'Collection written',
            ts: ts++,
          });
        // Append the last persisted progress message as the most recent entry
        // so the status card shows the specific action that was in progress.
        if (snap.lastProgressMessage) {
          const last = synthesized[synthesized.length - 1];
          const msg = snap.lastProgressMessage as string;
          if (!last || last.message !== msg)
            synthesized.push({ step: 'restored', message: msg, ts: ts++ });
        }
        if (synthesized.length > 0) patch.progress = synthesized;
      }

      return patch;
    }),

  applyRealtimeMessage: (topicName, data) => {
    if (!data) return;
    if (_lastSeen[topicName] === data) return;
    _lastSeen[topicName] = data;
    const s = get();
    set((prev) => {
      const patch: Partial<CuratorState> = {};

      if (topicName === 'interview') {
        if (prev.phase === 'started' || prev.phase === 'interview') {
          const d = data as { questions: unknown };
          const parsed = InterviewQuestionsSchema.safeParse(d.questions);
          if (parsed.success) patch.questions = parsed.data;
          patch.phase = 'interview';
        }
      }

      if (topicName === 'progress') {
        const d = data as {
          step: string;
          message: string;
          detail?: string;
        };
        const { step, message, detail } = d;

        if (step === 'answers-received') patch.phase = 'planning';
        if (step === 'complete') patch.phase = 'complete';
        if (step.startsWith('refining-')) patch.phase = 'refining';
        if (step === 'error') {
          patch.error = message;
          patch.phase = 'error';
        }

        // Deduplicate progress entries
        const last = prev.progress[prev.progress.length - 1];
        if (!(last?.step === step && last?.message === message)) {
          patch.progress = [
            ...prev.progress,
            { step, message, detail, ts: Date.now() },
          ];
        }
      }

      if (topicName === 'result') {
        const d = data as {
          json?: string;
          title?: string;
          sectionCount?: number;
          itemCount?: number;
        };
        patch.result = d as Result;
        if (d.json) {
          const payload = tryParsePayload(d.json);
          if (payload) patch.importPayload = payload;
        }
        // Only transition to complete from result if not currently refining
        // (refinement passes also publish result; final 'complete' comes via progress)
        if (prev.phase !== 'refining') patch.phase = 'complete';
      }

      if (topicName === 'section-urls') {
        // Don't regress phase for gap sections arriving during refinement
        if (prev.phase !== 'refining') {
          patch.phase = 'extracting';
        }
      }

      return patch;
    });
    // suppress unused variable warning — s is used for reads that don't trigger re-render
    void s;
  },

  reset: () => set({ ...initialState }),
}));
