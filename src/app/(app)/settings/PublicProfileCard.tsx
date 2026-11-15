import { currentUser } from '@clerk/nextjs/server';
import { count, eq } from 'drizzle-orm';
import { publishedCollections } from '@/db/schema';
import { getT } from '@/i18n/server';
import { db } from '@/lib/db';
import { CopyProfileUrl } from './CopyProfileUrl';
import { PublicProfileHint } from './PublicProfileHint';
import styles from './settings.module.css';

export async function PublicProfileCard() {
  const user = await currentUser();
  if (!user) return null;

  const { t } = await getT();

  const { username } = user;

  if (!username) {
    return (
      <div className={styles.publicProfile}>
        <h2 className={styles.publicProfileTitle}>
          {t('settings.profile.title')}
        </h2>
        <p className={styles.publicProfileHint}>
          {t('settings.profile.addUsername')}
        </p>
      </div>
    );
  }

  const [{ value: publishedCount }] = await db
    .select({ value: count() })
    .from(publishedCollections)
    .where(eq(publishedCollections.ownerClerkId, user.id));

  return (
    <div className={styles.publicProfile}>
      <h2 className={styles.publicProfileTitle}>
        {t('settings.profile.title')}
      </h2>
      {publishedCount === 0 ? (
        <PublicProfileHint username={username} />
      ) : (
        <>
          <p className={styles.publicProfileHint}>
            {t('settings.profile.published', { count: publishedCount })}
          </p>
          <CopyProfileUrl username={username} />
        </>
      )}
    </div>
  );
}
