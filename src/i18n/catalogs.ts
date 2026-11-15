import { PSEUDO_LOCALE, type RenderLocale } from './config';
import collections from './locales/en/collections.json';
import common from './locales/en/common.json';
import dialogs from './locales/en/dialogs.json';
import errors from './locales/en/errors.json';
import pages from './locales/en/pages.json';
import slots from './locales/en/slots.json';

/** Deep-merge catalog fragments; later fragments win on key collisions. */
function merge(...parts: Catalog[]): Catalog {
  const out: Catalog = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      const existing = out[key];
      out[key] =
        typeof value === 'string' || typeof existing !== 'object'
          ? value
          : merge(existing, value);
    }
  }
  return out;
}

/**
 * English is split into one file per area so several people (or agents) can
 * add strings without editing the same file. Top-level keys are the areas:
 * `t('dialogs.team.title')`. Other locales mirror this as a single file.
 */
const en = merge(common, slots, collections, dialogs, pages, errors);

import type { Catalog } from './pseudo';
import { pseudoizeCatalog } from './pseudo';

/**
 * Catalog loading. English is bundled (it is the fallback for every locale);
 * other locales are dynamic imports so each is its own chunk and only the
 * active one is ever sent to the browser.
 */
const loaders: Record<string, () => Promise<{ default: Catalog }>> = {
  es: async () => {
    const parts = await Promise.all([
      import('./locales/es/common.json'),
      import('./locales/es/slots.json'),
      import('./locales/es/collections.json'),
      import('./locales/es/dialogs.json'),
      import('./locales/es/pages.json'),
      import('./locales/es/errors.json'),
    ]);
    return { default: merge(...parts.map((p) => p.default as Catalog)) };
  },
};

export const sourceCatalog = en;

export type Resources = Record<string, { translation: Catalog }>;

/** Resources for i18next: the active locale plus English as the fallback. */
export async function loadResources(locale: RenderLocale): Promise<Resources> {
  if (locale === 'en') return { en: { translation: sourceCatalog } };
  if (locale === PSEUDO_LOCALE) {
    return {
      [PSEUDO_LOCALE]: { translation: pseudoizeCatalog(sourceCatalog) },
      en: { translation: sourceCatalog },
    };
  }
  const load = loaders[locale];
  const catalog = load ? (await load()).default : {};
  return {
    [locale]: { translation: catalog },
    en: { translation: sourceCatalog },
  };
}
