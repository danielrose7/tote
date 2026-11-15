/**
 * Pseudo-localization: accent vowels and pad ~40% so German-length text and
 * missed `t()` wraps are visible. `{{interpolation}}` slots and `$t(...)`
 * nesting are left intact so the string still works.
 */
const MAP: Record<string, string> = {
  a: 'å',
  e: 'é',
  i: 'ï',
  o: 'ø',
  u: 'ü',
  y: 'ý',
  A: 'Å',
  E: 'É',
  I: 'Ï',
  O: 'Ø',
  U: 'Ü',
  C: 'Ç',
  c: 'ç',
  n: 'ñ',
  N: 'Ñ',
};

export function pseudoize(text: string): string {
  const out = text
    .split(/(\{\{[^}]*\}\}|\$t\([^)]*\))/)
    .map((part, i) =>
      i % 2 === 1 // odd indices are the captured slots — leave untouched
        ? part
        : part.replace(/[a-zA-Z]/g, (ch) => MAP[ch] ?? ch),
    )
    .join('');
  const pad = '·'.repeat(Math.max(2, Math.round(text.length * 0.2)));
  return `[${pad}${out}${pad}]`;
}

export type Catalog = { [key: string]: string | Catalog };

/** Deep-map every string in a catalog through pseudoize(). */
export function pseudoizeCatalog(catalog: Catalog): Catalog {
  const result: Catalog = {};
  for (const [key, value] of Object.entries(catalog)) {
    result[key] =
      typeof value === 'string' ? pseudoize(value) : pseudoizeCatalog(value);
  }
  return result;
}
