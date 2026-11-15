'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/client';
import { APP_STORE_URL, CHROME_WEB_STORE_URL } from '@/lib/constants';
import { isIOS } from '@/lib/isIOS';
import { InstallLabel } from './InstallLabel';

/**
 * "Add to Chrome" CTA that becomes an App Store link on iOS, where a browser
 * extension link would be a dead end. Starts as the Chrome CTA to match
 * server-rendered HTML, then corrects after mount — same tradeoff InstallLabel
 * makes for browser-name detection.
 */
export function InstallCta({ className }: { className?: string }) {
  const { t } = useTranslation();
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
        {t('site.install.appStore')}
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
