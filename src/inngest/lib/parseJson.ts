/**
 * Robustly parse JSON from LLM output.
 *
 * Models — especially smaller ones like Haiku — frequently wrap JSON in
 * markdown code fences or add preamble/trailing text even when told not to.
 * This function tries three strategies in order:
 *
 * 1. Extract content from a code fence (non-greedy, handles text before/after)
 * 2. Parse the full trimmed text directly
 * 3. Find the first { or [ and try from there to each possible close bracket
 *    working right-to-left — handles preamble and trailing prose
 */
export function parseJson<T>(text: string): T | null {
  // 1. Extract content from a code fence if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1]) as T;
    } catch {}
  }

  // 2. Try full trimmed text
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {}

  // 3. Find first { or [ then try from there to each possible close bracket
  const objStart = trimmed.indexOf('{');
  const arrStart = trimmed.indexOf('[');
  const start =
    objStart === -1
      ? arrStart
      : arrStart === -1
        ? objStart
        : Math.min(objStart, arrStart);

  if (start !== -1) {
    const close = trimmed[start] === '{' ? '}' : ']';
    let end = trimmed.lastIndexOf(close);
    while (end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T;
      } catch {
        end = trimmed.lastIndexOf(close, end - 1);
      }
    }
  }

  return null;
}
