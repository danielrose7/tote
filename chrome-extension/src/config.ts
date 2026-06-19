/**
 * Extension configuration
 *
 * Values are loaded from environment files:
 * - .env.development (pnpm dev / pnpm build:dev)
 * - .env.production (pnpm build)
 */

export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export const SYNC_HOST = import.meta.env.VITE_SYNC_HOST;

// Tote application API origin. Production auth uses a Clerk satellite host.
export const APP_URL =
  import.meta.env.VITE_APP_URL ||
  (SYNC_HOST?.includes('localhost') ? SYNC_HOST : 'https://tote.tools');

if (!CLERK_PUBLISHABLE_KEY) {
  console.error('[Tote] Missing VITE_CLERK_PUBLISHABLE_KEY');
}
if (!SYNC_HOST) {
  console.error('[Tote] Missing VITE_SYNC_HOST');
}
