'use server';

import { clerkClient, currentUser } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { grantCredits } from '../../../lib/credits';

export type PublishedCollectionEntry = {
  slug: string;
  name?: string;
  jazzId: string;
};

export type UserPublishedCollections = {
  userId: string;
  email: string;
  username: string | null;
  collections: PublishedCollectionEntry[];
};

async function isAdmin(): Promise<boolean> {
  const user = await currentUser();
  return user?.publicMetadata?.admin === true;
}

export async function grantCreditsAction(
  email: string,
  amountDollars: number,
): Promise<
  | { ok: true; granted: number; newBalance: number; email: string }
  | { ok: false; error: string }
> {
  if (!(await isAdmin())) return { ok: false, error: 'Forbidden' };
  if (!email || amountDollars <= 0)
    return { ok: false, error: 'email and amountDollars required' };

  const clerk = await clerkClient();
  const results = await clerk.users.getUserList({ emailAddress: [email] });
  const target = results.data[0];
  if (!target) return { ok: false, error: `No user found for ${email}` };

  const cents = Math.round(amountDollars * 100);
  const newBalance = await grantCredits(target.id, cents);

  return { ok: true, granted: cents, newBalance, email };
}

export async function getPublishedCollectionsInfoAction(): Promise<
  { ok: true; users: UserPublishedCollections[] } | { ok: false; error: string }
> {
  if (!(await isAdmin())) return { ok: false, error: 'Forbidden' };

  const clerk = await clerkClient();
  const result: UserPublishedCollections[] = [];
  let offset = 0;

  while (true) {
    const page = await clerk.users.getUserList({ limit: 100, offset });
    if (!page.data.length) break;

    for (const u of page.data) {
      const raw = u.publicMetadata?.publishedCollections as
        | Record<string, string | { id: string; name?: string }>
        | undefined;
      if (!raw || !Object.keys(raw).length) continue;

      const collections: PublishedCollectionEntry[] = Object.entries(raw).map(
        ([slug, val]) => ({
          slug,
          jazzId: typeof val === 'string' ? val : val.id,
          name: typeof val === 'string' ? undefined : val.name,
        }),
      );

      result.push({
        userId: u.id,
        email: u.emailAddresses[0]?.emailAddress ?? '—',
        username: u.username,
        collections,
      });
    }

    if (page.data.length < 100) break;
    offset += 100;
  }

  return { ok: true, users: result };
}
