const SITE_URL = 'https://tote.tools';
const INDEXNOW_KEY = '49cdd26a0e5d1850075acc2fc53a6abc';
const INDEXNOW_KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;

function absoluteUrl(value) {
  const url = new URL(value, SITE_URL);
  if (url.origin !== SITE_URL) {
    throw new Error(`IndexNow URL must belong to ${SITE_URL}: ${value}`);
  }
  return url.href;
}

async function sitemapUrls() {
  const response = await fetch(`${SITE_URL}/sitemap.xml`);
  if (!response.ok) {
    throw new Error(`Could not fetch Tote's sitemap (${response.status}).`);
  }
  const xml = await response.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
    absoluteUrl(match[1]),
  );
}

async function main() {
  const args = process.argv.slice(2);
  const urlList = args.includes('--all')
    ? await sitemapUrls()
    : args.filter((arg) => !arg.startsWith('--')).map(absoluteUrl);

  if (urlList.length === 0) {
    throw new Error(
      'Pass one or more public URL paths, or use --all for the initial submission.',
    );
  }

  const uniqueUrls = [...new Set(urlList)];
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: new URL(SITE_URL).host,
      key: INDEXNOW_KEY,
      keyLocation: INDEXNOW_KEY_LOCATION,
      urlList: uniqueUrls,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `IndexNow rejected the submission (${response.status}): ${detail || response.statusText}`,
    );
  }

  console.log(`IndexNow accepted ${uniqueUrls.length} URL(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
