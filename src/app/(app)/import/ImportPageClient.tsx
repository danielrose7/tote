'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Header } from '@/components/Header';
import { Main } from '@/components/Main/Main';
import { useToast } from '@/components/ToastNotification';
import { useTranslation } from '@/i18n/client';
import { type ImportPayload, validatePayload } from '@/lib/importPayload';
import styles from './import.module.css';

export function ImportPageClient() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [json, setJson] = useState('');
  const [preview, setPreview] = useState<ImportPayload | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleParse = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setParseError(null);
    setPreview(null);

    try {
      const parsed = JSON.parse(json);
      const validated = validatePayload(parsed);
      setPreview(validated);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : t('import.parseFailed'),
      );
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);

    try {
      const response = await fetch('/api/v2/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: preview }),
      });
      const body = (await response.json().catch(() => null)) as {
        id?: string;
        error?: string;
      } | null;
      if (!response.ok || !body?.id) {
        throw new Error(body?.error ?? t('import.failed'));
      }

      const totalItems = preview.sections.reduce(
        (sum, section) => sum + section.items.length,
        0,
      );
      showToast({
        title: t('import.imported'),
        description: t('import.importedDescription', {
          title: preview.title,
          sections: t('import.sections', { count: preview.sections.length }),
          items: t('import.items', { count: totalItems }),
        }),
        variant: 'success',
      });

      router.push(`/collections/${body.id}`);
    } catch (err) {
      console.error('Import failed', err);
      showToast({
        title: t('import.failed'),
        description: err instanceof Error ? err.message : t('import.unknown'),
        variant: 'error',
      });
    } finally {
      setImporting(false);
    }
  };

  const totalItems =
    preview?.sections.reduce((sum, section) => sum + section.items.length, 0) ??
    0;

  return (
    <>
      <Header />
      <Main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.heading}>{t('import.heading')}</h1>
          <p className={styles.subheading}>{t('import.subheading')}</p>

          <form className={styles.form} onSubmit={handleParse}>
            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="json-input">
                {t('import.jsonLabel')}
              </label>
              <textarea
                id="json-input"
                className={styles.textarea}
                value={json}
                onChange={(e) => {
                  setJson(e.target.value);
                  setPreview(null);
                  setParseError(null);
                }}
                placeholder={`{\n  "title": "My Collection",\n  "intro": "...",\n  "sections": [\n    {\n      "title": "Section 1",\n      "items": [\n        { "title": "Item", "sourceUrl": "https://..." }\n      ]\n    }\n  ]\n}`}
                rows={16}
                spellCheck={false}
              />
            </div>

            {parseError && <p className={styles.error}>{parseError}</p>}

            <div className={styles.parseActions}>
              <p className={styles.parseHint}>{t('import.hint')}</p>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={!json.trim()}
              >
                {t('import.preview')}
              </button>
            </div>
          </form>

          {preview && (
            <div className={styles.preview}>
              <h2 className={styles.previewTitle}>{preview.title}</h2>
              {preview.intro && (
                <p className={styles.previewIntro}>{preview.intro}</p>
              )}
              <p className={styles.previewMeta}>
                {t('import.previewMeta', {
                  sections: t('import.sections', {
                    count: preview.sections.length,
                  }),
                  items: t('import.items', { count: totalItems }),
                })}
              </p>

              {preview.warnings && preview.warnings.length > 0 && (
                <div className={styles.warnings}>
                  {preview.warnings.map((warning) => (
                    <p key={warning} className={styles.warning}>
                      {warning}
                    </p>
                  ))}
                </div>
              )}

              <div className={styles.sections}>
                {preview.sections.map((section) => (
                  <div key={section.title} className={styles.section}>
                    <h3 className={styles.sectionTitle}>{section.title}</h3>
                    <ul className={styles.itemList}>
                      {section.items.map((item) => (
                        <li
                          key={item.sourceRowId || item.sourceUrl || item.title}
                          className={styles.item}
                        >
                          <span className={styles.itemName}>
                            {item.title || item.sourceUrl}
                          </span>
                          {item.sourceUrl && item.title && (
                            <span className={styles.itemUrl}>
                              {item.sourceUrl}
                            </span>
                          )}
                          {item.price && (
                            <span className={styles.itemPrice}>
                              {item.price}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className={styles.actions}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setPreview(null);
                    setParseError(null);
                  }}
                  type="button"
                >
                  {t('import.back')}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleImport}
                  disabled={importing || !me.$isLoaded || !me.root}
                  type="button"
                >
                  {importing
                    ? t('import.importing')
                    : t('import.importTitle', { title: preview.title })}
                </button>
              </div>
            </div>
          )}
        </div>
      </Main>
    </>
  );
}
