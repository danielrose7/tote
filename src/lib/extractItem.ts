import type { TFunction } from 'i18next';
import { type ExtractedMetadata, refreshViaExtension } from './extension';
import { needsEnhancedExtraction } from './extractionHint';

export type ItemExtraction = {
  metadata: ExtractedMetadata | null;
  /** The server read worked but came back thin (blocked / no image). */
  thin: boolean;
  /** Nothing could be read at all (network error or non-OK response). */
  failed: boolean;
};

/**
 * Read a product page for an existing item: the extension first (it reads the
 * page in the user's browser, which bot protection can't stop), then our
 * server. Reports how it went so callers can tell the user instead of
 * silently keeping stale data.
 */
export async function extractItemMetadata(
  url: string,
  useExtension: boolean,
): Promise<ItemExtraction> {
  if (useExtension) {
    const fromExtension = await refreshViaExtension(url, { capture: true });
    if (fromExtension) {
      return { metadata: fromExtension, thin: false, failed: false };
    }
  }
  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) return { metadata: null, thin: false, failed: true };
    const metadata = (await response.json()) as ExtractedMetadata & {
      fetchStatus?: 'ok' | 'blocked' | 'unreachable';
    };
    return {
      metadata,
      thin: needsEnhancedExtraction(metadata),
      failed: false,
    };
  } catch {
    return { metadata: null, thin: false, failed: true };
  }
}

export type RefreshOutcome = {
  total: number;
  thin: number;
  failed: number;
  extensionAvailable: boolean;
};

type ToastMessage = {
  title: string;
  description: string;
  variant: 'info' | 'error';
  key: string;
};

/**
 * Turn a refresh outcome into a user-facing message, or null if all was well.
 * Takes `t` so the text is in the user's language and pluralizes properly.
 */
export function describeRefreshOutcome(
  outcome: RefreshOutcome,
  t: TFunction,
): ToastMessage | null {
  const { total, thin, failed, extensionAvailable } = outcome;
  if (failed > 0) {
    return {
      title: t(
        failed === total ? 'refresh.failedTitleAll' : 'refresh.failedTitleSome',
      ),
      description: t('refresh.failedDescription', { count: failed }),
      variant: 'error',
      key: 'refresh-outcome',
    };
  }
  if (thin > 0) {
    return {
      title: t('refresh.thinTitle'),
      description: t(
        extensionAvailable
          ? 'refresh.thinWithExtension'
          : 'refresh.thinWithoutExtension',
        { count: thin },
      ),
      variant: 'info',
      key: 'refresh-outcome',
    };
  }
  return null;
}
