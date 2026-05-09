// TODO: This extraction logic is duplicated in mobile-app/src/lib/extractorScript.ts
// (hand-ported to ES5 for WebView injection). Any fixes here must be manually
// applied there too. Consider extracting to a shared package to avoid drift.
import type {
  ExtractedMetadata,
  ExtractionResult,
  ProductVariant,
  RawPageCapture,
} from './types';

// Decode HTML entities (e.g. &quot; → ") safely using a textarea
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

// Currency symbols and their codes
const CURRENCY_MAP: Record<string, string> = {
  $: 'USD',
  '£': 'GBP',
  '€': 'EUR',
  '¥': 'JPY',
  '₹': 'INR',
  '₩': 'KRW',
  A$: 'AUD',
  C$: 'CAD',
  kr: 'SEK',
  Fr: 'CHF',
};

// Price patterns for extraction
const PRICE_REGEX =
  /(?:[$£€¥₹₩]|A\$|C\$|kr|Fr\.?)\s*[\d.,]+|\d[\d.,]*\s*(?:[$£€¥₹₩]|USD|EUR|GBP)/gi;

function extractPriceFromText(
  text: string,
): { price: string; currency: string } | null {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  PRICE_REGEX.lastIndex = 0;
  const match = PRICE_REGEX.exec(cleaned);

  if (!match) return null;

  const priceStr = match[0];

  let currency = 'USD';
  for (const [symbol, code] of Object.entries(CURRENCY_MAP)) {
    if (priceStr.includes(symbol)) {
      currency = code;
      break;
    }
  }

  // Match digits and any combination of . or , separators
  const numericMatch = priceStr.match(/[\d.,]+/);
  if (!numericMatch) return null;

  let price = numericMatch[0];

  // European format: 1.234,56 (dot = thousand, comma = decimal)
  if (/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(price)) {
    price = price.replace(/\./g, '').replace(',', '.');
  }
  // US format: 1,234.56 (comma = thousand, dot = decimal)
  else if (/^\d{1,3}(?:,\d{3})+(?:\.\d{2})?$/.test(price)) {
    price = price.replace(/,/g, '');
  }
  // Simple comma decimal: 29,99
  else if (/^\d+,\d{2}$/.test(price)) {
    price = price.replace(',', '.');
  }

  return { price, currency };
}

// Fix URLs that JSON-LD generators over-encode: %3F→?, %3D→=, %26→&.
// We deliberately do NOT use decodeURIComponent (decodes %2F, %20, etc.)
// or decodeURI (skips reserved chars like %3F). Only query-structure chars.
function fixOverEncodedUrl(url: string): string {
  return url.replace(/%3F/gi, '?').replace(/%3D/gi, '=').replace(/%26/gi, '&');
}

// Return true if the URL contains an unresolved template variable like {width}.
// Shopify lazy-load uses srcset templates (e.g. image_{width}x.jpg) where JS
// substitutes the actual width. If captured before substitution, the URL is
// broken and will 404.
function hasTemplateVariable(url: string): boolean {
  return /\{[^}]+\}/.test(url);
}

// Resolve a potentially-relative URL to an absolute one using the current page origin.
function resolveUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  url = fixOverEncodedUrl(url);
  // Reject unresolved template variables like {width} — Shopify lazy-load
  // uses these in srcset templates and JS substitutes real values at runtime.
  if (hasTemplateVariable(url)) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Protocol-relative URLs (e.g. //cdn.shopify.com/...) — always treat as https.
  // Doing this explicitly avoids relying on window.location as a base, which
  // can misbehave in jsdom test environments where document.baseURI isn't set.
  if (url.startsWith('//')) return `https:${url}`;
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
}

// Check whether a URL from JSON-LD refers to the current page.
// Only applies when same-origin — cross-origin URLs (e.g. in tests or CDN-hosted
// JSON-LD) are considered a match to avoid false negatives.
function urlPathMatchesPage(url: string): boolean {
  try {
    const resolved = new URL(url, window.location.href);
    if (resolved.origin !== window.location.origin) return true;
    const normalize = (p: string) => p.replace(/\/+$/, '').toLowerCase();
    return normalize(resolved.pathname) === normalize(window.location.pathname);
  } catch {
    return true;
  }
}

type JsonRecord = Record<string, unknown>;
type JsonLdOffer = JsonRecord & {
  price?: unknown;
  priceCurrency?: string;
  availability?: string;
  url?: string;
};
type JsonLdProductLike = JsonRecord & {
  '@id'?: string;
  '@graph'?: unknown[];
  '@type'?: string | string[];
  brand?: unknown;
  color?: string;
  hasVariant?: JsonLdProductLike[];
  identifier?: string;
  image?: unknown;
  mpn?: string;
  name?: string;
  offers?: JsonLdOffer | JsonLdOffer[];
  productID?: string;
  productGroupID?: string;
  size?: string;
  sku?: string;
  url?: string;
};

// Extract the canonical URL from a product object (offers.url, @id, or url field).
function productCanonicalUrl(product: JsonLdProductLike): string | undefined {
  const offers = product?.offers;
  const offerUrl = Array.isArray(offers) ? offers[0]?.url : offers?.url;
  return offerUrl || product?.url || product?.['@id'] || undefined;
}

