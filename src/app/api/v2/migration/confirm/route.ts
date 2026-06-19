import { clerkClient } from '@clerk/nextjs/server';
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { confirmCollectionMigration } from '@/lib/collections/migrationRepository';
import { db } from '@/lib/db';

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await confirmCollectionMigration(userId, db);
  if (result.status === 'not_ready') {
    return NextResponse.json(
      { error: 'Migration is not ready for cutover' },
      { status: 409 },
    );
  }
  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: { neonCollectionsEnabled: true },
  });
  return NextResponse.json(result.value);
}
