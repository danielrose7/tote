'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Main } from '@/components/Main/Main';
import { useToast } from '@/components/ToastNotification';
import { Trans, useFormat, useTranslation } from '@/i18n/client';
import type { CuratorSessionRow } from '@/lib/curatorSessionsDb';
import { CreditsPanel } from './CreditsPanel';
import styles from './curate.module.css';

// claude-sonnet-4-6: $3/1M input, $15/1M output, $0.01/search
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

const phaseLabel: Record<string, string> = {
  started: 'curate.phase.started',
  'interview-round-1': 'curate.phase.interviewRound1',
  researching: 'curate.phase.researching',
  'interview-round-2': 'curate.phase.interviewRound2',
  framing: 'curate.phase.framing',
  planning: 'curate.phase.planning',
  extracting: 'curate.phase.extracting',
  curating: 'curate.phase.curating',
  hospitality: 'curate.phase.hospitality',
  complete: 'curate.phase.complete',
  error: 'curate.phase.error',
};

export function CurateHistoryClient() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [sessions, setSessions] = useState<CuratorSessionRow[] | null>(null);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const toastedRef = useRef(false);

  useEffect(() => {
    fetch('/api/curate/sessions')
      .then((r) => r.json())
      .then((data) => setSessions(data))
      .catch(() => setSessions([]));
  }, []);

  // Show success toast and clear param after Stripe redirect
  useEffect(() => {
    if (searchParams.get('credits') === 'added' && !toastedRef.current) {
      toastedRef.current = true;
      showToast({
        title: t('curate.history.creditsAdded'),
        description: t('curate.history.balanceUpdated'),
        variant: 'success',
      });
      window.history.replaceState({}, '', '/curate');
    }
  }, [searchParams, showToast, t]);

  const canStartNew = balanceCents === null || balanceCents > 0;

  return (
    <Main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.historyHeader}>
          <h1 className={styles.heading}>{t('curate.history.heading')}</h1>
          {canStartNew ? (
            <a href="/curate/new" className={styles.primaryButton}>
              {t('curate.newCuration')}
            </a>
          ) : (
            <span
              className={styles.newCurationDisabled}
              title={t('curate.history.addCreditsToStart')}
            >
              {t('curate.newCuration')}
            </span>
          )}
        </div>

        <CreditsPanel onBalanceLoaded={setBalanceCents} />

        {sessions === null ? null : sessions.length === 0 ? (
          <p className={styles.subheading}>
            <Trans
              i18nKey="curate.history.empty"
              components={{
                // biome-ignore lint/a11y/useAnchorContent: Trans fills in the link text
                link: <a href="/curate/new" className={styles.inlineLink} />,
              }}
            />
          </p>
        ) : (
          <ul className={styles.sessionList}>
            {sessions.map((s) => (
              <li key={s.sessionId} className={styles.sessionItem}>
                <a
                  href={`/curate/${s.sessionId}`}
                  className={styles.sessionLink}
                >
                  <span className={styles.sessionTopic}>
                    {((s.title ?? s.topic) || '').length > 67
                      ? `${(s.title ?? s.topic).slice(0, 67)}…`
                      : (s.title ?? s.topic)}
                  </span>
                  <span
                    className={`${styles.sessionPhase} ${styles[`phase_${s.phase}`]}`}
                  >
                    {phaseLabel[s.phase] ? t(phaseLabel[s.phase]) : s.phase}
                  </span>
                </a>
                <span className={styles.sessionDate}>
                  {fmt.date(s.createdAt)}
                  {s.inputTokens != null && s.outputTokens != null && (
                    <span
                      className={styles.sessionCost}
                      title={t('curate.usageTitle', {
                        input: fmt.number(s.inputTokens),
                        output: fmt.number(s.outputTokens),
                        searches: s.webSearchRequests ?? 0,
                      })}
                    >
                      {(() => {
                        const cost = computeCost(
                          s.inputTokens,
                          s.outputTokens,
                          s.webSearchRequests ?? 0,
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
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Main>
  );
}
