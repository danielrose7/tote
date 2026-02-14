import type { ExtractedMetadata, ExtractionResult } from "./types";

// Decode HTML entities (e.g. &quot; → ") safely using a textarea
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

// Currency symbols and their codes
const CURRENCY_MAP: Record<string, string> = {
  $: "USD",
  "£": "GBP",
  "€": "EUR",
  "¥": "JPY",
  "₹": "INR",
  "₩": "KRW",
  "A$": "AUD",
  "C$": "CAD",
  kr: "SEK",
  Fr: "CHF",
};

// Price patterns for extraction
const PRICE_REGEX =
  /(?:[$£€¥₹₩]|A\$|C\$|kr|Fr\.?)\s*[\d.,]+|\d[\d.,]*\s*(?:[$£€¥₹₩]|USD|EUR|GBP)/gi;

function extractPriceFromText(
  text: string
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
  const numericMatch = priceStr.match(/[\d.,]+/);
  if (!numericMatch) return null;

  let price = numericMatch[0];

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

// JSON-LD Extraction
function extractJsonLd(): Partial<ExtractedMetadata> | null {
  const scripts = document.querySelectorAll(
    'script[type="application/ld+json"]'
  );

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || "");
      const product = findProduct(data);
      if (product) {
        return {
          title: product.name,
          description: product.description,
          imageUrl: extractImage(product.image),
          price: extractProductPrice(product.offers)?.price,
          currency: extractProductPrice(product.offers)?.currency,
          brand: extractBrand(product.brand),
        };
      }
    } catch {
      // Invalid JSON
    }
  }
  return null;
}

