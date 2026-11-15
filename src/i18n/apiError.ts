import type { TFunction } from 'i18next';
import type { ApiErrorBody } from '@/lib/apiError';

const CODE_KEYS: Record<string, string> = {
  invite_unavailable: 'errors.api.inviteUnavailable',
  insufficient_credits: 'errors.api.insufficientCredits',
  version_conflict: 'errors.api.versionConflict',
};

function statusKey(status: number): string {
  switch (status) {
    case 400:
      return 'errors.api.invalid';
    case 401:
      return 'errors.api.unauthorized';
    case 402:
      return 'errors.api.insufficientCredits';
    case 403:
      return 'errors.api.forbidden';
    case 404:
      return 'errors.api.notFound';
    case 409:
      return 'errors.api.conflict';
    case 429:
      return 'errors.api.rateLimited';
    default:
      return status >= 500 ? 'errors.api.server' : 'errors.api.generic';
  }
}

/** Translated message for a failed API response. Never returns server English. */
export function apiErrorMessage(
  t: TFunction,
  status: number,
  body?: ApiErrorBody | null,
): string {
  const codeKey = body?.code ? CODE_KEYS[body.code] : undefined;
  return t(codeKey ?? statusKey(status));
}

/** Translated message for any thrown value from the collections client. */
export function errorMessage(t: TFunction, error: unknown): string {
  const e = error as { status?: unknown; code?: unknown } | null;
  if (e && typeof e.status === 'number') {
    return apiErrorMessage(t, e.status, {
      code: typeof e.code === 'string' ? e.code : undefined,
    });
  }
  return t('errors.api.network');
}
