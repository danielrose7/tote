export interface ExtractedMetadata {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  price?: string;
  currency?: string;
  brand?: string;
  availability?: string;
  platform?: "shopify" | "squarespace" | "woocommerce" | "unknown";
}

export interface ExtractionResult extends ExtractedMetadata {
  source: "json-ld" | "open-graph" | "shopify" | "html-fallback" | "merged";
  confidence: number; // 0-1
  extractedFields: string[];
}
