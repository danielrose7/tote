/**
 * Stable machine-readable error codes returned next to the English `error`
 * string by API routes. The English string stays for logs and non-web clients;
 * the web UI maps status + code to a translated message (src/i18n/apiError.ts).
 * Add a code only when the status alone is ambiguous.
 */
export type ApiErrorCode =
  | 'invite_unavailable'
  | 'insufficient_credits'
  | 'version_conflict';

export interface ApiErrorBody {
  error?: string;
  code?: ApiErrorCode | string;
}
