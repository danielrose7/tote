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

// Resolve a potentially-relative URL to an absolute one using the current page origin.
function resolveUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
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

// Extract the canonical URL from a product object (offers.url, @id, or url field).
function productCanonicalUrl(product: any): string | undefined {
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
  product: any;
  // When we fell back to a hasVariant item without matching the selected variant,
  // groupName holds the ProductGroup's name so we can use that instead of the
  // variant-specific name (e.g. "Wildcat" instead of "Wildcat - Matte Black | ...").
  groupName?: string;
  variantMatched: boolean;
  // Full variant list from ProductGroup (if available)
  allVariants?: any[];
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
      const d = data as any;
      const allVariants = Array.isArray(d.hasVariant)
        ? d.hasVariant
        : undefined;
      if (allVariants) {
        const variantId = extractCurrentVariantId();
        if (variantId) {
          const matched = allVariants.find((v: any) => {
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
        const withOffers = allVariants.find((v: any) => v?.offers);
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

  if ('@graph' in data && Array.isArray((data as any)['@graph'])) {
    for (const item of (data as any)['@graph']) {
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
  if (typeof image === 'object' && 'url' in (image as any)) {
    const url = resolveUrl((image as any).url);
    return url ? [url] : [];
  }
  return [];
}

// Extract variant list from JSON-LD hasVariant array
function extractVariants(variants: any[]): ProductVariant[] {
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

function extractProductPrice(offers: any): {
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

function extractBrand(brand: any): string | undefined {
  if (!brand) return undefined;
  if (typeof brand === 'string') return brand;
  if (typeof brand === 'object' && 'name' in brand) return brand.name;
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
    const ctx = cls + ' ' + id;

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
      if (img?.src && !img.src.includes('logo') && !img.src.includes('icon')) {
        return img.src;
      }
    } catch {
      // Invalid selector
    }
  }

  return undefined;
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
  const domImage = extractImageFromDOM();
  const platform = detectPlatform();

  // Merge with priority: JSON-LD > DOM > Open Graph
  const title = jsonLd?.title || og.title;
  const description = jsonLd?.description || og.description;
  const merged: ExtractedMetadata = {
    url,
    title: title ? decodeHtmlEntities(title) : undefined,
    description: description ? decodeHtmlEntities(description) : undefined,
    imageUrl: jsonLd?.imageUrl || og.imageUrl || domImage,
    images: jsonLd?.images,
    price: jsonLd?.price || domPrice.price || og.price,
    currency: jsonLd?.currency || domPrice.currency || og.currency,
    brand: jsonLd?.brand || og.brand,
    sku: jsonLd?.sku,
    color: jsonLd?.color,
    variants: jsonLd?.variants,
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
