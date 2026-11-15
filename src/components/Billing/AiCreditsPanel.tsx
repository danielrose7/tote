'use client';

import type { TFunction } from 'i18next';
import { useCallback, useEffect, useState } from 'react';
import { useFormat, useTranslation } from '@/i18n/client';
import styles from './AiCreditsPanel.module.css';

const PACKS = [
  {
    priceId: 'price_1TKn8dIRyPXUFa52ClYqRPKI',
    labelKey: 'billing.packs.starter',
    amountUsd: 5,
  },
  {
    priceId: 'price_1TKn8fIRyPXUFa52XCsjtETI',
    labelKey: 'billing.packs.standard',
    amountUsd: 10,
  },
  {
    priceId: 'price_1TKn8gIRyPXUFa52q6XX47mt',
    labelKey: 'billing.packs.pro',
    amountUsd: 25,
  },
] as const;

type CreditTransaction = {
  id: number;
  amountCents: number;
  type: 'free_grant' | 'purchase' | 'deduction';
  feature: string;
  referenceId: string | null;
  stepLabel: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  webSearchRequests: number | null;
  urlCount: number | null;
  candidateCount: number | null;
  durationMs: number | null;
  codeExecutionCount: number | null;
  cfCount: number | null;
  geminiCount: number | null;
  failedCount: number | null;
  provider: string | null;
  model: string | null;
  balanceAfterCents: number | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
};

type TransactionGroup = {
  key: string;
  title: string;
  subtitle: string | null;
  totalCents: number;
  latestCreatedAt: string;
  transactions: CreditTransaction[];
};

interface AiCreditsPanelProps {
  onBalanceLoaded?: (cents: number) => void;
  returnPath?: string;
  showTransactions?: boolean;
}

type Fmt = ReturnType<typeof useFormat>;

function formatCurrency(fmt: Fmt, cents: number): string {
  return fmt.currency(cents / 100, 'USD');
}

function formatSignedCurrency(fmt: Fmt, cents: number): string {
  const sign = cents > 0 ? '+' : '';
  return `${sign}${formatCurrency(fmt, cents)}`;
}

function transactionTitle(
  t: TFunction,
  transaction: CreditTransaction,
): string {
  if (transaction.type === 'purchase') return t('billing.tx.purchase');
  if (transaction.type === 'free_grant') return t('billing.tx.grant');
  if (transaction.feature === 'chat') return t('billing.tx.chat');
  return t('billing.tx.curator');
}

function shortId(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length > 14 ? `${value.slice(0, 10)}...` : value;
}

