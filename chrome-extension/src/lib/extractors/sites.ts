// Host-aware extraction for large retailers whose product pages don't carry
// usable structured data (no Product JSON-LD, no og:price), or whose generic
// DOM heuristics pick the wrong thing (sponsored thumbnails, carousel prices).
//
// Each adapter reads only that retailer's known product-detail selectors and
// returns whatever it finds. extractMetadata() prefers these values over the
// generic JSON-LD / OG / DOM pipeline, and falls back to it field-by-field.
//
// Mirrored in mobile-app/src/lib/extractorScript.ts (siteAdapters) — keep in sync.
// Selector notes and sample products: docs/PLATFORM_METADATA_PATTERNS.md.
import { extractPriceFromText, resolveUrl } from "./shared";
import type { ExtractedMetadata } from "./types";

export type SiteExtraction = Pick<
	ExtractedMetadata,
	"title" | "price" | "currency" | "imageUrl" | "images"
>;

interface SiteAdapter {
	id: string;
	hosts: RegExp;
	extract: () => SiteExtraction;
}

function text(selectors: string): string | undefined {
	const t = document.querySelector(selectors)?.textContent;
	const normalized = t?.replace(/\s+/g, " ").trim();
	return normalized || undefined;
}

// First selector (in priority order) whose element yields a parseable price.
function priceFrom(
	selectors: string[],
	read: (el: Element) => string | null | undefined = (el) => el.textContent,
): { price?: string; currency?: string } {
	for (const selector of selectors) {
		for (const el of document.querySelectorAll(selector)) {
			const raw = read(el);
			const parsed = raw ? extractPriceFromText(raw) : null;
			if (parsed) return parsed;
		}
	}
	return {};
}

// Largest srcset candidate, else src. Ignores data: placeholders.
function imgUrl(img: Element | null): string | undefined {
	if (!img) return undefined;
	const srcset = img.getAttribute("srcset");
	if (srcset) {
		let best: { url: string; w: number } | undefined;
		for (const entry of srcset.split(",")) {
			const [url, descriptor] = entry.trim().split(/\s+/);
			const w = parseInt(descriptor ?? "", 10) || 0;
			if (url && (!best || w > best.w)) best = { url, w };
		}
		if (best) return resolveUrl(best.url);
	}
	const src = img.getAttribute("src");
	return src && !src.startsWith("data:") ? resolveUrl(src) : undefined;
}

function unique(urls: (string | undefined)[]): string[] | undefined {
	const out = [...new Set(urls.filter((u): u is string => Boolean(u)))];
	return out.length > 1 ? out : undefined;
}

// ── Amazon ────────────────────────────────────────────────────────────────
// No JSON-LD and no og: tags. The visible price is split across
// .a-price-symbol/.a-price-whole/.a-price-fraction and its .a-offscreen copy
// is sometimes empty, so read the whole .a-price element and let the parser
// keep the first well-formed number.

// "https://m.media-amazon.com/images/I/917qEKD6XpL._AC_US40_.jpg" → full size
function amazonFullSize(url: string | undefined): string | undefined {
	return url?.replace(/\._[^/]*_\.(jpe?g|png|webp|gif)$/i, ".$1");
}

function amazonPriceText(el: Element): string | null {
	const offscreen = el.querySelector(".a-offscreen")?.textContent?.trim();
	if (offscreen) return offscreen;
	return el.textContent;
}

function amazonMainImage(): string | undefined {
	const img = document.querySelector(
		"#landingImage, #imgTagWrapperId img, #main-image, #main-image-container img, img[data-a-hires]",
	);
	if (!img) return undefined;
	const hires =
		img.getAttribute("data-old-hires") || img.getAttribute("data-a-hires");
	if (hires) return resolveUrl(hires);
	const dynamic = img.getAttribute("data-a-dynamic-image");
	if (dynamic) {
		try {
			const sizes = JSON.parse(dynamic) as Record<string, [number, number]>;
			const largest = Object.entries(sizes).sort(
				(a, b) => b[1][0] * b[1][1] - a[1][0] * a[1][1],
			)[0]?.[0];
			if (largest) return resolveUrl(largest);
		} catch {
			// Malformed attribute — fall through to src
		}
	}
	return imgUrl(img);
}

// "Amazon.com: Bedsure Fleece Throw : Home & Kitchen" → "Bedsure Fleece Throw"
function amazonDocumentTitle(): string | undefined {
	const match = document.title.match(/^Amazon\.[a-z.]+\s*:\s*(.+)$/i);
	if (!match) return undefined;
	return match[1].replace(/\s+:\s+[^:]+$/, "").trim() || undefined;
}

