'use client';

import { useEffect, useState } from 'react';

type BrowserName = 'Chrome' | 'Edge' | 'Brave' | 'Arc';

const STORAGE_KEY = 'tote:browser';

/**
 * Resolved once per page load and shared by every InstallLabel on the page.
 * Without this, each client-side navigation remounts the label, restarts
 * detection, and flashes "Chrome" before settling on the real name.
 *
 * The answer is also cached in localStorage, which is per-browser — Arc's
 * storage is not Chrome's, so a cached value can never belong to a different
 * browser. Detection still re-runs in the background on each load, so a value
 * that was wrong once (Brave withholding its API, say) corrects itself.
 */
let resolved: BrowserName | null = null;
let inFlight: Promise<BrowserName> | null = null;

function readCachedBrowser(): BrowserName | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'Chrome' ||
      stored === 'Edge' ||
      stored === 'Brave' ||
      stored === 'Arc'
      ? stored
      : null;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); detection
    // still works, it just re-runs on the next load.
    return null;
  }
}

/**
 * Best-effort detection of the Chromium browser the visitor is using, so the
 * install CTA can say "Add to Brave" instead of "Add to Chrome". Every one of
 * these installs from the Chrome Web Store, so the link never changes — only
 * the word does, and Chrome is the fallback whenever we can't tell.
 */
async function detectBrowser(): Promise<BrowserName> {
  // Brave ships an official detection API. It resolves false (or is absent) on
  // every other browser.
  try {
    const brave = (
      navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }
    ).brave;
    if (await brave?.isBrave?.()) return 'Brave';
  } catch {
    // Brave withholds the API in some contexts; fall through to the others.
  }

  const brands = (
    navigator as Navigator & {
      userAgentData?: { brands?: { brand: string }[] };
    }
  ).userAgentData?.brands;
  if (brands?.some((entry) => entry.brand === 'Microsoft Edge')) return 'Edge';
  if (!brands && / Edg\//.test(navigator.userAgent)) return 'Edge';

  if (isArc()) return 'Arc';

  // Arc injects its palette only after the page finishes loading, so a miss
  // here isn't final — check once more before settling on Chrome.
  await new Promise((r) => window.setTimeout(r, 400));
  return isArc() ? 'Arc' : 'Chrome';
}

/** Arc has no API; it injects --arc-palette-* custom properties onto :root. */
function isArc(): boolean {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue('--arc-palette-background')
      .trim() !== ''
  );
}

function resolveBrowser(): Promise<BrowserName> {
  if (!inFlight) {
    inFlight = detectBrowser().then((name) => {
      resolved = name;
      try {
        localStorage.setItem(STORAGE_KEY, name);
      } catch {
        // Non-fatal; see readCachedBrowser.
      }
      return name;
    });
  }
  return inFlight;
}

export function InstallLabel({ prefix = 'Add to ' }: { prefix?: string }) {
  // Later mounts start from the resolved value, so navigating between pages
  // never flashes. The first mount still starts at Chrome to match the
  // server-rendered HTML.
  const [browser, setBrowser] = useState<BrowserName>(
    () => resolved ?? 'Chrome',
  );

  useEffect(() => {
    if (resolved) {
      setBrowser(resolved);
      return;
    }

    // A previous load already worked it out — show that straight away, then
    // re-detect underneath and correct it if it disagrees.
    const cached = readCachedBrowser();
    if (cached) {
      resolved = cached;
      setBrowser(cached);
    }

    let cancelled = false;
    void resolveBrowser().then((name) => {
      if (!cancelled) setBrowser(name);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // One string, not two nodes — otherwise React splits the label with a comment
  // marker and the CTA text stops being a single crawlable phrase.
  return <>{`${prefix}${browser}`}</>;
}