// JSON-LD Extraction
function extractJsonLd(): Partial<ExtractedMetadata> | null {
  const scripts = document.querySelectorAll(
    'script[type="application/ld+json"]',
  );

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '');
      const match = findProduct(data);
      if (match) {
        const { product, groupName, variantMatched, allVariants } = match;

        // If the JSON-LD product has an explicit same-origin URL that doesn't
        // match the current page path, this data is stale (e.g. from a previous
        // SPA navigation on sites like Sézane that don't update JSON-LD on
        // client-side routing). Fall back to og: tags which are typically kept
        // up-to-date by the SPA router.
        const canonicalUrl = productCanonicalUrl(product);
        if (canonicalUrl && !urlPathMatchesPage(canonicalUrl)) {
          return null;
        }

        // Collect all images from the product (may be array)
        const images = extractAllImages(product.image);

        // Build variant list from ProductGroup
        const variants = allVariants ? extractVariants(allVariants) : undefined;

        return {
          // When we couldn't match the selected variant, use the group name (e.g.
          // "Wildcat") rather than the first variant's specific name ("Wildcat -
          // Matte Black | ...") which would be wrong for the user's selection.
          title: groupName ?? product.name,
          description: product.description,
          // Only use the JSON-LD image when we matched the right variant.
          // Otherwise, let og:image / DOM image take over since they more likely
          // reflect what the user is actually viewing.
          imageUrl: variantMatched
            ? resolveUrl(extractImage(product.image))
            : undefined,
          images: images.length > 1 ? images : undefined,
          price: extractProductPrice(product.offers)?.price,
          currency: extractProductPrice(product.offers)?.currency,
          brand: extractBrand(product.brand),
          sku: product.sku || undefined,
          color: product.color || undefined,
          variants: variants && variants.length > 0 ? variants : undefined,
        };
      }
    } catch {
      // Invalid JSON
    }
  }
  return null;
}

// Get the currently selected variant ID.
// Prefers Shopify's add-to-cart form input (updated by JS on swatch click)
// over the URL param, which may lag behind JS state.
function extractCurrentVariantId(): string | null {
  try {
    // Shopify: the add-to-cart form has a hidden input[name="id"] with the
    // currently selected variant ID, updated via JS when the user changes options
    const variantInput = document.querySelector(
      'form[action*="/cart/add"] input[name="id"]',
    ) as HTMLInputElement | null;
    if (variantInput?.value) return variantInput.value;
  } catch {}
  // Fall back to URL ?variant= parameter
  try {
    return new URLSearchParams(window.location.search).get('variant');
  } catch {
    return null;
  }
}

interface ProductFindResult {
  product: JsonLdProductLike;
  // When we fell back to a hasVariant item without matching the selected variant,
  // groupName holds the ProductGroup's name so we can use that instead of the
  // variant-specific name (e.g. "Wildcat" instead of "Wildcat - Matte Black | ...").
  groupName?: string;
  variantMatched: boolean;
  // Full variant list from ProductGroup (if available)
  allVariants?: JsonLdProductLike[];
}

function findProduct(data: unknown): ProductFindResult | null {
  if (!data || typeof data !== 'object') return null;

  if ('@type' in data) {
    const typed = data as { '@type': string | string[] };
    const types = Array.isArray(typed['@type'])
      ? typed['@type']
      : [typed['@type']];
    if (types.some((t) => t === 'Product' || t === 'IndividualProduct')) {
      return { product: data, variantMatched: true };
    }
    if (types.some((t) => t === 'ProductGroup')) {
      const d = data as JsonLdProductLike;
      const allVariants = Array.isArray(d.hasVariant)
        ? d.hasVariant
        : undefined;
      if (allVariants) {
        const variantId = extractCurrentVariantId();
        if (variantId) {
          const matched = allVariants.find((v) => {
            const vid = String(
              v?.['@id'] ?? v?.productID ?? v?.sku ?? v?.identifier ?? '',
            );
            return vid.includes(variantId);
          });
          if (matched)
            return { product: matched, variantMatched: true, allVariants };
        }
        // Couldn't identify the selected variant — fall back to first with offers
        // but flag it so we can use the group name and skip variant-specific image
        const withOffers = allVariants.find((v) => v?.offers);
        if (withOffers)
          return {
            product: withOffers,
            groupName: d.name,
            variantMatched: false,
            allVariants,
          };
      }
      if (d.offers) return { product: d, variantMatched: true, allVariants };
    }
  }

  const graph = (data as JsonLdProductLike)['@graph'];
  if (Array.isArray(graph)) {
    for (const item of graph) {
      const product = findProduct(item);
      if (product) return product;
    }
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const product = findProduct(item);
      if (product) return product;
    }
  }

  return null;
}

function extractImage(
  image: string | string[] | { url: string }[] | undefined,
): string | undefined {
  if (!image) return undefined;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) {
    const first = image[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'url' in first) return first.url;
  }
  return undefined;
}

// Extract all image URLs from JSON-LD image field (may be string, array, or object array)
function extractAllImages(image: unknown): string[] {
  if (!image) return [];
  if (typeof image === 'string')
    return [resolveUrl(image)].filter(Boolean) as string[];
  if (Array.isArray(image)) {
    return image
      .map((img) => {
        if (typeof img === 'string') return resolveUrl(img);
        if (img && typeof img === 'object' && 'url' in img)
          return resolveUrl(img.url);
        return undefined;
      })
      .filter(Boolean) as string[];
  }
  if (typeof image === 'object' && 'url' in image) {
    const url = resolveUrl(String(image.url));
    return url ? [url] : [];
  }
  return [];
}

// Extract variant list from JSON-LD hasVariant array
function extractVariants(variants: JsonLdProductLike[]): ProductVariant[] {
  return variants
    .map((v) => {
      const offer = Array.isArray(v.offers) ? v.offers[0] : v.offers;
      const available = offer?.availability
        ? String(offer.availability).includes('InStock')
        : undefined;
      return {
        name: v.name || '',
        price: offer?.price?.toString(),
        currency: offer?.priceCurrency,
        sku: v.sku || undefined,
        color: v.color || undefined,
        size: v.size || undefined,
        available,
        imageUrl: resolveUrl(extractImage(v.image)),
      };
    })
    .filter((v) => v.name);
}

function extractProductPrice(offers: JsonLdProductLike['offers']): {
  price?: string;
  currency?: string;
} {
  if (!offers) return {};
  const offer = Array.isArray(offers) ? offers[0] : offers;
  if (!offer) return {};
  return {
    price: offer.price?.toString(),
    currency: offer.priceCurrency,
  };
}

function extractBrand(brand: unknown): string | undefined {
  if (!brand) return undefined;
  if (typeof brand === 'string') return brand;
  if (typeof brand === 'object' && 'name' in brand) return String(brand.name);
  return undefined;
}

