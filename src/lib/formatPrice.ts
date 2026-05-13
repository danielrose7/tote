const SYMBOL_TO_CURRENCY: [string, string][] = [
	["A$", "AUD"],
	["C$", "CAD"],
	["HK$", "HKD"],
	["NZ$", "NZD"],
	["S$", "SGD"],
	["$", "USD"],
	["£", "GBP"],
	["€", "EUR"],
	["¥", "JPY"],
	["₹", "INR"],
	["₩", "KRW"],
	["₣", "CHF"],
];

export function formatPrice(raw: string, currencyCode?: string | null): string {
	const trimmed = raw.trim();

	let currency = currencyCode?.toUpperCase() ?? "USD";
	let digits = trimmed;

	for (const [symbol, code] of SYMBOL_TO_CURRENCY) {
		if (trimmed.startsWith(symbol)) {
			currency = code;
			digits = trimmed.slice(symbol.length).trim();
			break;
		}
	}

	// Handle European comma-decimal format (e.g. "29,99") vs thousands separators
	// If there's a comma but no period, treat comma as decimal separator
	const hasComma = digits.includes(",");
	const hasPeriod = digits.includes(".");
	if (hasComma && !hasPeriod) {
		digits = digits.replace(",", ".");
	} else {
		digits = digits.replace(/,/g, "");
	}

	const value = parseFloat(digits);
	if (Number.isNaN(value)) return raw;

	try {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency,
			minimumFractionDigits: value % 1 === 0 ? 0 : 2,
			maximumFractionDigits: 2,
		}).format(value);
	} catch {
		return raw;
	}
}
