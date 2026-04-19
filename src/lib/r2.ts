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
