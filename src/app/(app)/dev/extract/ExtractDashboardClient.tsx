'use client';

import { useEffect, useState } from 'react';

interface AnalysisData {
  summary: {
    total: number;
    uniqueUrls: number;
    domains: Record<string, number>;
  };
  structuredDataRates: Record<string, number>;
  platformBreakdown: Record<
    string,
    {
      count: number;
      avgConfidence: number;
      fieldsExtracted: Record<string, number>;
    }
  >;
  extractionGaps: Array<{
    field: string;
    availableIn: number;
    availableRate: number;
    extractedIn: number;
  }>;
  captures: Array<{
    key: string;
    url: string;
    domain: string;
    timestamp: string;
    platform: string;
    confidence: number;
    extractedFields: string[];
    hasJsonLd: boolean;
    metaTagCount: number;
    jsonLdFields: {
      hasRating: boolean;
      hasVariants: boolean;
      hasMultipleImages: boolean;
      hasMaterial: boolean;
    };
  }>;
}

export function ExtractDashboardClient() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dev/extract/analyze')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={styles.container}>
        <h1 style={styles.h1}>Extraction Corpus</h1>
        <p style={styles.muted}>Loading analysis from R2...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <h1 style={styles.h1}>Extraction Corpus</h1>
        <p style={styles.error}>Error: {error}</p>
      </div>
    );
  }

  if (!data || data.summary.total === 0) {
    return (
      <div style={styles.container}>
        <h1 style={styles.h1}>Extraction Corpus</h1>
        <p style={styles.muted}>
          No captures yet. Browse product pages with the extension to start
          building the corpus.
        </p>
      </div>
    );
  }

  const sortedDomains = Object.entries(data.summary.domains).sort(
    (a, b) => b[1] - a[1],
  );

  const sortedPlatforms = Object.entries(data.platformBreakdown).sort(
    (a, b) => b[1].count - a[1].count,
  );

  const capturesByDomain = new Map<string, typeof data.captures>();
  for (const c of data.captures) {
    const list = capturesByDomain.get(c.domain) || [];
    list.push(c);
    capturesByDomain.set(c.domain, list);
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.h1}>Extraction Corpus</h1>

      {/* Corpus Inventory */}
      <section style={styles.section}>
        <h2 style={styles.h2}>Corpus Inventory</h2>
        <div style={styles.statRow}>
          <Stat label="Total Captures" value={data.summary.total} />
          <Stat label="Unique URLs" value={data.summary.uniqueUrls} />
          <Stat label="Domains" value={sortedDomains.length} />
        </div>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Domain</th>
              <th style={styles.thRight}>Captures</th>
            </tr>
          </thead>
          <tbody>
            {sortedDomains.map(([domain, count]) => (
              <tr key={domain}>
                <td style={styles.td}>{domain}</td>
                <td style={styles.tdRight}>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Extraction Scorecard */}
      <section style={styles.section}>
        <h2 style={styles.h2}>Extraction Scorecard by Platform</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Platform</th>
              <th style={styles.thRight}>Count</th>
              <th style={styles.thRight}>Avg Confidence</th>
              <th style={styles.thRight}>Title %</th>
              <th style={styles.thRight}>Price %</th>
              <th style={styles.thRight}>Image %</th>
              <th style={styles.thRight}>Brand %</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlatforms.map(([platform, info]) => (
              <tr key={platform}>
                <td style={styles.td}>{platform}</td>
                <td style={styles.tdRight}>{info.count}</td>
                <td style={styles.tdRight}>
                  <ConfidenceBadge value={info.avgConfidence} />
                </td>
                <td style={styles.tdRight}>
                  {info.fieldsExtracted.title ?? 0}%
                </td>
                <td style={styles.tdRight}>
                  {info.fieldsExtracted.price ?? 0}%
                </td>
                <td style={styles.tdRight}>
                  {info.fieldsExtracted.imageUrl ?? 0}%
                </td>
                <td style={styles.tdRight}>
                  {info.fieldsExtracted.brand ?? 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Opportunity Matrix */}
      <section style={styles.section}>
        <h2 style={styles.h2}>Opportunity Matrix</h2>
        <p style={styles.muted}>
          Fields available in structured data but not currently extracted.
        </p>
        {data.extractionGaps.length === 0 ? (
          <p style={styles.muted}>No gaps detected (or no structured data).</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Field</th>
                <th style={styles.thRight}>Available In</th>
                <th style={styles.thRight}>% of Corpus</th>
                <th style={styles.thRight}>Currently Extracted</th>
              </tr>
            </thead>
            <tbody>
              {data.extractionGaps.map((gap) => (
                <tr key={gap.field}>
                  <td style={styles.td}>{gap.field}</td>
                  <td style={styles.tdRight}>{gap.availableIn} captures</td>
                  <td style={styles.tdRight}>{gap.availableRate}%</td>
                  <td style={styles.tdRight}>
                    <span style={{ color: '#ef4444' }}>0</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Structured Data Availability */}
      <section style={styles.section}>
        <h2 style={styles.h2}>Structured Data Availability</h2>
        <div style={styles.barChart}>
          {Object.entries(data.structuredDataRates)
            .sort((a, b) => b[1] - a[1])
            .map(([field, rate]) => (
              <div key={field} style={styles.barRow}>
                <span style={styles.barLabel}>{field}</span>
                <div style={styles.barTrack}>
                  <div
                    style={{
                      ...styles.barFill,
                      width: `${rate}%`,
                      backgroundColor:
                        rate > 50
                          ? '#22c55e'
                          : rate > 20
                            ? '#eab308'
                            : '#ef4444',
                    }}
                  />
                </div>
                <span style={styles.barValue}>{rate}%</span>
              </div>
            ))}
        </div>
      </section>

      {/* Per-Capture Browser */}
      <section style={styles.section}>
        <h2 style={styles.h2}>Captures by Domain</h2>
        {sortedDomains.map(([domain]) => {
          const captures = capturesByDomain.get(domain) || [];
          const isExpanded = expandedDomain === domain;
          return (
            <div key={domain} style={styles.domainGroup}>
              <button
                type="button"
                style={styles.domainHeader}
                onClick={() => setExpandedDomain(isExpanded ? null : domain)}
              >
                <span>
                  {isExpanded ? '▼' : '▶'} {domain}
                </span>
                <span style={styles.muted}>{captures.length} captures</span>
              </button>
              {isExpanded && (
                <div style={styles.captureList}>
                  {captures.map((c) => (
                    <div key={c.key} style={styles.captureCard}>
                      <div style={styles.captureUrl}>
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={styles.link}
                        >
                          {c.url}
                        </a>
                      </div>
                      <div style={styles.captureDetails}>
                        <span>
                          Platform: <strong>{c.platform}</strong>
                        </span>
                        <span>
                          Confidence: <ConfidenceBadge value={c.confidence} />
                        </span>
                        <span>
                          Fields: {c.extractedFields.join(', ') || 'none'}
                        </span>
                        <span>
                          JSON-LD: {c.hasJsonLd ? 'yes' : 'no'} | Meta tags:{' '}
                          {c.metaTagCount}
                        </span>
                        {(c.jsonLdFields.hasRating ||
                          c.jsonLdFields.hasVariants ||
                          c.jsonLdFields.hasMultipleImages ||
                          c.jsonLdFields.hasMaterial) && (
                          <span style={{ color: '#eab308' }}>
                            Untapped:{' '}
                            {[
                              c.jsonLdFields.hasRating && 'ratings',
                              c.jsonLdFields.hasVariants && 'variants',
                              c.jsonLdFields.hasMultipleImages && 'images',
                              c.jsonLdFields.hasMaterial && 'material',
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 0.8 ? '#22c55e' : value >= 0.5 ? '#eab308' : '#ef4444';
  return (
    <span
      style={{
        color,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {(value * 100).toFixed(0)}%
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '2rem 1rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#e2e8f0',
  },
  h1: { fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' },
  h2: {
    fontSize: '1.1rem',
    fontWeight: 600,
    marginBottom: '0.75rem',
    borderBottom: '1px solid #334155',
    paddingBottom: '0.5rem',
  },
  section: { marginBottom: '2.5rem' },
  muted: { color: '#94a3b8', fontSize: '0.875rem' },
  error: { color: '#ef4444' },
  statRow: { display: 'flex', gap: '2rem', marginBottom: '1rem' },
  stat: { textAlign: 'center' },
  statValue: { fontSize: '2rem', fontWeight: 700 },
  statLabel: {
    color: '#94a3b8',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.5rem 0.75rem',
    borderBottom: '1px solid #334155',
    color: '#94a3b8',
    fontWeight: 500,
  },
  thRight: {
    textAlign: 'right',
    padding: '0.5rem 0.75rem',
    borderBottom: '1px solid #334155',
    color: '#94a3b8',
    fontWeight: 500,
  },
  td: { padding: '0.4rem 0.75rem', borderBottom: '1px solid #1e293b' },
  tdRight: {
    padding: '0.4rem 0.75rem',
    borderBottom: '1px solid #1e293b',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  barChart: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  barRow: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  barLabel: {
    width: 140,
    fontSize: '0.8rem',
    textAlign: 'right',
    flexShrink: 0,
  },
  barTrack: {
    flex: 1,
    height: 16,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4, transition: 'width 0.3s' },
  barValue: {
    width: 40,
    fontSize: '0.8rem',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  domainGroup: { marginBottom: '0.25rem' },
  domainHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
    padding: '0.5rem 0.75rem',
    background: 'none',
    border: '1px solid #1e293b',
    borderRadius: 4,
    color: '#e2e8f0',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  captureList: { padding: '0.5rem 0 0.5rem 1.5rem' },
  captureCard: {
    padding: '0.5rem 0.75rem',
    borderLeft: '2px solid #334155',
    marginBottom: '0.5rem',
  },
  captureUrl: {
    fontSize: '0.8rem',
    marginBottom: '0.25rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  captureDetails: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    fontSize: '0.75rem',
    color: '#94a3b8',
  },
  link: { color: '#60a5fa', textDecoration: 'none' },
};
