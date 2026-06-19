import { APP_URL } from '../config';
import type { ExtractedMetadata } from './extractors/types';
import { normalizeUrl } from './normalizeUrl';

export type CaptureCollection = {
  id: string;
  name: string;
  color: string | null;
  role: 'owner' | 'admin' | 'editor';
  sections: Array<{ id: string; name: string }>;
};

// One save attempt's identity. Reusing the same pair on retry lets the
// server replay the original response instead of inserting a duplicate.
export type CaptureIds = {
  nodeId: string;
  mutationId: string;
};

export function createCaptureIds(): CaptureIds {
  return { nodeId: crypto.randomUUID(), mutationId: crypto.randomUUID() };
}

export class CaptureRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CaptureRequestError';
  }
}

async function request<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${APP_URL}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new CaptureRequestError(
      body?.error || `Tote request failed with status ${response.status}`,
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

export async function fetchCaptureCollections(token: string) {
  const response = await request<{ collections: CaptureCollection[] }>(
    '/api/v2/capture',
    token,
  );
  return response.collections;
}

function validUrlOrUndefined(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    new URL(value);
    return value;
  } catch {
    return undefined;
  }
}

export function buildCapturePayload({
  ids,
  collectionId,
  sectionId,
  metadata,
}: {
  ids: CaptureIds;
  collectionId: string;
  sectionId: string | null;
  metadata: ExtractedMetadata;
}) {
  const images = metadata.images
    ?.filter((image) => validUrlOrUndefined(image))
    .slice(0, 50);
  return {
    id: ids.nodeId,
    mutationId: ids.mutationId,
    collectionId,
    sectionId,
    title: metadata.title?.trim() || 'Untitled',
    url: normalizeUrl(metadata.url),
    imageUrl: validUrlOrUndefined(metadata.imageUrl),
    images: images?.length ? images : undefined,
    price: metadata.price?.trim() || undefined,
    description: metadata.description?.trim() || undefined,
  };
}

// Collection creation is online-only; the server assigns canonical ordering
// when positionKey is omitted.
export async function createCollection({
  token,
  ids,
  name,
}: {
  token: string;
  ids: CaptureIds;
  name: string;
}) {
  return request<{ id: string; replayed: boolean }>(
    '/api/v2/collections',
    token,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: ids.nodeId,
        mutationId: ids.mutationId,
        name: name.trim(),
      }),
    },
  );
}

export type CapturePayload = ReturnType<typeof buildCapturePayload>;

export async function sendCapturePayload(
  token: string,
  payload: CapturePayload,
) {
  return request<{ id: string; replayed: boolean }>('/api/v2/capture', token, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function saveCapture({
  token,
  ids,
  collectionId,
  sectionId,
  metadata,
}: {
  token: string;
  ids: CaptureIds;
  collectionId: string;
  sectionId: string | null;
  metadata: ExtractedMetadata;
}) {
  return sendCapturePayload(
    token,
    buildCapturePayload({ ids, collectionId, sectionId, metadata }),
  );
}
