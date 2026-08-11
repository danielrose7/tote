const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'campaign_source',
  'gclid',
  'gclsrc',
  'gbraid',
  'wbraid',
  'gad_source',
  'gad_campaignid',
  'srsltid',
  'fbclid',
  'msclkid',
]);

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key)) u.searchParams.delete(key);
    }
    u.searchParams.sort();
    return u.toString();
  } catch {
    return url;
  }
}