// Open Graph / Meta Tag Extraction
function extractOpenGraph(): Partial<ExtractedMetadata> {
  const getMeta = (names: string[]): string | undefined => {
    for (const name of names) {
      const el =
        document.querySelector(`meta[property="${name}"]`) ||
        document.querySelector(`meta[name="${name}"]`);
      const content = el?.getAttribute('content');
      if (content) return content;
    }
    return undefined;
  };

  return {
    title:
      getMeta(['og:title', 'twitter:title']) || document.title || undefined,
    description: getMeta([
      'og:description',
      'twitter:description',
      'description',
    ]),
    imageUrl: getMeta(['og:image', 'og:image:secure_url', 'twitter:image']),
    price: getMeta(['product:price:amount', 'og:price:amount']),
    currency: getMeta(['product:price:currency', 'og:price:currency']),
    brand: getMeta(['product:brand', 'og:brand']),
  };
}

// DOM-based price extraction (for JS-rendered content)
function extractPriceFromDOM(productTitle?: string): {
  price?: string;
  currency?: string;
} {
  // Priority selectors - check sale prices FIRST (order matters!)
  // These indicate the actual/current price to pay, not original/list prices
  const salePriceSelectors = [
    // data-testid patterns (very reliable when present)
    '[data-testid*="sale-price"]',
    '[data-testid*="sales-price"]',
    '[data-testid*="final-price"]',
    '[data-testid*="current-price"]',
    '[data-testid*="offer-price"]',
    '[data-testid*="your-price"]',
    // BFX (Borderfree) ecommerce platform
    '.bfx-sale-price',
    // Common class patterns
    '.sale-price',
    '.current-price',
    '.final-price',
    '.offer-price',
    '.your-price',
    '.special-price',
    '.promo-price',
    // Attribute wildcards
    '[class*="sale-price"]',
    '[class*="salePrice"]',
    '[class*="final-price"]',
    '[class*="finalPrice"]',
    '[class*="current-price"]',
    '[class*="currentPrice"]',
    '[class*="special-price"]',
    '[class*="specialPrice"]',
  ];

  // Check sale price selectors first
  for (const selector of salePriceSelectors) {
    try {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim();
        if (text) {
          const result = extractPriceFromText(text);
          if (result) return result;
        }
      }
    } catch {
      // Invalid selector
    }
  }

  // General price selectors (excluding list/original prices)
  // These are checked AFTER sale price selectors, so sale prices take priority
  const selectors = [
    '[itemprop="price"]',
    '[data-price]',
    '[data-product-price]',
    // Exclude list/original/compare prices via class
    '.price:not(.price-compare):not(.was-price):not(.list-price):not(.bfx-list-price)',
    '.product-price:not(.list-price):not(.original-price)',
    // Exclude via class wildcards
    '[class*="price"]:not([class*="compare"]):not([class*="was"]):not([class*="old"]):not([class*="list"]):not([class*="original"]):not([class*="strikethrough"]):not([class*="crossed"])',
    '[class*="Price"]:not([class*="Compare"]):not([class*="Was"]):not([class*="Old"]):not([class*="List"]):not([class*="Original"]):not([class*="Strikethrough"]):not([class*="Crossed"])',
    // Exclude via data-testid / data-test patterns
    '[data-testid*="price"]:not([data-testid*="list"]):not([data-testid*="original"]):not([data-testid*="was"]):not([data-testid*="compare"])',
    '[data-test*="price"]:not([data-test*="list"]):not([data-test*="original"]):not([data-test*="was"]):not([data-test*="compare"])',
  ];

  // First try itemprop with content attribute
  const itempropEl = document.querySelector('[itemprop="price"]');
  if (itempropEl) {
    const content = itempropEl.getAttribute('content');
    if (content) {
      const currencyEl = document.querySelector('[itemprop="priceCurrency"]');
      return {
        price: content,
        currency: currencyEl?.getAttribute('content') || 'USD',
      };
    }
  }

  // Try data-price attribute
  const dataPriceEl = document.querySelector('[data-price]');
  if (dataPriceEl) {
    const attrValue = dataPriceEl.getAttribute('data-price');
    // Only use attribute if it looks like a price (has digits)
    if (attrValue && /\d/.test(attrValue)) {
      const result = extractPriceFromText(attrValue);
      if (result) return result;
    }
    // Otherwise use text content
    const textContent = dataPriceEl.textContent?.trim();
    if (textContent) {
      const result = extractPriceFromText(textContent);
      if (result) return result;
    }
  }

  // Score all price candidates and return the best match
  return bestScoredPrice(selectors, productTitle);
}

// Walk up the DOM to find the nearest preceding heading element
function nearestHeading(el: Element): Element | null {
  let node: Element | null = el.parentElement;
  while (node && node !== document.body) {
    let prev = node.previousElementSibling;
    while (prev) {
      if (/^H[1-6]$/.test(prev.tagName)) return prev;
      const h = prev.querySelector('h1, h2, h3, h4, h5, h6');
      if (h) return h;
      prev = prev.previousElementSibling;
    }
    node = node.parentElement;
  }
  return document.querySelector('h1');
}

// Score a price element by how likely it is to be the main product price
function scorePriceElement(el: Element, h1Text: string): number {
  let score = 0;

  // Walk ancestors looking for context signals
  let node: Element | null = el;
  while (node && node !== document.body) {
    const cls = (node.getAttribute('class') ?? '').toLowerCase();
    const id = (node.getAttribute('id') ?? '').toLowerCase();
    const ctx = `${cls} ${id}`;

    // Penalize related/recommended/cross-sell sections
    if (
      /related|recommend|upsell|cross.?sell|complementary|you.?may|complete.?your|kit\b/.test(
        ctx,
      )
    ) {
      score -= 60;
      break;
    }
    // Reward main product containers
    if (/product.{0,10}(info|detail|main|form|summary)|pdp/.test(ctx)) {
      score += 20;
      break;
    }
    node = node.parentElement;
  }

  // Reward proximity to an add-to-cart button
  const container = el.closest(
    "form, [class*='product__info'], [class*='product-info'], [class*='product-detail']",
  );
  if (
    container?.querySelector(
      '[name="add"], [class*="add-to-cart"], [class*="buy-now"]',
    )
  ) {
    score += 25;
  }

  // Reward heading match with page title
  const heading = nearestHeading(el);
  if (heading && h1Text) {
    const hText = heading.textContent?.trim().toLowerCase() ?? '';
    if (hText === h1Text) score += 50;
    else if (hText && (hText.includes(h1Text) || h1Text.includes(hText)))
      score += 25;
  }

  return score;
}

