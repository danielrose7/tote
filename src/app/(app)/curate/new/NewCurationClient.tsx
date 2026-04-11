'use client';

import { useState } from 'react';
import { useAccount } from 'jazz-tools/react';
import {
  CuratorSession,
  CuratorSessionList,
  JazzAccount,
} from '../../../../schema';
import styles from '../curate.module.css';

const QUICK_FILLS = [
  {
    label: 'Baby gear (3mo)',
    topic:
      'Baby gear for a 3-month-old — natural materials, considered design, small condo in Salt Lake City',
  },
  {
    label: 'Gardening gear',
    topic:
      'Considered gardening gear — tools, workwear, and footwear that serious gardeners reach for',
  },
];

export function NewCurationClient() {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const me = useAccount(JazzAccount, {
    resolve: { root: { curatorSessions: true } },
  });

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
      setError('Failed to start curation. Check CURATOR_ENABLED.');
      setLoading(false);
      return;
    }

    const { sessionId } = await res.json();

    // Create Jazz session immediately — before navigating
    if (me.$isLoaded && me.root) {
      const jazzSession = CuratorSession.create(
        {
          sessionId,
          topic: topic.trim(),
          phase: 'started',
          createdAt: new Date(),
        },
        me,
      );
      if (!me.root.curatorSessions) {
        me.root.$jazz.set(
          'curatorSessions',
          CuratorSessionList.create([jazzSession], me),
        );
      } else if (me.root.curatorSessions.$isLoaded) {
        me.root.curatorSessions.$jazz.push(jazzSession);
      }
    }

    window.location.href = `/curate/${sessionId}`;
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.historyHeader}>
          <h1 className={styles.heading}>New curation</h1>
          <a href="/curate" className={styles.backLink}>
            All sessions
          </a>
        </div>

        <form onSubmit={handleStart} className={styles.form}>
          <p className={styles.subheading}>
            Describe what you want to curate. Be specific — include context,
            occasion, or a source like an email or product category.
          </p>
          <div className={styles.inputGroup}>
            <label htmlFor="topic" className={styles.label}>
              Topic
            </label>
            <textarea
              id="topic"
              className={styles.textarea}
              rows={4}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Considered gardening gear — tools, workwear, and footwear that serious gardeners reach for"
              autoFocus
            />
            <div className={styles.quickFills}>
              <span className={styles.quickFillLabel}>Quick fill:</span>
              {QUICK_FILLS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={styles.quickFillChip}
                  onClick={() => setTopic(preset.topic)}
                >
                  {preset.label}
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
              {loading ? 'Starting…' : 'Start curation'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
