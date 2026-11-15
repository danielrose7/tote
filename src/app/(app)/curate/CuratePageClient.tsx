'use client';

import { useRealtime } from 'inngest/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Main } from '@/components/Main/Main';
import { useToast } from '@/components/ToastNotification';
import type { SectionToExtract } from '@/hooks/useCuratorSession';
import { useCuratorSession } from '@/hooks/useCuratorSession';
import { apiErrorMessage } from '@/i18n/apiError';
import { Trans, useFormat, useTranslation } from '@/i18n/client';
import { curationChannel } from '@/inngest/channels';
import { useCuratorStore } from '@/store/curatorStore';
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
function computeCost(
  inputTokens: number,
  outputTokens: number,
  webSearchRequests = 0,
): number {
  return (
    (inputTokens / 1_000_000) * 3 +
    (outputTokens / 1_000_000) * 15 +
    webSearchRequests * 0.01
  );
}

const phaseStatusLabel: Record<string, string> = {
  started: 'curate.status.started',
  'interview-round-1': 'curate.status.interviewRound1',
  researching: 'curate.status.researching',
  'interview-round-2': 'curate.status.interviewRound2',
  framing: 'curate.status.framing',
  'brief-review': 'curate.status.briefReview',
  planning: 'curate.status.planning',
  extracting: 'curate.status.extracting',
  curating: 'curate.status.curating',
  hospitality: 'curate.status.hospitality',
  refining: 'curate.status.refining',
  complete: 'curate.status.complete',
  error: 'curate.status.error',
};

// Raw phase shown in the status badge, as a label
const phaseBadgeLabel: Record<string, string> = {
  started: 'curate.badge.started',
  'interview-round-1': 'curate.badge.interviewRound1',
  researching: 'curate.badge.researching',
  'interview-round-2': 'curate.badge.interviewRound2',
  framing: 'curate.badge.framing',
  'brief-review': 'curate.badge.briefReview',
  planning: 'curate.badge.planning',
  extracting: 'curate.badge.extracting',
  curating: 'curate.badge.curating',
  hospitality: 'curate.badge.hospitality',
  refining: 'curate.badge.refining',
  complete: 'curate.badge.complete',
  error: 'curate.badge.error',
};

const extractionStatusLabel = {
  loading: 'curate.extraction.extracting',
  done: 'curate.extraction.extracted',
  skipped: 'curate.extraction.skipped',
} as const;

