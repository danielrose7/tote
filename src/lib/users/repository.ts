import { clerkClient } from '@clerk/nextjs/server';
import { inArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { db } from '../db';
import { users } from '../../db/schema/users';

export type UserRecord = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  primaryEmail: string | null;
  deletedAt: Date | null;
};

export type UserSummary = {
  id: string;
  displayName: string;
  imageUrl: string;
  email: string | null;
  deleted: boolean;
};

export function toUserSummary(user: UserRecord): UserSummary {
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.primaryEmail ||
    user.id;
  return {
    id: user.id,
    displayName,
    imageUrl: user.imageUrl,
    email: user.primaryEmail,
    deleted: user.deletedAt !== null,
  };
}

export async function upsertUser(
  clerkUserId: string,
  data: {
    firstName: string | null;
    lastName: string | null;
    imageUrl: string;
    primaryEmail: string | null;
  },
  database: NodePgDatabase<Record<string, never>> = db,
): Promise<UserRecord> {
  const [row] = await database
    .insert(users)
    .values({
      id: clerkUserId,
      firstName: data.firstName,
      lastName: data.lastName,
      imageUrl: data.imageUrl,
      primaryEmail: data.primaryEmail,
      deletedAt: null,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        firstName: data.firstName,
        lastName: data.lastName,
        imageUrl: data.imageUrl,
        primaryEmail: data.primaryEmail,
        deletedAt: null,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return row;
}

export async function markUserDeleted(
  clerkUserId: string,
  database: NodePgDatabase<Record<string, never>> = db,
): Promise<void> {
  await database
    .insert(users)
    .values({
      id: clerkUserId,
      firstName: null,
      lastName: null,
      imageUrl: '',
      primaryEmail: null,
      deletedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { deletedAt: sql`now()`, updatedAt: sql`now()` },
    });
}

export async function getUsersByIds(
  clerkUserIds: string[],
  database: NodePgDatabase<Record<string, never>> = db,
): Promise<Map<string, UserRecord>> {
  if (clerkUserIds.length === 0) return new Map();
  const rows = await database
    .select()
    .from(users)
    .where(inArray(users.id, clerkUserIds));
  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * Resolves user summaries for the given Clerk IDs.
 * Fetches from DB first; any missing IDs are pulled from Clerk and upserted.
 */
export async function resolveUsers(
  clerkUserIds: string[],
): Promise<Map<string, UserSummary>> {
  const unique = [...new Set(clerkUserIds)];
  if (unique.length === 0) return new Map();

  const fromDb = await getUsersByIds(unique);

  const missing = unique.filter((id) => !fromDb.has(id));
  if (missing.length > 0) {
    const clerk = await clerkClient();
    const { data: clerkUsers } = await clerk.users.getUserList({
      userId: missing,
      limit: missing.length,
    });
    await Promise.all(
      clerkUsers.map((u) =>
        upsertUser(u.id, {
          firstName: u.firstName,
          lastName: u.lastName,
          imageUrl: u.imageUrl,
          primaryEmail: u.primaryEmailAddress?.emailAddress ?? null,
        }),
      ),
    );
    const freshRows = await getUsersByIds(missing);
    for (const [id, row] of freshRows) fromDb.set(id, row);
  }

  return new Map(
    [...fromDb.entries()].map(([id, row]) => [id, toUserSummary(row)]),
  );
}
