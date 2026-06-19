import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import {
  parseJsonRequest,
  saveCaptureInputSchema,
} from '@/lib/collections/api';
import {
  listCaptureCollections,
  saveCapture,
} from '@/lib/collections/captureRepository';
import { db } from '@/lib/db';

async function authorizedNeonUser() {
  const { userId } = await auth();
  if (!userId) return { status: 401 as const };
  return { status: 200 as const, userId };
}

export async function GET() {
  const authorized = await authorizedNeonUser();
  if (authorized.status !== 200) {
    return NextResponse.json(
      {
        error:
          authorized.status === 404
            ? 'Not found'
            : authorized.status === 401
              ? 'Unauthorized'
              : 'Neon collections are not enabled',
        ...('dataSource' in authorized
          ? { dataSource: authorized.dataSource }
          : {}),
      },
      { status: authorized.status },
    );
  }
  return NextResponse.json({
    collections: await listCaptureCollections(authorized.userId, db),
  });
}

export async function POST(request: Request) {
  const authorized = await authorizedNeonUser();
  if (authorized.status !== 200) {
    return NextResponse.json(
      {
        error:
          authorized.status === 404
            ? 'Not found'
            : authorized.status === 401
              ? 'Unauthorized'
              : 'Neon collections are not enabled',
        ...('dataSource' in authorized
          ? { dataSource: authorized.dataSource }
          : {}),
      },
      { status: authorized.status },
    );
  }
  const body = await parseJsonRequest(request);
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = saveCaptureInputSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid capture', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const result = await saveCapture(authorized.userId, parsed.data, db);
  if (result.status === 'not_found') {
    return NextResponse.json(
      { error: 'Collection or section not found' },
      { status: 404 },
    );
  }
  if (result.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (result.status === 'idempotency_conflict') {
    return NextResponse.json(
      { error: 'Mutation id was already used for another request' },
      { status: 409 },
    );
  }
  if (result.status === 'version_conflict') {
    return NextResponse.json({ error: 'Version conflict' }, { status: 409 });
  }
  return NextResponse.json(
    { ...result.value, replayed: result.replayed ?? false },
    { status: result.replayed ? 200 : 201 },
  );
}
