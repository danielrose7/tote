import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublishedCollectionsByOwner } from '../../../../lib/publishedCollectionsDb';
import styles from './page.module.css';

type Params = Promise<{ username: string }>;

async function resolveClerkUserId(username: string): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return null;
  const res = await fetch(
    `https://api.clerk.com/v1/users?username=${encodeURIComponent(username)}&limit=1`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
      next: { revalidate: 60 },
    },
  );
  if (!res.ok) return null;
  const users = await res.json();
  return users[0]?.id ?? null;
}

export async function generateMetadata(props: {
  params: Params;
}): Promise<Metadata> {
  const { username } = await props.params;
  return {
    title: `${username}'s collections on Tote`,
    description: `Browse public collections curated by ${username}.`,
  };
}

export default async function UserCollectionsPage(props: { params: Params }) {
  const { username } = await props.params;
  const clerkUserId = await resolveClerkUserId(username);

  if (!clerkUserId) {
    return <NotFound username={username} />;
  }

  const collections = await getPublishedCollectionsByOwner(clerkUserId);

  if (collections.length === 0) {
    return <NotFound username={username} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>{username}</h1>
        <p className={styles.subheading}>
          {collections.length}{' '}
          {collections.length === 1 ? 'collection' : 'collections'}
        </p>
      </header>
      <main className={styles.grid}>
        {collections.map((c) => (
          <Link
            key={c.id}
            href={`/s/${username}/${c.slug}`}
            className={styles.card}
          >
            <h2 className={styles.cardTitle}>{c.name}</h2>
            {c.description && (
              <p className={styles.cardDescription}>{c.description}</p>
            )}
            <p className={styles.cardMeta}>
              {c.itemCount} {c.itemCount === 1 ? 'item' : 'items'}
            </p>
          </Link>
        ))}
      </main>
      <footer className={styles.footer}>
        <p>
          Powered by{' '}
          <a href="/" className={styles.footerLink}>
            Tote
          </a>
        </p>
      </footer>
    </div>
  );
}

function NotFound({ username }: { username: string }) {
  return (
    <div className={styles.notFound}>
      <h1 className={styles.notFoundTitle}>No collections found</h1>
      <p className={styles.notFoundText}>
        {username} hasn&apos;t published any collections yet.
      </p>
    </div>
  );
}
