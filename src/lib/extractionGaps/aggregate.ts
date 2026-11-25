// Turns per-(domain, client, missing-fields) counts into ranked extraction-gap
// groups. Kept dependency-free so it can be unit-tested without a database.
//
// Privacy: inputs and outputs are domain-level aggregates only. Never add user
// ids, collection ids/names, or full URLs here — this feeds an automated
// improvement loop that runs outside the production environment.

export const GAP_FIELDS = ['title', 'image', 'price'] as const;
export type GapField = (typeof GAP_FIELDS)[number];

export interface GapCountRow {
  domain: string;
  addedVia: string;
  missingTitle: boolean;
  missingImage: boolean;
  missingPrice: boolean;
  count: number;
}

export interface GapGroup {
  /** Stable key, e.g. "zara.com|mobile|price". Used to match GitHub issues. */
  key: string;
  domain: string;
  addedVia: string;
  missing: GapField[];
  count: number;
  /** Links saved from this domain via this client in the window. */
  domainTotal: number;
}

export interface FieldStats {
  total: number;
  missing: Record<GapField, number>;
}

export interface GapReport {
  totals: FieldStats;
  byClient: Record<string, FieldStats>;
  groups: GapGroup[];
}

function emptyStats(): FieldStats {
  return { total: 0, missing: { title: 0, image: 0, price: 0 } };
}

function addTo(stats: FieldStats, row: GapCountRow) {
  stats.total += row.count;
  if (row.missingTitle) stats.missing.title += row.count;
  if (row.missingImage) stats.missing.image += row.count;
  if (row.missingPrice) stats.missing.price += row.count;
}

export function buildGapReport(rows: GapCountRow[]): GapReport {
  const totals = emptyStats();
  const byClient: Record<string, FieldStats> = {};
  const domainTotals = new Map<string, number>();
  const groups = new Map<string, GapGroup>();

  for (const row of rows) {
    addTo(totals, row);
    byClient[row.addedVia] ??= emptyStats();
    addTo(byClient[row.addedVia], row);

    const domainKey = `${row.domain}|${row.addedVia}`;
    domainTotals.set(domainKey, (domainTotals.get(domainKey) ?? 0) + row.count);

    const missing = GAP_FIELDS.filter(
      (f) =>
        (f === 'title' && row.missingTitle) ||
        (f === 'image' && row.missingImage) ||
        (f === 'price' && row.missingPrice),
    );
    if (missing.length === 0) continue;

    const key = `${domainKey}|${missing.join('+')}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += row.count;
    } else {
      groups.set(key, {
        key,
        domain: row.domain,
        addedVia: row.addedVia,
        missing,
        count: row.count,
        domainTotal: 0,
      });
    }
  }

  const ranked = [...groups.values()]
    .map((g) => ({
      ...g,
      domainTotal: domainTotals.get(`${g.domain}|${g.addedVia}`) ?? g.count,
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  return { totals, byClient, groups: ranked };
}
