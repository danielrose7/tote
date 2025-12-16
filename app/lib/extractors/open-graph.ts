import type { ExtractionResult } from "./types";

function getMetaContent(html: string, names: string[]): string | undefined {
  for (const name of names) {
    // Try property attribute (Open Graph style)
    const propertyRegex = new RegExp(
      `<meta[^>]*property=["']${name}["'][^>]*content=["']([^"']+)["']`,
      "i"
    );
    let match = propertyRegex.exec(html);
    if (match?.[1]) return match[1];

    // Try content before property
    const reversePropertyRegex = new RegExp(
      `<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${name}["']`,
      "i"
    );
    match = reversePropertyRegex.exec(html);
    if (match?.[1]) return match[1];

    // Try name attribute (standard meta tags)
    const nameRegex = new RegExp(
      `<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`,
      "i"
    );
    match = nameRegex.exec(html);
    if (match?.[1]) return match[1];

    // Try content before name
    const reverseNameRegex = new RegExp(
      `<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["']`,
      "i"
    );
    match = reverseNameRegex.exec(html);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function getTitle(html: string): string | undefined {
  const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  return titleMatch?.[1]?.trim();
}

export function extractOpenGraph(html: string): ExtractionResult | null {
  const extractedFields: string[] = [];

  const title = getMetaContent(html, ["og:title", "twitter:title"]) || getTitle(html);
  const description = getMetaContent(html, [
    "og:description",
    "twitter:description",
    "description",
  ]);
  const imageUrl = getMetaContent(html, ["og:image", "twitter:image"]);
  const price = getMetaContent(html, [
    "product:price:amount",
    "og:price:amount",
  ]);
  const currency = getMetaContent(html, [
    "product:price:currency",
    "og:price:currency",
  ]);
  const brand = getMetaContent(html, ["product:brand", "og:brand"]);
  const availability = getMetaContent(html, [
    "product:availability",
    "og:availability",
  ]);

  // Track extracted fields
  if (title) extractedFields.push("title");
  if (description) extractedFields.push("description");
  if (imageUrl) extractedFields.push("imageUrl");
  if (price) extractedFields.push("price");
  if (currency) extractedFields.push("currency");
  if (brand) extractedFields.push("brand");

  if (extractedFields.length === 0) {
    return null;
  }

  return {
    url: "",
    title,
    description,
    imageUrl,
    price,
    currency,
    brand,
    availability,
    source: "open-graph",
    confidence: extractedFields.length / 6,
    extractedFields,
  };
}
