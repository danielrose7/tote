import { createHash, createHmac } from 'crypto';

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
export const R2_BUCKET = process.env.R2_BUCKET_NAME!;

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function getSigningKey(secretKey: string, dateStamp: string): Buffer {
  const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, 'auto');
  const kService = hmacSha256(kRegion, 's3');
  return hmacSha256(kService, 'aws4_request');
}

/**
 * Generate a presigned PUT URL for uploading to R2.
 * Uses native Node crypto — no AWS SDK needed.
 */
export function presignR2PutUrl(opts: {
  key: string;
  contentType: string;
  contentEncoding?: string;
  expiresIn?: number;
}): string {
  const { key, contentType, contentEncoding, expiresIn = 300 } = opts;
  const host = `${R2_BUCKET}.${ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = `${dateStamp}T${now.toISOString().slice(11, 19).replace(/:/g, '')}Z`;
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;

  const signedHeaders = 'host';

  const params = new URLSearchParams();
  params.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  params.set('X-Amz-Credential', `${ACCESS_KEY_ID}/${credentialScope}`);
  params.set('X-Amz-Date', amzDate);
  params.set('X-Amz-Expires', String(expiresIn));
  params.set('X-Amz-SignedHeaders', signedHeaders);
  if (contentType) params.set('Content-Type', contentType);
  if (contentEncoding) params.set('Content-Encoding', contentEncoding);

  // Canonical query string must be sorted
  const sortedParams = new URLSearchParams(
    [...params.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );

  const encodedKey = key
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/');

  const canonicalRequest = [
    'PUT',
    `/${encodedKey}`,
    sortedParams.toString(),
    `host:${host}\n`,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');

  const signingKey = getSigningKey(SECRET_ACCESS_KEY, dateStamp);
  const signature = hmacSha256(signingKey, stringToSign).toString('hex');

  sortedParams.set('X-Amz-Signature', signature);
  return `https://${host}/${encodedKey}?${sortedParams.toString()}`;
}

// --- Authorization header signing (for server-side GET/PUT/LIST) ---

function r2Host(): string {
  return `${R2_BUCKET}.${ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

function signRequest(
  method: string,
  path: string,
  queryString: string,
  headers: Record<string, string>,
  payloadHash: string,
): Record<string, string> {
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = `${dateStamp}T${now.toISOString().slice(11, 19).replace(/:/g, '')}Z`;
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;

  const allHeaders = {
    ...headers,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  };
  const signedHeaderKeys = Object.keys(allHeaders).sort().join(';');
  const canonicalHeaders = Object.keys(allHeaders)
    .sort()
    .map((k) => `${k}:${allHeaders[k]}`)
    .join('\n');

  const canonicalRequest = [
    method,
    path,
    queryString,
    `${canonicalHeaders}\n`,
    signedHeaderKeys,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');

  const signingKey = getSigningKey(SECRET_ACCESS_KEY, dateStamp);
  const signature = hmacSha256(signingKey, stringToSign).toString('hex');

  return {
    ...allHeaders,
    Authorization: `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaderKeys}, Signature=${signature}`,
  };
}

export interface R2ObjectInfo {
  key: string;
  size: number;
  lastModified: string;
}

/**
 * List objects in the R2 bucket by prefix. Handles pagination.
 */
export async function listR2Objects(prefix: string): Promise<R2ObjectInfo[]> {
  const host = r2Host();
  const results: R2ObjectInfo[] = [];
  let continuationToken: string | undefined;

  do {
    const params = new URLSearchParams({ 'list-type': '2', prefix });
    if (continuationToken) params.set('continuation-token', continuationToken);
    const qs = params.toString();

    const headers = signRequest('GET', '/', qs, { host }, 'UNSIGNED-PAYLOAD');
    const res = await fetch(`https://${host}/?${qs}`, { headers });

    if (!res.ok) {
      throw new Error(`R2 LIST failed: ${res.status} ${await res.text()}`);
    }

    const xml = await res.text();

    // Parse objects from XML
    const keyMatches = xml.matchAll(/<Key>([^<]+)<\/Key>/g);
    const sizeMatches = xml.matchAll(/<Size>(\d+)<\/Size>/g);
    const dateMatches = xml.matchAll(/<LastModified>([^<]+)<\/LastModified>/g);

    const keys = [...keyMatches].map((m) => m[1]);
    const sizes = [...sizeMatches].map((m) => Number(m[1]));
    const dates = [...dateMatches].map((m) => m[1]);

    for (let i = 0; i < keys.length; i++) {
      results.push({ key: keys[i], size: sizes[i], lastModified: dates[i] });
    }

    // Check for pagination
    const truncated = xml.includes('<IsTruncated>true</IsTruncated>');
    const tokenMatch = xml.match(
      /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/,
    );
    continuationToken = truncated && tokenMatch ? tokenMatch[1] : undefined;
  } while (continuationToken);

  return results;
}

/**
 * Get an object from R2. Returns the raw response body as a Buffer.
 */
export async function getR2Object(key: string): Promise<Buffer> {
  const host = r2Host();
  const encodedKey = key
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/');

  const headers = signRequest(
    'GET',
    `/${encodedKey}`,
    '',
    { host },
    'UNSIGNED-PAYLOAD',
  );
  const res = await fetch(`https://${host}/${encodedKey}`, { headers });

  if (!res.ok) {
    throw new Error(`R2 GET failed: ${res.status} ${await res.text()}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

/**
 * Put an object into R2.
 */
export async function putR2Object(
  key: string,
  body: Buffer | string,
  contentType = 'application/json',
): Promise<void> {
  const host = r2Host();
  const encodedKey = key
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/');
  const payload = typeof body === 'string' ? Buffer.from(body) : body;
  const payloadHash = sha256(payload.toString());

  const headers = signRequest(
    'PUT',
    `/${encodedKey}`,
    '',
    {
      host,
      'content-type': contentType,
      'content-length': String(payload.length),
    },
    payloadHash,
  );

  const res = await fetch(`https://${host}/${encodedKey}`, {
    method: 'PUT',
    headers,
    body: payload,
  });

  if (!res.ok) {
    throw new Error(`R2 PUT failed: ${res.status} ${await res.text()}`);
  }
}
