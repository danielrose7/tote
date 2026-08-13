'use client';

import { useEffect, useState } from 'react';

type BrowserName = 'Chrome' | 'Edge' | 'Brave' | 'Arc';

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

  // Arc has no API. It injects a palette of CSS custom properties onto :root,
  // but only once the page has finished loading — hence the caller's delay.
  const arcPalette = getComputedStyle(
    document.documentElement,
  ).getPropertyValue('--arc-palette-background');
  if (arcPalette.trim() !== '') return 'Arc';

  return 'Chrome';
}

export function InstallLabel({ prefix = 'Add to ' }: { prefix?: string }) {
  const [browser, setBrowser] = useState<BrowserName>('Chrome');

  useEffect(() => {
    let cancelled = false;

    // Give Arc a moment to inject its palette before we decide.
    const timer = window.setTimeout(() => {
      void detectBrowser().then((name) => {
        if (!cancelled) setBrowser(name);
      });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  // One string, not two nodes — otherwise React splits the label with a comment
  // marker and the CTA text stops being a single crawlable phrase.
  return <>{`${prefix}${browser}`}</>;
}
