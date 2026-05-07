import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import {
  deletePublishedCollection,
  upsertPublishedCollection,
} from '../../../../lib/publishedCollectionsDb';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      sourceJazzId,
      jazzPublishedId,
      slug,
      name,
      description,
      color,
      layout,
      allowCloning,
      username,
      topLevelProducts,
      slots,
    } = body;

    if (!sourceJazzId || !slug || !name) {
      return NextResponse.json(
        { error: 'sourceJazzId, slug, and name are required' },
        { status: 400 },
      );
    }

    const id = await upsertPublishedCollection({
      sourceJazzId,
      jazzPublishedId,
      ownerClerkId: userId,
      username: typeof username === 'string' ? username : undefined,
      slug,
      name,
      description,
      color,
      layout: layout ?? 'minimal',
      allowCloning: allowCloning ?? true,
      topLevelProducts: topLevelProducts ?? [],
      slots: slots ?? [],
    });

    return NextResponse.json({ id });
  } catch (error) {
    console.error('[PublishCollection] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to publish', details: String(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sourceJazzId } = await request.json();
    if (!sourceJazzId) {
      return NextResponse.json(
        { error: 'sourceJazzId is required' },
        { status: 400 },
      );
    }

    await deletePublishedCollection(sourceJazzId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PublishCollection] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to unpublish', details: String(error) },
      { status: 500 },
    );
  }
}
