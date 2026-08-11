import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import {
  collectionIdSchema,
  deleteCollectionNodeInputSchema,
  parseJsonRequest,
  updateCollectionNodeInputSchema,
} from '@/lib/collections/api';
import {
  deleteCollectionNode,
  updateCollectionNode,
} from '@/lib/collections/repository';

type RouteContext = {
  params: Promise<{ id: string; nodeId: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, nodeId } = await params;
  const parsedCollectionId = collectionIdSchema.safeParse(id);
  const parsedNodeId = collectionIdSchema.safeParse(nodeId);
  const body = await parseJsonRequest(request);
  if (!parsedCollectionId.success || !parsedNodeId.success || !body.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const parsed = updateCollectionNodeInputSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid node update', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await updateCollectionNode(
    userId,
    parsedCollectionId.data,
    parsedNodeId.data,
    parsed.data,
  );
  if (result.status === 'not_found') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (result.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (result.status === 'version_conflict') {
    return NextResponse.json({ error: 'Version conflict' }, { status: 409 });
  }
  if (result.status === 'idempotency_conflict') {
    return NextResponse.json(
      { error: 'Mutation id was already used for another request' },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ...result.value,
    replayed: result.replayed ?? false,
  });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, nodeId } = await params;
  const parsedCollectionId = collectionIdSchema.safeParse(id);
  const parsedNodeId = collectionIdSchema.safeParse(nodeId);
  const body = await parseJsonRequest(request);
  if (!parsedCollectionId.success || !parsedNodeId.success || !body.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const parsed = deleteCollectionNodeInputSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid node deletion', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await deleteCollectionNode(
    userId,
    parsedCollectionId.data,
    parsedNodeId.data,
    parsed.data,
  );
  if (result.status === 'not_found') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (result.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (result.status === 'version_conflict') {
    return NextResponse.json({ error: 'Version conflict' }, { status: 409 });
  }
  if (result.status === 'idempotency_conflict') {
    return NextResponse.json(
      { error: 'Mutation id was already used for another request' },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ...result.value,
    replayed: result.replayed ?? false,
  });
}
