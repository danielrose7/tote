/**
 * Analyze the locally synced corpus and print a report.
 *
 * Usage: npx tsx chrome-extension/scripts/analyze-corpus.ts
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = join(import.meta.dirname, '../fixtures/captures');

interface Capture {
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

function walkJson(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) results.push(...walkJson(full));
      else if (entry.endsWith('.json') && entry !== 'manifest.json')
        results.push(full);
    }
  } catch {}
  return results;
}

function findInJsonLd(jsonLd: unknown[], field: string): unknown {
  const find = (obj: unknown): unknown => {
    if (!obj || typeof obj !== 'object') return undefined;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const v = find(item);
        if (v !== undefined) return v;
      }
      return undefined;
    }
    const r = obj as Record<string, unknown>;
    if (field in r) return r[field];
    if ('@graph' in r && Array.isArray(r['@graph'])) return find(r['@graph']);
    if ('hasVariant' in r && Array.isArray(r.hasVariant))
      return find(r.hasVariant);
    return undefined;
  };
  return find(jsonLd);
}

const files = walkJson(FIXTURES_DIR);
const captures: Capture[] = files.map((f) =>
  JSON.parse(readFileSync(f, 'utf-8')),
);

console.log(`\n=== Corpus Analysis (${captures.length} captures) ===\n`);

// --- Platform breakdown ---
const platforms = new Map<string, Capture[]>();
for (const c of captures) {
  const p = c.extraction.platform || 'unknown';
  platforms.set(p, [...(platforms.get(p) || []), c]);
}

console.log('Platform Breakdown:');
for (const [p, caps] of [...platforms.entries()].sort(
  (a, b) => b[1].length - a[1].length,
)) {
  const avgConf =
    caps.reduce((s, c) => s + c.extraction.confidence, 0) / caps.length;
  const fields = [
    'title',
    'imageUrl',
    'price',
    'brand',
    'description',
  ] as const;
  const rates = fields.map((f) => {
    const count = caps.filter((c) => c.extraction[f]).length;
    return `${f}:${Math.round((count / caps.length) * 100)}%`;
  });
  console.log(
    `  ${p}: ${caps.length} captures, avg confidence ${avgConf.toFixed(2)}`,
  );
  console.log(`    ${rates.join(', ')}`);
}

// --- Image analysis (deep dive) ---
console.log('\n--- Image Extraction Analysis ---');
const noImage = captures.filter((c) => !c.extraction.imageUrl);
console.log(
  `Missing image: ${noImage.length}/${captures.length} (${Math.round((noImage.length / captures.length) * 100)}%)`,
);
if (noImage.length > 0) {
  console.log('Pages missing images:');
  for (const c of noImage) {
    const hasOgImage = !!c.metaTags['og:image'];
    const hasJsonLdImage = findInJsonLd(c.jsonLd, 'image') !== undefined;
    console.log(
      `  ${c.url}  [og:image=${hasOgImage}, jsonLd.image=${hasJsonLdImage}, platform=${c.extraction.platform}]`,
    );
  }
}

// Multiple images available but not captured
const multiImageAvailable = captures.filter((c) => {
  const img = findInJsonLd(c.jsonLd, 'image');
  return Array.isArray(img) && img.length > 1;
});
console.log(
  `\nMultiple images in JSON-LD: ${multiImageAvailable.length}/${captures.length}`,
);

// OG image available but not used
const ogImageAvailable = captures.filter(
  (c) => !c.extraction.imageUrl && c.metaTags['og:image'],
);
console.log(
  `OG image available but extraction missed: ${ogImageAvailable.length}`,
);

// --- Structured data opportunities ---
console.log('\n--- Structured Data Opportunities ---');
const opportunities = [
  'aggregateRating',
  'hasVariant',
  'material',
  'sku',
  'gtin',
  'weight',
  'color',
  'size',
  'additionalProperty',
  'review',
  'itemCondition',
] as const;

for (const field of opportunities) {
  const count = captures.filter(
    (c) => findInJsonLd(c.jsonLd, field) !== undefined,
  ).length;
  if (count > 0) {
    const pct = Math.round((count / captures.length) * 100);
    console.log(`  ${field}: ${count} captures (${pct}%)`);

    // Show a sample value
    const sample = captures.find(
      (c) => findInJsonLd(c.jsonLd, field) !== undefined,
    )!;
    const val = findInJsonLd(sample.jsonLd, field);
    const preview =
      typeof val === 'object'
        ? JSON.stringify(val).slice(0, 120)
        : String(val).slice(0, 120);
    console.log(`    sample: ${preview}`);
  }
}

// --- Price analysis ---
console.log('\n--- Price Extraction ---');
const noPrice = captures.filter((c) => !c.extraction.price);
console.log(
  `Missing price: ${noPrice.length}/${captures.length} (${Math.round((noPrice.length / captures.length) * 100)}%)`,
);
if (noPrice.length > 0) {
  for (const c of noPrice.slice(0, 10)) {
    const hasJsonLdPrice =
      findInJsonLd(c.jsonLd, 'price') !== undefined ||
      findInJsonLd(c.jsonLd, 'lowPrice') !== undefined;
    const hasOgPrice = !!c.metaTags['product:price:amount'];
    console.log(
      `  ${c.url}  [jsonLd.price=${hasJsonLdPrice}, og:price=${hasOgPrice}]`,
    );
  }
}

// --- Title analysis ---
console.log('\n--- Title Extraction ---');
const noTitle = captures.filter((c) => !c.extraction.title);
console.log(`Missing title: ${noTitle.length}/${captures.length}`);

// --- Confidence distribution ---
console.log('\n--- Confidence Distribution ---');
const buckets = { '1.0': 0, '0.67': 0, '0.33': 0, '0.0': 0 };
for (const c of captures) {
  if (c.extraction.confidence >= 1) buckets['1.0']++;
  else if (c.extraction.confidence >= 0.67) buckets['0.67']++;
  else if (c.extraction.confidence >= 0.33) buckets['0.33']++;
  else buckets['0.0']++;
}
for (const [bucket, count] of Object.entries(buckets)) {
  const bar = '█'.repeat(Math.round((count / captures.length) * 40));
  console.log(`  ${bucket}: ${bar} ${count}`);
}
