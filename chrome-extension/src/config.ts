/**
 * Extension configuration
 * Shared config values for Clerk and Jazz
 *
 * Values are loaded from environment files:
 * - .env.development (pnpm dev / pnpm build:dev)
 * - .env.production (pnpm build)
 */

// Clerk publishable key - same as web app
export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Jazz API key - same as web app
export const JAZZ_API_KEY = import.meta.env.VITE_JAZZ_API_KEY;

// Web app URL for auth sync
export const SYNC_HOST = import.meta.env.VITE_SYNC_HOST;

// Validate required config at runtime
if (!CLERK_PUBLISHABLE_KEY) {
  console.error("[Tote] Missing VITE_CLERK_PUBLISHABLE_KEY");
}
if (!JAZZ_API_KEY) {
  console.error("[Tote] Missing VITE_JAZZ_API_KEY");
}
if (!SYNC_HOST) {
  console.error("[Tote] Missing VITE_SYNC_HOST");
}
