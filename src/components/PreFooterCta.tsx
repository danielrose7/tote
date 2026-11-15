'use client';

import { Show, SignUpButton } from '@clerk/nextjs';
import { useTranslation } from '@/i18n/client';
import styles from './PreFooterCta.module.css';

export function PreFooterCta({ cloneHref }: { cloneHref?: string }) {
  const { t } = useTranslation();
  return (
    <Show when="signed-out">
      <section className={styles.section}>
        <div className={styles.card}>
          <div className={styles.cardInner}>
            <h2 className={styles.headline}>
              {t('site.cta.preFooter.headline')}
            </h2>
            <p className={styles.sub}>{t('site.cta.preFooter.sub')}</p>
            <div className={styles.actions}>
              <SignUpButton
                mode="modal"
                fallbackRedirectUrl={cloneHref ?? '/collections'}
              >
                <button type="button" className={styles.primaryBtn}>
                  {t('site.cta.preFooter.saveFirst')}
                </button>
              </SignUpButton>
              {cloneHref && (
                <SignUpButton mode="modal" fallbackRedirectUrl={cloneHref}>
                  <button type="button" className={styles.secondaryBtn}>
                    {t('site.cta.preFooter.saveCopy')}
                  </button>
                </SignUpButton>
              )}
            </div>
          </div>
        </div>
      </section>
    </Show>
  );
}