// Collect all price candidates from the DOM, score them, and return the best
function bestScoredPrice(
  selectors: string[],
  productTitle?: string,
): { price?: string; currency?: string } {
  // Use the provided product title (from JSON-LD/OG), fall back to h1, or skip heading match if nothing known
  const titleText = (
    productTitle ??
    document.querySelector('h1')?.textContent?.trim() ??
    ''
  ).toLowerCase();
  const seen = new Set<Element>();
  const candidates: Array<{ price: string; currency: string; score: number }> =
    [];

  const addCandidate = (el: Element, scoreBias = 0) => {
    if (seen.has(el)) return;
    seen.add(el);
    const text = el.textContent?.trim();
    if (!text) return;
    const parsed = extractPriceFromText(text);
    if (!parsed) return;
    candidates.push({
      ...parsed,
      score: scorePriceElement(el, titleText) + scoreBias,
    });
  };

  // Labeled price elements (selectors with price classes/attributes)
  for (const selector of selectors) {
    try {
      for (const el of document.querySelectorAll(selector)) addCandidate(el);
    } catch {
      // Invalid selector
    }
  }

  // Broad scan: short price-like text in generic elements (e.g. "$40" in a button or span with no price class)
  // Slight score penalty vs labeled elements since provenance is less certain
  for (const el of document.querySelectorAll('div, span, p, button')) {
    if (el.children.length > 2) continue;
    const text = el.textContent?.trim() ?? '';
    if (text.length < 15 && /^[$£€¥]\d/.test(text)) addCandidate(el, -5);
  }

  if (!candidates.length) return {};
  candidates.sort((a, b) => b.score - a.score);
  return { price: candidates[0].price, currency: candidates[0].currency };
}

// Detect platform
function detectPlatform(): ExtractedMetadata['platform'] {
  const html = document.documentElement.outerHTML;

  if (
    html.includes('cdn.shopify.com') ||
    html.includes('Shopify.theme') ||
    document
      .querySelector('meta[name="generator"]')
      ?.getAttribute('content')
      ?.includes('Shopify')
  ) {
    return 'shopify';
  }

  if (html.includes('squarespace.com') || html.includes('squarespace-cdn')) {
    return 'squarespace';
  }

  if (html.includes('woocommerce') || html.includes('wc-')) {
    return 'woocommerce';
  }

  return 'unknown';
}

// --- Image gallery extraction helpers ---

// Patterns to exclude from image URLs (logos, icons, tracking pixels, etc.)
const IMAGE_EXCLUDE_PATTERNS =
  /logo|icon|favicon|sprite|placeholder|spacer|pixel|tracking|badge|avatar|rating|star|wordmark|share.?image/i;

// Shopify CDN size suffixes
const SHOPIFY_SIZE_REGEX =
  /_(?:\d+x\d*|\d*x\d+|pico|icon|thumb|small|compact|medium|large|grande|master|original)(?=\.\w+)/;

// Known gallery container selectors, ordered by specificity
const GALLERY_SELECTORS = [
  'media-gallery',
  'product-media',
  'product-media-carousel',
  'scroll-carousel',
  'slider-component',
  '.swiper-wrapper',
  '[data-product-target="swiperContainer"]',
  '.slick-list',
  '.woocommerce-product-gallery',
  '.woocommerce-product-gallery__wrapper',
  '.product-gallery',
  '.product-images',
  '.product-media',
  '.product__media-list',
  '.product__images',
  '[class*="product-gallery"]',
  '[class*="product-image"]',
  '[class*="gallery-viewer"]',
  '.carousel-inner',
];

// Parse srcset attribute and return URL with largest w descriptor
function parseSrcset(srcset: string): string | undefined {
  let best: { url: string; width: number } | undefined;
  for (const entry of srcset.split(',')) {
    const parts = entry.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const url = parts[0];
    const descriptor = parts[1];
    const wMatch = descriptor.match(/^(\d+)w$/);
    if (wMatch) {
      const w = parseInt(wMatch[1], 10);
      if (!best || w > best.width) best = { url, width: w };
    }
  }
  return best?.url;
}

// Normalize image URL for deduplication by stripping CDN size/quality variants
function normalizeImageUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Normalize protocol to https for comparison (http vs https shouldn't matter)
    parsed.protocol = 'https:';

    // Next.js image proxy: extract the real URL
    if (parsed.pathname === '/_next/image' && parsed.searchParams.has('url')) {
      const proxiedUrl = parsed.searchParams.get('url');
      if (proxiedUrl) return normalizeImageUrl(decodeURIComponent(proxiedUrl));
    }

    // Strip common resize/quality/cache query params
    for (const param of [
      'width',
      'w',
      'h',
      'height',
      'quality',
      'q',
      'format',
      'fit',
      'crop',
      'dpr',
      'v',
    ]) {
      parsed.searchParams.delete(param);
    }

    let normalized = parsed.toString();

    // Shopify CDN size suffixes
    normalized = normalized.replace(SHOPIFY_SIZE_REGEX, '');

    // Cloudinary transform segments: /c_fill,w_300,h_300/
    normalized = normalized.replace(
      /\/[a-z]_[a-z0-9]+(?:,[a-z]_[a-z0-9]+)*\//g,
      '/',
    );

    return normalized;
  } catch {
    return url;
  }
}

// Deduplicate images by normalized URL, preserving first occurrence order
function deduplicateImages(urls: string[]): string[] {
  const seen = new Map<string, string>(); // normalized → first original
  const result: string[] = [];
  for (const url of urls) {
    const key = normalizeImageUrl(url);
    if (!seen.has(key)) {
      seen.set(key, url);
      result.push(url);
    }
  }
  return result;
}

