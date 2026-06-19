import { Suspense } from 'react';
import { PublicProfileCard } from './PublicProfileCard';
import { SettingsClient } from './SettingsClient';
import styles from './settings.module.css';

export default function SettingsPage() {
  return (
    <SettingsClient
      publicProfileCard={
        <Suspense fallback={<div className={styles.publicProfileSkeleton} />}>
          <PublicProfileCard />
        </Suspense>
      }
    />
  );
}
