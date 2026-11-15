import { PSEUDO_LOCALE, type RenderLocale } from './config';
import en from './locales/en/common.json';
import type { Catalog } from './pseudo';
import { pseudoizeCatalog } from './pseudo';

/**
 * Catalog loading. English is bundled (it is the fallback for every locale);
 * other locales are dynamic imports so each is its own chunk and only the
 * active one is ever sent to the browser.
 */
const loaders: Record<string, () => Promise<{ default: Catalog }>> = {
  // es: () => import('./locales/es/common.json'),
};

export const sourceCatalog = en as Catalog;

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
