'use server';

import { clerkClient, currentUser } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { grantCredits } from '@/lib/credits';
import {
  type MergePreview,
  type MergeResult,
  mergeAccounts,
  previewMerge,
} from '@/lib/users/mergeAccounts';
import { upsertUser } from '@/lib/users/repository';

export async function grantCreditsAction(
  email: string,
  amountDollars: number,
): Promise<
  | { ok: true; granted: number; newBalance: number; email: string }
  | { ok: false; error: string }
> {
  const admin = await currentUser();
  if (admin?.publicMetadata?.admin !== true)
    return { ok: false, error: 'Forbidden' };
  if (!email || amountDollars <= 0)
    return { ok: false, error: 'email and amountDollars required' };

  const clerk = await clerkClient();
  const results = await clerk.users.getUserList({ emailAddress: [email] });
  const target = results.data[0];
  if (!target) return { ok: false, error: `No user found for ${email}` };

  const cents = Math.round(amountDollars * 100);
  const newBalance = await grantCredits(target.id, cents);
  revalidatePath('/admin');

  return { ok: true, granted: cents, newBalance, email };
}

export async function seedUsersAction(): Promise<
  { ok: true; upserted: number } | { ok: false; error: string }
> {
  const admin = await currentUser();
  if (admin?.publicMetadata?.admin !== true)
    return { ok: false, error: 'Forbidden' };

  const clerk = await clerkClient();
  let upserted = 0;
  let offset = 0;
  const limit = 500;

  while (true) {
    const { data, totalCount } = await clerk.users.getUserList({
      limit,
      offset,
      orderBy: '+created_at',
    });
    if (data.length === 0) break;

    await Promise.all(
      data.map((u) =>
        upsertUser(u.id, {
          firstName: u.firstName,
          lastName: u.lastName,
          imageUrl: u.imageUrl,
          primaryEmail:
            u.primaryEmailAddress?.emailAddress ??
            u.emailAddresses[0]?.emailAddress ??
            null,
        }),
      ),
    );

    upserted += data.length;
    offset += data.length;
    if (offset >= totalCount) break;
  }

  return { ok: true, upserted };
}

type MergeAccountSummary = {
  id: string;
  email: string;
  name: string;
  /** Verified addresses only; these are the ones that can be moved. */
  verifiedEmails: string[];
  /** OAuth logins (e.g. oauth_google). Clerk can't move these between users. */
  externalProviders: string[];
};

async function findAccount(
  email: string,
): Promise<MergeAccountSummary | string> {
  const clerk = await clerkClient();
  const { data } = await clerk.users.getUserList({ emailAddress: [email] });
  const user = data[0];
  if (!user) return `No user found for ${email}`;
  return {
    id: user.id,
    email,
    name: [user.firstName, user.lastName].filter(Boolean).join(' '),
    verifiedEmails: user.emailAddresses
      .filter((e) => e.verification?.status === 'verified')
      .map((e) => e.emailAddress),
    externalProviders: user.externalAccounts.map((a) => a.provider),
  };
}

export async function previewMergeAction(
  sourceEmail: string,
  targetEmail: string,
): Promise<
  | {
      ok: true;
      source: MergeAccountSummary;
      target: MergeAccountSummary;
      preview: MergePreview;
    }
  | { ok: false; error: string }
> {
  const admin = await currentUser();
  if (admin?.publicMetadata?.admin !== true)
    return { ok: false, error: 'Forbidden' };

  const [source, target] = await Promise.all([
    findAccount(sourceEmail.trim()),
    findAccount(targetEmail.trim()),
  ]);
  if (typeof source === 'string') return { ok: false, error: source };
  if (typeof target === 'string') return { ok: false, error: target };
  if (source.id === target.id)
    return { ok: false, error: 'Both emails belong to the same account' };

  return {
    ok: true,
    source,
    target,
    preview: await previewMerge(source.id, target.id),
  };
}

export type MergeActionResult =
  | (Extract<MergeResult, { ok: true }> & { clerk: ClerkOutcome })
  | { ok: false; error: string };

type ClerkOutcome =
  | { status: 'skipped' }
  | { status: 'done'; movedEmails: string[] }
  | { status: 'failed'; error: string };

/**
 * Clerk enforces one owner per email address, so an address must be freed on
 * the old user (by deleting it) before it can be attached to the kept user.
 * Not atomic with the DB merge: runs after it, and a failure here leaves the
 * data merged — the admin can finish by hand in the Clerk dashboard.
 */
async function moveEmailsInClerk(
  sourceId: string,
  targetId: string,
  emails: string[],
): Promise<ClerkOutcome> {
  try {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(sourceId);
    const moved: string[] = [];
    for (const emailAddress of emails) {
      await clerk.emailAddresses.createEmailAddress({
        userId: targetId,
        emailAddress,
        verified: true,
        primary: false, // the kept account's primary email stays primary
      });
      moved.push(emailAddress);
    }
    return { status: 'done', movedEmails: moved };
  } catch (err) {
    console.error('[Admin] Clerk email move failed', err);
    return {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function mergeAccountsAction(
  sourceId: string,
  targetId: string,
  moveEmails: boolean,
): Promise<MergeActionResult> {
  const admin = await currentUser();
  if (admin?.publicMetadata?.admin !== true)
    return { ok: false, error: 'Forbidden' };

  console.info(`[Admin] ${admin.id} merging ${sourceId} -> ${targetId}`);
  try {
    // Read the old user's emails first; they're unreadable once it's deleted.
    const clerk = await clerkClient();
    const source = await clerk.users.getUser(sourceId);
    const emails = source.emailAddresses
      .filter((e) => e.verification?.status === 'verified')
      .map((e) => e.emailAddress);

    const result = await mergeAccounts(sourceId, targetId);
    revalidatePath('/admin');
    if (!result.ok) return result;
    const clerkOutcome: ClerkOutcome = moveEmails
      ? await moveEmailsInClerk(sourceId, targetId, emails)
      : { status: 'skipped' };
    return { ...result, clerk: clerkOutcome };
  } catch (err) {
    console.error('[Admin] merge failed', err);
    return {
      ok: false,
      error: `Merge failed and was rolled back: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
