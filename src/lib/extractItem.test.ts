import { describe, expect, it } from 'vitest';
import { loadResources } from '@/i18n/catalogs';
import { createI18n } from '@/i18n/instance';
import { describeRefreshOutcome as describe_ } from './extractItem';

const i18n = createI18n('en', await loadResources('en'));
const describeRefreshOutcome = (outcome: Parameters<typeof describe_>[0]) =>
  describe_(outcome, i18n.t);

const base = { total: 3, thin: 0, failed: 0, extensionAvailable: false };

describe('describeRefreshOutcome', () => {
  it('says nothing when everything was read', () => {
    expect(describeRefreshOutcome(base)).toBeNull();
  });
  it('reports failures as errors, ahead of thin results', () => {
    const msg = describeRefreshOutcome({ ...base, failed: 1, thin: 2 });
    expect(msg?.variant).toBe('error');
    expect(msg?.title).toBe('Some items failed');
  });
  it('titles a total failure plainly', () => {
    expect(describeRefreshOutcome({ ...base, failed: 3 })?.title).toBe(
      'Refresh failed',
    );
  });
  it('suggests the extension when it is not installed', () => {
    const msg = describeRefreshOutcome({ ...base, thin: 2 });
    expect(msg?.variant).toBe('info');
    expect(msg?.description).toContain('2 items');
    expect(msg?.description).toContain('extension');
    expect(msg?.description).toContain('browser');
    expect(msg?.key).toBe('refresh-outcome');
  });
  it('does not push the extension when it is already in use', () => {
    const msg = describeRefreshOutcome({
      ...base,
      thin: 1,
      extensionAvailable: true,
    });
    expect(msg?.description).toContain('1 item limits');
    expect(msg?.description).not.toContain('reads pages in your browser');
  });
});
