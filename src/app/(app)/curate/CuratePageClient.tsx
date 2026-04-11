'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRealtime } from 'inngest/react';
import { useAccount } from 'jazz-tools/react';
import { curationChannel } from '../../../inngest/channels';
import {
  checkExtensionAvailable,
  refreshViaExtension,
} from '../../../lib/extension';
import { MOCK_EXTRACTED_ITEMS } from '../../../inngest/fixtures/extracted-items';
import { fetchRealtimeToken } from './actions';
import { useToast } from '../../../components/ToastNotification';
import {
  BlockList,
  CuratorSession,
  CuratorSessionList,
  JazzAccount,
} from '../../../schema';
import {
  type ImportPayload,
  createCollectionFromPayload,
  validatePayload,
} from '../../../lib/importPayload';
import styles from './curate.module.css';
import type { ExtractedItem, InterviewQuestion } from '../../../inngest/types';

type CurationMode = 'normal' | 'debug';

type Phase =
  | 'idle'
  | 'started'
  | 'interview'
  | 'planning'
  | 'extracting'
  | 'complete'
  | 'error';

interface ProgressEntry {
  step: string;
  message: string;
  detail?: string;
  ts: number;
}

interface Result {
  filePath: string;
  title: string;
  sectionCount: number;
  itemCount: number;
}

/** keyed by question.id */
type Answers = Record<string, string>;

interface CuratePageClientProps {
  initialSessionId?: string | null;
}

interface UrlsData {
  sections: { title: string; slug: string; urls: string[] }[];
  mock?: boolean;
}

interface ExtractionEntry {
  url: string;
  domain: string;
  status: 'pending' | 'loading' | 'done' | 'skipped';
  title?: string;
}

interface ExtractionProgress {
  current: number;
  total: number;
  entries: ExtractionEntry[];
}

function buildAnswerString(selected: string[], notes: string): string {
  const base = selected.join(' / ');
  if (!notes.trim()) return base;
  return base ? `${base} — ${notes.trim()}` : notes.trim();
}

const milestoneLabels: Record<string, string> = {
  acknowledged: 'Workflow started',
  'interview-sent': 'Interview ready',
  'answers-received': 'Answers locked',
  planned: 'Plan drafted',
  extracting: 'Extraction queued',
  curating: 'Final curation',
  complete: 'Collection written',
};

// claude-sonnet-4-6 pricing: $3/1M input, $15/1M output
function estimateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;
}

function formatCost(inputTokens: number, outputTokens: number): string {
  const cost = estimateCost(inputTokens, outputTokens);
  return cost < 0.01 ? `<$0.01` : `~$${cost.toFixed(2)}`;
}

