#!/usr/bin/env node
// Keeps code and the English catalog in agreement.
//
//   pnpm i18n:check
//
// Fails (exit 1) if code uses a translation key that isn't in the English
// catalog — it would render the raw key. Warns about catalog keys nothing
// uses and about t() calls whose key isn't a literal (invisible to this
// check; prefer an explicit map of keys). Also verifies every other locale
// only defines keys that exist in English, so a rename can't strand a
// translation.
//
// A "key" is a dotted string literal whose first segment is a catalog area
// (the top-level keys of src/i18n/locales/en/*.json), found anywhere in
// source — that is what lets key maps like { owner: 'dialogs.team.role.owner' }
// be checked, not just t('...') calls.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = join(root, 'src/i18n/locales');
const PLURAL = /_(zero|one|two|few|many|other)$/;

function flatten(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.add(key.replace(PLURAL, ''));
    else flatten(v, key, out);
  }
  return out;
}

function readLocale(dir) {
  const merged = {};
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    Object.assign(merged, JSON.parse(readFileSync(join(dir, f), 'utf8')), {});
  }
  return merged;
}

// Merge fragments the way catalogs.ts does (deep, later wins).
function readMerged(dir) {
  const out = {};
  const merge = (a, b) => {
    for (const [k, v] of Object.entries(b)) {
      a[k] =
        typeof v === 'object' && v && typeof a[k] === 'object'
          ? merge(a[k], v)
          : v;
    }
    return a;
  };
  for (const f of readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    merge(out, JSON.parse(readFileSync(join(dir, f), 'utf8')));
  }
  return out;
}

const en = readMerged(join(localesDir, 'en'));
const areas = Object.keys(en);
const defined = flatten(en);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === '.next' || p === localesDir)
        continue;
      yield* walk(p);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) yield p;
  }
}

const keyRe = new RegExp(
  `['"\`]((?:${areas.join('|')})\\.[A-Za-z0-9_.]+)['"\`]`,
  'g',
);
const dynamicRe = /\bt\(\s*(?!['"`])[^)\s]/g;
const used = new Map(); // key -> first file
const dynamic = [];

for (const file of walk(join(root, 'src'))) {
  // Drop comment-only lines so examples in docs aren't mistaken for usage.
  const text = readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => (/^\s*(\/\/|\/\*|\*)/.test(l) ? '' : l))
    .join('\n');
  const rel = relative(root, file);
  for (const m of text.matchAll(keyRe)) {
    const key = m[1].replace(/\.$/, '');
    if (!used.has(key)) used.set(key, rel);
  }
  for (const m of text.matchAll(dynamicRe)) {
    const line = text.slice(0, m.index).split('\n').length;
    dynamic.push(`${rel}:${line}`);
  }
}

// A key that names a group (t('landing.faq', { returnObjects: true })) uses
// every key beneath it.
const isGroup = (k) => [...defined].some((d) => d.startsWith(`${k}.`));
const covered = (k) =>
  used.has(k) ||
  [...used.keys()].some((u) => k.startsWith(`${u}.`) && isGroup(u));
const missing = [...used].filter(([k]) => !defined.has(k) && !isGroup(k));
const unused = [...defined].filter((k) => !covered(k));

const strayLocale = [];
for (const dir of readdirSync(localesDir).filter((d) => d !== 'en')) {
  for (const key of flatten(readMerged(join(localesDir, dir)))) {
    if (!defined.has(key)) strayLocale.push(`${dir}: ${key}`);
  }
}

let failed = false;
if (missing.length) {
  failed = true;
  console.error(
    `\n✗ ${missing.length} key(s) used in code but missing from the English catalog:`,
  );
  for (const [k, f] of missing) console.error(`  ${k}   (${f})`);
}
if (strayLocale.length) {
  failed = true;
  console.error(
    `\n✗ ${strayLocale.length} translated key(s) with no English source:`,
  );
  for (const s of strayLocale) console.error(`  ${s}`);
}
if (unused.length) {
  console.warn(`\n! ${unused.length} catalog key(s) not referenced in code:`);
  for (const k of unused.slice(0, 40)) console.warn(`  ${k}`);
  if (unused.length > 40) console.warn(`  … and ${unused.length - 40} more`);
}
if (dynamic.length) {
  console.warn(
    `\n! ${dynamic.length} t() call(s) with a non-literal key (not checked):`,
  );
  for (const d of dynamic.slice(0, 20)) console.warn(`  ${d}`);
}

console.log(
  `\ni18n: ${defined.size} English keys, ${used.size} referenced, ${missing.length} missing, ${unused.length} unused.`,
);
process.exit(failed ? 1 : 0);
