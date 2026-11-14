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

/** Turn a refresh outcome into a user-facing message, or null if all was well. */
export function describeRefreshOutcome(
  outcome: RefreshOutcome,
): ToastMessage | null {
  const { total, thin, failed, extensionAvailable } = outcome;
  const noun = (n: number) => (n === 1 ? '1 item' : `${n} items`);
  if (failed > 0) {
    return {
      title: failed === total ? 'Refresh failed' : 'Some items failed',
      description: `Couldn't read ${noun(failed)}. Check your connection and try again.`,
      variant: 'error',
      key: 'refresh-outcome',
    };
  }
  if (thin > 0) {
    return {
      title: 'Some details are missing',
      description: extensionAvailable
        ? `${noun(thin)} limit what can be read, even with the extension. You can add the details by hand.`
        : `${noun(thin)} limit what our servers can read. The Tote extension reads pages in your browser and usually gets the image and price.`,
      variant: 'info',
      key: 'refresh-outcome',
    };
  }
  return null;
}
