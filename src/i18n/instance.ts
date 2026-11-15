import { createInstance, type i18n } from 'i18next';
import type { Resources } from './catalogs';
import { DEFAULT_LOCALE, type RenderLocale } from './config';

/**
 * One i18next instance per render (server) or per provider (client) — never a
 * module-level singleton, which would leak one request's language into
 * another's on the server.
 */
export function createI18n(locale: RenderLocale, resources: Resources): i18n {
  const instance = createInstance();
  instance.init({
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    resources,
    defaultNS: 'translation',
    interpolation: { escapeValue: false }, // React escapes already
    returnNull: false,
    initAsync: false, // resources are in hand; render synchronously
  });
  return instance;
}