export function CuratePageClient({
  initialSessionId = null,
}: CuratePageClientProps) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const {
    phase,
    topic,
    sessionTitle,
    sessionId,
    questions,
    questionRound,
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
    setNotes,
    setError,
    setCopied,
    setImporting,
    applyRealtimeMessage,
    reset,
  } = useCuratorStore();

  const { queueSectionForExtraction, handleReconnect } =
    useCuratorSession(sessionId);

  const formRef = useRef<HTMLFormElement>(null);
  const [answersComplete, setAnswersComplete] = useState(false);

  // Initialize from props on mount; reset store on unmount
  // biome-ignore lint/correctness/useExhaustiveDependencies: initialize store once per page load
  useEffect(() => {
    setSessionId(initialSessionId);
    if (initialSessionId) setPhase('started');
    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset form completion flag when questions change (new round)
  useEffect(() => {
    setAnswersComplete(false);
  }, [questions]);

  const { showToast } = useToast();

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

  const { messages, connectionStatus } = useRealtime({
    // biome-ignore lint/style/noNonNullAssertion: enabled guard handles null
    channel: channel!,
    topics,
    token: realtimeToken,
    enabled: !!sessionId && realtimeEnabled,
    pauseOnHidden: true,
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
      const key = entry.sectionTitle ?? t('curate.gap');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return {
      gapEntries: entries,
      gapDone: done,
      gapTotal: entries.length,
      gapGroups: Array.from(map.entries()),
    };
  }, [extractionProgress?.entries, t]);
  const hasActiveGapExtraction =
    phase === 'refining' && gapTotal > 0 && gapDone < gapTotal;

  type StepStatus = 'completed' | 'active' | 'pending';
  type PipelineStep = {
    id: string;
    labelKey: string;
    n?: number;
    status: StepStatus;
  };
  type PipelineStage = {
    id: string;
    labelKey: string;
    status: StepStatus;
    steps: PipelineStep[];
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

    const shapeSteps: PipelineStep[] = [];
    for (let p = 1; p <= maxPass; p++) {
      shapeSteps.push({
        id: `refine-${p}`,
        labelKey: 'curate.pipeline.refine',
        n: p,
        status: stepStatus(`refine-complete-${p}`),
      });
    }
    shapeSteps.push({
      id: 'publish',
      labelKey: 'curate.pipeline.publish',
      status: stepStatus('complete'),
    });

    const stages: Array<{
      id: string;
      labelKey: string;
      keys: string[];
      steps: PipelineStep[];
    }> = [
      {
        id: 'scope',
        labelKey: 'curate.pipeline.scope',
        keys: [
          'interview-round-1-sent',
          'answers-round-1-received',
          'category-research-complete',
          'interview-round-2-sent',
          'answers-round-2-received',
          'framing-complete',
          'planned',
        ],
        steps: [
          {
            id: 'round-1',
            labelKey: 'curate.pipeline.round1',
            status: stepStatus('interview-round-1-sent'),
          },
          {
            id: 'research',
            labelKey: 'curate.pipeline.research',
            status: stepStatus('category-research-complete'),
          },
          {
            id: 'round-2',
            labelKey: 'curate.pipeline.round2',
            status: stepStatus('interview-round-2-sent'),
          },
          {
            id: 'follow-up',
            labelKey: 'curate.pipeline.followUp',
            status: stepStatus('answers-round-2-received'),
          },
          {
            id: 'framing',
            labelKey: 'curate.pipeline.framing',
            status: stepStatus('framing-complete'),
          },
          {
            id: 'plan',
            labelKey: 'curate.pipeline.plan',
            status: stepStatus('planned'),
          },
        ],
      },
      {
        id: 'scout',
        labelKey: 'curate.pipeline.scout',
        keys: ['urls-found', 'extracting', 'curating'],
        steps: [
          {
            id: 'links',
            labelKey: 'curate.pipeline.links',
            status: stepStatus('urls-found'),
          },
          {
            id: 'extract',
            labelKey: 'curate.pipeline.extract',
            status: stepStatus('extracting'),
          },
          {
            id: 'curation',
            labelKey: 'curate.pipeline.curation',
            status: stepStatus('curating'),
          },
        ],
      },
      {
        id: 'polish',
        labelKey: 'curate.pipeline.polish',
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
    // (set from both sync hydration and key transitions) as a minimum status.
    // Scope completed by planning phase; Scout active by extracting phase, etc.
    const phaseFloor: Record<string, StepStatus> = {};
    if (
      phase === 'researching' ||
      phase === 'interview-round-2' ||
      phase === 'framing' ||
      phase === 'brief-review' ||
      phase === 'planning'
    ) {
      phaseFloor.scope =
        phase === 'planning' || phase === 'brief-review'
          ? 'completed'
          : 'active';
      if (isSearching) phaseFloor.scout = 'active';
    } else if (phase === 'extracting') {
      phaseFloor.scope = 'completed';
      phaseFloor.scout = 'active';
    } else if (
      phase === 'curating' ||
      phase === 'hospitality' ||
      phase === 'refining' ||
      phase === 'complete'
    ) {
      phaseFloor.scope = 'completed';
      phaseFloor.scout = 'completed';
      if (phase === 'hospitality' || phase === 'refining')
        phaseFloor.polish = 'active';
      if (phase === 'complete') phaseFloor.polish = 'completed';
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
      const forceActive = stage.id === 'scout' && isSearching;
      const derivedStatus: StepStatus = allDone
        ? 'completed'
        : anyDone || forceActive
          ? 'active'
          : 'pending';
      const status = maxStatus(
        derivedStatus,
        phaseFloor[stage.id] ?? 'pending',
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
      return { id: stage.id, labelKey: stage.labelKey, status, steps };
    });
  }, [progress, phase]);

  async function handleAnswers(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!answersComplete || !questionRound) return;

    const formData = new FormData(e.currentTarget);
    const answers: Answers = Object.fromEntries(
      questions.map((q) => [
        q.id,
        buildAnswerString(formData.getAll(q.id) as string[], notes[q.id] ?? ''),
      ]),
    );

    // Optimistically advance so the UI doesn't appear frozen while Inngest
    // processes the event — realtime will override with the real next phase.
    setPhase(questionRound === 1 ? 'researching' : 'framing');

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
      setError(t('curate.errors.submitAnswers'));
      setPhase('error');
    }
  }

  const [briefCorrection, setBriefCorrection] = useState('');
  const [briefSubmitting, setBriefSubmitting] = useState(false);

  async function handleBriefApproval(correction?: string) {
    if (briefSubmitting) return;
    setBriefSubmitting(true);
    setPhase('planning');
    const res = await fetch('/api/curate/brief-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, correction: correction ?? '' }),
    });
    if (!res.ok) {
      setError(t('curate.errors.approveBrief'));
      setPhase('error');
    }
    setBriefSubmitting(false);
  }

  async function handleImport() {
    if (!importPayload) return;
    setImporting(true);
    try {
      const response = await fetch('/api/v2/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: importPayload,
          originType: 'curator',
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        id?: string;
        error?: string;
        code?: string;
      } | null;
      if (!response.ok) {
        throw new Error(apiErrorMessage(t, response.status, body));
      }
      if (!body?.id) {
        throw new Error(t('curate.errors.importFailed'));
      }
      const collectionId = body.id;

      if (sessionId) {
        const linkRes = await fetch('/api/curate/link-collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, collectionId }),
        });
        if (!linkRes.ok) {
          console.warn('[curate] failed to link collection to session', {
            sessionId,
            collectionId,
            status: linkRes.status,
          });
        }
      }

      window.location.href = `/collections/${collectionId}`;
    } catch (err) {
      showToast({
        title: t('curate.errors.importFailed'),
        description:
          err instanceof Error ? err.message : t('curate.errors.unknown'),
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
    <Main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.historyHeader}>
          <h1 className={styles.heading}>
            {sessionTitle ||
              (topic
                ? topic.length > 72
                  ? `${topic.slice(0, 72).trimEnd()}…`
                  : topic
                : t('curate.page.heading'))}
          </h1>
          <a href="/curate" className={styles.backLink}>
            {t('curate.new.allSessions')}
          </a>
        </div>

        {!sessionId && phase === 'started' && (
          <p className={styles.subheading}>{t('curate.page.settingUp')}</p>
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
                        key={stage.id}
                        className={styles.pipelineStage}
                        data-status={stage.status}
                      >
                        <span className={styles.pipelineDot}>
                          {stage.status === 'completed' && '✓'}
                        </span>
                        <div className={styles.pipelineContent}>
                          <span className={styles.pipelineStageLabel}>
                            {t(stage.labelKey)}
                          </span>
                          {stage.status !== 'pending' && (
                            <ol className={styles.pipelineSubSteps}>
                              {stage.steps.map((step) => (
                                <li
                                  key={step.id}
                                  className={styles.pipelineSubStep}
                                  data-status={step.status}
                                >
                                  {t(step.labelKey, { n: step.n })}
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
                  {t('curate.page.connecting')}
                </p>
              )}

              {/* Interview form */}
              {(phase === 'interview-round-1' ||
                phase === 'interview-round-2') &&
                questions.length > 0 && (
                  <form
                    ref={formRef}
                    key={questionRound}
                    onSubmit={handleAnswers}
                    onChange={(e) => {
                      const fd = new FormData(e.currentTarget);
                      setAnswersComplete(
                        questions.every((q) => fd.getAll(q.id).length > 0),
                      );
                    }}
                    className={styles.form}
                  >
                    <p className={styles.subheading}>
                      {questionRound === 2
                        ? t('curate.interview.round2', {
                            subject:
                              sessionTitle ||
                              topic ||
                              t('curate.interview.theCategory'),
                          })
                        : t('curate.interview.round1')}
                    </p>

                    {questions.map((q) => (
                      <div key={q.id} className={styles.inputGroup}>
                        <span className={styles.label}>{q.text}</span>
                        <div className={styles.interviewOptions}>
                          {q.options.map((opt) => (
                            <label
                              key={opt.value}
                              className={styles.interviewOption}
                            >
                              <input
                                type={q.multi ? 'checkbox' : 'radio'}
                                name={q.id}
                                value={opt.value}
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
                          placeholder={t('curate.interview.notesPlaceholder')}
                        />
                      </div>
                    ))}

                    <div className={styles.actions}>
                      <button
                        type="submit"
                        className={styles.primaryButton}
                        disabled={!answersComplete || !questionRound}
                      >
                        {questionRound === 2
                          ? t('curate.interview.submitFollowUp')
                          : t('curate.interview.submitAnswers')}
                      </button>
                    </div>
                  </form>
                )}

              {/* ── Brief review ── */}
              {phase === 'brief-review' && framingBrief && (
                <div className={styles.form}>
                  <p className={styles.subheading}>{t('curate.brief.intro')}</p>
                  <div className={styles.framingBriefCard}>
                    <p className={styles.framingBriefGoal}>
                      {framingBrief.goal}
                    </p>
                    {framingBrief.recipientContext && (
                      <p className={styles.framingBriefMeta}>
                        {framingBrief.recipientContext}
                      </p>
                    )}
                    {framingBrief.tasteDirection && (
                      <p className={styles.framingBriefMeta}>
                        {framingBrief.tasteDirection}
                      </p>
                    )}
                    {framingBrief.constraints.length > 0 && (
                      <ul className={styles.framingBriefMeta}>
                        {framingBrief.constraints.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    )}
                    {framingBrief.avoid.length > 0 && (
                      <p className={styles.framingBriefMeta}>
                        {t('curate.brief.avoid', {
                          items: framingBrief.avoid.join(', '),
                        })}
                      </p>
                    )}
                  </div>
                  <div className={styles.inputGroup}>
                    <span className={styles.label}>
                      {t('curate.brief.anythingOff')}
                    </span>
                    <textarea
                      className={styles.textarea}
                      rows={3}
                      value={briefCorrection}
                      onChange={(e) => setBriefCorrection(e.target.value)}
                      placeholder={
                        framingBrief.correctionExample ??
                        t('curate.brief.correctionExample')
                      }
                    />
                  </div>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={briefSubmitting}
                      onClick={() => handleBriefApproval()}
                    >
                      {briefSubmitting
                        ? t('curate.brief.approving')
                        : t('curate.brief.approve')}
                    </button>
                    {briefCorrection.trim() && (
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        disabled={briefSubmitting}
                        onClick={() => handleBriefApproval(briefCorrection)}
                      >
                        {t('curate.brief.submitCorrection')}
                      </button>
                    )}
                  </div>
                </div>
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
                        ? t('curate.page.extractingPages', {
                            current: extractionProgress.current,
                            total: extractionProgress.total,
                          })
                        : hasActiveGapExtraction
                          ? t('curate.page.extractingGapPages', {
                              current: gapDone,
                              total: gapTotal,
                            })
                          : (latestProgress?.message ??
                            (phaseStatusLabel[phase]
                              ? t(phaseStatusLabel[phase])
                              : t('curate.page.runCreated')))}
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
                        {t('curate.page.refinementPasses')}
                      </p>
                    )}
                  </div>
                  <div className={styles.statusActions}>
                    <span className={styles.phaseBadge}>
                      {phaseBadgeLabel[phase]
                        ? t(phaseBadgeLabel[phase])
                        : phase}
                    </span>
                    {phase !== 'complete' && phase !== 'error' && (
                      <>
                        {connectionStatus === 'error' ||
                        connectionStatus === 'closed' ? (
                          <button
                            type="button"
                            className={styles.reconnectButton}
                            onClick={handleReconnect}
                            title={t('curate.page.streamDisconnected')}
                          >
                            {t('curate.page.reconnect')}
                          </button>
                        ) : (
                          <span
                            className={styles.connectionDot}
                            data-status={connectionStatus}
                            title={t('curate.page.streamStatus', {
                              status: connectionStatus,
                            })}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
                <p className={styles.sessionMeta}>
                  <Trans
                    i18nKey="curate.page.session"
                    values={{ sessionId }}
                    components={{ code: <code /> }}
                  />
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
                                {t('curate.page.approach')}
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
                                {t('curate.page.approachNote')}
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
                              {t(
                                extractionStatusLabel[
                                  entry.status === 'loading'
                                    ? 'loading'
                                    : entry.status === 'done'
                                      ? 'done'
                                      : 'skipped'
                                ],
                              )}{' '}
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
                                {t('curate.page.urlsPending', {
                                  count: entries.length,
                                })}
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
                                    {t(
                                      extractionStatusLabel[
                                        entry.status === 'loading'
                                          ? 'loading'
                                          : entry.status === 'done'
                                            ? 'done'
                                            : 'skipped'
                                      ],
                                    )}{' '}
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
                    {t('curate.result.sections', {
                      count: result.sectionCount,
                    })}
                    {t('curate.result.joiner')}
                    {t('curate.result.items', { count: result.itemCount })}
                    {tokenUsage && (
                      <>
                        {t('curate.result.joiner')}
                        <span
                          title={t('curate.usageTitle', {
                            input: fmt.number(tokenUsage.inputTokens),
                            output: fmt.number(tokenUsage.outputTokens),
                            searches: tokenUsage.webSearchRequests ?? 0,
                          })}
                        >
                          {(() => {
                            const cost = computeCost(
                              tokenUsage.inputTokens,
                              tokenUsage.outputTokens,
                              tokenUsage.webSearchRequests ?? 0,
                            );
                            return cost < 0.01
                              ? t('curate.cost.under', {
                                  amount: fmt.currency(0.01, 'USD'),
                                })
                              : t('curate.cost.approx', {
                                  amount: fmt.currency(cost, 'USD'),
                                });
                          })()}
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
                              <div key={w.text} className={styles.warning}>
                                <p>{w.text}</p>
                                {w.url && (
                                  <a
                                    href={w.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.warningLink}
                                  >
                                    ↗
                                  </a>
                                )}
                              </div>
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
                      {t('curate.page.newCollection')}
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
                      {copied
                        ? t('curate.page.copied')
                        : t('curate.page.copyJson')}
                    </button>
                    {importPayload && (
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={handleImport}
                        disabled={importing}
                      >
                        {importing
                          ? t('curate.page.importing')
                          : t('curate.page.addToTote')}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Error ── */}
              {phase === 'error' && (
                <div className={styles.errorBox}>
                  <p>{error ?? t('curate.page.somethingWrong')}</p>
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
                        {t('curate.page.tryAgain')}
                      </button>
                    )}
                    <a href="/curate/new" className={styles.secondaryButton}>
                      {t('curate.page.newTopic')}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Main>
  );
}
