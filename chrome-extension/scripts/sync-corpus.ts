/**
 * Download R2 captures to local fixtures for offline testing.
 *
 * Usage: npx tsx chrome-extension/scripts/sync-corpus.ts
 *
 * Requires R2 env vars in .env.local.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { gunzipSync } from 'zlib';

// Load .env.local from repo root before importing r2 (needs env vars at module init)
const envPath = resolve(import.meta.dirname, '../../.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

// Dynamic import after env vars are loaded
const { getR2Object, listR2Objects } = await import('../../src/lib/r2.ts');

const FIXTURES_DIR = join(import.meta.dirname, '../fixtures/captures');
const MANIFEST_PATH = join(FIXTURES_DIR, 'manifest.json');

interface Manifest {
  synced: Record<string, { size: number; syncedAt: string }>;
}

function loadManifest(): Manifest {
  if (existsSync(MANIFEST_PATH)) {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  }
  return { synced: {} };
}

function saveManifest(manifest: Manifest) {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function keyToLocalPath(key: string): string {
  // captures/domain/slug/timestamp.json.gz → domain/slug/timestamp.json
  const parts = key.replace(/^captures\//, '').replace(/\.gz$/, '');
  return join(FIXTURES_DIR, parts);
}

async function main() {
  console.log('Listing R2 captures...');
  const objects = await listR2Objects('captures/');
  console.log(`Found ${objects.length} objects in R2`);

  const manifest = loadManifest();
  let downloaded = 0;
  let skipped = 0;

  for (const obj of objects) {
    // Skip if already synced with same size
    const existing = manifest.synced[obj.key];
    if (existing && existing.size === obj.size) {
      skipped++;
      continue;
    }

    try {
      const raw = await getR2Object(obj.key);
      // Try gunzip; fall back to raw (some captures stored uncompressed)
      let json: Buffer;
      try {
        json = gunzipSync(raw);
      } catch {
        json = raw;
      }

      const localPath = keyToLocalPath(obj.key);
      mkdirSync(dirname(localPath), { recursive: true });
      writeFileSync(localPath, json);

      manifest.synced[obj.key] = {
        size: obj.size,
        syncedAt: new Date().toISOString(),
      };
      downloaded++;

      const domain = obj.key.split('/')[1] || 'unknown';
      console.log(`  ↓ ${domain} (${(obj.size / 1024).toFixed(0)}KB)`);
    } catch (err) {
      console.error(`  ✗ Failed: ${obj.key}`, err);
    }
  }

  saveManifest(manifest);

  // Summary
  const domains = new Map<string, number>();
  for (const key of Object.keys(manifest.synced)) {
    const domain = key.split('/')[1] || 'unknown';
    domains.set(domain, (domains.get(domain) || 0) + 1);
  }

  console.log(
    `\nDone: ${downloaded} new, ${skipped} skipped, ${Object.keys(manifest.synced).length} total`,
  );
  console.log('\nDomains:');
  for (const [domain, count] of [...domains.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${domain}: ${count}`);
  }
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
