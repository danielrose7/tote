import type { ExtractedMetadata, ExtractionResult } from "./types";
import { extractJsonLd } from "./json-ld";
import { extractOpenGraph } from "./open-graph";
import { extractPrice } from "./price";
import { isShopifySite, extractShopifyProduct } from "./shopify";

export type { ExtractedMetadata, ExtractionResult } from "./types";

// Decode HTML entities like &#x27; &quot; &amp; etc.
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&"); // Must be last to avoid double-decoding
}

interface MergedResult extends ExtractedMetadata {
  sources: string[];
  confidence: number;
  extractedFields: string[];
}

function mergeResults(results: (ExtractionResult | null)[]): MergedResult {
  const validResults = results.filter((r): r is ExtractionResult => r !== null);

  if (validResults.length === 0) {
    return {
      url: "",
      sources: [],
      confidence: 0,
      extractedFields: [],
    };
  }

  // Priority order for merging (first non-empty value wins)
  // Shopify > JSON-LD > Open Graph > HTML fallback
  const priorityOrder = ["shopify", "json-ld", "open-graph", "html-fallback"];
  validResults.sort((a, b) => {
    const aIdx = priorityOrder.indexOf(a.source);
    const bIdx = priorityOrder.indexOf(b.source);
    return aIdx - bIdx;
  });

  const merged: MergedResult = {
    url: "",
    sources: validResults.map((r) => r.source),
    confidence: 0,
    extractedFields: [],
  };

  const fields: (keyof ExtractedMetadata)[] = [
    "title",
    "description",
    "imageUrl",
    "price",
    "currency",
    "brand",
    "availability",
    "platform",
  ];

  for (const field of fields) {
    for (const result of validResults) {
      const value = result[field];
      if (value && !merged[field]) {
        (merged as Record<string, unknown>)[field] = value;
        if (!merged.extractedFields.includes(field)) {
          merged.extractedFields.push(field);
        }
        break;
      }
    }
  }

  // Calculate confidence based on extracted fields
  const criticalFields = ["title", "imageUrl", "price"];
  const criticalExtracted = criticalFields.filter((f) =>
    merged.extractedFields.includes(f)
  ).length;
  merged.confidence = criticalExtracted / criticalFields.length;

  // Decode HTML entities in text fields
  if (merged.title) {
    merged.title = decodeHtmlEntities(merged.title);
  }
  if (merged.description) {
    merged.description = decodeHtmlEntities(merged.description);
  }

  return merged;
}

export async function extractMetadata(url: string): Promise<MergedResult> {
  // Fetch HTML
  let html: string;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    html = await response.text();
  } catch (error) {
    return {
      url,
      sources: [],
      confidence: 0,
      extractedFields: [],
    };
  }

  const results: (ExtractionResult | null)[] = [];

  // Check if Shopify site - if so, try Shopify API first
  if (isShopifySite(html, url)) {
    const shopifyResult = await extractShopifyProduct(url);
    if (shopifyResult) {
      results.push(shopifyResult);
    }
  }

  // Run HTML-based extractors in parallel
  const [jsonLdResult, ogResult] = await Promise.all([
    Promise.resolve(extractJsonLd(html)),
    Promise.resolve(extractOpenGraph(html)),
  ]);

  results.push(jsonLdResult);
  results.push(ogResult);

  // If we don't have price from structured data, try HTML extraction
  const hasPrice = results.some((r) => r?.price);
  if (!hasPrice) {
    const priceResult = extractPrice(html);
    if (priceResult.price) {
      results.push({
        url,
        price: priceResult.price,
        currency: priceResult.currency,
        source: "html-fallback",
        confidence: 0.3,
        extractedFields: ["price", ...(priceResult.currency ? ["currency"] : [])],
      });
    }
  }

  // Merge all results
  const merged = mergeResults(results);
  merged.url = url;

  // Detect platform if not already set
  if (!merged.platform) {
    if (isShopifySite(html, url)) {
      merged.platform = "shopify";
    } else if (/squarespace/i.test(html)) {
      merged.platform = "squarespace";
    } else if (/woocommerce/i.test(html)) {
      merged.platform = "woocommerce";
    } else {
      merged.platform = "unknown";
    }
  }

  return merged;
}