function formatStepLabel(step: string): string {
  if (step.startsWith('searching-')) return 'Searching';
  if (step.startsWith('found-urls-')) return 'URLs found';
  if (step.startsWith('researching-')) return 'Researching section';
  if (step.startsWith('researched-')) return 'Section researched';

  return (
    milestoneLabels[step] ??
    step
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function CuratePageClient({
  initialSessionId = null,
}: CuratePageClientProps) {
  const [phase, setPhase] = useState<Phase>(
    initialSessionId ? 'started' : 'idle',
  );
  const [topic, setTopic] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [mode, setMode] = useState<CurationMode>('debug');
  /** Selected option values per question id */
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  /** Free-text notes per question id */
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [importPayload, setImportPayload] = useState<ImportPayload | null>(
    null,
  );
  const [importing, setImporting] = useState(false);
  const [urlsData, setUrlsData] = useState<UrlsData | null>(null);
  const [extractionProgress, setExtractionProgress] =
    useState<ExtractionProgress | null>(null);
  const [tokenUsage, setTokenUsage] = useState<{
    inputTokens: number;
    outputTokens: number;
  } | null>(null);
  const progressEndRef = useRef<HTMLDivElement>(null);
  const extractionStartedRef = useRef(false);

  const { showToast } = useToast();
  const me = useAccount(JazzAccount, {
    resolve: { root: { blocks: true, curatorSessions: true } },
  });

  const topics = ['interview', 'progress', 'result', 'urls'] as const;
  const channel = useMemo(
    () => (sessionId ? curationChannel({ sessionId }) : null),
    [sessionId],
  );
  const realtimeToken = useMemo(
    () => (sessionId ? () => fetchRealtimeToken(sessionId) : undefined),
    [sessionId],
  );

  const [realtimeEnabled, setRealtimeEnabled] = useState(true);

  const { messages } = useRealtime({
    // biome-ignore lint/style/noNonNullAssertion: enabled guard handles null
    channel: channel!,
    topics,
    token: realtimeToken,
    enabled: !!sessionId && realtimeEnabled,
  });

  async function syncFromInngest(sid: string) {
    try {
      const res = await fetch(`/api/curate/sync/${sid}`);
      if (res.ok) {
        const snap = await res.json();
        if (snap.phase) setPhase(snap.phase);
        if (snap.questions?.length > 0) setQuestions(snap.questions);
        if (snap.progress?.length > 0) setProgress(snap.progress);
        if (snap.result) {
          setResult(snap.result);
          if (snap.result.json) {
            try {
              setImportPayload(validatePayload(JSON.parse(snap.result.json)));
            } catch {
              // ignore
            }
          }
        }
        if (snap.urlSections)
          setUrlsData({ sections: snap.urlSections, mock: false });
        if (snap.tokenUsage) setTokenUsage(snap.tokenUsage);
      }
    } catch {
      // ignore
    }
  }

  async function handleImport() {
    if (!importPayload || !me.$isLoaded || !me.root) return;
    setImporting(true);
    try {
      const collectionBlock = createCollectionFromPayload(importPayload, me);

      if (!me.root.blocks) {
        me.root.$jazz.set('blocks', BlockList.create([collectionBlock], me));
      } else if (me.root.blocks.$isLoaded) {
        me.root.blocks.$jazz.push(collectionBlock);
      }

      // Link collection back to this curation session
      getJazzSession()?.$jazz.set('collectionId', collectionBlock.$jazz.id);

      window.location.href = `/collections/${collectionBlock.$jazz.id}`;
    } catch (err) {
      showToast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      });
      setImporting(false);
    }
  }

  async function handleReconnect() {
    if (sessionId) await syncFromInngest(sessionId);
    // Reset extraction so it can re-run if urlSections were restored
    extractionStartedRef.current = false;
    // Bounce the realtime subscription to force reconnect
    setRealtimeEnabled(false);
    setTimeout(() => setRealtimeEnabled(true), 100);
  }
  const latestProgress = progress[progress.length - 1] ?? null;
  const completedMilestones = progress.filter((entry) =>
    [
      'acknowledged',
      'interview-sent',
      'answers-received',
      'planned',
      'extracting',
      'curating',
      'complete',
    ].includes(entry.step),
  );
  const searchEvents = progress.filter(
    (entry) =>
      entry.step.startsWith('searching-') ||
      entry.step.startsWith('found-urls-'),
  );

  // Load topic from Jazz session when available
  useEffect(() => {
    if (!sessionId || topic) return;
    const jazzSession = getJazzSession();
    if (jazzSession?.topic) setTopic(jazzSession.topic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, me.$isLoaded]);

  // Drive phase transitions from realtime messages
  useEffect(() => {
    if (!messages) return;

    const interview = messages.byTopic.interview;
    if (interview && (phase === 'started' || phase === 'interview')) {
      setQuestions(interview.data.questions);
      setPhase('interview');
    }

    const latestProgress = messages.byTopic.progress;
    if (latestProgress) {
      const { step, message, detail } = latestProgress.data;

      if (step === 'answers-received') {
        setPhase('planning');
      }

      if (step === 'acknowledged' && phase === 'started') {
        // Questions are generated by the LLM — wait for the interview-questions event
        setPhase('started');
      }

      if (step === 'error') {
        setError(message);
        setPhase('error');
      }

      setProgress((prev) => {
        // Avoid duplicate entries on hot-reload
        const last = prev[prev.length - 1];
        if (last?.message === message && last?.step === step) return prev;
        return [...prev, { step, message, detail, ts: Date.now() }];
      });
    }

    const resultMsg = messages.byTopic.result;
    if (resultMsg) {
      setResult(resultMsg.data);
      setPhase('complete');
      try {
        setImportPayload(validatePayload(JSON.parse(resultMsg.data.json)));
      } catch {
        // ignore — user can still copy JSON manually
      }
    }

    const urlsMsg = messages.byTopic.urls;
    if (urlsMsg && phase === 'planning') {
      setUrlsData(urlsMsg.data);
      setPhase('extracting');
    }
  }, [messages, phase, questions.length]);

  // Run extraction when phase transitions to "extracting"
  useEffect(() => {
    if (
      phase !== 'extracting' ||
      !urlsData ||
      !sessionId ||
      extractionStartedRef.current
    ) {
      return;
    }
    extractionStartedRef.current = true;

    (async () => {
      const isMock =
        urlsData.mock ?? process.env.NEXT_PUBLIC_CURATOR_MOCK === 'true';

      if (!isMock) {
        const available = await checkExtensionAvailable();
        if (!available) {
          setError(
            'Tote extension not installed or not responding. Install the extension and try again.',
          );
          setPhase('error');
          return;
        }
      }

      // Build flat queue: [{ sectionSlug, url }]
      const queue: { sectionSlug: string; url: string }[] = [];
      for (const section of urlsData.sections) {
        for (const url of section.urls) {
          queue.push({ sectionSlug: section.slug, url });
        }
      }

      const total = queue.length;

      // Initialize extraction results per section
      const resultsBySectionSlug: Record<string, ExtractedItem[]> = {};
      for (const section of urlsData.sections) {
        resultsBySectionSlug[section.slug] = [];
      }

      // Initialize progress entries
      const initialEntries: ExtractionEntry[] = queue.map(({ url }) => ({
        url,
        domain: (() => {
          try {
            return new URL(url).hostname;
          } catch {
            return url;
          }
        })(),
        status: 'pending',
      }));
      setExtractionProgress({ current: 0, total, entries: initialEntries });

      for (let i = 0; i < queue.length; i++) {
        const { sectionSlug, url } = queue[i];

        // Mark as loading
        setExtractionProgress((prev) => {
          if (!prev) return prev;
          const newEntries = [...prev.entries];
          newEntries[i] = { ...newEntries[i], status: 'loading' };
          return { current: i, total, entries: newEntries };
        });

        let metadata: Awaited<ReturnType<typeof refreshViaExtension>> = null;

        if (isMock) {
          await sleep(350);
          const fixture = MOCK_EXTRACTED_ITEMS[url];
          metadata = fixture ? { ...fixture } : null;
        } else {
          metadata = await refreshViaExtension(url);
        }

        const item: ExtractedItem = { sourceUrl: url, ...metadata };
        if (metadata) {
          resultsBySectionSlug[sectionSlug].push(item);
        }

        setExtractionProgress((prev) => {
          if (!prev) return prev;
          const newEntries = [...prev.entries];
          newEntries[i] = {
            ...newEntries[i],
            status: metadata ? 'done' : 'skipped',
            title: metadata?.title,
          };
          return { current: i + 1, total, entries: newEntries };
        });
      }

      // POST extractions back to Inngest
      const sections = urlsData.sections.map((s) => ({
        slug: s.slug,
        title: s.title,
        items: resultsBySectionSlug[s.slug],
      }));

      const res = await fetch('/api/curate/extractions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, sections }),
      });

      if (!res.ok) {
        setError('Failed to submit extraction results.');
        setPhase('error');
        return;
      }

      setPhase('planning');
    })();
  }, [phase, urlsData, sessionId]);

  // Keep a ref to the active Jazz session so we can update it on phase transitions
  const jazzSessionRef = useRef<typeof CuratorSession.prototype | null>(null);

  function getJazzSession(): typeof CuratorSession.prototype | null {
    if (jazzSessionRef.current) return jazzSessionRef.current;
    if (!me.$isLoaded || !me.root?.curatorSessions?.$isLoaded || !sessionId)
      return null;
    for (const s of me.root.curatorSessions) {
      if (s?.sessionId === sessionId) {
        jazzSessionRef.current = s;
        return s;
      }
    }
    return null;
  }

  // Update Jazz session whenever phase, result, or token usage changes
  useEffect(() => {
    if (!sessionId || !me.$isLoaded) return;
    const jazzSession = getJazzSession();
    if (!jazzSession) return;
    jazzSession.$jazz.set('phase', phase);
    if (result?.title) jazzSession.$jazz.set('title', result.title);
    if (result?.sectionCount != null)
      jazzSession.$jazz.set('sectionCount', result.sectionCount);
    if (result?.itemCount != null)
      jazzSession.$jazz.set('itemCount', result.itemCount);
    if (tokenUsage) {
      jazzSession.$jazz.set('inputTokens', tokenUsage.inputTokens);
      jazzSession.$jazz.set('outputTokens', tokenUsage.outputTokens);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result, tokenUsage, sessionId, me.$isLoaded]);

  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (
      !sessionId ||
      hasSyncedRef.current ||
      phase === 'complete' ||
      phase === 'error'
    )
      return;
    hasSyncedRef.current = true;
    syncFromInngest(sessionId).then(() => {
      // Reset extraction ref so it can re-run if urlSections were restored
      extractionStartedRef.current = false;
    });
  }, [sessionId, phase]);

  // Auto-scroll progress log
  useEffect(() => {
    progressEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [progress]);

  const answersComplete = questions.every(
    (q) => (selections[q.id]?.length ?? 0) > 0,
  );

  async function handleAnswers(e: React.FormEvent) {
    e.preventDefault();
    if (!answersComplete) return;

    // Build answer strings from selections + notes
    const answers: Answers = Object.fromEntries(
      questions.map((q) => [
        q.id,
        buildAnswerString(selections[q.id] ?? [], notes[q.id] ?? ''),
      ]),
    );

    const res = await fetch('/api/curate/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, questions, answers, mode }),
    });

    if (!res.ok) {
      setError('Failed to submit answers.');
      setPhase('error');
    }
  }

  function handleReset() {
    setPhase('idle');
    setTopic('');
    setSessionId(null);
    setQuestions([]);
    setSelections({});
    setNotes({});
    setMode('debug');
    setProgress([]);
    setResult(null);
    setError(null);
    setUrlsData(null);
    setExtractionProgress(null);
    extractionStartedRef.current = false;
    jazzSessionRef.current = null;
    window.location.href = '/curate';
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.historyHeader}>
          <h1 className={styles.heading}>{topic || 'Collection Curator'}</h1>
          <a href="/curate" className={styles.backLink}>
            All sessions
          </a>
        </div>

        {phase === 'started' && (
          <p className={styles.subheading}>
            Connecting to workflow and waiting for the first curator events...
          </p>
        )}

        {phase === 'interview' && questions.length > 0 && (
          <form onSubmit={handleAnswers} className={styles.form}>
            <p className={styles.subheading}>
              Answer these questions to set the curatorial lens.
            </p>

            {questions.map((q) => {
              const selected = selections[q.id] ?? [];
              return (
                <div key={q.id} className={styles.inputGroup}>
                  <span className={styles.label}>{q.text}</span>
                  <div className={styles.interviewOptions}>
                    {q.options.map((opt) => (
                      <label
                        key={opt.value}
                        className={styles.interviewOption}
                        data-selected={selected.includes(opt.value)}
                      >
                        <input
                          type={q.multi ? 'checkbox' : 'radio'}
                          name={q.id}
                          value={opt.value}
                          checked={selected.includes(opt.value)}
                          onChange={(e) => {
                            setSelections((prev) => {
                              const cur = prev[q.id] ?? [];
                              if (q.multi) {
                                // "No constraints" style exclusive option
                                if (
                                  opt.value === 'No constraints' &&
                                  e.target.checked
                                )
                                  return {
                                    ...prev,
                                    [q.id]: ['No constraints'],
                                  };
                                const next = e.target.checked
                                  ? [
                                      ...cur.filter(
                                        (v) => v !== 'No constraints',
                                      ),
                                      opt.value,
                                    ]
                                  : cur.filter((v) => v !== opt.value);
                                return { ...prev, [q.id]: next };
                              }
                              return { ...prev, [q.id]: [opt.value] };
                            });
                          }}
                        />
                        <span>
                          <strong>{opt.value}</strong>
                          <span className={styles.optionDescription}>
                            {opt.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <input
                    type="text"
                    className={styles.input}
                    value={notes[q.id] ?? ''}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    placeholder="Additional notes (optional)"
                  />
                </div>
              );
            })}

            <div className={styles.inputGroup}>
              <span className={styles.label}>Mode</span>
              <div className={styles.modeOptions}>
                <label className={styles.modeOption}>
                  <input
                    type="radio"
                    name="mode"
                    value="debug"
                    checked={mode === 'debug'}
                    onChange={() => setMode('debug')}
                  />
                  <span>
                    <strong>Debug</strong>
                    <span className={styles.modeHelp}>
                      Fewer sections, fewer candidates, lower token spend.
                    </span>
                  </span>
                </label>
                <label className={styles.modeOption}>
                  <input
                    type="radio"
                    name="mode"
                    value="normal"
                    checked={mode === 'normal'}
                    onChange={() => setMode('normal')}
                  />
                  <span>
                    <strong>Normal</strong>
                    <span className={styles.modeHelp}>
                      Fuller planning and research for a production-style run.
                    </span>
                  </span>
                </label>
              </div>
            </div>
            <div className={styles.actions}>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={!answersComplete}
              >
                Submit answers
              </button>
            </div>
          </form>
        )}

        {sessionId && (
          <div className={styles.progressSection}>
            <div className={styles.statusCard}>
              <div className={styles.statusHeader}>
                <div>
                  <p className={styles.eyebrow}>Live Run</p>
                  <h2 className={styles.statusTitle}>
                    {phase === 'extracting' && extractionProgress
                      ? `Extracting pages (${extractionProgress.current} / ${extractionProgress.total})`
                      : (latestProgress?.message ??
                        (phase === 'started'
                          ? 'Waiting for workflow acknowledgment'
                          : 'Run created'))}
                  </h2>
                </div>
                <div className={styles.statusActions}>
                  <span className={styles.phaseBadge}>{phase}</span>
                  {phase !== 'complete' && phase !== 'error' && (
                    <button
                      type="button"
                      className={styles.reconnectButton}
                      onClick={handleReconnect}
                      title="Reconnect to realtime stream"
                    >
                      ↺ Reconnect
                    </button>
                  )}
                </div>
              </div>
              {phase !== 'extracting' && latestProgress?.detail && (
                <p className={styles.statusDetail}>{latestProgress.detail}</p>
              )}
              <p className={styles.sessionMeta}>
                Session <code>{sessionId}</code>
              </p>
            </div>

            {completedMilestones.length > 0 && (
              <div className={styles.progressCard}>
                <h2 className={styles.sectionTitle}>Milestones</h2>
                <ul className={styles.milestoneList}>
                  {completedMilestones.map((entry) => (
                    <li key={entry.ts} className={styles.milestoneItem}>
                      <span className={styles.milestoneDot} />
                      <div>
                        <p className={styles.milestoneLabel}>
                          {formatStepLabel(entry.step)}
                        </p>
                        <p className={styles.milestoneMessage}>
                          {entry.message}
                        </p>
                        {entry.detail && (
                          <p className={styles.milestoneDetail}>
                            {entry.detail}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {searchEvents.length > 0 && (
              <div className={styles.progressCard}>
                <h2 className={styles.sectionTitle}>URL Discovery</h2>
                <ul className={styles.researchList}>
                  {searchEvents.map((entry) => (
                    <li key={entry.ts} className={styles.researchItem}>
                      <span className={styles.researchStep}>
                        {formatStepLabel(entry.step)}
                      </span>
                      <span className={styles.researchMessage}>
                        {entry.message}
                      </span>
                      {entry.detail && (
                        <span className={styles.progressDetail}>
                          {entry.detail}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {phase === 'extracting' && extractionProgress && (
              <div className={styles.progressCard}>
                <h2 className={styles.sectionTitle}>
                  Extracting pages ({extractionProgress.current} /{' '}
                  {extractionProgress.total})
                </h2>
                <ul className={styles.extractionList}>
                  {extractionProgress.entries
                    .filter((e) => e.status !== 'pending')
                    .slice(-8)
                    .map((entry) => (
                      <li
                        key={entry.url}
                        className={styles.extractionItem}
                        data-status={entry.status}
                      >
                        <span className={styles.extractionIcon}>
                          {entry.status === 'loading'
                            ? '▶'
                            : entry.status === 'done'
                              ? '✓'
                              : '–'}
                        </span>
                        <span className={styles.extractionContent}>
                          <span className={styles.extractionDomain}>
                            {entry.domain}
                          </span>
                          {entry.title && (
                            <span className={styles.extractionTitle}>
                              {entry.title}
                            </span>
                          )}
                          {entry.status === 'skipped' && (
                            <span className={styles.extractionSkipped}>
                              skipped
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {progress.length > 0 && (
              <div className={styles.progressCard}>
                <h2 className={styles.sectionTitle}>Event Log</h2>
                <ul className={styles.progressLog}>
                  {progress.map((entry) => (
                    <li key={entry.ts} className={styles.progressEntry}>
                      <span className={styles.progressStep}>{entry.step}</span>
                      <span className={styles.progressMessage}>
                        {entry.message}
                      </span>
                      {entry.detail && (
                        <span className={styles.progressDetail}>
                          {entry.detail}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <div ref={progressEndRef} />
              </div>
            )}
          </div>
        )}

        {phase === 'complete' && result && (
          <div className={styles.result}>
            <h2 className={styles.resultTitle}>{result.title}</h2>
            <p className={styles.resultMeta}>
              {result.sectionCount} sections · {result.itemCount} items
              {tokenUsage && (
                <>
                  {' · '}
                  <span
                    title={`${tokenUsage.inputTokens.toLocaleString()} in / ${tokenUsage.outputTokens.toLocaleString()} out`}
                  >
                    {formatCost(
                      tokenUsage.inputTokens,
                      tokenUsage.outputTokens,
                    )}
                  </span>
                </>
              )}
            </p>

            {importPayload && (
              <div className={styles.importPreview}>
                {importPayload.intro && (
                  <p className={styles.importIntro}>{importPayload.intro}</p>
                )}
                {importPayload.warnings &&
                  importPayload.warnings.length > 0 && (
                    <div className={styles.warnings}>
                      {importPayload.warnings.map((w) => (
                        <p key={w} className={styles.warning}>
                          {w}
                        </p>
                      ))}
                    </div>
                  )}
                <div className={styles.importSections}>
                  {importPayload.sections.map((section) => (
                    <div key={section.title} className={styles.importSection}>
                      <h3 className={styles.importSectionTitle}>
                        {section.title}
                      </h3>
                      <ul className={styles.importItemList}>
                        {section.items.map((item) => (
                          <li
                            key={
                              item.sourceRowId || item.sourceUrl || item.title
                            }
                            className={styles.importItem}
                          >
                            <span className={styles.importItemName}>
                              {item.title || item.sourceUrl}
                            </span>
                            {item.price && (
                              <span className={styles.importItemPrice}>
                                {item.price}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleReset}
              >
                New collection
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={async () => {
                  if (!importPayload) return;
                  await navigator.clipboard.writeText(
                    JSON.stringify(importPayload, null, 2),
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? 'Copied!' : 'Copy JSON'}
              </button>
              {importPayload && (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handleImport}
                  disabled={importing || !me.$isLoaded || !me.root}
                >
                  {importing ? 'Importing...' : 'Add to Tote'}
                </button>
              )}
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className={styles.errorBox}>
            <p>{error ?? 'Something went wrong.'}</p>
            <a href="/curate/new" className={styles.primaryButton}>
              Start new curation
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
