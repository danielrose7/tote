import type { ModelContext, ModelContextTool } from './modelContext';

/**
 * Register tools and return a function that removes them.
 *
 * Implementations differ: some return a promise from registerTool and some
 * throw, and drafts unregister either through the abort signal or through
 * unregisterTool. One bad tool must not stop the rest from registering.
 */
export function registerTools(
  modelContext: ModelContext,
  tools: readonly ModelContextTool[],
): () => void {
  const controller = new AbortController();
  for (const tool of tools) {
    void Promise.resolve()
      .then(() =>
        modelContext.registerTool(tool, { signal: controller.signal }),
      )
      .catch((error: unknown) =>
        console.error(`[Tote] WebMCP tool ${tool.name} failed`, error),
      );
  }
  return () => {
    controller.abort();
    for (const tool of tools) {
      void Promise.resolve()
        .then(() => modelContext.unregisterTool?.(tool.name))
        .catch((error: unknown) =>
          console.debug(
            `[Tote] WebMCP tool ${tool.name} already removed`,
            error,
          ),
        );
    }
  };
}
