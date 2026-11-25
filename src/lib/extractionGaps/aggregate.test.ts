import { describe, expect, it } from 'vitest';
import { buildGapReport, type GapCountRow } from './aggregate';

const row = (r: Partial<GapCountRow>): GapCountRow => ({
  domain: 'shop.com',
  addedVia: 'extension',
  missingTitle: false,
  missingImage: false,
  missingPrice: false,
  count: 1,
  ...r,
});

describe('buildGapReport', () => {
  it('groups by domain, client and missing-field set, ranked by count', () => {
    const report = buildGapReport([
      row({ count: 5 }),
      row({ missingPrice: true, count: 3 }),
      row({ addedVia: 'mobile', missingPrice: true, count: 1 }),
      row({
        domain: 'zara.com',
        missingImage: true,
        missingPrice: true,
        count: 4,
      }),
    ]);

    expect(report.groups.map((g) => [g.key, g.count, g.domainTotal])).toEqual([
      ['zara.com|extension|image+price', 4, 4],
      ['shop.com|extension|price', 3, 8],
      ['shop.com|mobile|price', 1, 1],
    ]);
  });

  it('counts per-field misses overall and per client', () => {
    const report = buildGapReport([
      row({ count: 2 }),
      row({ missingTitle: true, missingPrice: true, count: 3 }),
      row({ addedVia: 'mobile', missingImage: true, count: 1 }),
    ]);

    expect(report.totals).toEqual({
      total: 6,
      missing: { title: 3, image: 1, price: 3 },
    });
    expect(report.byClient.mobile).toEqual({
      total: 1,
      missing: { title: 0, image: 1, price: 0 },
    });
  });

  it('returns no groups when nothing is missing', () => {
    expect(buildGapReport([row({ count: 10 })]).groups).toEqual([]);
  });
});
