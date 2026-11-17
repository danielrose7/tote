import { isLocale, type Locale } from '@/i18n/config';

const LANGUAGE_NAMES: Record<Locale, string | null> = {
  en: null,
  es: 'Spanish (neutral Latin American, informal "tú")',
  de: 'German (informal "du")',
};

/**
 * Instruction appended to a system prompt so the model writes user-facing text
 * in the user's language. Empty for English (and unknown or pseudo locales),
 * so English prompts are byte-for-byte unchanged.
 *
 * Only prose changes language: JSON keys, enum values, ids, URLs and brand or
 * product names must stay exactly as the schema asks, or parsing breaks.
 */
export function outputLanguageDirective(locale: string | null | undefined) {
  if (!isLocale(locale)) return '';
  const language = LANGUAGE_NAMES[locale];
  if (!language) return '';
  return `\n\nOutput language: write every user-facing string you produce (questions, answer options, titles, descriptions, notes, replies) in ${language}. Keep JSON keys, enum values, ids, URLs, tool and schema field names, brand names and product names exactly as specified; do not translate them.`;
}
