// Kept dependency-free so request-validation code and tests can import it
// without pulling in the Drizzle schema (or needing the `@/` alias).
export const NODE_ADDED_VIA = [
  'unknown',
  'app',
  'extension',
  'mobile',
  'capture',
  'import',
  'curator',
  'copy',
] as const;
export type NodeAddedVia = (typeof NODE_ADDED_VIA)[number];
