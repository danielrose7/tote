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
  source: "json-ld" | "open-graph" | "dom" | "merged";
  confidence: number;
  extractedFields: string[];
}

export interface MessagePayload {
  type: "EXTRACT_METADATA" | "METADATA_RESULT";
  data?: ExtractedMetadata;
  error?: string;
}
