'use server';

import { clerkClient, currentUser } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { grantCredits } from '@/lib/credits';
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
