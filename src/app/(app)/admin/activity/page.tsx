import { clerkClient, currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Main } from '@/components/Main/Main';
import { sql } from '@/lib/db';
import styles from '../admin.module.css';

/**
 * Admin activity overview.
 *
 * Privacy contract (see /privacy "Aggregate usage data"): counts and
 * timestamps only. Never select titles, URLs, collection names, or any saved
 * content here, and don't add new tracking — everything below is derived from
 * data the product already stores (Clerk's own createdAt/lastActiveAt and
 * row counts in Postgres).
 */

const DAY = 24 * 60 * 60 * 1000;
const USER_CAP = 1000; // Clerk pages of 500; plenty at current scale.

async function listClerkUsers() {
  const clerk = await clerkClient();
  const users = [];
  let total = 0;
  while (users.length < USER_CAP) {
    const { data, totalCount } = await clerk.users.getUserList({
      limit: 500,
      offset: users.length,
      orderBy: '-created_at',
    });
    total = totalCount;
    users.push(...data);
    if (data.length === 0 || users.length >= totalCount) break;
  }
  return { users, total };
}

const fmt = (ms: number | null) =>
  ms ? new Date(ms).toLocaleDateString() : '—';

export default async function ActivityPage() {
  const admin = await currentUser();
  if (!admin) redirect('/sign-in');
  if (admin.publicMetadata?.admin !== true) redirect('/');

  const [{ users, total }, [totals], perAccount, [curator], published] =
    await Promise.all([
      listClerkUsers(),
      sql`
        SELECT
          (SELECT COUNT(*) FROM collections WHERE deleted_at IS NULL) AS collections,
          (SELECT COUNT(*) FROM collection_nodes
             WHERE deleted_at IS NULL AND type <> 'section') AS items,
          (SELECT COUNT(*) FROM published_collections) AS published
      `,
      sql`
        SELECT c.owner_user_id AS user_id,
               COUNT(DISTINCT c.id) AS collections,
               COUNT(n.id) FILTER (WHERE n.type <> 'section') AS items,
               GREATEST(MAX(c.updated_at), MAX(n.updated_at)) AS last_edit
        FROM collections c
        LEFT JOIN collection_nodes n
          ON n.collection_id = c.id AND n.deleted_at IS NULL
        WHERE c.deleted_at IS NULL
        GROUP BY c.owner_user_id
      `,
      sql`
        SELECT COUNT(*) AS sessions
        FROM curator_sessions
        WHERE created_at > now() - interval '30 days'
      `,
      // Published collections are public by the owner's choice, so name and
      // link are fair game here; private collections never appear.
      sql`
        SELECT id, owner_clerk_id, username, slug, name, published_at
        FROM published_collections
        ORDER BY published_at DESC
        LIMIT 100
      `,
    ]);

  const now = Date.now();
  const joinedSince = (days: number) =>
    users.filter((u) => now - u.createdAt < days * DAY).length;
  const activeSince = (days: number) =>
    users.filter((u) => u.lastActiveAt && now - u.lastActiveAt < days * DAY)
      .length;

  const statsByUser = new Map(
    perAccount.map((r) => [
      String(r.user_id),
      {
        collections: Number(r.collections),
        items: Number(r.items),
        lastEdit: r.last_edit ? new Date(String(r.last_edit)).getTime() : null,
      },
    ]),
  );
  const withData = users.filter((u) => statsByUser.has(u.id)).length;

  const tiles: [string, string | number][] = [
    ['Accounts', total],
    ['Joined, last 7 days', joinedSince(7)],
    ['Joined, last 30 days', joinedSince(30)],
    ['Active, last 7 days', activeSince(7)],
    ['Active, last 30 days', activeSince(30)],
    ['Accounts with a collection', `${withData} / ${users.length}`],
    ['Collections', Number(totals.collections)],
    ['Saved items', Number(totals.items)],
    ['Published collections', Number(totals.published)],
    ['Curator runs, last 30 days', Number(curator.sessions)],
  ];

  const recent = users.slice(0, 50);
  const emailById = new Map(
    users.map((u) => [
      u.id,
      u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress,
    ]),
  );

  return (
    <Main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.heading}>Activity</h1>
        <p>
          <Link href="/admin">← Admin</Link>
        </p>
        <p className={styles.empty}>
          Counts only for private data. Only collections the owner chose to
          publish are listed by name.
          {users.length < total &&
            ` Clerk figures cover the newest ${users.length} accounts.`}
        </p>

        <section className={styles.section}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <tbody>
                {tiles.map(([label, value]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>
                      <strong>{value}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>
            Published collections ({Number(totals.published)})
          </h2>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Collection</th>
                  <th>Owner</th>
                  <th>Published</th>
                </tr>
              </thead>
              <tbody>
                {published.map((c) => {
                  const href = c.username
                    ? `/s/${c.username}/${c.slug}`
                    : `/view/${c.id}`;
                  return (
                    <tr key={String(c.id)}>
                      <td>
                        <div>{String(c.name)}</div>
                        <a
                          href={`https://tote.tools${href}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <code>tote.tools{href}</code>
                        </a>
                      </td>
                      <td>
                        {emailById.get(String(c.owner_clerk_id)) ??
                          String(c.owner_clerk_id)}
                      </td>
                      <td>
                        {new Date(String(c.published_at)).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Newest accounts</h2>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Joined</th>
                  <th>Last active</th>
                  <th>Collections</th>
                  <th>Items</th>
                  <th>Last edit</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((u) => {
                  const s = statsByUser.get(u.id);
                  return (
                    <tr key={u.id}>
                      <td>
                        {u.primaryEmailAddress?.emailAddress ??
                          u.emailAddresses[0]?.emailAddress ??
                          '—'}
                      </td>
                      <td>{fmt(u.createdAt)}</td>
                      <td>{fmt(u.lastActiveAt)}</td>
                      <td>{s?.collections ?? 0}</td>
                      <td>{s?.items ?? 0}</td>
                      <td>{fmt(s?.lastEdit ?? null)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Main>
  );
}
