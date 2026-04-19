/**
 * Corpus-driven extraction tests.
 *
 * Runs extractMetadata() against real captured HTML from R2 (synced locally).
 * Skips silently if no fixtures are downloaded — run `pnpm corpus:sync` first.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { extractMetadata } from './index';
import type { ExtractionResult, RawPageCapture } from './types';

const FIXTURES_DIR = join(__dirname, '../../../fixtures/captures');

function walkJson(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        results.push(...walkJson(full));
      } else if (entry.endsWith('.json') && entry !== 'manifest.json') {
        results.push(full);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return results;
}

interface LoadedCapture {
  path: string;
  capture: RawPageCapture;
}

function loadCaptures(): LoadedCapture[] {
  const files = walkJson(FIXTURES_DIR);
  return files.map((path) => ({
    path,
    capture: JSON.parse(readFileSync(path, 'utf-8')) as RawPageCapture,
  }));
}

/**
 * Set up jsdom with captured HTML.
 * innerHTML won't create script elements that querySelectorAll can find,
 * so we manually inject JSON-LD scripts.
 */
function setupCapturedDOM(capture: RawPageCapture) {
  // Parse the captured HTML to extract head and body content
  const headMatch = capture.html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = capture.html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  // Set head content (minus script tags which we'll re-inject)
  const headHtml = headMatch?.[1] || '';
  const headWithoutScripts = headHtml.replace(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
    '',
  );
  document.head.innerHTML = headWithoutScripts;

  // Set body content
  document.body.innerHTML = bodyMatch?.[1] || '';

  // Manually inject JSON-LD scripts (innerHTML doesn't create them properly)
  for (const jsonLd of capture.jsonLd) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }

  // Mock window.location to match capture URL
  try {
    const url = new URL(capture.url);
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        ...window.location,
        href: capture.url,
        hostname: url.hostname,
        pathname: url.pathname,
        search: url.search,
        origin: url.origin,
        protocol: url.protocol,
        host: url.host,
      },
    });
  } catch {
    // Invalid URL — leave location as-is
  }
}

function shortLabel(capture: RawPageCapture): string {
  try {
    const url = new URL(capture.url);
    const domain = url.hostname.replace(/^www\./, '');
    const path = url.pathname.slice(0, 40);
    return `${domain}${path}`;
  } catch {
    return capture.url.slice(0, 50);
  }
}

const captures = loadCaptures();

describe.skipIf(captures.length === 0)('Corpus extraction tests', () => {
  describe('extraction stability', () => {
    for (const { capture } of captures) {
      it(`extracts without error: ${shortLabel(capture)}`, () => {
        setupCapturedDOM(capture);
        const result = extractMetadata();
        expect(result).toBeDefined();
        expect(result.source).toBe('merged');
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      });
    }
  });

  describe('regression: structured data fields', () => {
    for (const { capture } of captures) {
      const baseline = capture.extraction;

      // Only test if baseline had structured data
      if (
        capture.jsonLd.length === 0 &&
        Object.keys(capture.metaTags).length === 0
      ) {
        continue;
      }

      it(`matches baseline structured data: ${shortLabel(capture)}`, () => {
        setupCapturedDOM(capture);
        const result = extractMetadata();

        // Title: if available in JSON-LD or OG, should match baseline
        const hasStructuredTitle =
          capture.jsonLd.length > 0 ||
          capture.metaTags['og:title'] ||
          capture.metaTags['twitter:title'];
        if (hasStructuredTitle && baseline.title) {
          expect(result.title).toBe(baseline.title);
        }

        // Price: if available in JSON-LD or OG product meta
        const hasStructuredPrice =
          capture.jsonLd.length > 0 ||
          capture.metaTags['product:price:amount'] ||
          capture.metaTags['og:price:amount'];
        if (hasStructuredPrice && baseline.price) {
          expect(result.price).toBe(baseline.price);
        }

        // Brand: if available in JSON-LD or OG
        const hasStructuredBrand =
          capture.jsonLd.length > 0 ||
          capture.metaTags['product:brand'] ||
          capture.metaTags['og:brand'];
        if (hasStructuredBrand && baseline.brand) {
          expect(result.brand).toBe(baseline.brand);
        }
      });
    }
  });

  describe('coverage report', () => {
    it('prints extraction coverage summary', () => {
      const fields = [
        'title',
        'description',
        'imageUrl',
        'price',
        'currency',
        'brand',
      ] as const;

      const counts: Record<string, { baseline: number; reExtracted: number }> =
        {};
      for (const f of fields) {
        counts[f] = { baseline: 0, reExtracted: 0 };
      }

      let totalConfidence = 0;

      for (const { capture } of captures) {
        const baseline = capture.extraction;
        setupCapturedDOM(capture);
        const result = extractMetadata();

        totalConfidence += result.confidence;

        for (const f of fields) {
          if (baseline[f]) counts[f].baseline++;
          if (result[f]) counts[f].reExtracted++;
        }
      }

      const report = Object.fromEntries(
        Object.entries(counts).map(([field, c]) => [
          field,
          {
            'baseline %': Math.round((c.baseline / captures.length) * 100),
            're-extracted %': Math.round(
              (c.reExtracted / captures.length) * 100,
            ),
            delta:
              Math.round((c.reExtracted / captures.length) * 100) -
              Math.round((c.baseline / captures.length) * 100),
          },
        ]),
      );

      console.log(`\n--- Corpus Coverage (${captures.length} captures) ---`);
      console.log(
        `Avg confidence: ${(totalConfidence / captures.length).toFixed(2)}`,
      );
      console.table(report);

      expect(true).toBe(true);
    });
  });
});
