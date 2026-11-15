'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from './client';
import {
  LOCALE_LABELS,
  LOCALES,
  type Locale,
  type RenderLocale,
} from './config';
import styles from './LanguagePicker.module.css';
import { setLocaleCookie } from './LocaleSync';

/**
 * Language setting. Saves to the profile (synced to the extension and iOS app)
 * and the cookie (what the server renders with), then refreshes so the page
 * re-renders translated. Renders nothing until a second language exists.
 */
export function LanguagePicker({ current }: { current: RenderLocale }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<Locale | null>(null);

  if (LOCALES.length < 2) return null;

  async function choose(locale: Locale) {
    setSaving(true);
    setFailed(null);
    try {
      const res = await fetch('/api/v2/user/preferences', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLocaleCookie(locale);
      router.refresh();
    } catch (error) {
      console.error('[i18n] could not save language', error);
      setFailed(locale);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card}>
      <label className={styles.label} htmlFor="language-select">
        {t('settings.language.label')}
      </label>
      <p className={styles.hint}>{t('settings.language.hint')}</p>
      <select
        id="language-select"
        className={styles.select}
        value={current === 'xx' ? 'en' : current}
        disabled={saving}
        onChange={(e) => choose(e.target.value as Locale)}
      >
        {LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_LABELS[locale]}
          </option>
        ))}
      </select>
      {failed && (
        <p className={styles.error} role="alert">
          {t('settings.language.saveError')}{' '}
          <button
            type="button"
            className={styles.retry}
            onClick={() => choose(failed)}
          >
            {t('common.retry')}
          </button>
        </p>
      )}
    </section>
  );
}
