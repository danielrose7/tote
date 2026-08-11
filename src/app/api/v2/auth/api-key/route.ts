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

/**
 * Revokes the caller's Share Extension key on sign out or account deletion.
 *
 * The client sends back the secret it holds rather than a key id, so nothing
 * extra has to be persisted alongside it in the Keychain. We resolve the secret
 * to its key and revoke only that one — each device provisions its own key, so
 * signing out here must not disturb the same account on another device.
 */
export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const secret = body?.secret;
  if (typeof secret !== 'string' || secret.length === 0) {
    return NextResponse.json({ error: 'secret is required' }, { status: 400 });
  }

  const clerk = await clerkClient();

  let apiKey: Awaited<ReturnType<typeof clerk.apiKeys.verify>>;
  try {
    apiKey = await clerk.apiKeys.verify(secret);
  } catch {
    // Already revoked, expired, or never valid — the caller's goal is met.
    return NextResponse.json({ revoked: false });
  }

  // Never let one account revoke another's key.
  if (apiKey.subject !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await clerk.apiKeys.revoke({
    apiKeyId: apiKey.id,
    revocationReason: 'Signed out on iOS',
  });

  return NextResponse.json({ revoked: true });
}