function findProduct(data: unknown): any {
  if (!data || typeof data !== "object") return null;

  if ("@type" in data) {
    const typed = data as { "@type": string | string[] };
    const types = Array.isArray(typed["@type"])
      ? typed["@type"]
      : [typed["@type"]];
    if (types.some((t) => t === "Product" || t === "IndividualProduct")) {
      return data;
    }
  }

  if ("@graph" in data && Array.isArray((data as any)["@graph"])) {
    for (const item of (data as any)["@graph"]) {
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
  image: string | string[] | { url: string }[] | undefined
): string | undefined {
  if (!image) return undefined;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    const first = image[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "url" in first) return first.url;
  }
  return undefined;
}

function extractProductPrice(offers: any): { price?: string; currency?: string } {
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
  if (typeof brand === "string") return brand;
  if (typeof brand === "object" && "name" in brand) return brand.name;
  return undefined;
}

// Open Graph / Meta Tag Extraction
function extractOpenGraph(): Partial<ExtractedMetadata> {
  const getMeta = (names: string[]): string | undefined => {
    for (const name of names) {
      const el =
        document.querySelector(`meta[property="${name}"]`) ||
        document.querySelector(`meta[name="${name}"]`);
      const content = el?.getAttribute("content");
      if (content) return content;
    }
    return undefined;
  };

  return {
    title:
      getMeta(["og:title", "twitter:title"]) || document.title || undefined,
    description: getMeta([
      "og:description",
      "twitter:description",
      "description",
    ]),
    imageUrl: getMeta(["og:image", "twitter:image"]),
    price: getMeta(["product:price:amount", "og:price:amount"]),
    currency: getMeta(["product:price:currency", "og:price:currency"]),
    brand: getMeta(["product:brand", "og:brand"]),
  };
}

// DOM-based price extraction (for JS-rendered content)
function extractPriceFromDOM(): { price?: string; currency?: string } {
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
    "[data-price]",
    "[data-product-price]",
    // Exclude list/original/compare prices via class
    ".price:not(.price-compare):not(.was-price):not(.list-price):not(.bfx-list-price)",
    ".product-price:not(.list-price):not(.original-price)",
    // Exclude via class wildcards
    '[class*="price"]:not([class*="compare"]):not([class*="was"]):not([class*="old"]):not([class*="list"]):not([class*="original"]):not([class*="strikethrough"]):not([class*="crossed"])',
    '[class*="Price"]:not([class*="Compare"]):not([class*="Was"]):not([class*="Old"]):not([class*="List"]):not([class*="Original"]):not([class*="Strikethrough"]):not([class*="Crossed"])',
    // Exclude via data-testid patterns
    '[data-testid*="price"]:not([data-testid*="list"]):not([data-testid*="original"]):not([data-testid*="was"]):not([data-testid*="compare"])',
  ];

  // First try itemprop with content attribute
  const itempropEl = document.querySelector('[itemprop="price"]');
  if (itempropEl) {
    const content = itempropEl.getAttribute("content");
    if (content) {
      const currencyEl = document.querySelector('[itemprop="priceCurrency"]');
      return {
        price: content,
        currency: currencyEl?.getAttribute("content") || "USD",
      };
    }
  }

  // Try data-price attribute
  const dataPriceEl = document.querySelector("[data-price]");
  if (dataPriceEl) {
    const attrValue = dataPriceEl.getAttribute("data-price");
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

  // Try CSS selectors
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
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

  // Strategy: Look for "Add to cart" button area - price often near it
  const addToCartBtn = document.querySelector(
    'button[class*="add"], button[class*="cart"], [class*="add-to-cart"], [class*="buy"]'
  );
  if (addToCartBtn) {
    // Check the button itself and nearby siblings
    const parent = addToCartBtn.parentElement;
    if (parent) {
      const text = parent.textContent || "";
      const result = extractPriceFromText(text);
      if (result) return result;
    }
    // Check button's own text
    const btnText = addToCartBtn.textContent || "";
    const btnResult = extractPriceFromText(btnText);
    if (btnResult) return btnResult;
  }

  // Strategy: Scan for elements with just a price (e.g., "$40")
  // Look for short text nodes containing currency symbols
  const allElements = document.querySelectorAll(
    "div, span, p, button, [class*='h5'], [class*='h4'], [class*='h3']"
  );
  for (const el of allElements) {
    // Skip if has many children (likely a container)
    if (el.children.length > 2) continue;

    const text = el.textContent?.trim() || "";
    // Only check short text that looks like a price
    if (text.length < 15 && /^[$£€¥]\d/.test(text)) {
      const result = extractPriceFromText(text);
      if (result) return result;
    }
  }

  return {};
}

// Detect platform
function detectPlatform(): ExtractedMetadata["platform"] {
  const html = document.documentElement.outerHTML;

  if (
    html.includes("cdn.shopify.com") ||
    html.includes("Shopify.theme") ||
    document
      .querySelector('meta[name="generator"]')
      ?.getAttribute("content")
      ?.includes("Shopify")
  ) {
    return "shopify";
  }

  if (html.includes("squarespace.com") || html.includes("squarespace-cdn")) {
    return "squarespace";
  }

  if (html.includes("woocommerce") || html.includes("wc-")) {
    return "woocommerce";
  }

  return "unknown";
}

// Get best product image from DOM
function extractImageFromDOM(): string | undefined {
  // Priority: product images, then gallery, then main content
  const selectors = [
    '[class*="product"] img[src*="product"]',
    '[class*="gallery"] img',
    '[class*="product-image"] img',
    '[data-product-image]',
    "main img",
    "article img",
    ".product img",
  ];

  for (const selector of selectors) {
    try {
      const img = document.querySelector(selector) as HTMLImageElement | null;
      if (img?.src && !img.src.includes("logo") && !img.src.includes("icon")) {
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
  const domPrice = extractPriceFromDOM();
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
    price: jsonLd?.price || domPrice.price || og.price,
    currency: jsonLd?.currency || domPrice.currency || og.currency,
    brand: jsonLd?.brand || og.brand,
    platform,
  };

  // Track extracted fields
  if (merged.title) extractedFields.push("title");
  if (merged.description) extractedFields.push("description");
  if (merged.imageUrl) extractedFields.push("imageUrl");
  if (merged.price) extractedFields.push("price");
  if (merged.currency) extractedFields.push("currency");
  if (merged.brand) extractedFields.push("brand");

  // Calculate confidence
  const criticalFields = ["title", "imageUrl", "price"];
  const criticalExtracted = criticalFields.filter((f) =>
    extractedFields.includes(f)
  ).length;

  return {
    ...merged,
    source: "merged",
    confidence: criticalExtracted / criticalFields.length,
    extractedFields,
  };
}
