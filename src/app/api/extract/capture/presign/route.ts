import { NextResponse } from 'next/server';
import { isCurator } from '../../../../../inngest/curator-auth';
import { presignR2PutUrl } from '../../../../../lib/r2';

function buildR2Key(url: string): string {
  const parsed = new URL(url);
  const domain = parsed.hostname.replace(/^www\./, '');
  const slug = parsed.pathname
    .replace(/^\/|\/$/g, '')
    .replace(/\//g, '-')
    .replace(/[^a-z0-9-]/gi, '')
    .slice(0, 120);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `captures/${domain}/${slug || 'index'}/${timestamp}.json.gz`;
}

export async function POST(request: Request) {
  if (!(await isCurator())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { url } = await request.json();
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const key = buildR2Key(url);

  const presignedUrl = presignR2PutUrl({
    key,
    contentType: 'application/json',
    contentEncoding: 'gzip',
  });

  return NextResponse.json({ presignedUrl, key });
}
