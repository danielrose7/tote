// Patterns to exclude from image URLs (logos, icons, tracking pixels, etc.)
const IMAGE_EXCLUDE_PATTERNS =
	/logo|icon|favicon|sprite|placeholder|spacer|pixel|tracking|badge|avatar|rating|star|wordmark|share.?image/i;

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
			String.fromCharCode(parseInt(hex, 16)),
		)
		.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

export function resolveImageUrl(
	url: string | undefined,
	pageUrl: string,
): string | undefined {
	if (!url) return undefined;
	const decoded = decodeHtmlEntities(url.trim());
	if (!decoded || decoded.startsWith("data:")) return undefined;
	if (decoded.startsWith("https://") || decoded.startsWith("http://")) {
		return decoded;
	}
	if (decoded.startsWith("//")) return `https:${decoded}`;
	try {
		return new URL(decoded, pageUrl).href;
	} catch {
		return decoded;
	}
}

export function isExcludedImage(url: string | undefined): boolean {
	if (!url) return false;
	return IMAGE_EXCLUDE_PATTERNS.test(url);
}

export function filterImageUrl(url: string | undefined): string | undefined {
	if (!url || isExcludedImage(url)) return undefined;
	return url;
}

function getAttr(tag: string, name: string): string | undefined {
	const match = new RegExp(`\\s${name}=["']([^"']+)["']`, "i").exec(tag);
	return match?.[1];
}

function parseSrcset(srcset: string): string | undefined {
	let best: { url: string; width: number } | undefined;
	for (const entry of srcset.split(",")) {
		const parts = entry.trim().split(/\s+/);
		const url = parts[0];
		if (!url) continue;
		const widthMatch = parts[1]?.match(/^(\d+)w$/);
		const width = widthMatch ? Number.parseInt(widthMatch[1], 10) : 0;
		if (!best || width > best.width) best = { url, width };
	}
	return best?.url;
}

function scoreImageTag(tag: string): number {
	const haystack = tag.toLowerCase();
	let score = 0;
	if (/product|media|gallery|pdp/.test(haystack)) score += 20;
	if (/srcset|data-srcset/.test(haystack)) score += 5;
	if (/width=["'](?:[8-9]\d{2}|[1-9]\d{3,})/.test(haystack)) score += 5;
	if (/header|footer|nav|modal|dialog/.test(haystack)) score -= 25;
	return score;
}

export function extractImageFromHtml(
	html: string,
	pageUrl: string,
): string | undefined {
	const candidates: Array<{ url: string; score: number }> = [];
	const imgRegex = /<img\b[^>]*>/gi;
	let match = imgRegex.exec(html);
	while (match !== null) {
		const tag = match[0];
		const raw =
			parseSrcset(getAttr(tag, "data-srcset") || "") ||
			getAttr(tag, "data-src") ||
			parseSrcset(getAttr(tag, "srcset") || "") ||
			getAttr(tag, "src");
		const resolved = filterImageUrl(resolveImageUrl(raw, pageUrl));
		match = imgRegex.exec(html);
		if (!resolved) continue;
		candidates.push({ url: resolved, score: scoreImageTag(tag) });
	}

	candidates.sort((a, b) => b.score - a.score);
	return candidates[0]?.url;
}
