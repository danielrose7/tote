'use client';

import { useEffect, useState } from 'react';
import { APP_STORE_URL, CHROME_WEB_STORE_URL } from '@/lib/constants';
import { InstallLabel } from './InstallLabel';

/**
 * Chrome extensions don't run on iOS regardless of which browser the visitor
 * picks there — every iOS browser is a WebKit shell. iPadOS 13+ also drops
 * "iPad" from the UA and reports as a touch-capable Mac, so that combination
 * counts too.
 */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * "Add to Chrome" CTA that becomes an App Store link on iOS, where a browser
 * extension link would be a dead end. Starts as the Chrome CTA to match
 * server-rendered HTML, then corrects after mount — same tradeoff InstallLabel
 * makes for browser-name detection.
 */
export function InstallCta({ className }: { className?: string }) {
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setIos(isIOS());
  }, []);

  if (ios && APP_STORE_URL) {
    return (
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        Get it on the App Store
      </a>
    );
  }

  return (
    <a
      href={CHROME_WEB_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      <InstallLabel />
    </a>
  );
}
