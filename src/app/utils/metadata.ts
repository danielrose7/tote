export interface LinkMetadata {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  price?: string;
  currency?: string;
  brand?: string;
  source?: "custom" | "microlink" | "fallback";
}

interface CustomExtractionResult {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  price?: string;
  currency?: string;
  brand?: string;
  confidence: number;
  sources: string[];
  extractedFields: string[];
}

export interface MicrolinkResponse {
  status: string;
  data: {
    url: string;
    title?: string;
    description?: string;
    image?: {
      url: string;
    };
    logo?: {
      url: string;
    };
    author?: string;
    publisher?: string;
    lang?: string;
  };
}

async function fetchFromCustomApi(url: string): Promise<LinkMetadata | null> {
  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      return null;
    }

    const data: CustomExtractionResult = await response.json();

    // Only use custom result if it has good confidence
    if (data.confidence < 0.3 && !data.title && !data.imageUrl) {
      return null;
    }

    return {
      url: data.url,
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
      price: data.price,
      currency: data.currency,
      brand: data.brand,
      source: "custom",
    };
  } catch (error) {
    console.error("Custom extraction failed:", error);
    return null;
  }
}

async function fetchFromMicrolink(url: string): Promise<LinkMetadata> {
  const microlinkUrl = new URL("https://api.microlink.io/");
  microlinkUrl.searchParams.set("url", url);
  microlinkUrl.searchParams.set("meta", "true");
  microlinkUrl.searchParams.set("screenshot", "false");
  microlinkUrl.searchParams.set("video", "false");

  const response = await fetch(microlinkUrl.toString());

  if (!response.ok) {
    throw new Error(`Failed to fetch metadata: ${response.statusText}`);
  }

  const data: MicrolinkResponse = await response.json();

  if (data.status !== "success") {
    throw new Error("Failed to extract metadata from URL");
  }

  // Fall back to logo if no image is available
  const imageUrl = data.data.image?.url || data.data.logo?.url;
  const title = data.data.title || generateTitleFromUrl(url);

  return {
    url: data.data.url,
    title,
    description: data.data.description,
    imageUrl,
    source: "microlink",
  };
}

function mergeResults(
  custom: LinkMetadata | null,
  microlink: LinkMetadata | null
): LinkMetadata {
  if (!custom && !microlink) {
    return {
      url: "",
      source: "fallback",
    };
  }

  if (!custom) return microlink!;
  if (!microlink) return custom;

  // Merge: prefer custom for price/brand, use best available for others
  return {
    url: custom.url || microlink.url,
    title: custom.title || microlink.title,
    description: custom.description || microlink.description,
    imageUrl: custom.imageUrl || microlink.imageUrl,
    price: custom.price || microlink.price,
    currency: custom.currency || microlink.currency,
    brand: custom.brand || microlink.brand,
    source: custom.price ? "custom" : microlink.source,
  };
}

export async function fetchMetadata(url: string): Promise<LinkMetadata> {
  try {
    // Try both in parallel for speed
    const [customResult, microlinkResult] = await Promise.allSettled([
      fetchFromCustomApi(url),
      fetchFromMicrolink(url),
    ]);

    const custom =
      customResult.status === "fulfilled" ? customResult.value : null;
    const microlink =
      microlinkResult.status === "fulfilled" ? microlinkResult.value : null;

    const merged = mergeResults(custom, microlink);

    // Ensure we have at least a title
    if (!merged.title) {
      merged.title = generateTitleFromUrl(url);
    }

    merged.url = url;
    return merged;
  } catch (error) {
    console.error("Error fetching metadata:", error);

    return {
      url,
      title: generateTitleFromUrl(url),
      source: "fallback",
    };
  }
}

function generateTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, "");
    return hostname.charAt(0).toUpperCase() + hostname.slice(1);
  } catch {
    return "Untitled Link";
  }
}

export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
