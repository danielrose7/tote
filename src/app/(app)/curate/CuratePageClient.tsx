'use client';

import { useRealtime } from 'inngest/react';
import { Group } from 'jazz-tools';
import { useAccount } from 'jazz-tools/react';
import { useEffect, useMemo, useRef } from 'react';
import { useToast } from '../../../components/ToastNotification';
import type { SectionToExtract } from '../../../hooks/useCuratorSession';
import { useCuratorSession } from '../../../hooks/useCuratorSession';
import { curationChannel } from '../../../inngest/channels';
import { checkExtensionAvailable } from '../../../lib/extension';
import { createCollectionFromPayload } from '../../../lib/importPayload';
import { BlockList, JazzAccount } from '../../../schema';
import { useCuratorStore } from '../../../store/curatorStore';
import { fetchRealtimeToken } from './actions';
import styles from './curate.module.css';

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

const phaseStatusLabel: Record<string, string> = {
  started: 'Waiting for workflow acknowledgment',
  'interview-round-1': 'Waiting for Round 1 answers',
  researching: 'Researching the category — usually 30–90s...',
  'interview-round-2': 'Waiting for follow-up questions',
  framing: 'Building curatorial brief — usually under a minute...',
  planning: 'Planning collection structure...',
  extracting: 'Extracting pages...',
  curating: 'Curating the shortlist — usually 60–90s...',
  hospitality: 'Refining collection...',
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
    questions,
    questionRound,
    selections,
    notes,
    progress,
    extractionProgress,
    result,
    importPayload,
    tokenUsage,
    framingBrief,
    error,
    copied,
    importing,
    realtimeEnabled,
    setSessionId,
    setPhase,
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: initialize store once per page load
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset processed ids when the session changes
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

  type JazzSessionHandle = {
    sessionId?: string;
    topic?: string;
    $jazz: {
      set: (key: string, value: unknown) => void;
    };
  };

  // Keep a ref to the active Jazz session so handleImport can link the collection back
  const jazzSessionRef = useRef<JazzSessionHandle | null>(null);

  function getJazzSession(): JazzSessionHandle | null {
    if (jazzSessionRef.current) return jazzSessionRef.current;
    if (!me.$isLoaded || !me.root?.curatorSessions?.$isLoaded || !sessionId)
      return null;
    for (const s of me.root.curatorSessions) {
      const loaded = s as JazzSessionHandle | null;
      if (loaded?.sessionId === sessionId) {
        jazzSessionRef.current = s;
        return s;
      }
    }
    return null;
  }

  // Load topic from Jazz session when available (Jazz may load after KV sync)
  // biome-ignore lint/correctness/useExhaustiveDependencies: hydrate topic lazily from Jazz once available
  useEffect(() => {
    if (!sessionId || topic) return;
    const jazzSession = getJazzSession();
    if (jazzSession?.topic)
      useCuratorStore.getState().setTopic(jazzSession.topic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, me.$isLoaded]);

  // Auto-scroll progress log
  const progressEndRef = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll after progress updates
  useEffect(() => {
    progressEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [progress]);

  const latestProgress = progress[progress.length - 1] ?? null;

  // Gap extraction state — entries stamped with sectionTag === "gap"
  const { gapEntries, gapDone, gapTotal, gapGroups } = useMemo(() => {
    const entries =
      extractionProgress?.entries.filter((e) => e.sectionTag === 'gap') ?? [];
    const done = entries.filter(
      (e) => e.status === 'done' || e.status === 'skipped',
    ).length;
    const map = new Map<string, typeof entries>();
    for (const entry of entries) {
      const key = entry.sectionTitle ?? 'Gap';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return {
      gapEntries: entries,
      gapDone: done,
      gapTotal: entries.length,
      gapGroups: Array.from(map.entries()),
    };
  }, [extractionProgress?.entries]);
  const hasActiveGapExtraction =
    phase === 'refining' && gapTotal > 0 && gapDone < gapTotal;

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
        if (!Number.isNaN(n) && n > maxPass) maxPass = n;
      }
    }
    if (phase === 'refining') {
      if (maxPass === 0) maxPass = 1;
      // If we've completed pass N but still refining, pass N+1 is in progress
      else if (doneKeys.has(`refine-complete-${maxPass}`)) maxPass += 1;
    }

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
    shapeSteps.push({ label: 'Publish', status: stepStatus('complete') });

    const stages: Array<{
      label: string;
      keys: string[];
      steps: Array<{ label: string; status: StepStatus }>;
    }> = [
      {
        label: 'Scope',
        keys: [
          'interview-round-1-sent',
          'answers-round-1-received',
          'category-research-complete',
          'framing-complete',
          'planned',
        ],
        steps: [
          { label: 'Round 1', status: stepStatus('interview-round-1-sent') },
          {
            label: 'Research',
            status: stepStatus('category-research-complete'),
          },
          {
            label: 'Follow-up',
            status: stepStatus('answers-round-2-received'),
          },
          { label: 'Framing', status: stepStatus('framing-complete') },
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
        label: 'Polish',
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
    if (
      phase === 'researching' ||
      phase === 'interview-round-2' ||
      phase === 'framing' ||
      phase === 'planning'
    ) {
      phaseFloor.Scope = phase === 'planning' ? 'completed' : 'active';
      if (isSearching) phaseFloor.Scout = 'active';
    } else if (phase === 'extracting') {
      phaseFloor.Scope = 'completed';
      phaseFloor.Scout = 'active';
    } else if (
      phase === 'curating' ||
      phase === 'hospitality' ||
      phase === 'refining' ||
      phase === 'complete'
    ) {
      phaseFloor.Scope = 'completed';
      phaseFloor.Scout = 'completed';
      if (phase === 'hospitality' || phase === 'refining')
        phaseFloor.Polish = 'active';
      if (phase === 'complete') phaseFloor.Polish = 'completed';
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
    if (!answersComplete || !questionRound) return;

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
      body: JSON.stringify({
        sessionId,
        questions,
        answers,
        round: questionRound,
      }),
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
              {(phase === 'interview-round-1' ||
                phase === 'interview-round-2') &&
                questions.length > 0 && (
                  <form onSubmit={handleAnswers} className={styles.form}>
                    <p className={styles.subheading}>
                      {questionRound === 2
                        ? `Round 2 of 2. We've researched ${topic || 'the category'} — these questions help us dial in the specifics before we build.`
                        : `Round 1 of 2. After you answer, we'll research the category (~30–90s), then come back with a few sharper follow-up questions.`}
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

                    <div className={styles.actions}>
                      <button
                        type="submit"
                        className={styles.primaryButton}
                        disabled={!answersComplete || !questionRound}
                      >
                        {questionRound === 2
                          ? 'Submit follow-up'
                          : 'Submit answers'}
                      </button>
                    </div>
                  </form>
                )}

              {/* ── Framing brief ── */}
              {framingBrief &&
                (phase === 'planning' ||
                  phase === 'extracting' ||
                  phase === 'curating' ||
                  phase === 'hospitality' ||
                  phase === 'refining' ||
                  phase === 'complete') && (
                  <div className={styles.framingBriefCard}>
                    <p className={styles.framingBriefGoal}>
                      {framingBrief.goal}
                    </p>
                    {framingBrief.tasteDirection && (
                      <p className={styles.framingBriefMeta}>
                        {framingBrief.tasteDirection}
                      </p>
                    )}
                  </div>
                )}

              {/* ── Unified activity feed ── */}
              <div className={styles.activityCard}>
                <div className={styles.activityHeader}>
                  <div>
                    <h2 className={styles.statusTitle}>
                      {phase === 'extracting' && extractionProgress
                        ? `Extracting pages (${extractionProgress.current} / ${extractionProgress.total})`
                        : hasActiveGapExtraction
                          ? `Extracting gap pages (${gapDone} / ${gapTotal})`
                          : (latestProgress?.message ??
                            phaseStatusLabel[phase] ??
                            'Run created')}
                    </h2>
                    {phase !== 'extracting' &&
                      !hasActiveGapExtraction &&
                      latestProgress?.detail && (
                        <p className={styles.statusDetail}>
                          {latestProgress.detail}
                        </p>
                      )}
                    {phase === 'refining' && (
                      <p className={styles.statusDetail}>
                        Usually 1–2 refinement passes.
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
                  (phase === 'extracting' && extractionProgress) ||
                  hasActiveGapExtraction) && (
                  <div className={styles.eventLog}>
                    {progress.map((entry, i) => (
                      <div
                        key={entry.ts}
                        className={styles.eventEntry}
                        data-latest={
                          i === progress.length - 1 &&
                          phase !== 'extracting' &&
                          !hasActiveGapExtraction
                        }
                      >
                        <span className={styles.eventDot} />
                        <div className={styles.eventContent}>
                          <span className={styles.eventMessage}>
                            {entry.message}
                          </span>
                          {entry.step === 'planned' && entry.detail && (
                            <div className={styles.planSections}>
                              <span className={styles.planSectionsLabel}>
                                Here's how we're approaching it:
                              </span>
                              <ul className={styles.planSectionList}>
                                {entry.detail.split(', ').map((title) => (
                                  <li
                                    key={title}
                                    className={styles.planSection}
                                  >
                                    {title}
                                  </li>
                                ))}
                              </ul>
                              <span className={styles.planSectionsNote}>
                                A focused selection within each — not a
                                comprehensive guide.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Initial extraction — flat scrolling list */}
                    {phase === 'extracting' &&
                      extractionProgress &&
                      extractionProgress.entries
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

                    {/* Refinement gap extraction — grouped by gap */}
                    {hasActiveGapExtraction &&
                      gapGroups.map(([gapTitle, entries]) => {
                        const active = entries.filter(
                          (e) => e.status !== 'pending',
                        );
                        const done = entries.filter(
                          (e) => e.status === 'done' || e.status === 'skipped',
                        ).length;
                        const isLast =
                          gapGroups[gapGroups.length - 1][0] === gapTitle;
                        return (
                          <div key={gapTitle} className={styles.gapGroup}>
                            <div className={styles.gapGroupHeader}>
                              <span className={styles.gapGroupTitle}>
                                {gapTitle}
                              </span>
                              <span className={styles.gapGroupCount}>
                                {done}/{entries.length}
                              </span>
                            </div>
                            {active.length === 0 ? (
                              <div className={styles.gapGroupPending}>
                                {entries.length} URL
                                {entries.length !== 1 ? 's' : ''} pending
                              </div>
                            ) : (
                              active.slice(-4).map((entry, i, arr) => (
                                <div
                                  key={entry.url}
                                  className={styles.eventEntry}
                                  data-latest={isLast && i === arr.length - 1}
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
                              ))
                            )}
                          </div>
                        );
                      })}

                    <div ref={progressEndRef} />
                  </div>
                )}
              </div>

              {/* ── Result ── */}
              {phase === 'complete' && result && (
                <div className={styles.result}>
                  <h2 className={styles.resultTitle}>{result.title}</h2>
                  {framingBrief?.goal && (
                    <p className={styles.resultGoal}>{framingBrief.goal}</p>
                  )}
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