const amazon: SiteAdapter = {
	id: "amazon",
	hosts: /(^|\.)amazon\.(com|ca|co\.uk|de|fr|it|es|nl|se|pl|com\.au|com\.mx|com\.br|co\.jp|in|sg|ae)$/,
	extract() {
		const imageUrl = amazonMainImage();
		const thumbs = Array.from(
			document.querySelectorAll(
				"#altImages li.imageThumbnail img, #altImages li.item:not(.videoThumbnail) img",
			),
		)
			.map((img) => amazonFullSize(imgUrl(img)))
			// The first thumbnail is the main image at another size.
			.filter((url) => url !== amazonFullSize(imageUrl));
		return {
			title: text("#productTitle") ?? text("#title") ?? amazonDocumentTitle(),
			...priceFrom(
				[
					"#corePriceDisplay_desktop_feature_div .priceToPay",
					"#corePriceDisplay_mobile_feature_div .priceToPay",
					"#corePrice_feature_div .priceToPay",
					"#corePrice_mobile_feature_div .priceToPay",
					"#apex_desktop .priceToPay",
					".priceToPay",
					"#corePrice_feature_div .a-price:not(.a-text-price)",
					"#corePrice_mobile_feature_div .a-price:not(.a-text-price)",
					"#apex_desktop .a-price:not(.a-text-price)",
					"#tp_price_block_total_price_ww",
					"#price_inside_buybox",
					"#priceblock_dealprice",
					"#priceblock_ourprice",
				],
				amazonPriceText,
			),
			imageUrl,
			images: unique([imageUrl, ...thumbs]),
		};
	},
};

// ── Target ────────────────────────────────────────────────────────────────
// Next.js app with data-test hooks. The price is fetched client-side after
// hydration (it depends on the shopper's store), so it is absent from the
// server HTML — callers that extract on load must wait for it.
// og:image tracks the default variant, gallery item 0 tracks the selected one.
const target: SiteAdapter = {
	id: "target",
	hosts: /(^|\.)target\.com$/,
	extract() {
		const gallery = Array.from(
			document.querySelectorAll('[data-test^="image-gallery-item-"] img'),
		).map(imgUrl);
		return {
			title: text('[data-test="product-title"]'),
			...priceFrom(['[data-test="product-price"]']),
			imageUrl: imgUrl(
				document.querySelector('[data-test="image-gallery-item-0"] img'),
			),
			images: unique(gallery),
		};
	},
};

// ── Wayfair ───────────────────────────────────────────────────────────────
// og:image exists, but iPhone user agents get an AVIF rendition
// (assets.wfcdn.com/avif/im/…) behind a .jpg name; normalize to the JPEG path.
function wayfairJpeg(url: string | undefined): string | undefined {
	return url?.replace(/(assets\.wfcdn\.com)\/avif\/im\//, "$1/im/");
}

const wayfair: SiteAdapter = {
	id: "wayfair",
	hosts: /(^|\.)(wayfair|allmodern|birchlane|jossandmain|perigold)\.(com|ca|co\.uk|de)$/,
	extract() {
		const og = document
			.querySelector('meta[property="og:image"]')
			?.getAttribute("content");
		const imageUrl = wayfairJpeg(og ? resolveUrl(og) : undefined);
		// Gallery photos share the og:image filename stem with a "-<id>" suffix
		// ("…/19%22+H+Classic+Metal+Table+Lamps-646693588.jpg"); class names are
		// hashed, so match on that instead. Keyed by filename to drop resizes.
		const stem = imageUrl?.split("/").pop()?.replace(/\.\w+$/, "");
		const gallery = new Map<string, string>();
		if (stem) {
			for (const img of document.querySelectorAll(
				'img[src*="assets.wfcdn.com/im/"]',
			)) {
				const url = wayfairJpeg(imgUrl(img));
				const file = url?.split("?")[0].split("/").pop();
				if (url && file?.startsWith(`${stem}-`) && !gallery.has(file))
					gallery.set(file, url);
			}
		}
		return {
			title: text('h1[data-rtl-id="listingHeaderNameHeading"]'),
			...priceFrom([
				'[data-test-id="PricingFull-leadPrice"]',
				'[data-test-id="StandardPricingPrice-PRIMARY"]',
			]),
			imageUrl,
			images: unique([imageUrl, ...gallery.values()]),
		};
	},
};

// ── Walmart ───────────────────────────────────────────────────────────────
// No Product JSON-LD. Carousel tiles reuse data-automation-id="product-price"
// with superscript cents ("$12599current price $125.99"), so only trust the
// buy-box hero price.
function walmartFullSize(url: string | undefined): string | undefined {
	return url?.split("?")[0];
}

const walmart: SiteAdapter = {
	id: "walmart",
	hosts: /(^|\.)walmart\.(com|ca)$/,
	extract() {
		const thumbs = Array.from(
			document.querySelectorAll('[data-testid="media-thumbnail"] img'),
		).map((img) => walmartFullSize(imgUrl(img)));
		return {
			title: text('#main-title, h1[itemprop="name"]'),
			...priceFrom(['[data-seo-id="hero-price"]', '[itemprop="price"]']),
			images: unique(thumbs),
		};
	},
};

const ADAPTERS: SiteAdapter[] = [amazon, target, wayfair, walmart];

export function siteAdapterFor(hostname: string): string | undefined {
	return ADAPTERS.find((a) => a.hosts.test(hostname.toLowerCase()))?.id;
}

// `adapter` is set whenever the host matched, even if nothing was found: the
// caller then distrusts the generic DOM heuristics on that page (they pick
// sponsored thumbnails and carousel prices on these retailers).
export function extractFromSite(): SiteExtraction & { adapter?: string } {
	const host = window.location.hostname.toLowerCase();
	const adapter = ADAPTERS.find((a) => a.hosts.test(host));
	if (!adapter) return {};
	try {
		return { adapter: adapter.id, ...adapter.extract() };
	} catch (error) {
		// A retailer DOM change must never break extraction — the structured
		// sources still run. Log so it shows up when debugging a bad capture.
		console.warn(`[tote] ${adapter.id} adapter failed`, error);
		return { adapter: adapter.id };
	}
}
