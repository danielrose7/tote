'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRealtime } from 'inngest/react';
import { Group } from 'jazz-tools';
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
  curating: 'Initial curation',
  complete: 'Collection written',
};

// claude-sonnet-4-6 pricing: $3/1M input, $15/1M output, $0.01/search
function formatCost(
  inputTokens: number,
  outputTokens: number,
  webSearchRequests = 0,
): string {
  const cost =
    (inputTokens / 1_000_000) * 3 +
    (outputTokens / 1_000_000) * 15 +
    webSearchRequests * 0.01;
  return cost < 0.01 ? `<$0.01` : `~$${cost.toFixed(2)}`;
}

function formatStepLabel(step: string): string {
  if (step === 'searching') return 'Searching';
  if (step === 'found-urls') return 'URLs found';
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

const phaseStatusLabel: Record<string, string> = {
  started: 'Waiting for workflow acknowledgment',
  interview: 'Waiting for answers',
  planning: 'Planning collection structure...',
  extracting: 'Extracting pages...',
  refining: 'Refining collection...',
  complete: 'Collection complete',
  error: 'Something went wrong',
};

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

  // Track which realtime message IDs have been processed to avoid duplicates
  const processedMsgIdsRef = useRef(new Set<string>());
  useEffect(() => {
    processedMsgIdsRef.current = new Set();
  }, [sessionId]);

  // Thin dispatcher — all phase transition logic lives in the store.
  // applyRealtimeMessage is idempotent (version-guards on data object reference)
  // so re-renders caused by store updates won't reprocess the same message.
  useEffect(() => {
    if (!messages) return;
    const { byTopic, all } = messages;

    if (byTopic.interview)
      applyRealtimeMessage('interview', byTopic.interview.data);

    if (byTopic.progress)
      applyRealtimeMessage('progress', byTopic.progress.data);

    if (byTopic.result) applyRealtimeMessage('result', byTopic.result.data);

    // Iterate all messages to avoid missing earlier section-urls messages
    for (const msg of all) {
      if (msg.topic !== 'section-urls') continue;
      if (processedMsgIdsRef.current.has(msg.id)) continue;
      processedMsgIdsRef.current.add(msg.id);
      applyRealtimeMessage('section-urls', msg.data);
      const data = msg.data as { sections: SectionToExtract[]; mock?: boolean };
      for (const section of data.sections) {
        queueSectionForExtraction({ ...section, mock: data.mock });
      }
    }
  }, [messages, applyRealtimeMessage, queueSectionForExtraction]);

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

  const progressByStep = useMemo(
    () => Object.fromEntries(progress.map((e) => [e.step, e])),
    [progress],
  );

  type StepStatus = 'completed' | 'active' | 'pending';
  type PipelineStage = {
    label: string;
    status: StepStatus;
    steps: Array<{ label: string; status: StepStatus }>;
  };

  const wizardPipeline = useMemo((): PipelineStage[] => {
    const doneKeys = new Set(progress.map((e) => e.step));

    let maxPass = 0;
    for (const e of progress) {
      // Count from both refining-N and refine-complete-N so a missed refining-N
      // event doesn't prevent the pass from appearing in the sidebar
      if (
        e.step.startsWith('refining-') ||
        e.step.startsWith('refine-complete-')
      ) {
        const parts = e.step.split('-');
        const n = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(n) && n > maxPass) maxPass = n;
      }
    }
    if (phase === 'refining' && maxPass === 0) maxPass = 1;

    function stepStatus(key: string): StepStatus {
      return doneKeys.has(key) ? 'completed' : 'pending';
    }

    const shapeSteps: Array<{ label: string; status: StepStatus }> = [];
    for (let p = 1; p <= maxPass; p++) {
      shapeSteps.push({
        label: `Refine ${p}`,
        status: stepStatus(`refine-complete-${p}`),
      });
    }

    const stages: Array<{
      label: string;
      keys: string[];
      steps: Array<{ label: string; status: StepStatus }>;
    }> = [
      {
        label: 'Scope',
        keys: ['interview-sent', 'answers-received', 'planned'],
        steps: [
          { label: 'Interview', status: stepStatus('interview-sent') },
          { label: 'Answers', status: stepStatus('answers-received') },
          { label: 'Plan', status: stepStatus('planned') },
        ],
      },
      {
        label: 'Scout',
        keys: ['urls-found', 'extracting', 'curating'],
        steps: [
          { label: 'Links', status: stepStatus('urls-found') },
          { label: 'Extract', status: stepStatus('extracting') },
          { label: 'Curation', status: stepStatus('curating') },
        ],
      },
      {
        label: 'Shape',
        keys: [
          'complete',
          ...Array.from(
            { length: maxPass },
            (_, i) => `refine-complete-${i + 1}`,
          ),
        ],
        steps: shapeSteps,
      },
    ];

    // step.realtime.publish first arg is a message ID — the actual step field
    // in progress data is 'searching' (not 'searching-${slug}')
    const isSearching = progress.some((e) => e.step === 'searching');

    // Phase-derived floor: if realtime events are missed, use the store phase
    // (set from both KV hydration and key transitions) as a minimum status.
    // Scope completed by planning phase; Scout active by extracting phase, etc.
    const phaseFloor: Record<string, StepStatus> = {};
    if (phase === 'planning') {
      // Searching can happen while phase is still 'planning'
      phaseFloor['Scope'] = 'completed';
      if (isSearching) phaseFloor['Scout'] = 'active';
    } else if (phase === 'extracting') {
      phaseFloor['Scope'] = 'completed';
      phaseFloor['Scout'] = 'active';
    } else if (
      phase === 'curating' ||
      phase === 'refining' ||
      phase === 'complete'
    ) {
      phaseFloor['Scope'] = 'completed';
      phaseFloor['Scout'] = 'completed';
      if (phase === 'refining') phaseFloor['Shape'] = 'active';
      if (phase === 'complete') phaseFloor['Shape'] = 'completed';
    }

    const statusRank: Record<StepStatus, number> = {
      pending: 0,
      active: 1,
      completed: 2,
    };
    function maxStatus(a: StepStatus, b: StepStatus): StepStatus {
      return statusRank[a] >= statusRank[b] ? a : b;
    }

    // Derive each stage's status from its steps
    return stages.map((stage) => {
      const allDone = stage.keys.every((k) => doneKeys.has(k));
      const anyDone = stage.keys.some((k) => doneKeys.has(k));
      // Scout is active while URL discovery is running even before urls-found fires
      const forceActive = stage.label === 'Scout' && isSearching;
      const derivedStatus: StepStatus = allDone
        ? 'completed'
        : anyDone || forceActive
          ? 'active'
          : 'pending';
      const status = maxStatus(
        derivedStatus,
        phaseFloor[stage.label] ?? 'pending',
      );
      // When the stage itself is completed, lift any pending sub-steps to completed
      // so individual steps don't show pending when the overall stage is done
      const steps =
        status === 'completed'
          ? stage.steps.map((s) =>
              s.status === 'pending'
                ? { ...s, status: 'completed' as StepStatus }
                : s,
            )
          : stage.steps;
      return { label: stage.label, status, steps };
    });
  }, [progress, phase]);

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
        const group = Group.create({ owner: me });
        me.root.$jazz.set('blocks', BlockList.create([collectionBlock], group));
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

        {!sessionId && phase === 'started' && (
          <p className={styles.subheading}>Setting things up...</p>
        )}

        {sessionId && (
          <div className={styles.runLayout}>
            {/* ── Left sidebar: pipeline ── */}
            {wizardPipeline.length > 0 && (
              <aside className={styles.runSidebar}>
                <div className={styles.pipelineWrap}>
                  <ol className={styles.pipeline}>
                    {wizardPipeline.map((stage) => (
                      <li
                        key={stage.label}
                        className={styles.pipelineStage}
                        data-status={stage.status}
                      >
                        <span className={styles.pipelineDot}>
                          {stage.status === 'completed' && '✓'}
                        </span>
                        <div className={styles.pipelineContent}>
                          <span className={styles.pipelineStageLabel}>
                            {stage.label}
                          </span>
                          {stage.status !== 'pending' && (
                            <ol className={styles.pipelineSubSteps}>
                              {stage.steps.map((step) => (
                                <li
                                  key={step.label}
                                  className={styles.pipelineSubStep}
                                  data-status={step.status}
                                >
                                  {step.label}
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </aside>
            )}

            {/* ── Right main ── */}
            <div className={styles.runMain}>
              {phase === 'started' && (
                <p className={styles.subheading}>
                  Connecting to workflow and waiting for the first curator
                  events...
                </p>
              )}

              {/* Interview form */}
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
                            setNotes((prev) => ({
                              ...prev,
                              [q.id]: e.target.value,
                            }))
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
                            Fuller planning and research for a production-style
                            run.
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

              {/* ── Unified activity feed ── */}
              <div className={styles.activityCard}>
                <div className={styles.activityHeader}>
                  <div>
                    <h2 className={styles.statusTitle}>
                      {phase === 'extracting' && extractionProgress
                        ? `Extracting pages (${extractionProgress.current} / ${extractionProgress.total})`
                        : (latestProgress?.message ??
                          phaseStatusLabel[phase] ??
                          'Run created')}
                    </h2>
                    {phase !== 'extracting' && latestProgress?.detail && (
                      <p className={styles.statusDetail}>
                        {latestProgress.detail}
                      </p>
                    )}
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
                <p className={styles.sessionMeta}>
                  Session <code>{sessionId}</code>
                </p>

                {(progress.length > 0 ||
                  (phase === 'extracting' && extractionProgress)) && (
                  <div className={styles.eventLog}>
                    {progress.map((entry, i) => (
                      <div
                        key={entry.ts}
                        className={styles.eventEntry}
                        data-latest={
                          i === progress.length - 1 && phase !== 'extracting'
                        }
                      >
                        <span className={styles.eventDot} />
                        <div className={styles.eventContent}>
                          <span className={styles.eventMessage}>
                            {entry.message}
                          </span>
                          {entry.step === 'planned' && entry.detail && (
                            <div className={styles.planSections}>
                              {entry.detail.split(', ').map((title) => (
                                <span
                                  key={title}
                                  className={styles.planSection}
                                >
                                  {title}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {phase === 'extracting' && extractionProgress && (
                      <>
                        {extractionProgress.entries
                          .filter((e) => e.status !== 'pending')
                          .slice(-6)
                          .map((entry, i, arr) => (
                            <div
                              key={entry.url}
                              className={styles.eventEntry}
                              data-latest={i === arr.length - 1}
                            >
                              <span className={styles.eventDot} />
                              <span className={styles.eventMessage}>
                                {entry.status === 'loading'
                                  ? 'Extracting'
                                  : entry.status === 'done'
                                    ? 'Extracted'
                                    : 'Skipped'}{' '}
                                <span className={styles.eventSub}>
                                  {entry.title || entry.domain}
                                </span>
                              </span>
                            </div>
                          ))}
                      </>
                    )}
                    <div ref={progressEndRef} />
                  </div>
                )}
              </div>

              {/* ── Result ── */}
              {phase === 'complete' && result && (
                <div className={styles.result}>
                  <h2 className={styles.resultTitle}>{result.title}</h2>
                  <p className={styles.resultMeta}>
                    {result.sectionCount} sections · {result.itemCount} items
                    {tokenUsage && (
                      <>
                        {' · '}
                        <span
                          title={`${tokenUsage.inputTokens.toLocaleString()} in / ${tokenUsage.outputTokens.toLocaleString()} out / ${tokenUsage.webSearchRequests ?? 0} searches`}
                        >
                          {formatCost(
                            tokenUsage.inputTokens,
                            tokenUsage.outputTokens,
                            tokenUsage.webSearchRequests ?? 0,
                          )}
                        </span>
                      </>
                    )}
                  </p>

                  {importPayload && (
                    <div className={styles.importPreview}>
                      {importPayload.intro && (
                        <p className={styles.importIntro}>
                          {importPayload.intro}
                        </p>
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
                          <div
                            key={section.title}
                            className={styles.importSection}
                          >
                            <h3 className={styles.importSectionTitle}>
                              {section.title}
                            </h3>
                            <ul className={styles.importItemList}>
                              {section.items.map((item) => (
                                <li
                                  key={
                                    item.sourceRowId ||
                                    item.sourceUrl ||
                                    item.title
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

              {/* ── Error ── */}
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
          </div>
        )}
      </div>
    </main>
  );
}
