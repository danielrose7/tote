/**
 * Admin account merge: move everything owned by `sourceId` onto `targetId`.
 *
 * Both are Clerk user IDs. Runs as ONE non-interactive Neon transaction, so a
 * failure leaves both accounts exactly as they were. Does not touch Clerk —
 * the caller decides what to do with the source login afterwards.
 *
 * Every table that stores a Clerk user ID must be handled here. When you add a
 * new user-keyed column, add it to `preview` and `mergeAccounts` too.
 */

import { publishRealtimeEvents } from '../collections/realtimePublish';
import { sql } from '../db';

export type MergePreview = {
  collectionsOwned: number;
  collectionMemberships: number;
  publications: number;
  curatorSessions: number;
  creditTransactions: number;
  creditBalanceCents: number;
  /** Target already owns a publication with the same slug as one of source's. */
  slugConflicts: string[];
};

export type MergeResult =
  | { ok: true; preview: MergePreview; targetBalanceCents: number }
  | { ok: false; error: string };

const num = (v: unknown) => Number(v ?? 0);

export async function previewMerge(
  sourceId: string,
  targetId: string,
): Promise<MergePreview> {
  const [counts] = await sql`
    SELECT
      (SELECT COUNT(*) FROM collections WHERE owner_user_id = ${sourceId}) AS collections_owned,
      (SELECT COUNT(*) FROM collection_members WHERE user_id = ${sourceId}) AS memberships,
      (SELECT COUNT(*) FROM published_collections WHERE owner_clerk_id = ${sourceId}) AS publications,
      (SELECT COUNT(*) FROM curator_sessions WHERE clerk_user_id = ${sourceId}) AS curator_sessions,
      (SELECT COUNT(*) FROM credit_transactions WHERE clerk_user_id = ${sourceId}) AS credit_transactions,
      (SELECT COALESCE(SUM(balance_cents), 0) FROM user_credits WHERE clerk_user_id = ${sourceId}) AS balance
  `;
  const conflicts = await sql`
    SELECT s.slug
    FROM published_collections s
    JOIN published_collections t
      ON t.slug = s.slug AND t.owner_clerk_id = ${targetId}
    WHERE s.owner_clerk_id = ${sourceId}
    ORDER BY s.slug
  `;
  return {
    collectionsOwned: num(counts.collections_owned),
    collectionMemberships: num(counts.memberships),
    publications: num(counts.publications),
    curatorSessions: num(counts.curator_sessions),
    creditTransactions: num(counts.credit_transactions),
    creditBalanceCents: num(counts.balance),
    slugConflicts: conflicts.map((r) => String(r.slug)),
  };
}