// Upgrade a Shopify CDN URL to a display-quality resolution
function upgradeImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Shopify CDN: replace small width with 1200 (good for cards/previews)
    if (
      parsed.hostname.includes('shopify.com') ||
      parsed.hostname.includes('cdn.shopify.com') ||
      parsed.searchParams.has('width')
    ) {
      const currentWidth = parseInt(
        parsed.searchParams.get('width') || '9999',
        10,
      );
      if (currentWidth < 800) {
        parsed.searchParams.set('width', '1200');
        return parsed.toString();
      }
    }
    return url;
  } catch {
    return url;
  }
}

// Resolve the best URL from a single <img> element
function resolveImageUrl(img: Element): string | undefined {
  const dataZoom = img.getAttribute('data-zoom-src');
  if (dataZoom && !dataZoom.startsWith('data:')) {
    const resolved = resolveUrl(dataZoom);
    if (resolved) return upgradeImageUrl(resolved);
  }

  // Check data-srcset (lazysizes) before data-src
  const dataSrcset = img.getAttribute('data-srcset');
  if (dataSrcset) {
    const largest = parseSrcset(dataSrcset);
    const resolved = largest ? resolveUrl(largest) : undefined;
    if (resolved) return upgradeImageUrl(resolved);
  }

  const dataSrc = img.getAttribute('data-src');
  if (dataSrc && !dataSrc.startsWith('data:')) {
    const resolved = resolveUrl(dataSrc);
    if (resolved) return upgradeImageUrl(resolved);
  }

  const dataOriginal = img.getAttribute('data-original');
  if (dataOriginal && !dataOriginal.startsWith('data:')) {
    const resolved = resolveUrl(dataOriginal);
    if (resolved) return upgradeImageUrl(resolved);
  }

  const srcset = img.getAttribute('srcset');
  if (srcset) {
    const largest = parseSrcset(srcset);
    const resolved = largest ? resolveUrl(largest) : undefined;
    if (resolved) return upgradeImageUrl(resolved);
  }

  const src = (img as HTMLImageElement).src || img.getAttribute('src') || '';
  if (src && !src.startsWith('data:')) {
    const resolved = resolveUrl(src);
    if (resolved) return upgradeImageUrl(resolved);
  }

  return undefined;
}

// Check if an image (by URL or alt text) looks like a non-product image
function isExcludedImage(
  url: string,
  altText?: string,
  image?: Element,
): boolean {
  if (IMAGE_EXCLUDE_PATTERNS.test(url)) return true;
  if (altText && IMAGE_EXCLUDE_PATTERNS.test(altText)) return true;
  if (image?.getAttribute('itemprop')?.toLowerCase() === 'logo') return true;
  return false;
}

// Collect resolved image URLs from all <img> elements inside a container
function collectImagesFromContainer(container: Element): string[] {
  const imgs = container.querySelectorAll(
    'img:not(.slick-cloned img):not([aria-hidden="true"])',
  );
  const urls: string[] = [];

  for (const img of imgs) {
    // Skip images inside modal/dialog overlays (e.g. email capture popups)
    if (img.closest('[aria-modal="true"], [role="dialog"], dialog')) continue;

    // Skip tiny indicator/dot images — but not responsive images that use
    // placeholder dimensions with srcset/data-srcset for actual sizes
    const w = img.getAttribute('width');
    const h = img.getAttribute('height');
    const hasSrcset =
      img.hasAttribute('srcset') || img.hasAttribute('data-srcset');
    if (!hasSrcset && w && h && parseInt(w, 10) < 50 && parseInt(h, 10) < 50)
      continue;

    const url = resolveImageUrl(img);
    const alt = img.getAttribute('alt') ?? undefined;
    if (url && !isExcludedImage(url, alt, img)) {
      urls.push(url);
    }
  }

  return urls;
}

// Count direct and nested <img> elements
function countImages(el: Element): number {
  return el.querySelectorAll('img').length;
}

// Active-slide selectors for common carousel frameworks.
// When a carousel marks the currently-visible slide, we want that image first
// (it's what the user is actually looking at), ahead of DOM order.
const ACTIVE_SLIDE_SELECTORS = [
  '.flickity-cell.is-selected', // Flickity
  '.slick-slide.slick-active.slick-current', // Slick
  '.swiper-slide-active', // Swiper
  '[data-slide].active', // Bootstrap carousel
  '.carousel-item.active', // Bootstrap
  '[class*="slide"][aria-selected="true"]',
  '[class*="slide"][aria-current="true"]',
];

// If the gallery container has an active/selected slide, return its image URL
// so we can promote it to the front of the list.
function extractActiveSlideImage(container: Element): string | undefined {
  for (const selector of ACTIVE_SLIDE_SELECTORS) {
    try {
      const activeSlide = container.querySelector(selector);
      if (activeSlide) {
        const img = activeSlide.querySelector('img');
        if (img) {
          const url = resolveImageUrl(img);
          if (
            url &&
            !isExcludedImage(url, img.getAttribute('alt') ?? undefined, img)
          )
            return url;
        }
      }
    } catch {
      // Invalid selector
    }
  }
  return undefined;
}

// Reorder images so that `activeUrl` (if present in the list) comes first.
function promoteActiveImage(
  images: string[],
  activeUrl: string | undefined,
): string[] {
  if (!activeUrl) return images;
  const normalizedActive = normalizeImageUrl(activeUrl);
  const idx = images.findIndex(
    (url) => normalizeImageUrl(url) === normalizedActive,
  );
  if (idx <= 0) return images; // already first or not found
  return [images[idx], ...images.slice(0, idx), ...images.slice(idx + 1)];
}

const MAX_GALLERY_IMAGES = 15;

