/**
 * Minimal typing and feature detection for the WebMCP API.
 *
 * The draft spec moved the entry point from `navigator.modelContext` to
 * `document.modelContext` in mid-2026; browsers in the origin trial and some
 * agents (e.g. headless engines) still expose the old one, so check both.
 * See https://webmachinelearning.github.io/webmcp/.
 */

export type ModelContextToolAnnotations = {
  /** True when the tool only reads. Agents use it to decide on confirmation. */
  readOnlyHint: boolean;
  /**
   * True when the output carries text Tote doesn't vouch for: titles and
   * descriptions scraped from shop pages, or written by other members of a
   * shared collection. Agents can treat it as possible prompt injection.
   */
  untrustedContentHint: boolean;
  /** True for hard-to-undo actions; agents should confirm with the user. */
  consequentialHint: boolean;
};

export type ModelContextTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /**
   * Always set. The spec makes it optional, but the ChatGPT/Codex browser
   * currently rejects every tool on the page when one omits it.
   */
  annotations: ModelContextToolAnnotations;
  execute: (
    input: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ) => Promise<unknown>;
};

export type ModelContext = {
  registerTool: (
    tool: ModelContextTool,
    options?: { signal?: AbortSignal },
  ) => unknown;
  /** Older drafts only; Chrome unregisters through the abort signal. */
  unregisterTool?: (name: string) => unknown;
};

export function getModelContext(): ModelContext | null {
  if (typeof document === 'undefined') return null;
  const candidates = [
    (document as Document & { modelContext?: ModelContext }).modelContext,
    (navigator as Navigator & { modelContext?: ModelContext }).modelContext,
  ];
  return (
    candidates.find(
      (candidate) => typeof candidate?.registerTool === 'function',
    ) ?? null
  );
}
