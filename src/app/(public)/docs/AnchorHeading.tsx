'use client';

import { useState, type ReactNode } from 'react';
import styles from './docs.module.css';

interface AnchorHeadingProps {
  as: 'h2' | 'h3';
  id: string;
  children: ReactNode;
}

export function AnchorHeading({ as: Tag, id, children }: AnchorHeadingProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = () => {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Tag id={id} className={styles.anchorHeading}>
      <span>{children}</span>
      <a
        href={`#${id}`}
        className={`${styles.anchorLink} ${copied ? styles.anchorLinkCopied : ''}`}
        onClick={(e) => {
          e.preventDefault();
          handleClick();
          window.history.replaceState(null, '', `#${id}`);
        }}
        aria-label={`Copy link to ${typeof children === 'string' ? children : 'section'}`}
      >
        {copied ? (
          <>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className={styles.anchorTooltip}>Copied!</span>
          </>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        )}
      </a>
    </Tag>
  );
}
