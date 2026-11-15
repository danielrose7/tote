'use client';

import { Show, SignUpButton } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/client';
import styles from './StickyCtaBar.module.css';

export function StickyCtaBar({ cloneHref }: { cloneHref?: string }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > window.innerHeight * 0.5) {
        setVisible(true);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (dismissed) return null;

  return (
    <Show when="signed-out">
      <div
        className={`${styles.bar} ${visible ? styles.barVisible : ''}`}
        aria-hidden={!visible}
      >
        <div className={styles.inner}>
          <p className={styles.text}>{t('site.cta.sticky.text')}</p>
          <SignUpButton
            mode="modal"
            fallbackRedirectUrl={cloneHref ?? '/collections'}
          >
            <button type="button" className={styles.btn}>
              {t('site.cta.sticky.saveFirst')}
            </button>
          </SignUpButton>
          <button
            type="button"
            className={styles.dismiss}
            onClick={() => setDismissed(true)}
            aria-label={t('site.cta.sticky.dismiss')}
          >
            ✕
          </button>
        </div>
      </div>
    </Show>
  );
}
