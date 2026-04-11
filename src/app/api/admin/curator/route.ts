import { NextResponse } from 'next/server';
import { currentUser, clerkClient } from '@clerk/nextjs/server';

async function isAdmin(): Promise<boolean> {
  const user = await currentUser();
  return user?.publicMetadata?.admin === true;
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId, curator } = await request.json();
  if (!userId || typeof curator !== 'boolean') {
    return NextResponse.json(
      { error: 'userId and curator (boolean) required' },
      { status: 400 },
    );
  }

  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: { curator },
  });

  return NextResponse.json({ userId, curator });
}
