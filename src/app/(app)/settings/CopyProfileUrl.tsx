'use client';

import { useState } from 'react';
import styles from './settings.module.css';

export function CopyProfileUrl({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}/s/${username}`
      : `/s/${username}`;

  return (
    <div className={styles.publicProfileRow}>
      <span className={styles.publicProfileUrl}>{url}</span>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => {
          navigator.clipboard.writeText(
            `${window.location.origin}/s/${username}`,
          );
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <a
        href={`/s/${username}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-secondary btn-sm"
      >
        View →
      </a>
    </div>
  );
}
