import type { FetchStatus } from '@/app/lib/extractors';

// How long a dismissed "get better results" tip stays hidden.
export const EXTRACTION_HINT_SNOOZE_MS = 5 * 24 * 60 * 60 * 1000;
const STORAGE_KEY = 'tote:extraction-hint-dismissed-at';

type ServerExtraction = {
  fetchStatus?: FetchStatus;
  imageUrl?: string;
  title?: string;
};

/**
 * True when a server-side extraction came back too thin to trust: the site
 * blocked or was unreachable for the server, or the page gave us no image.
 * The item still saves either way; this only decides whether to suggest the
 * extension / app, which read the page in the user's own browser.
 */
export function needsEnhancedExtraction(result: ServerExtraction): boolean {
  if (result.fetchStatus && result.fetchStatus !== 'ok') return true;
  return !result.imageUrl;
}

// localStorage is a per-viewer convenience only; every access is guarded
// because it can throw (private windows, blocked site data).
export function isExtractionHintSnoozed(now = Date.now()): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    return (
      Number.isFinite(dismissedAt) &&
      now - dismissedAt < EXTRACTION_HINT_SNOOZE_MS
    );
  } catch {
    return false;
  }
}

export function snoozeExtractionHint(now = Date.now()): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(now));
  } catch {
    // Not remembering the dismissal is harmless; the tip just shows again.
  }
}
