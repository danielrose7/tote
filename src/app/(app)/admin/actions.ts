'use server';

import { currentUser, clerkClient } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { grantCredits } from '../../../lib/credits';

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
