import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clerk = await clerkClient();
  const apiKey = await clerk.apiKeys.create({
    name: 'iOS Share Extension',
    subject: `user:${userId}`,
  });

  return NextResponse.json({ secret: apiKey.secret }, { status: 201 });
}
