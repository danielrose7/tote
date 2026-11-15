import { describe, expect, it } from 'vitest';
import { apiErrorMessage, errorMessage } from './apiError';

const t = ((key: string) => `«${key}»`) as never;

describe('apiErrorMessage', () => {
  it('prefers a known code over the status', () => {
    expect(apiErrorMessage(t, 404, { code: 'invite_unavailable' })).toBe(
      '«errors.api.inviteUnavailable»',
    );
  });
  it('falls back to the status, ignoring unknown codes and server English', () => {
    expect(apiErrorMessage(t, 403, { error: 'Forbidden', code: 'x' })).toBe(
      '«errors.api.forbidden»',
    );
    expect(apiErrorMessage(t, 503)).toBe('«errors.api.server»');
    expect(apiErrorMessage(t, 418)).toBe('«errors.api.generic»');
  });
  it('treats errors without a status as network failures', () => {
    expect(errorMessage(t, new TypeError('Failed to fetch'))).toBe(
      '«errors.api.network»',
    );
    expect(errorMessage(t, { status: 409, code: 'version_conflict' })).toBe(
      '«errors.api.versionConflict»',
    );
  });
});
