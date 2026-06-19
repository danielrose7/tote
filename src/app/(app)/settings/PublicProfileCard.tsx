import { currentUser } from '@clerk/nextjs/server';
import { count, eq } from 'drizzle-orm';
import { publishedCollections } from '@/db/schema';
import { db } from '@/lib/db';
import { CopyProfileUrl } from './CopyProfileUrl';
import styles from './settings.module.css';

export async function PublicProfileCard() {
  const user = await currentUser();
  if (!user) return null;

  const { username } = user;

  if (!username) {
    return (
      <div className={styles.publicProfile}>
        <h2 className={styles.publicProfileTitle}>Your public profile</h2>
        <p className={styles.publicProfileHint}>
          Add a username in the profile below to get a public profile URL.
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
      <h2 className={styles.publicProfileTitle}>Your public profile</h2>
      {publishedCount === 0 ? (
        <p className={styles.publicProfileHint}>
          Publish a collection to activate your public profile at{' '}
          <code>/s/{username}</code>. Collections are private by default.
        </p>
      ) : (
        <>
          <p className={styles.publicProfileHint}>
            {publishedCount}{' '}
            {publishedCount === 1 ? 'collection' : 'collections'} published.
          </p>
          <CopyProfileUrl username={username} />
        </>
      )}
    </div>
  );
}
