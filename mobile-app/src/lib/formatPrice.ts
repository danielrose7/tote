/**
 * Formats a price string for display.
 * - Whole amounts: "$95"
 * - With cents:    "$49.99"
 * - With a known currency code: "€49.99", "£95", "¥1,200"
 */
export function formatPrice(
	price: string | undefined,
	currency?: string | null,
): string | null {
	if (!price) return null;
	const num = parseFloat(price.replace(/[^0-9.]/g, ""));
	if (isNaN(num)) return price; // fallback: return as-is
	const amount = num % 1 === 0 ? num.toFixed(0) : num.toFixed(2);
	const code = normalizeCurrency(currency);
	if (code && code !== "USD") {
		try {
			return new Intl.NumberFormat("en-US", {
				style: "currency",
				currency: code,
				minimumFractionDigits: num % 1 === 0 ? 0 : 2,
				maximumFractionDigits: 2,
			}).format(num);
		} catch {
			// This device's Intl data doesn't know the code: show it plainly.
			return `${amount} ${code}`;
		}
	}
	return `$${amount}`;
}

/** An ISO 4217 code ("usd" → "USD"), or undefined for anything else. */
export function normalizeCurrency(code: unknown): string | undefined {
	if (typeof code !== "string") return undefined;
	const trimmed = code.trim().toUpperCase();
	return /^[A-Z]{3}$/.test(trimmed) ? trimmed : undefined;
}
