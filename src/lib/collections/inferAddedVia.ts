import type { NodeAddedVia } from '../../db/schema/addedVia';

/**
 * Best-effort provenance for clients that predate the `addedVia` field.
 * An explicit, known value from the client always wins; otherwise we look at
 * request headers. Never throws and never blocks a save — worst case is 'unknown'.
 *
 * Signals (the client version itself is not available from headers):
 * - Extension popup requests carry `Origin: chrome-extension://…`.
 * - The web app sends its own site origin.
 * - React Native on iOS sends no Origin and a `CFNetwork … Darwin` User-Agent.
 */
export function inferAddedVia(
  request: Request,
  explicit?: NodeAddedVia,
): NodeAddedVia {
  if (explicit && explicit !== 'unknown') return explicit;

  const origin = request.headers.get('origin') ?? '';
  if (/^(chrome|moz|safari-web)-extension:\/\//.test(origin)) {
    return 'extension';
  }
  if (origin) {
    try {
      if (new URL(origin).host === new URL(request.url).host) return 'app';
    } catch {
      // Malformed origin: fall through to 'unknown'.
    }
    return 'unknown';
  }

  const userAgent = request.headers.get('user-agent') ?? '';
  if (/CFNetwork|Darwin/.test(userAgent)) return 'mobile';
  return 'unknown';
}
