import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import {
  collectionIdSchema,
  parseJsonRequest,
  transferCollectionOwnershipInputSchema,
} from '@/lib/collections/api';
import { transferCollectionOwnership } from '@/lib/collections/teamRepository';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const parsedId = collectionIdSchema.safeParse(id);
  const body = await parseJsonRequest(request);
  if (!parsedId.success || !body.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const parsed = transferCollectionOwnershipInputSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid ownership transfer', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await transferCollectionOwnership(
    userId,
    parsedId.data,
    parsed.data.targetUserId,
  );
  if (result.status === 'not_found') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (result.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (
    result.status === 'version_conflict' ||
    result.status === 'idempotency_conflict'
  ) {
    return NextResponse.json({ error: 'Conflict' }, { status: 409 });
  }

  return NextResponse.json(result.value);
}
