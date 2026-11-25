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
  // Added by an AI agent through Tote's tools (WebMCP today, MCP later).
  'agent',
] as const;
export type NodeAddedVia = (typeof NODE_ADDED_VIA)[number];
