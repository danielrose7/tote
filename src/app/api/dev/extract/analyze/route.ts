import { NextResponse } from 'next/server';
import { isCurator } from '../../../../../inngest/curator-auth';
import { getR2Object, listR2Objects } from '../../../../../lib/r2';
import { gunzipSync } from 'zlib';

interface CaptureData {
  url: string;
  timestamp: string;
  jsonLd: unknown[];
  metaTags: Record<string, string>;
  extraction: {
    title?: string;
    description?: string;
    imageUrl?: string;
    price?: string;
    currency?: string;
    brand?: string;
    platform?: string;
    confidence: number;
    extractedFields: string[];
  };
}

function findInJsonLd(jsonLd: unknown[], path: string): boolean {
  const check = (obj: unknown): boolean => {
    if (!obj || typeof obj !== 'object') return false;
    if (Array.isArray(obj)) return obj.some(check);
    const record = obj as Record<string, unknown>;
    if (path in record) return true;
    if ('@graph' in record && Array.isArray(record['@graph'])) {
      return record['@graph'].some(check);
    }
    if ('hasVariant' in record && path === 'hasVariant') return true;
    return false;
  };
  return jsonLd.some(check);
}

function findJsonLdValue(jsonLd: unknown[], path: string): unknown {
  const find = (obj: unknown): unknown => {
    if (!obj || typeof obj !== 'object') return undefined;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const v = find(item);
        if (v !== undefined) return v;
      }
      return undefined;
    }
    const record = obj as Record<string, unknown>;
    if (path in record) return record[path];
    if ('@graph' in record && Array.isArray(record['@graph'])) {
      return find(record['@graph']);
    }
    return undefined;
  };
  return find(jsonLd);
}

function hasMultipleImages(jsonLd: unknown[]): boolean {
  const image = findJsonLdValue(jsonLd, 'image');
  return Array.isArray(image) && image.length > 1;
}

export async function GET() {
  if (!(await isCurator())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const objects = await listR2Objects('captures/');
  if (objects.length === 0) {
    return NextResponse.json({
      summary: { total: 0, uniqueUrls: 0, domains: {} },
      structuredDataRates: {},
      platformBreakdown: {},
      extractionGaps: [],
      captures: [],
    });
  }

  // Download and parse all captures
  const captures: (CaptureData & { key: string })[] = [];
  for (const obj of objects) {
    try {
      const raw = await getR2Object(obj.key);
      let json: string;
      try {
        json = gunzipSync(raw).toString('utf-8');
      } catch {
        json = raw.toString('utf-8');
      }
      const data = JSON.parse(json) as CaptureData;
      captures.push({ ...data, key: obj.key });
    } catch {
      // Skip corrupt captures
    }
  }

  // Summary
  const urls = new Set(captures.map((c) => c.url));
  const domains: Record<string, number> = {};
  for (const c of captures) {
    try {
      const domain = new URL(c.url).hostname.replace(/^www\./, '');
      domains[domain] = (domains[domain] || 0) + 1;
    } catch {}
  }

  // Structured data availability
  const total = captures.length;
  const rate = (count: number) =>
    total > 0 ? Math.round((count / total) * 100) : 0;

  const structuredDataCounts = {
    jsonLdProduct: 0,
    aggregateRating: 0,
    variants: 0,
    multipleImages: 0,
    material: 0,
    brand: 0,
    availability: 0,
    sku: 0,
  };

  for (const c of captures) {
    if (findInJsonLd(c.jsonLd, 'name')) structuredDataCounts.jsonLdProduct++;
    if (findInJsonLd(c.jsonLd, 'aggregateRating'))
      structuredDataCounts.aggregateRating++;
    if (findInJsonLd(c.jsonLd, 'hasVariant')) structuredDataCounts.variants++;
    if (hasMultipleImages(c.jsonLd)) structuredDataCounts.multipleImages++;
    if (findInJsonLd(c.jsonLd, 'material')) structuredDataCounts.material++;
    if (
      findInJsonLd(c.jsonLd, 'brand') ||
      c.metaTags['product:brand'] ||
      c.metaTags['og:brand']
    )
      structuredDataCounts.brand++;
    if (findInJsonLd(c.jsonLd, 'availability'))
      structuredDataCounts.availability++;
    if (findInJsonLd(c.jsonLd, 'sku')) structuredDataCounts.sku++;
  }

  const structuredDataRates = Object.fromEntries(
    Object.entries(structuredDataCounts).map(([k, v]) => [k, rate(v)]),
  );

  // Platform breakdown
  const platforms: Record<
    string,
    {
      count: number;
      totalConfidence: number;
      fieldCounts: Record<string, number>;
    }
  > = {};
  for (const c of captures) {
    const p = c.extraction.platform || 'unknown';
    if (!platforms[p]) {
      platforms[p] = { count: 0, totalConfidence: 0, fieldCounts: {} };
    }
    platforms[p].count++;
    platforms[p].totalConfidence += c.extraction.confidence;
    for (const field of c.extraction.extractedFields) {
      platforms[p].fieldCounts[field] =
        (platforms[p].fieldCounts[field] || 0) + 1;
    }
  }

  const platformBreakdown = Object.fromEntries(
    Object.entries(platforms).map(([p, data]) => [
      p,
      {
        count: data.count,
        avgConfidence:
          Math.round((data.totalConfidence / data.count) * 100) / 100,
        fieldsExtracted: Object.fromEntries(
          Object.entries(data.fieldCounts).map(([f, count]) => [
            f,
            rate(count),
          ]),
        ),
      },
    ]),
  );

  // Extraction gaps — fields available in structured data but not in extraction
  const gapFields = [
    {
      field: 'aggregateRating',
      available: structuredDataCounts.aggregateRating,
    },
    { field: 'variants', available: structuredDataCounts.variants },
    { field: 'multipleImages', available: structuredDataCounts.multipleImages },
    { field: 'material', available: structuredDataCounts.material },
    { field: 'sku', available: structuredDataCounts.sku },
  ];

  const extractionGaps = gapFields
    .filter((g) => g.available > 0)
    .map((g) => ({
      field: g.field,
      availableIn: g.available,
      availableRate: rate(g.available),
      extractedIn: 0, // These fields aren't currently extracted
    }))
    .sort((a, b) => b.availableIn - a.availableIn);

  // Per-capture details (slim version for the list)
  const captureDetails = captures.map((c) => {
    const domain = (() => {
      try {
        return new URL(c.url).hostname.replace(/^www\./, '');
      } catch {
        return 'unknown';
      }
    })();
    return {
      key: c.key,
      url: c.url,
      domain,
      timestamp: c.timestamp,
      platform: c.extraction.platform || 'unknown',
      confidence: c.extraction.confidence,
      extractedFields: c.extraction.extractedFields,
      hasJsonLd: c.jsonLd.length > 0,
      metaTagCount: Object.keys(c.metaTags).length,
      jsonLdFields: {
        hasRating: findInJsonLd(c.jsonLd, 'aggregateRating'),
        hasVariants: findInJsonLd(c.jsonLd, 'hasVariant'),
        hasMultipleImages: hasMultipleImages(c.jsonLd),
        hasMaterial: findInJsonLd(c.jsonLd, 'material'),
      },
    };
  });

  return NextResponse.json({
    summary: { total, uniqueUrls: urls.size, domains },
    structuredDataRates,
    platformBreakdown,
    extractionGaps,
    captures: captureDetails,
  });
}