export async function mergeAccounts(
  sourceId: string,
  targetId: string,
): Promise<MergeResult> {
  if (sourceId === targetId) {
    return { ok: false, error: 'Source and target are the same account' };
  }

  const preview = await previewMerge(sourceId, targetId);
  if (preview.slugConflicts.length > 0) {
    return {
      ok: false,
      error: `Both accounts have a published collection with slug: ${preview.slugConflicts.join(', ')}. Rename or unpublish one first.`,
    };
  }

  // Lower number = more privilege. Revoked memberships rank below every role.
  const results = await sql.transaction((tx) => [
    // --- Collection membership (PK is collection_id + user_id) ---
    // 1. Where both accounts are members, keep the stronger role on target.
    tx`
      UPDATE collection_members t
      SET role = s.role, revoked_at = NULL, updated_at = now()
      FROM collection_members s
      WHERE s.user_id = ${sourceId} AND t.user_id = ${targetId}
        AND s.collection_id = t.collection_id
        AND s.revoked_at IS NULL
        AND (
          t.revoked_at IS NOT NULL
          OR array_position(ARRAY['owner','admin','editor','viewer'], s.role::text)
           < array_position(ARRAY['owner','admin','editor','viewer'], t.role::text)
        )
    `,
    // 2. Drop source rows that now duplicate a target row.
    tx`
      DELETE FROM collection_members
      WHERE user_id = ${sourceId}
        AND collection_id IN (
          SELECT collection_id FROM collection_members WHERE user_id = ${targetId}
        )
    `,
    // 3. Move the rest.
    tx`UPDATE collection_members SET user_id = ${targetId}, updated_at = now() WHERE user_id = ${sourceId}`,
    tx`UPDATE collection_members SET invited_by_user_id = ${targetId} WHERE invited_by_user_id = ${sourceId}`,

    // --- Collections and their attribution columns ---
    tx`UPDATE collections SET owner_user_id = ${targetId}, updated_at = now() WHERE owner_user_id = ${sourceId}`,
    tx`UPDATE collection_nodes SET created_by_user_id = ${targetId} WHERE created_by_user_id = ${sourceId}`,
    tx`UPDATE collection_invites SET created_by_user_id = ${targetId} WHERE created_by_user_id = ${sourceId}`,
    tx`UPDATE collection_membership_events SET actor_user_id = ${targetId} WHERE actor_user_id = ${sourceId}`,
    tx`UPDATE collection_membership_events SET subject_user_id = ${targetId} WHERE subject_user_id = ${sourceId}`,
    tx`UPDATE collection_lineage SET created_by_user_id = ${targetId} WHERE created_by_user_id = ${sourceId}`,
    tx`UPDATE collection_lineage SET source_owner_user_id = ${targetId} WHERE source_owner_user_id = ${sourceId}`,

    // Idempotency receipts are 30-day caches keyed by user; safe to discard.
    tx`DELETE FROM collection_mutation_receipts WHERE user_id = ${sourceId}`,

    // --- Publications (slug conflicts were rejected above) ---
    tx`UPDATE published_collections SET owner_clerk_id = ${targetId} WHERE owner_clerk_id = ${sourceId}`,

    // --- Curator + credits ---
    tx`UPDATE curator_sessions SET clerk_user_id = ${targetId} WHERE clerk_user_id = ${sourceId}`,
    tx`UPDATE credit_transactions SET clerk_user_id = ${targetId} WHERE clerk_user_id = ${sourceId}`,
    tx`
      INSERT INTO user_credits (clerk_user_id, balance_cents, stripe_customer_id)
      SELECT ${targetId}, balance_cents, stripe_customer_id
      FROM user_credits WHERE clerk_user_id = ${sourceId}
      ON CONFLICT (clerk_user_id) DO UPDATE SET
        balance_cents = user_credits.balance_cents + EXCLUDED.balance_cents,
        stripe_customer_id = COALESCE(user_credits.stripe_customer_id, EXCLUDED.stripe_customer_id),
        updated_at = now()
    `,
    tx`DELETE FROM user_credits WHERE clerk_user_id = ${sourceId}`,

    // --- Users table: hide the retired account from team lists ---
    tx`UPDATE users SET deleted_at = now(), updated_at = now() WHERE id = ${sourceId}`,

    // --- Realtime: channels whose open clients should refetch (published below) ---
    tx`
      SELECT 'user:' || ${sourceId} || ':collections' AS channel
      UNION SELECT 'user:' || ${targetId} || ':collections'
      UNION SELECT 'collection:' || collection_id::text
        FROM collection_members WHERE user_id = ${targetId}
    `,
    tx`SELECT balance_cents FROM user_credits WHERE clerk_user_id = ${targetId}`,
  ]);

  const channelRows = results[results.length - 2] as { channel: string }[];
  const balanceRows = results[results.length - 1] as {
    balance_cents: number;
  }[];
  // The transaction has committed; tell open clients on either account to refetch.
  await publishRealtimeEvents(
    channelRows.map(({ channel }) => ({
      channel,
      name: 'account.merged',
      data: {},
    })),
  );
  return {
    ok: true,
    preview,
    targetBalanceCents: num(balanceRows[0]?.balance_cents),
  };
}
