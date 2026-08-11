export type BraveSearchResult = {
  title: string;
  url: string;
  description: string;
};

type BraveWebResult = {
  title?: string;
  url?: string;
  description?: string;
};

type BraveApiResponse = {
  web?: {
    results?: BraveWebResult[];
  };
};

export async function braveSearch(params: {
  query: string;
  allowed_domains?: string[];
  blocked_domains?: string[];
  count?: number;
}): Promise<BraveSearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error('BRAVE_SEARCH_API_KEY is not set');

  let query = params.query;

  if (params.allowed_domains?.length) {
    query += ' ' + params.allowed_domains.map((d) => `site:${d}`).join(' OR ');
  }
  if (params.blocked_domains?.length) {
    query += ' ' + params.blocked_domains.map((d) => `-site:${d}`).join(' ');
  }

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(params.count ?? 10));

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
  });

  if (!res.ok) {
    throw new Error(
      `Brave Search API error: ${res.status} ${await res.text()}`,
    );
  }

  const data: BraveApiResponse = await res.json();
  const results = data.web?.results ?? [];

  return results
    .filter((r): r is Required<BraveWebResult> => Boolean(r.title && r.url))
    .map((r) => ({
      title: r.title,
      url: r.url,
      description: r.description ?? '',
    }));
}
