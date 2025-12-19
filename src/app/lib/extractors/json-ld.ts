import type { ExtractedMetadata, ExtractionResult } from "./types";

interface JsonLdProduct {
  "@type": string;
  name?: string;
  description?: string;
  image?: string | string[] | { url: string }[];
  brand?: { name?: string; "@type"?: string } | string;
  offers?:
    | {
        price?: string | number;
        priceCurrency?: string;
        availability?: string;
      }
    | Array<{
        price?: string | number;
        priceCurrency?: string;
        availability?: string;
      }>;
}

interface JsonLdGraph {
  "@graph"?: JsonLdProduct[];
}

function findProductInData(data: unknown): JsonLdProduct | null {
  if (!data || typeof data !== "object") return null;

  // Direct product
  if ("@type" in data) {
    const typed = data as { "@type": string | string[] };
    const types = Array.isArray(typed["@type"])
      ? typed["@type"]
      : [typed["@type"]];
    if (types.some((t) => t === "Product" || t === "IndividualProduct")) {
      return data as JsonLdProduct;
    }
  }

  // @graph array
  if ("@graph" in data) {
    const graph = (data as JsonLdGraph)["@graph"];
    if (Array.isArray(graph)) {
      for (const item of graph) {
        const product = findProductInData(item);
        if (product) return product;
      }
    }
  }

  // Array of schemas
  if (Array.isArray(data)) {
    for (const item of data) {
      const product = findProductInData(item);
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

function extractPrice(
  offers: JsonLdProduct["offers"]
): { price?: string; currency?: string; availability?: string } {
  if (!offers) return {};

  const offer = Array.isArray(offers) ? offers[0] : offers;
  if (!offer) return {};

  return {
    price: offer.price?.toString(),
    currency: offer.priceCurrency,
    availability: offer.availability,
  };
}

function extractBrand(
  brand: JsonLdProduct["brand"]
): string | undefined {
  if (!brand) return undefined;
  if (typeof brand === "string") return brand;
  if (typeof brand === "object" && "name" in brand) return brand.name;
  return undefined;
}

export function extractJsonLd(html: string): ExtractionResult | null {
  const scriptRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const extractedFields: string[] = [];

  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const jsonContent = match[1].trim();
      const data = JSON.parse(jsonContent);
      const product = findProductInData(data);

      if (product) {
        const { price, currency, availability } = extractPrice(product.offers);
        const imageUrl = extractImage(product.image);
        const brand = extractBrand(product.brand);

        const result: ExtractedMetadata = {
          url: "",
          title: product.name,
          description: product.description,
          imageUrl,
          price,
          currency,
          brand,
          availability,
        };

        // Track which fields were extracted
        if (result.title) extractedFields.push("title");
        if (result.description) extractedFields.push("description");
        if (result.imageUrl) extractedFields.push("imageUrl");
        if (result.price) extractedFields.push("price");
        if (result.currency) extractedFields.push("currency");
        if (result.brand) extractedFields.push("brand");

        return {
          ...result,
          source: "json-ld",
          confidence: extractedFields.length / 6, // 6 possible fields
          extractedFields,
        };
      }
    } catch {
      // Invalid JSON, continue to next script
    }
  }

  return null;
}
