import type { RawPageCapture } from './extractors/types';

const API_BASE =
  process.env.NODE_ENV === 'production'
    ? 'https://tote.tools'
    : 'http://localhost:3000';

/**
 * Upload a raw page capture to R2 via presigned URL.
 * Silently logs errors — should never block the calling flow.
 */
export async function uploadCapture(capture: RawPageCapture): Promise<void> {
  const presignRes = await fetch(`${API_BASE}/api/extract/capture/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: capture.url }),
  });

  if (!presignRes.ok) return;
  const { presignedUrl } = await presignRes.json();

  const blob = new Blob([JSON.stringify(capture)]);
  const compressed = await new Response(
    blob.stream().pipeThrough(new CompressionStream('gzip')),
  ).blob();

  await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip',
    },
    body: compressed,
  });
}
