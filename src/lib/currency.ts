/**
 * An ISO 4217 code ("usd" → "USD"), or undefined for anything else. Stores
 * report currency inconsistently, and Intl throws on an unknown code.
 */
export function normalizeCurrency(code: unknown): string | undefined {
  if (typeof code !== 'string') return undefined;
  const trimmed = code.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(trimmed) ? trimmed : undefined;
}

/**
 * The price fields to save from a page read. A new price always replaces the
 * old currency too (with undefined when the page didn't say), so a stale code
 * never ends up next to a price it wasn't read with.
 */
export function pagePriceProperties(metadata: {
  price?: string | null;
  currency?: string | null;
}): { price?: string; currency?: string } {
  if (!metadata.price) return {};
  return {
    price: metadata.price,
    currency: normalizeCurrency(metadata.currency),
  };
}