function metadataString(
  transaction: CreditTransaction,
  key: string,
): string | null {
  const value = transaction.metadataJson?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function groupKey(transaction: CreditTransaction): string {
  if (transaction.type !== 'deduction') return `tx:${transaction.id}`;
  const curatorSessionId = metadataString(transaction, 'curatorSessionId');
  if (transaction.feature === 'curator' && transaction.referenceId) {
    return `curator:${transaction.referenceId}`;
  }
  if (transaction.feature === 'chat') {
    if (curatorSessionId) return `curator-chat:${curatorSessionId}`;
    if (transaction.referenceId) return `chat:${transaction.referenceId}`;
  }
  return `${transaction.feature}:${transaction.referenceId ?? transaction.id}`;
}

function groupTitle(t: TFunction, transaction: CreditTransaction): string {
  if (transaction.type === 'purchase') return t('billing.group.purchases');
  if (transaction.type === 'free_grant') return t('billing.group.grants');

  const curatorSessionId =
    transaction.feature === 'curator'
      ? transaction.referenceId
      : metadataString(transaction, 'curatorSessionId');
  if (curatorSessionId) {
    return t('billing.group.curation', { id: shortId(curatorSessionId) });
  }

  if (transaction.feature === 'chat') {
    return t('billing.group.chat', {
      id: shortId(transaction.referenceId) ?? '',
    }).trim();
  }

  return transactionTitle(t, transaction);
}

function groupSubtitle(
  t: TFunction,
  transaction: CreditTransaction,
): string | null {
  if (transaction.type !== 'deduction') return null;
  const collectionId =
    transaction.feature === 'chat'
      ? (metadataString(transaction, 'collectionId') ?? transaction.referenceId)
      : null;
  if (collectionId)
    return t('billing.group.collection', { id: shortId(collectionId) });
  if (transaction.referenceId)
    return t('billing.group.session', { id: shortId(transaction.referenceId) });
  return null;
}

function groupTransactions(
  t: TFunction,
  transactions: CreditTransaction[],
): TransactionGroup[] {
  const groups = new Map<string, TransactionGroup>();
  for (const transaction of transactions) {
    const key = groupKey(transaction);
    const existing = groups.get(key);
    if (existing) {
      existing.transactions.push(transaction);
      existing.totalCents += transaction.amountCents;
      if (
        new Date(transaction.createdAt).getTime() >
        new Date(existing.latestCreatedAt).getTime()
      ) {
        existing.latestCreatedAt = transaction.createdAt;
      }
      continue;
    }

    groups.set(key, {
      key,
      title: groupTitle(t, transaction),
      subtitle: groupSubtitle(t, transaction),
      totalCents: transaction.amountCents,
      latestCreatedAt: transaction.createdAt,
      transactions: [transaction],
    });
  }

  return Array.from(groups.values()).sort(
    (a, b) =>
      new Date(b.latestCreatedAt).getTime() -
      new Date(a.latestCreatedAt).getTime(),
  );
}

function transactionDetails(
  t: TFunction,
  fmt: Fmt,
  transaction: CreditTransaction,
): string {
  const details: string[] = [];
  const tokens =
    (transaction.inputTokens ?? 0) + (transaction.outputTokens ?? 0);
  if (tokens > 0) {
    details.push(t('billing.details.tokens', { tokens: fmt.number(tokens) }));
  }
  if ((transaction.webSearchRequests ?? 0) > 0) {
    details.push(
      t('billing.details.searches', {
        count: transaction.webSearchRequests ?? 0,
      }),
    );
  }
  if ((transaction.cfCount ?? 0) > 0) {
    details.push(
      t('billing.details.browserSessions', { count: transaction.cfCount ?? 0 }),
    );
  }
  if (transaction.model) {
    details.push(transaction.model);
  }
  if (transaction.balanceAfterCents !== null) {
    details.push(
      t('billing.details.balance', {
        amount: formatCurrency(fmt, transaction.balanceAfterCents),
      }),
    );
  }
  return details.join(' / ');
}

export function AiCreditsPanel({
  onBalanceLoaded,
  returnPath = '/settings',
  showTransactions = true,
}: AiCreditsPanelProps) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[] | null>(
    null,
  );
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/credits');
      if (!res.ok) return;
      const { balanceCents: nextBalance } = await res.json();
      setBalanceCents(nextBalance);
      onBalanceLoaded?.(nextBalance);
    } catch {
      // Balance is non-critical UI; chat/curator requests still enforce it server-side.
    }
  }, [onBalanceLoaded]);

  const fetchTransactions = useCallback(async () => {
    if (!showTransactions) return;
    try {
      const res = await fetch('/api/billing/transactions?limit=50');
      if (!res.ok) return;
      const { transactions: nextTransactions } = await res.json();
      setTransactions(nextTransactions);
    } catch {
      setTransactions([]);
    }
  }, [showTransactions]);

  useEffect(() => {
    fetchBalance();
    fetchTransactions();
  }, [fetchBalance, fetchTransactions]);

  async function handleBuy(priceId: string) {
    setLoading(priceId);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, returnPath }),
      });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
        return;
      }
    } catch {
      // Fall through to reset loading.
    }
    setLoading(null);
  }

  const isLow = balanceCents !== null && balanceCents < 50;
  const isEmpty = balanceCents !== null && balanceCents <= 0;
  const transactionGroups = transactions
    ? groupTransactions(t, transactions)
    : null;

  return (
    <section className={styles.panel} aria-label={t('billing.title')}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t('billing.title')}</h2>
          <p className={styles.subtitle}>{t('billing.subtitle')}</p>
        </div>
        <span className={`${styles.balance} ${isLow ? styles.balanceLow : ''}`}>
          {balanceCents === null
            ? t('billing.loading')
            : isEmpty
              ? t('billing.noCredits')
              : formatCurrency(fmt, balanceCents)}
        </span>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.toggleButton}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? t('billing.cancel') : t('billing.addCredits')}
        </button>
      </div>

      {open && (
        <div className={styles.packs}>
          {PACKS.map((pack) => (
            <button
              key={pack.priceId}
              type="button"
              className={styles.pack}
              onClick={() => handleBuy(pack.priceId)}
              disabled={loading !== null}
            >
              <span className={styles.packLabel}>{t(pack.labelKey)}</span>
              <span className={styles.packAmount}>
                {fmt.currency(pack.amountUsd, 'USD', {
                  maximumFractionDigits: 0,
                })}
              </span>
              <span className={styles.packDescription}>
                {t('billing.packDescription', {
                  amount: fmt.currency(pack.amountUsd, 'USD', {
                    maximumFractionDigits: 0,
                  }),
                })}
              </span>
              {loading === pack.priceId && (
                <span className={styles.packLoading}>
                  {t('billing.redirecting')}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {showTransactions && (
        <div className={styles.transactions}>
          <div className={styles.transactionsHeader}>
            <h3 className={styles.transactionsTitle}>
              {t('billing.recentActivity')}
            </h3>
            <button
              type="button"
              className={styles.refreshButton}
              onClick={() => {
                fetchBalance();
                fetchTransactions();
              }}
            >
              {t('billing.refresh')}
            </button>
          </div>

          {transactions === null ? (
            <p className={styles.emptyState}>{t('billing.loadingActivity')}</p>
          ) : transactionGroups?.length === 0 ? (
            <p className={styles.emptyState}>{t('billing.noActivity')}</p>
          ) : (
            <ul className={styles.transactionList}>
              {transactionGroups?.map((group) => {
                return (
                  <li key={group.key} className={styles.transactionGroup}>
                    <div className={styles.transactionGroupHeader}>
                      <div className={styles.transactionMain}>
                        <span className={styles.transactionTitle}>
                          {group.title}
                        </span>
                        <span className={styles.transactionDate}>
                          {fmt.dateTime(group.latestCreatedAt)}
                          {group.subtitle ? ` / ${group.subtitle}` : ''}
                        </span>
                      </div>
                      <span
                        className={
                          group.totalCents < 0
                            ? styles.transactionNegative
                            : styles.transactionPositive
                        }
                      >
                        {formatSignedCurrency(fmt, group.totalCents)}
                      </span>
                    </div>
                    <ul className={styles.transactionRows}>
                      {group.transactions.map((transaction) => {
                        const details = transactionDetails(t, fmt, transaction);
                        return (
                          <li
                            key={transaction.id}
                            className={styles.transactionItem}
                          >
                            <span className={styles.transactionDetails}>
                              {transactionTitle(t, transaction)}
                              {details ? ` / ${details}` : ''}
                            </span>
                            <span
                              className={
                                transaction.amountCents < 0
                                  ? styles.transactionNegative
                                  : styles.transactionPositive
                              }
                            >
                              {formatSignedCurrency(
                                fmt,
                                transaction.amountCents,
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
