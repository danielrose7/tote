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
    subject: userId,
  });
  const secret =
    apiKey.secret ?? (await clerk.apiKeys.getSecret(apiKey.id)).secret;

  return NextResponse.json({ secret }, { status: 201 });
}
