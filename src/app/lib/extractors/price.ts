// Price extraction from HTML using multiple strategies

const PRICE_SELECTORS = [
  '[itemprop="price"]',
  '[data-price]',
  '[data-product-price]',
  ".price",
  ".product-price",
  ".current-price",
  ".sale-price",
  '[class*="price"]:not([class*="compare"])',
  '[class*="Price"]:not([class*="Compare"])',
];

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

// Regex to match prices like $29.99, €19,99, £100, etc.
const PRICE_REGEX = /(?:[$£€¥₹₩]|A\$|C\$|kr|Fr\.?)\s*[\d,]+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?\s*(?:[$£€¥₹₩]|USD|EUR|GBP)/gi;

function extractPriceFromText(text: string): { price: string; currency: string } | null {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const match = PRICE_REGEX.exec(cleaned);

  if (!match) return null;

  const priceStr = match[0];

  // Extract currency
  let currency = "USD"; // default
  for (const [symbol, code] of Object.entries(CURRENCY_MAP)) {
    if (priceStr.includes(symbol)) {
      currency = code;
      break;
    }
  }

  // Extract numeric value
  const numericMatch = priceStr.match(/[\d,]+(?:[.,]\d{2})?/);
  if (!numericMatch) return null;

  // Normalize price (handle European format with comma as decimal)
  let price = numericMatch[0];
  // If format is like 1.234,56 (European), convert to 1234.56
  if (/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(price)) {
    price = price.replace(/\./g, "").replace(",", ".");
  }
  // If format is like 1,234.56 (US), just remove commas
  else if (/^\d{1,3}(?:,\d{3})+(?:\.\d{2})?$/.test(price)) {
    price = price.replace(/,/g, "");
  }
  // Simple comma decimal like 29,99
  else if (/^\d+,\d{2}$/.test(price)) {
    price = price.replace(",", ".");
  }

  return { price, currency };
}

function getAttributeValue(html: string, selector: string, attr: string): string | null {
  // Convert CSS selector to regex pattern for attribute extraction
  let pattern: RegExp;

  if (selector.startsWith("[") && selector.includes("=")) {
    // Attribute selector like [itemprop="price"]
    const attrMatch = selector.match(/\[([^=]+)=["']([^"']+)["']\]/);
    if (attrMatch) {
      const [, attrName, attrValue] = attrMatch;
      pattern = new RegExp(
        `<[^>]*${attrName}=["']${attrValue}["'][^>]*${attr}=["']([^"']+)["']|<[^>]*${attr}=["']([^"']+)["'][^>]*${attrName}=["']${attrValue}["']`,
        "i"
      );
    } else {
      return null;
    }
  } else if (selector.startsWith("[")) {
    // Simple attribute selector like [data-price]
    const attrName = selector.slice(1, -1);
    pattern = new RegExp(`<[^>]*${attrName}=["']([^"']+)["']`, "i");
    const match = pattern.exec(html);
    return match?.[1] || null;
  } else {
    return null;
  }

  const match = pattern.exec(html);
  return match?.[1] || match?.[2] || null;
}

function getElementContent(html: string, selector: string): string | null {
  let pattern: RegExp;

  if (selector.startsWith(".")) {
    // Class selector
    const className = selector.slice(1);
    pattern = new RegExp(
      `<[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([^<]+)`,
      "i"
    );
  } else if (selector.startsWith("[") && selector.includes("*=")) {
    // Partial attribute match like [class*="price"]
    const attrMatch = selector.match(/\[([^*]+)\*=["']([^"']+)["']\]/);
    if (attrMatch) {
      const [, attrName, partialValue] = attrMatch;
      pattern = new RegExp(
        `<[^>]*${attrName}=["'][^"']*${partialValue}[^"']*["'][^>]*>([^<]+)`,
        "i"
      );
    } else {
      return null;
    }
  } else if (selector.startsWith("[")) {
    // Attribute selector
    const attrMatch = selector.match(/\[([^=]+)=["']([^"']+)["']\]/);
    if (attrMatch) {
      const [, attrName, attrValue] = attrMatch;
      pattern = new RegExp(
        `<[^>]*${attrName}=["']${attrValue}["'][^>]*>([^<]+)`,
        "i"
      );
    } else {
      return null;
    }
  } else {
    return null;
  }

  const match = pattern.exec(html);
  return match?.[1]?.trim() || null;
}

export function extractPrice(html: string): { price?: string; currency?: string } {
  // Strategy 1: itemprop="price" with content attribute
  const itempropPrice = getAttributeValue(html, '[itemprop="price"]', "content");
  if (itempropPrice) {
    const currency = getAttributeValue(html, '[itemprop="priceCurrency"]', "content");
    return { price: itempropPrice, currency: currency || "USD" };
  }

  // Strategy 2: data-price attribute
  const dataPrice = getAttributeValue(html, "[data-price]", "data-price");
  if (dataPrice) {
    return extractPriceFromText(dataPrice) || { price: dataPrice };
  }

  // Strategy 3: CSS selectors with text content
  for (const selector of PRICE_SELECTORS) {
    // Skip complex selectors with :not() for regex-based extraction
    if (selector.includes(":not(")) continue;

    const content = getElementContent(html, selector);
    if (content) {
      const result = extractPriceFromText(content);
      if (result) return result;
    }
  }

  // Strategy 4: Scan for any price-like pattern in common containers
  const priceContainerPattern = /<(?:span|div|p)[^>]*class=["'][^"']*price[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div|p)>/gi;
  let match;
  while ((match = priceContainerPattern.exec(html)) !== null) {
    const content = match[1].replace(/<[^>]+>/g, " ").trim();
    const result = extractPriceFromText(content);
    if (result) return result;
  }

  return {};
}
