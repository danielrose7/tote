'use client';

import { useState } from 'react';
import { Main } from '@/components/Main/Main';
import { useTranslation } from '@/i18n/client';
import styles from '../curate.module.css';

const QUICK_FILLS = [
  {
    labelKey: 'curate.new.quickFillBabyLabel',
    topicKey: 'curate.new.quickFillBabyTopic',
  },
  {
    labelKey: 'curate.new.quickFillGardenLabel',
    topicKey: 'curate.new.quickFillGardenTopic',
  },
] as const;

export function NewCurationClient() {
  const { t } = useTranslation();
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);

    const res = await fetch('/api/curate/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
    });

    if (!res.ok) {
      setError(t('curate.new.startFailed'));
      setLoading(false);
      return;
    }

    const { sessionId } = await res.json();
    window.location.href = `/curate/${sessionId}`;
  }

  return (
    <Main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.historyHeader}>
          <h1 className={styles.heading}>{t('curate.newCuration')}</h1>
          <a href="/curate" className={styles.backLink}>
            {t('curate.new.allSessions')}
          </a>
        </div>

        <form onSubmit={handleStart} className={styles.form}>
          <p className={styles.subheading}>{t('curate.new.describe')}</p>
          <p className={styles.scopeNote}>{t('curate.new.scopeNote')}</p>
          <div className={styles.inputGroup}>
            <label htmlFor="topic" className={styles.label}>
              {t('curate.new.topicLabel')}
            </label>
            <textarea
              id="topic"
              className={styles.textarea}
              rows={4}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t('curate.new.topicPlaceholder')}
              autoFocus
            />
            <div className={styles.quickFills}>
              <span className={styles.quickFillLabel}>
                {t('curate.new.quickFill')}
              </span>
              {QUICK_FILLS.map((preset) => (
                <button
                  key={preset.labelKey}
                  type="button"
                  className={styles.quickFillChip}
                  onClick={() => setTopic(t(preset.topicKey))}
                >
                  {t(preset.labelKey)}
                </button>
              ))}
            </div>
          </div>
          {error && <p className={styles.errorMessage}>{error}</p>}
          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={!topic.trim() || loading}
            >
              {loading ? t('curate.new.starting') : t('curate.new.start')}
            </button>
          </div>
        </form>
      </div>
    </Main>
  );
}
