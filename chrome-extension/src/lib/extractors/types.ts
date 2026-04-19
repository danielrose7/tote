export interface ExtractedMetadata {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  price?: string;
  currency?: string;
  brand?: string;
  availability?: string;
  platform?: 'shopify' | 'squarespace' | 'woocommerce' | 'unknown';
}

export interface ExtractionResult extends ExtractedMetadata {
  source: 'json-ld' | 'open-graph' | 'dom' | 'merged';
  confidence: number;
  extractedFields: string[];
}

export interface RawPageCapture {
  url: string;
  timestamp: string;
  html: string;
  jsonLd: unknown[];
  metaTags: Record<string, string>;
  extraction: ExtractionResult;
}

export interface MessagePayload {
  type: 'EXTRACT_METADATA' | 'METADATA_RESULT' | 'CAPTURE_RAW_PAGE';
  data?: ExtractedMetadata;
  capture?: RawPageCapture;
  error?: string;
}

export interface TabInfo {
  tabId: number;
  url: string;
  title: string;
  favIconUrl?: string;
  extractable: boolean;
}
