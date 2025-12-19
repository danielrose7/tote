import type { ExtractionResult } from "./types";

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  description: string;
  vendor: string;
  type: string;
  tags: string[];
  price: number;
  price_min: number;
  price_max: number;
  available: boolean;
  compare_at_price: number | null;
  compare_at_price_min: number;
  compare_at_price_max: number;
  variants: Array<{
    id: number;
    title: string;
    price: number;
    compare_at_price: number | null;
    available: boolean;
  }>;
  images: string[];
  featured_image: string;
  url: string;
}

export function isShopifySite(html: string, url: string): boolean {
  // Check for Shopify CDN in URLs
  if (url.includes("cdn.shopify.com") || url.includes(".myshopify.com")) {
    return true;
  }

  // Check for Shopify meta generator tag
  if (/<meta[^>]*name=["']generator["'][^>]*content=["']Shopify["']/i.test(html)) {
    return true;
  }

  // Check for Shopify in scripts
  if (/Shopify\.(theme|shop|routes)/i.test(html)) {
    return true;
  }

  // Check for cdn.shopify.com in any resource
  if (/cdn\.shopify\.com/i.test(html)) {
    return true;
  }

  return false;
}

function extractHandleFromUrl(url: string): string | null {
  // Match /products/handle or /products/handle?variant=...
  const match = url.match(/\/products\/([^/?#]+)/);
  return match?.[1] || null;
}

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

function optimizeShopifyImageUrl(imageUrl: string): string {
  // Remove size constraints to get full resolution
  // Shopify images often have _100x100 or similar suffixes
  return imageUrl.replace(/_\d+x\d*|\d+x\d+_/g, "");
}

export async function extractShopifyProduct(
  url: string
): Promise<ExtractionResult | null> {
  const handle = extractHandleFromUrl(url);
  if (!handle) return null;

  try {
    // Extract base URL
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    const productJsonUrl = `${baseUrl}/products/${handle}.js`;

    const response = await fetch(productJsonUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; ToteBot/1.0)",
      },
    });

    if (!response.ok) return null;

    const product: ShopifyProduct = await response.json();
    const extractedFields: string[] = [];

    const title = product.title;
    const description = product.description?.replace(/<[^>]+>/g, " ").trim();
    const imageUrl = product.featured_image
      ? optimizeShopifyImageUrl(product.featured_image)
      : product.images?.[0]
        ? optimizeShopifyImageUrl(product.images[0])
        : undefined;
    const price = formatPrice(product.price_min || product.price);
    const brand = product.vendor;
    const availability = product.available ? "InStock" : "OutOfStock";

    if (title) extractedFields.push("title");
    if (description) extractedFields.push("description");
    if (imageUrl) extractedFields.push("imageUrl");
    if (price) extractedFields.push("price");
    if (brand) extractedFields.push("brand");

    return {
      url,
      title,
      description,
      imageUrl,
      price,
      currency: "USD", // Shopify JS API doesn't include currency, would need store config
      brand,
      availability,
      platform: "shopify",
      source: "shopify",
      confidence: extractedFields.length / 5,
      extractedFields,
    };
  } catch {
    return null;
  }
}
