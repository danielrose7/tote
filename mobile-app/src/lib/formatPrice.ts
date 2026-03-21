/**
 * Formats a price string for display.
 * - Whole dollars: "$95"
 * - With cents:    "$49.99"
 */
export function formatPrice(price: string | undefined): string | null {
  if (!price) return null;
  const num = parseFloat(price.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return price; // fallback: return as-is
  const formatted = num % 1 === 0 ? num.toFixed(0) : num.toFixed(2);
  return `$${formatted}`;
}