// Extract all product images from DOM using layered strategy.
// Returns { images, activeSlideUrl } — activeSlideUrl is the image from the
// currently-selected carousel slide (if any), so callers can prioritize it
// over the static og:image when the user has a variant/color selected.
function extractAllImagesFromDOM(ogImageUrl?: string): {
  images: string[];
  activeSlideUrl: string | undefined;
} {
  let images: string[] = [];
  let activeSlideUrl: string | undefined;

  // Layer 1: og:image anchor — find it in DOM, walk up to gallery container
  if (ogImageUrl) {
    const normalizedOg = normalizeImageUrl(ogImageUrl);
    const allImgs = document.querySelectorAll('img');

    let anchorImg: Element | null = null;
    for (const img of allImgs) {
      const url = resolveImageUrl(img);
      if (url && normalizeImageUrl(url) === normalizedOg) {
        anchorImg = img;
        break;
      }
    }

    if (anchorImg) {
      // Walk up ancestors looking for a gallery container.
      // Always require >= 2 images even when a known gallery selector matches —
      // broad selectors like [class*="product-image"] can hit single-image wrappers
      // (e.g. .product-image-wrapper on Goodwear's Flickity theme) and stop the
      // walk before we reach the actual carousel (.flickity-slider).
      let current: Element | null = anchorImg.parentElement;
      let maxDepth = 8;
      while (current && maxDepth-- > 0) {
        if (countImages(current) >= 2) {
          activeSlideUrl = extractActiveSlideImage(current);
          images = promoteActiveImage(
            collectImagesFromContainer(current),
            activeSlideUrl,
          );
          break;
        }
        current = current.parentElement;
      }
    }
  }

  // Layer 2: Known gallery selectors
  if (images.length < 2) {
    for (const selector of GALLERY_SELECTORS) {
      try {
        const container = document.querySelector(selector);
        if (container) {
          const found = collectImagesFromContainer(container);
          if (found.length >= 2) {
            activeSlideUrl = extractActiveSlideImage(container);
            images = promoteActiveImage(found, activeSlideUrl);
            break;
          }
        }
      } catch {
        // Invalid selector
      }
    }
  }

  // Layer 3: Heuristic scan — large images in product-related containers
  if (images.length < 2) {
    const containers = document.querySelectorAll(
      'main, article, [class*="product"], [class*="pdp"]',
    );
    const heuristicUrls: string[] = [];

    for (const container of containers) {
      const imgs = container.querySelectorAll('img');
      for (const img of imgs) {
        // Skip if inside header/footer/nav/modal
        if (
          img.closest(
            'header, footer, nav, [class*="footer"], [class*="header"], [class*="nav-"], [aria-modal="true"], [role="dialog"], dialog',
          )
        )
          continue;

        // Require reasonable size
        const w =
          parseInt(img.getAttribute('width') || '0', 10) ||
          (img as HTMLImageElement).naturalWidth ||
          0;
        if (w > 0 && w < 100) continue;

        const url = resolveImageUrl(img);
        const alt = img.getAttribute('alt') ?? undefined;
        if (url && !isExcludedImage(url, alt, img)) {
          heuristicUrls.push(url);
        }
      }
    }

    if (heuristicUrls.length >= 2) {
      images = heuristicUrls;
    }
  }

  return {
    images: deduplicateImages(images).slice(0, MAX_GALLERY_IMAGES),
    activeSlideUrl,
  };
}

// Get best product image from DOM
function extractImageFromDOM(): string | undefined {
  // Priority: product images, then gallery, then main content
  const selectors = [
    '[class*="product"] img[src*="product"]',
    '[class*="gallery"] img',
    '[class*="product-image"] img',
    '[data-product-image]',
    'main img',
    'article img',
    '.product img',
  ];

  for (const selector of selectors) {
    try {
      const img = document.querySelector(selector) as HTMLImageElement | null;
      if (
        img?.src &&
        !isExcludedImage(img.src, img.getAttribute('alt') ?? undefined, img) &&
        !img.closest('[aria-modal="true"], [role="dialog"], dialog')
      ) {
        return img.src;
      }
    } catch {
      // Invalid selector
    }
  }

  return undefined;
}

const MAX_COLLECTION_ITEMS = 24;

function normalizeWhitespace(
  text: string | undefined | null,
): string | undefined {
  const normalized = text?.replace(/\s+/g, ' ').trim();
  return normalized || undefined;
}

function isLikelyProductUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.href);
    const path = parsed.pathname.toLowerCase();
    if (parsed.origin !== window.location.origin) return false;
    if (path === window.location.pathname.toLowerCase()) return false;
    return (
      /\/products?\//.test(path) ||
      /\/p\//.test(path) ||
      /\/product[-/]/.test(path) ||
      /\/shop\/.+/.test(path) ||
      /\bsku\b/.test(parsed.search.toLowerCase())
    );
  } catch {
    return false;
  }
}

function isLikelyCollectionPage(): boolean {
  const path = window.location.pathname.toLowerCase();
  if (
    /\/products?\//.test(path) ||
    /\/p\//.test(path) ||
    /\/product[-/]/.test(path)
  ) {
    return false;
  }
  return (
    /\/collections?\//.test(path) ||
    /\/categories?\//.test(path) ||
    /\/catalog\//.test(path) ||
    /\/shop\//.test(path) ||
    /\/search/.test(path) ||
    /\/strollers?\//.test(path) ||
    /\/car-seats?\//.test(path) ||
    /\/accessories?\//.test(path)
  );
}

