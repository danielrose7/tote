/**
 * Utah-style context pruning for tool results.
 * Prevents web search results from bloating the conversation context.
 */

const SOFT_LIMIT = 4000;
const HEAD = 1500;
const TAIL = 1500;

export function pruneText(text: string, softLimit = SOFT_LIMIT): string {
  if (text.length <= softLimit) return text;
  const head = text.slice(0, HEAD);
  const tail = text.slice(-TAIL);
  return `${head}\n\n[...trimmed ${text.length - HEAD - TAIL} chars...]\n\n${tail}`;
}
