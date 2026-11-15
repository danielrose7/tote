/**
 * Chrome extensions don't run on iOS regardless of which browser the visitor
 * picks there — every iOS browser is a WebKit shell. iPadOS 13+ also drops
 * "iPad" from the UA and reports as a touch-capable Mac, so that combination
 * counts too. Browser-only: returns false during SSR.
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** True when the page runs as an installed home-screen web app. */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  );
}