function productUrlScore(url: string): number {
  try {
    const path = new URL(url, window.location.href).pathname.toLowerCase();
    if (/\/products?\//.test(path)) return 30;
    if (/\/p\//.test(path)) return 25;
    if (/\/product[-/]/.test(path)) return 20;
    return 0;
  } catch {
    return 0;
  }
}

function findLikelyProductCard(anchor: HTMLAnchorElement): Element {
  let current: Element | null = anchor;
  let best: Element = anchor;
  let depth = 0;

  while (current && current !== document.body && depth < 8) {
    const classId = `${current.getAttribute('class') || ''} ${
      current.getAttribute('id') || ''
    }`.toLowerCase();
    const productLinkCount = Array.from(
      current.querySelectorAll('a[href]'),
    ).filter((a) => isLikelyProductUrl((a as HTMLAnchorElement).href)).length;
    const textLength = (current.textContent || '')
      .replace(/\s+/g, ' ')
      .trim().length;

    if (
      /product|card|tile|grid|item|result|listing/.test(classId) &&
      productLinkCount <= 4 &&
      textLength <= 2200
    ) {
      best = current;
    }

    current = current.parentElement;
    depth++;
  }

  return best;
}

function extractTitleFromCard(
  card: Element,
  anchor: HTMLAnchorElement,
): string | undefined {
  const selectors = [
    '[class*="title"]',
    '[class*="name"]',
    '[data-testid*="title"]',
    '[data-testid*="name"]',
    'h2',
    'h3',
    'h4',
  ];

  for (const selector of selectors) {
    try {
      const el = card.querySelector(selector);
      const text = normalizeWhitespace(el?.textContent);
      if (text && text.length <= 140 && !PRICE_REGEX.test(text)) return text;
    } catch {
      // Invalid selector
    } finally {
      PRICE_REGEX.lastIndex = 0;
    }
  }

  const aria = normalizeWhitespace(anchor.getAttribute('aria-label'));
  if (aria && aria.length <= 140) return aria;

  const anchorText = normalizeWhitespace(anchor.textContent);
  if (
    anchorText &&
    anchorText.length <= 140 &&
    !/buy|shop|explore|view/i.test(anchorText)
  ) {
    return anchorText;
  }

  const img = card.querySelector('img[alt]') as HTMLImageElement | null;
  const alt = normalizeWhitespace(img?.getAttribute('alt'));
  return alt && alt.length <= 180 ? alt : undefined;
}

function extractDescriptionFromCard(
  card: Element,
  title?: string,
  price?: string,
): string | undefined {
  const pieces: string[] = [];
  const selectors = [
    '[class*="description"]',
    '[class*="subtitle"]',
    '[class*="summary"]',
    '[class*="feature"]',
    'p',
    'li',
  ];

  for (const selector of selectors) {
    try {
      for (const el of Array.from(card.querySelectorAll(selector))) {
        const text = normalizeWhitespace(el.textContent);
        if (!text) continue;
        if (title && text === title) continue;
        if (price && text.includes(price)) continue;
        if (/^(buy|shop|explore|compare|previous|next)$/i.test(text)) continue;
        if (text.length < 4 || text.length > 220) continue;
        if (!pieces.includes(text)) pieces.push(text);
        if (pieces.length >= 6) break;
      }
    } catch {
      // Invalid selector
    }
    if (pieces.length >= 6) break;
  }

  return pieces.length ? pieces.join(' | ') : undefined;
}

function extractPriceFromCard(card: Element): {
  price?: string;
  currency?: string;
} {
  const selectors = [
    '[itemprop="price"]',
    '[data-price]',
    '[class*="price"]',
    '[class*="Price"]',
    '[data-testid*="price"]',
  ];

  for (const selector of selectors) {
    try {
      for (const el of Array.from(card.querySelectorAll(selector))) {
        const content =
          el.getAttribute('content') || el.getAttribute('data-price');
        if (content && /^[\d.,]+$/.test(content)) {
          return { price: content, currency: undefined };
        }
        const parsed = extractPriceFromText(el.textContent || '');
        if (parsed) return parsed;
      }
    } catch {
      // Invalid selector
    }
  }

  const parsed = extractPriceFromText(card.textContent || '');
  return parsed || {};
}

function extractBrandFromCard(card: Element): string | undefined {
  const selectors = [
    '[itemprop="brand"]',
    '[class*="brand"]',
    '[class*="vendor"]',
    '[data-testid*="brand"]',
  ];

  for (const selector of selectors) {
    try {
      const text = normalizeWhitespace(
        card.querySelector(selector)?.textContent,
      );
      if (text && text.length <= 80) return text;
    } catch {
      // Invalid selector
    }
  }

  return undefined;
}

function extractCollectionItemsFromShopifyAnalytics(): ExtractedMetadata[] {
  type ShopifyAnalyticsProduct = {
    handle?: string;
    title?: string;
    vendor?: string;
    variants?: Array<{
      name?: string;
      price?: number | string;
      sku?: string;
    }>;
  };
  type ShopifyAnalyticsMeta = {
    currency?: string;
    products?: ShopifyAnalyticsProduct[];
  };
  const analytics = (
    window as Window & {
      ShopifyAnalytics?: { meta?: ShopifyAnalyticsMeta };
    }
  ).ShopifyAnalytics?.meta;
  const products = Array.isArray(analytics?.products) ? analytics.products : [];
  return products
    .map((product): ExtractedMetadata | null => {
      const variant = Array.isArray(product?.variants)
        ? product.variants[0]
        : undefined;
      const handle = product?.handle;
      if (!handle) return null;
      const rawPrice = variant?.price;
      const price =
        typeof rawPrice === 'number'
          ? (rawPrice / 100).toFixed(2).replace(/\.00$/, '')
          : rawPrice != null
            ? String(rawPrice)
            : undefined;

      const url = resolveUrl(`/products/${handle}`);
      if (!url) return null;

      return {
        url,
        title: normalizeWhitespace(variant?.name || product?.title || handle),
        price,
        currency: analytics?.currency,
        brand: normalizeWhitespace(product?.vendor),
        sku: variant?.sku,
        pageType: 'product',
      };
    })
    .filter((item: ExtractedMetadata | null): item is ExtractedMetadata =>
      Boolean(item?.url && item.title),
    );
}

function extractCollectionItemsFromDOM(): ExtractedMetadata[] {
  const byKey = new Map<string, ExtractedMetadata & { _score?: number }>();
  const anchors = Array.from(document.querySelectorAll('a[href]')).filter((a) =>
    isLikelyProductUrl((a as HTMLAnchorElement).href),
  ) as HTMLAnchorElement[];

  for (const anchor of anchors) {
    const sourceUrl = resolveUrl(anchor.getAttribute('href') || anchor.href);
    if (!sourceUrl) continue;

    const card = findLikelyProductCard(anchor);
    const { price, currency } = extractPriceFromCard(card);
    const title = extractTitleFromCard(card, anchor);
    const imageUrl = collectImagesFromContainer(card)[0];
    const brand = extractBrandFromCard(card);
    const description = extractDescriptionFromCard(card, title, price);

    if (!title && !imageUrl && !price) continue;

    const normalizedTitle = title?.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const key =
      normalizedTitle && price ? `${normalizedTitle}:${price}` : sourceUrl;
    const score =
      productUrlScore(sourceUrl) +
      (title ? 10 : 0) +
      (imageUrl ? 5 : 0) +
      (price ? 5 : 0) +
      (description ? 3 : 0);
    const existing = byKey.get(key);
    if (existing && (existing._score || 0) >= score) continue;

    byKey.set(key, {
      url: sourceUrl,
      title,
      description,
      imageUrl,
      price,
      currency,
      brand,
      pageType: 'product',
      _score: score,
    });
  }

  return Array.from(byKey.values())
    .sort((a, b) => (b._score || 0) - (a._score || 0))
    .slice(0, MAX_COLLECTION_ITEMS)
    .map(({ _score, ...item }) => item);
}

function extractCollectionItems(): ExtractedMetadata[] {
  const byUrl = new Map<string, ExtractedMetadata>();

  for (const item of [
    ...extractCollectionItemsFromShopifyAnalytics(),
    ...extractCollectionItemsFromDOM(),
  ]) {
    if (!item.url) continue;
    const existing = byUrl.get(item.url);
    byUrl.set(item.url, {
      ...item,
      ...existing,
      title: existing?.title || item.title,
      description: existing?.description || item.description,
      imageUrl: existing?.imageUrl || item.imageUrl,
      price: existing?.price || item.price,
      currency: existing?.currency || item.currency,
      brand: existing?.brand || item.brand,
      sku: existing?.sku || item.sku,
      pageType: 'product',
    });
  }

  return Array.from(byUrl.values()).slice(0, MAX_COLLECTION_ITEMS);
}

// Main extraction function
export function extractMetadata(): ExtractionResult {
  const url = window.location.href;
  const extractedFields: string[] = [];

  // Collect from all sources
  const jsonLd = extractJsonLd();
  const og = extractOpenGraph();
  // Pass the best-known product title to DOM extraction for heading-match scoring.
  // Prefers JSON-LD/OG over h1 since many sites don't use h1 for product names.
  const knownTitle = jsonLd?.title || og.title || undefined;
  const domPrice = extractPriceFromDOM(knownTitle);
  const ogImageUrl = og.imageUrl;
  const { images: domImages, activeSlideUrl } =
    extractAllImagesFromDOM(ogImageUrl);
  const domImageFallback = extractImageFromDOM();
  const platform = detectPlatform();
  const collectionItems = extractCollectionItems();
  const shouldTreatAsCollection =
    collectionItems.length >= 2 && isLikelyCollectionPage();

  // Filter og:image through the same exclusion check as DOM images.
  // Store-wide social share images (e.g. Shopify-share-image.png) must not
  // become the primary product image or appear in the gallery.
  const filteredOgImageUrl =
    ogImageUrl && !isExcludedImage(ogImageUrl) ? ogImageUrl : undefined;

  // Merge all image sources, deduplicate.
  const allImages = deduplicateImages(
    [
      ...(jsonLd?.images || []),
      ...(filteredOgImageUrl ? [filteredOgImageUrl] : []),
      ...domImages,
    ].filter(Boolean),
  );

  // Image priority: JSON-LD variant match > active carousel slide > og:image > DOM fallback.
  // activeSlideUrl reflects the variant the user actually has selected (e.g. Flickity
  // is-selected cell), so it wins over the static og:image when variants differ.
  const title = jsonLd?.title || og.title;
  const description = jsonLd?.description || og.description;
  const merged: ExtractedMetadata = {
    url,
    title: title ? decodeHtmlEntities(title) : undefined,
    description: description ? decodeHtmlEntities(description) : undefined,
    imageUrl:
      jsonLd?.imageUrl ||
      activeSlideUrl ||
      filteredOgImageUrl ||
      domImages[0] ||
      domImageFallback,
    images: allImages.length > 1 ? allImages : undefined,
    price: jsonLd?.price || domPrice.price || og.price,
    currency: jsonLd?.currency || domPrice.currency || og.currency,
    brand: jsonLd?.brand || og.brand,
    sku: jsonLd?.sku,
    color: jsonLd?.color,
    variants: jsonLd?.variants,
    pageType: shouldTreatAsCollection
      ? 'collection'
      : title || jsonLd?.price || og.price || domPrice.price
        ? 'product'
        : 'unknown',
    collectionItems: shouldTreatAsCollection ? collectionItems : undefined,
    platform,
  };

  // Track extracted fields
  if (merged.title) extractedFields.push('title');
  if (merged.description) extractedFields.push('description');
  if (merged.imageUrl) extractedFields.push('imageUrl');
  if (merged.images) extractedFields.push('images');
  if (merged.price) extractedFields.push('price');
  if (merged.currency) extractedFields.push('currency');
  if (merged.brand) extractedFields.push('brand');
  if (merged.sku) extractedFields.push('sku');
  if (merged.color) extractedFields.push('color');
  if (merged.variants) extractedFields.push('variants');
  if (merged.pageType) extractedFields.push('pageType');
  if (merged.collectionItems) extractedFields.push('collectionItems');

  // Calculate confidence
  const criticalFields = ['title', 'imageUrl', 'price'];
  const criticalExtracted = criticalFields.filter((f) =>
    extractedFields.includes(f),
  ).length;

  return {
    ...merged,
    source: 'merged',
    confidence: criticalExtracted / criticalFields.length,
    extractedFields,
  };
}

// Collect all JSON-LD blocks from the page (raw, unparsed beyond JSON.parse)
function collectJsonLd(): unknown[] {
  const results: unknown[] = [];
  for (const script of document.querySelectorAll(
    'script[type="application/ld+json"]',
  )) {
    try {
      results.push(JSON.parse(script.textContent || ''));
    } catch {
      // Skip invalid JSON
    }
  }
  return results;
}

// Collect all meta tags into a flat record
function collectMetaTags(): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const meta of document.querySelectorAll('meta[property], meta[name]')) {
    const key =
      meta.getAttribute('property') || meta.getAttribute('name') || '';
    const content = meta.getAttribute('content') || '';
    if (key && content) {
      tags[key] = content;
    }
  }
  return tags;
}

// Capture full page data for corpus building
export function captureRawPage(): RawPageCapture {
  const extraction = extractMetadata();
  return {
    url: window.location.href,
    timestamp: new Date().toISOString(),
    html: document.documentElement.outerHTML,
    jsonLd: collectJsonLd(),
    metaTags: collectMetaTags(),
    extraction,
  };
}
