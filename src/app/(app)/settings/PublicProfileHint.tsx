'use client';

import { Trans } from '@/i18n/client';
import styles from './settings.module.css';

export function PublicProfileHint({ username }: { username: string }) {
  return (
    <p className={styles.publicProfileHint}>
      <Trans
        i18nKey="settings.profile.publishHint"
        values={{ path: `/s/${username}` }}
        components={{ code: <code /> }}
      />
    </p>
  );
}
