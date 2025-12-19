/**
 * Extension configuration
 * Shared config values for Clerk and Jazz
 */

// Clerk publishable key - same as web app
export const CLERK_PUBLISHABLE_KEY =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  "pk_test_ZG9taW5hbnQtaGVuLTM3LmNsZXJrLmFjY291bnRzLmRldiQ";

// Jazz API key - same as web app
export const JAZZ_API_KEY =
  import.meta.env.VITE_JAZZ_API_KEY ||
  "react-passkey-auth@garden.co";

// Web app URL for auth sync
export const SYNC_HOST =
  import.meta.env.VITE_SYNC_HOST || "http://localhost:3000";
