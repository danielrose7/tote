export interface LinkMetadata {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  price?: string;
}

/**
 * Script to inject into iframe to extract and send metadata
 */
const EXTRACTOR_SCRIPT = `
(function() {
  function getMeta(names) {
    for (const name of names) {
      let tag = document.querySelector('meta[property="' + name + '"]');
      if (tag && tag.getAttribute('content')) {
        return tag.getAttribute('content');
      }
      tag = document.querySelector('meta[name="' + name + '"]');
      if (tag && tag.getAttribute('content')) {
        return tag.getAttribute('content');
      }
    }
    return null;
  }

  function extractPrice() {
    const ogPrice = document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content');
    if (ogPrice) return ogPrice;

    const priceMeta = document.querySelector('meta[itemprop="price"]')?.getAttribute('content');
    if (priceMeta) return priceMeta;

    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || '');
        if (data['@type'] === 'Product' && data.offers) {
          const price = data.offers.price || data.offers[0]?.price;
          if (price) return String(price);
        }
      } catch {}
    }

    const priceSelectors = ['[itemprop="price"]', '.price', '[class*="price"]', '[data-price]'];
    for (const selector of priceSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        const priceMatch = element.textContent.match(/[$£€¥]\\s*[\\d,]+\\.?\\d*/);
        if (priceMatch) return priceMatch[0];
      }
    }
    return null;
  }

  function generateTitle(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace(/^www\\./, '');
      return hostname.charAt(0).toUpperCase() + hostname.slice(1);
    } catch {
      return 'Untitled Link';
    }
  }

  const title = getMeta(['og:title', 'twitter:title']) ||
                document.querySelector('title')?.textContent ||
                document.querySelector('h1')?.textContent ||
                generateTitle(window.location.href);

  const description = getMeta(['og:description', 'twitter:description', 'description']);

  let imageUrl = getMeta(['og:image', 'twitter:image', 'twitter:image:src']);
  if (imageUrl && !imageUrl.startsWith('http')) {
    try {
      imageUrl = new URL(imageUrl, window.location.origin).href;
    } catch {
      imageUrl = null;
    }
  }

  const price = extractPrice();

  window.parent.postMessage({
    type: 'METADATA_EXTRACTED',
    data: {
      url: window.location.href,
      title: title?.trim(),
      description: description?.trim(),
      imageUrl: imageUrl,
      price: price
    }
  }, '*');
})();
`;

/**
 * Generate a title from URL hostname
 */
function generateTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');
    return hostname.charAt(0).toUpperCase() + hostname.slice(1);
  } catch {
    return 'Untitled Link';
  }
}

export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export { EXTRACTOR_SCRIPT, generateTitleFromUrl };
