import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import {
  buildGapReport,
  type GapCountRow,
} from '@/lib/extractionGaps/aggregate';

// Domain-level report of recently saved links whose extraction came back
// without a title, image or price. Read by a scheduled Claude task that groups
// the gaps and works through extractor fixes.
//
// Auth: `Authorization: Bearer $EXTRACTION_REPORT_TOKEN` (not a Clerk session —
// the caller is an automated job). Returns 404 when the token isn't configured.
//
// Privacy: returns domains and counts only. No user ids, collection data or
// full URLs leave the database through this route.

// Only clients that run our extractors. import/curator/copy rows carry
// metadata from elsewhere and would add noise.
const EXTRACTING_CLIENTS = ['extension', 'mobile', 'app', 'capture'];

function authorized(request: Request): boolean {
  const expected = process.env.EXTRACTION_REPORT_TOKEN;
  if (!expected) return false;
  const header = request.headers.get('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!process.env.EXTRACTION_REPORT_TOKEN) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const days = Number(params.get('days') ?? '7');
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    return NextResponse.json(
      { error: 'days must be an integer from 1 to 90' },
      { status: 400 },
    );
  }

  const raw = (await sql`
    WITH links AS (
      SELECT
        (substring(lower(properties->>'url') FROM '^https?://(?:www[.])?([^/:?#]+)')) AS domain,
        added_via,
        (
          title IS NULL
          OR btrim(title) = ''
          OR title = 'Untitled'
          OR title = properties->>'url'
        ) AS missing_title,
        coalesce(properties->>'imageUrl', '') = '' AS missing_image,
        coalesce(properties->>'price', '') = '' AS missing_price
      FROM collection_nodes
      WHERE type IN ('product', 'link')
        AND deleted_at IS NULL
        AND created_at > now() - make_interval(days => ${days})
        AND added_via = ANY(${EXTRACTING_CLIENTS})
        AND properties->>'url' ~* '^https?://'
    )
    SELECT domain, added_via, missing_title, missing_image, missing_price,
           count(*)::int AS count
    FROM links
    WHERE domain IS NOT NULL
    GROUP BY 1, 2, 3, 4, 5
  `) as Array<{
    domain: string;
    added_via: string;
    missing_title: boolean;
    missing_image: boolean;
    missing_price: boolean;
    count: number;
  }>;

  const rows: GapCountRow[] = raw.map((r) => ({
    domain: r.domain,
    addedVia: r.added_via,
    missingTitle: r.missing_title,
    missingImage: r.missing_image,
    missingPrice: r.missing_price,
    count: r.count,
  }));

  return NextResponse.json({
    days,
    generatedAt: new Date().toISOString(),
    ...buildGapReport(rows),
  });
}
