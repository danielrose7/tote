'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRealtime } from 'inngest/react';
import { useAccount } from 'jazz-tools/react';
import { curationChannel } from '../../../inngest/channels';
import { checkExtensionAvailable } from '../../../lib/extension';
import { fetchRealtimeToken } from './actions';
import { useToast } from '../../../components/ToastNotification';
import { BlockList, JazzAccount } from '../../../schema';
import { createCollectionFromPayload } from '../../../lib/importPayload';
import styles from './curate.module.css';
import { useCuratorStore } from '../../../store/curatorStore';
import { useCuratorSession } from '../../../hooks/useCuratorSession';
import type { SectionToExtract } from '../../../hooks/useCuratorSession';

/** keyed by question.id */
type Answers = Record<string, string>;

interface CuratePageClientProps {
  initialSessionId?: string | null;
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
  if (step.startsWith('refining-'))
    return `Refinement pass ${step.split('-')[1]}`;
  if (step.startsWith('refine-complete-'))
    return `Refinement pass ${step.split('-')[2]} done`;

  return (
    milestoneLabels[step] ??
    step
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}

export function CuratePageClient({
  initialSessionId = null,
}: CuratePageClientProps) {
  const {
    phase,
    topic,
    sessionId,
    mode,
    questions,
    selections,
    notes,
    progress,
    extractionProgress,
    result,
    importPayload,
    tokenUsage,
    error,
    copied,
    importing,
    realtimeEnabled,
    setSessionId,
    setPhase,
    setMode,
    setSelections,
    setNotes,
    setError,
    setCopied,
    setImporting,
    applyRealtimeMessage,
    reset,
  } = useCuratorStore();

  const { queueSectionForExtraction, handleReconnect } =
    useCuratorSession(sessionId);

  // Initialize from props on mount; reset store on unmount
  useEffect(() => {
    setSessionId(initialSessionId);
    if (initialSessionId) setPhase('started');
    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { showToast } = useToast();
  const me = useAccount(JazzAccount, {
    resolve: { root: { blocks: true, curatorSessions: true } },
  });

  const topics = [
    'interview',
    'progress',
    'result',
    'urls',
    'section-urls',
  ] as const;
  const channel = useMemo(
    () => (sessionId ? curationChannel({ sessionId }) : null),
    [sessionId],
  );
  const realtimeToken = useMemo(
    () => (sessionId ? () => fetchRealtimeToken(sessionId) : undefined),
    [sessionId],
  );

  const { messages } = useRealtime({
    // biome-ignore lint/style/noNonNullAssertion: enabled guard handles null
    channel: channel!,
    topics,
    token: realtimeToken,
    enabled: !!sessionId && realtimeEnabled,
  });

  // Thin dispatcher — all phase transition logic lives in the store
  useEffect(() => {
    if (!messages) return;

    if (messages.byTopic.interview)
      applyRealtimeMessage('interview', messages.byTopic.interview.data);

    if (messages.byTopic.progress)
      applyRealtimeMessage('progress', messages.byTopic.progress.data);

    if (messages.byTopic.result)
      applyRealtimeMessage('result', messages.byTopic.result.data);

    const sectionUrlsMsg = messages.byTopic['section-urls'];
    if (sectionUrlsMsg) {
      applyRealtimeMessage('section-urls', sectionUrlsMsg.data);
      const { slug, title, urls, mock } =
        sectionUrlsMsg.data as SectionToExtract;
      queueSectionForExtraction({ slug, title, urls, mock });
    }
  }, [messages]);

  // Keep a ref to the active Jazz session so handleImport can link the collection back
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jazzSessionRef = useRef<any>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getJazzSession(): any {
    if (jazzSessionRef.current) return jazzSessionRef.current;
    if (!me.$isLoaded || !me.root?.curatorSessions?.$isLoaded || !sessionId)
      return null;
    for (const s of me.root.curatorSessions) {
      const loaded = s as { sessionId?: string } | null;
      if (loaded?.sessionId === sessionId) {
        jazzSessionRef.current = s;
        return s;
      }
    }
    return null;
  }

  // Load topic from Jazz session when available (Jazz may load after KV sync)
  useEffect(() => {
    if (!sessionId || topic) return;
    const jazzSession = getJazzSession();
    if (jazzSession?.topic)
      useCuratorStore.getState().setTopic(jazzSession.topic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, me.$isLoaded]);

  // Auto-scroll progress log
  const progressEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    progressEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [progress]);

  const latestProgress = progress[progress.length - 1] ?? null;
  const completedMilestones = progress.filter(
    (entry) =>
      [
        'acknowledged',
        'interview-sent',
        'answers-received',
        'planned',
        'extracting',
        'curating',
        'complete',
      ].includes(entry.step) ||
      entry.step.startsWith('refining-') ||
      entry.step.startsWith('refine-complete-'),
  );
  const searchEvents = progress.filter(
    (entry) =>
      entry.step.startsWith('searching-') ||
      entry.step.startsWith('found-urls-'),
  );

  const answersComplete = questions.every(
    (q) => (selections[q.id]?.length ?? 0) > 0,
  );

  async function handleAnswers(e: React.FormEvent) {
    e.preventDefault();
    if (!answersComplete) return;

    // Fail fast: check extension before committing to a run
    const isMock = process.env.NEXT_PUBLIC_CURATOR_MOCK === 'true';
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

  function handleReset() {
    reset();
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
            <div className={styles.actions}>
              {topic && (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={async () => {
                    const res = await fetch('/api/curate/start', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ topic }),
                    });
                    if (res.ok) {
                      const { sessionId: newId } = await res.json();
                      window.location.href = `/curate/${newId}`;
                    }
                  }}
                >
                  Try again
                </button>
              )}
              <a href="/curate/new" className={styles.secondaryButton}>
                New topic
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
