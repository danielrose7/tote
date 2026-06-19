'use client';

import { useState } from 'react';
import styles from './page.module.css';

export function CollectionCover({
  images,
  color,
}: {
  images: { url: string; title: string | null }[];
  color: string;
}) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

  const visible = images.filter((img) => !failedUrls.has(img.url));

  function onError(url: string) {
    setFailedUrls((prev) => new Set([...prev, url]));
  }

  if (visible.length === 0) {
    return (
      <div
        className={styles.coverFallback}
        style={{
          background: `radial-gradient(circle at 20% 80%, ${color}99 0%, transparent 55%),
                     radial-gradient(circle at 80% 15%, ${color}66 0%, transparent 45%),
                     radial-gradient(circle at 55% 50%, ${color}44 0%, transparent 60%),
                     ${color}22`,
        }}
      />
    );
  }

  if (visible.length === 1) {
    return (
      <div className={styles.coverSingle}>
        <img
          src={visible[0].url}
          alt={visible[0].title ?? ''}
          className={styles.coverImg}
          onError={() => onError(visible[0].url)}
        />
      </div>
    );
  }

  if (visible.length === 2) {
    return (
      <div className={styles.coverTwo}>
        <img
          src={visible[0].url}
          alt={visible[0].title ?? ''}
          className={styles.coverImg}
          onError={() => onError(visible[0].url)}
        />
        <img
          src={visible[1].url}
          alt={visible[1].title ?? ''}
          className={styles.coverImg}
          onError={() => onError(visible[1].url)}
        />
      </div>
    );
  }

  return (
    <div className={styles.coverThree}>
      <img
        src={visible[0].url}
        alt={visible[0].title ?? ''}
        className={`${styles.coverImg} ${styles.coverThreeMain}`}
        onError={() => onError(visible[0].url)}
      />
      <img
        src={visible[1].url}
        alt={visible[1].title ?? ''}
        className={styles.coverImg}
        onError={() => onError(visible[1].url)}
      />
      <img
        src={visible[2].url}
        alt={visible[2].title ?? ''}
        className={styles.coverImg}
        onError={() => onError(visible[2].url)}
      />
    </div>
  );
}
