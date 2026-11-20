// Helpers shared by the generic extractor (index.ts) and the per-site
// adapters (sites.ts). Mirrored in mobile-app/src/lib/extractorScript.ts.

// Currency symbols and their codes
export const CURRENCY_MAP: Record<string, string> = {
	$: "USD",
	"£": "GBP",
	"€": "EUR",
	"¥": "JPY",
	"₹": "INR",
	"₩": "KRW",
	A$: "AUD",
	C$: "CAD",
	kr: "SEK",
	Fr: "CHF",
};

// Price patterns for extraction
export const PRICE_REGEX =
	/(?:[$£€¥₹₩]|A\$|C\$|kr|Fr\.?)\s*[\d.,]+|\d[\d.,]*\s*(?:[$£€¥₹₩]|USD|EUR|GBP)/gi;

// Well-formed numbers: 1,234.56 / 1.234,56 / 1234.56 / 29,99 / 40
const VALID_NUMBER =
	/^(?:\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)$/;

// Big retailers render a price twice for accessibility (an offscreen "$9.99"
// next to visual "$" "9" "." "99" spans), or superscript the cents, so the
// element text reads "$9.99$9.99" or "$9.999.99". When the digit run isn't a
// well-formed number, keep the leading "d.dd" (or "d,dd") price.
function firstWellFormedNumber(raw: string): string {
	if (VALID_NUMBER.test(raw)) return raw;
	const decimal = raw.match(/^\d{1,3}(?:,\d{3})*\.\d{2}|^\d+[.,]\d{2}/);
	if (decimal) return decimal[0];
	const integer = raw.match(/^\d+/);
	return integer ? integer[0] : raw;
}

export function extractPriceFromText(
	text: string,
): { price: string; currency: string } | null {
	const cleaned = text.replace(/\s+/g, " ").trim();
	PRICE_REGEX.lastIndex = 0;
	const match = PRICE_REGEX.exec(cleaned);

	if (!match) return null;

	const priceStr = match[0];

	let currency = "USD";
	for (const [symbol, code] of Object.entries(CURRENCY_MAP)) {
		if (priceStr.includes(symbol)) {
			currency = code;
			break;
		}
	}

	// Match digits and any combination of . or , separators
	const numericMatch = priceStr.match(/\d[\d.,]*/);
	if (!numericMatch) return null;

	let price = firstWellFormedNumber(numericMatch[0].replace(/[.,]+$/, ""));

	// European format: 1.234,56 (dot = thousand, comma = decimal)
	if (/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(price)) {
		price = price.replace(/\./g, "").replace(",", ".");
	}
	// US format: 1,234.56 (comma = thousand, dot = decimal)
	else if (/^\d{1,3}(?:,\d{3})+(?:\.\d{2})?$/.test(price)) {
		price = price.replace(/,/g, "");
	}
	// Simple comma decimal: 29,99
	else if (/^\d+,\d{2}$/.test(price)) {
		price = price.replace(",", ".");
	}

	return { price, currency };
}

// Fix URLs that JSON-LD generators over-encode: %3F→?, %3D→=, %26→&.
// We deliberately do NOT use decodeURIComponent (decodes %2F, %20, etc.)
// or decodeURI (skips reserved chars like %3F). Only query-structure chars.
function fixOverEncodedUrl(url: string): string {
	return url.replace(/%3F/gi, "?").replace(/%3D/gi, "=").replace(/%26/gi, "&");
}

// Return true if the URL contains an unresolved template variable like {width}.
// Shopify lazy-load uses srcset templates (e.g. image_{width}x.jpg) where JS
// substitutes the actual width. If captured before substitution, the URL is
// broken and will 404.
function hasTemplateVariable(url: string): boolean {
	return /\{[^}]+\}/.test(url);
}

// Resolve a potentially-relative URL to an absolute one using the current page origin.
export function resolveUrl(url: string | undefined): string | undefined {
	if (!url) return undefined;
	url = fixOverEncodedUrl(url);
	// Reject unresolved template variables like {width} — Shopify lazy-load
	// uses these in srcset templates and JS substitutes real values at runtime.
	if (hasTemplateVariable(url)) return undefined;
	if (url.startsWith("http://") || url.startsWith("https://")) return url;
	// Protocol-relative URLs (e.g. //cdn.shopify.com/...) — always treat as https.
	// Doing this explicitly avoids relying on window.location as a base, which
	// can misbehave in jsdom test environments where document.baseURI isn't set.
	if (url.startsWith("//")) return `https:${url}`;
	try {
		return new URL(url, window.location.href).href;
	} catch {
		return url;
	}
}
