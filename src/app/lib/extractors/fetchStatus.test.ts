import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractMetadata } from './index';

describe('extractMetadata fetchStatus', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([401, 403, 429])('reports blocked for HTTP %i', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status })));
    expect((await extractMetadata('https://example.com/p')).fetchStatus).toBe(
      'blocked',
    );
  });

  it('reports unreachable for network errors and other statuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    expect((await extractMetadata('https://example.com/p')).fetchStatus).toBe(
      'unreachable',
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    expect((await extractMetadata('https://example.com/p')).fetchStatus).toBe(
      'unreachable',
    );
  });

  it('reports ok when the page was fetched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html><head><title>t</title></head></html>', { status: 200 }),
      ),
    );
    expect((await extractMetadata('https://example.com/p')).fetchStatus).toBe('ok');
  });
});
