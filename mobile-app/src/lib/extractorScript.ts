/**
 * Injected into the hidden WebView via injectJavaScript().
 * Adapted from chrome-extension/src/lib/extractors/index.ts —
 * same logic, wrapped as an IIFE, posts result via ReactNativeWebView.
 */
export const extractorScript = `
(function() {
  try {
    // ── Helpers ──────────────────────────────────────────────────────────

    function decodeHtmlEntities(text) {
      var el = document.createElement('textarea');
      el.innerHTML = text;
      return el.value;
    }

    var CURRENCY_MAP = {
      '$': 'USD', '£': 'GBP', '€': 'EUR', '¥': 'JPY',
      '₹': 'INR', '₩': 'KRW', 'A$': 'AUD', 'C$': 'CAD',
      'kr': 'SEK', 'Fr': 'CHF',
    };

    var PRICE_REGEX = /(?:[$£€¥₹₩]|A\\$|C\\$|kr|Fr\\.?)\\s*[\\d.,]+|\\d[\\d.,]*\\s*(?:[$£€¥₹₩]|USD|EUR|GBP)/gi;

    function extractPriceFromText(text) {
      var cleaned = text.replace(/\\s+/g, ' ').trim();
      PRICE_REGEX.lastIndex = 0;
      var match = PRICE_REGEX.exec(cleaned);
      if (!match) return null;
      var priceStr = match[0];
      var currency = 'USD';
      var symbols = Object.keys(CURRENCY_MAP);
      for (var i = 0; i < symbols.length; i++) {
        if (priceStr.indexOf(symbols[i]) !== -1) { currency = CURRENCY_MAP[symbols[i]]; break; }
      }
      var numericMatch = priceStr.match(/[\\d.,]+/);
      if (!numericMatch) return null;
      var price = numericMatch[0];
      if (/^\\d{1,3}(?:\\.\\d{3})+,\\d{2}$/.test(price)) price = price.replace(/\\./g, '').replace(',', '.');
      else if (/^\\d{1,3}(?:,\\d{3})+(?:\\.\\d{2})?$/.test(price)) price = price.replace(/,/g, '');
      else if (/^\\d+,\\d{2}$/.test(price)) price = price.replace(',', '.');
      return { price: price, currency: currency };
    }

    // ── Variant detection ─────────────────────────────────────────────────

    function extractCurrentVariantId() {
      try {
        var input = document.querySelector('form[action*="/cart/add"] input[name="id"]');
        if (input && input.value) return input.value;
      } catch(e) {}
      try { return new URLSearchParams(window.location.search).get('variant'); } catch(e) { return null; }
    }

    // ── JSON-LD ───────────────────────────────────────────────────────────

    function extractImage(image) {
      if (!image) return undefined;
      if (typeof image === 'string') return image;
      if (Array.isArray(image)) {
        var first = image[0];
        if (typeof first === 'string') return first;
        if (first && first.url) return first.url;
      }
      return undefined;
    }

    function extractProductPrice(offers) {
      if (!offers) return {};
      var offer = Array.isArray(offers) ? offers[0] : offers;
      if (!offer) return {};
      return { price: offer.price != null ? String(offer.price) : undefined, currency: offer.priceCurrency };
    }

    function extractBrand(brand) {
      if (!brand) return undefined;
      if (typeof brand === 'string') return brand;
      if (brand.name) return brand.name;
      return undefined;
    }

    function findProduct(data) {
      if (!data || typeof data !== 'object') return null;
      if (data['@type']) {
        var types = Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
        if (types.some(function(t) { return t === 'Product' || t === 'IndividualProduct'; }))
          return { product: data, variantMatched: true };
        if (types.some(function(t) { return t === 'ProductGroup'; })) {
          if (Array.isArray(data.hasVariant)) {
            var variantId = extractCurrentVariantId();
            if (variantId) {
              var matched = null;
              for (var i = 0; i < data.hasVariant.length; i++) {
                var v = data.hasVariant[i];
                var vid = String(v['@id'] || v.productID || v.sku || v.identifier || '');
                if (vid.indexOf(variantId) !== -1) { matched = v; break; }
              }
              if (matched) return { product: matched, variantMatched: true };
            }
            var withOffers = null;
            for (var j = 0; j < data.hasVariant.length; j++) {
              if (data.hasVariant[j].offers) { withOffers = data.hasVariant[j]; break; }
            }
            if (withOffers) return { product: withOffers, groupName: data.name, variantMatched: false };
          }
          if (data.offers) return { product: data, variantMatched: true };
        }
      }
      if (data['@graph'] && Array.isArray(data['@graph'])) {
        for (var k = 0; k < data['@graph'].length; k++) {
          var r = findProduct(data['@graph'][k]);
          if (r) return r;
        }
      }
      if (Array.isArray(data)) {
        for (var l = 0; l < data.length; l++) {
          var r2 = findProduct(data[l]);
          if (r2) return r2;
        }
      }
      return null;
    }

    function extractJsonLd() {
      var scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (var i = 0; i < scripts.length; i++) {
        try {
          var data = JSON.parse(scripts[i].textContent || '');
          var match = findProduct(data);
          if (match) {
            var p = match.product;
            var priceInfo = extractProductPrice(p.offers);
            return {
              title: match.groupName || p.name,
              description: p.description,
              imageUrl: match.variantMatched ? extractImage(p.image) : undefined,
              price: priceInfo.price,
              currency: priceInfo.currency,
              brand: extractBrand(p.brand),
            };
          }
        } catch(e) {}
      }
      return null;
    }

    // ── Open Graph ────────────────────────────────────────────────────────

    function extractOpenGraph() {
      function getMeta(names) {
        for (var i = 0; i < names.length; i++) {
          var el = document.querySelector('meta[property="' + names[i] + '"]') ||
                   document.querySelector('meta[name="' + names[i] + '"]');
          if (el && el.getAttribute('content')) return el.getAttribute('content');
        }
        return undefined;
      }
      return {
        title: getMeta(['og:title', 'twitter:title']) || document.title || undefined,
        description: getMeta(['og:description', 'twitter:description', 'description']),
        imageUrl: getMeta(['og:image', 'twitter:image']),
        price: getMeta(['product:price:amount', 'og:price:amount']),
        currency: getMeta(['product:price:currency', 'og:price:currency']),
        brand: getMeta(['product:brand', 'og:brand']),
      };
    }

    // ── DOM price ─────────────────────────────────────────────────────────

    function nearestHeading(el) {
      var node = el.parentElement;
      while (node && node !== document.body) {
        var prev = node.previousElementSibling;
        while (prev) {
          if (/^H[1-6]$/.test(prev.tagName)) return prev;
          var h = prev.querySelector('h1,h2,h3,h4,h5,h6');
          if (h) return h;
          prev = prev.previousElementSibling;
        }
        node = node.parentElement;
      }
      return document.querySelector('h1');
    }

    function scorePriceElement(el, h1Text) {
      var score = 0;
      var node = el;
      while (node && node !== document.body) {
        var ctx = ((node.getAttribute('class') || '') + ' ' + (node.getAttribute('id') || '')).toLowerCase();
        if (/related|recommend|upsell|cross.?sell|complementary|you.?may|complete.?your|kit\\b/.test(ctx)) { score -= 60; break; }
        if (/product.{0,10}(info|detail|main|form|summary)|pdp/.test(ctx)) { score += 20; break; }
        node = node.parentElement;
      }
      var container = el.closest('form,[class*="product__info"],[class*="product-info"],[class*="product-detail"]');
      if (container && container.querySelector('[name="add"],[class*="add-to-cart"],[class*="buy-now"]')) score += 25;
      var heading = nearestHeading(el);
      if (heading && h1Text) {
        var hText = (heading.textContent || '').trim().toLowerCase();
        if (hText === h1Text) score += 50;
        else if (hText && (hText.indexOf(h1Text) !== -1 || h1Text.indexOf(hText) !== -1)) score += 25;
      }
      return score;
    }

    function extractPriceFromDOM(productTitle) {
      var titleText = (productTitle || (document.querySelector('h1') || {textContent:''}).textContent || '').trim().toLowerCase();
      var salePriceSelectors = [
        '[data-testid*="sale-price"]','[data-testid*="sales-price"]','[data-testid*="final-price"]',
        '[data-testid*="current-price"]','.bfx-sale-price','.sale-price','.current-price',
        '.final-price','.special-price','[class*="sale-price"],[class*="salePrice"]',
        '[class*="final-price"],[class*="finalPrice"],[class*="current-price"],[class*="currentPrice"]',
      ];
      for (var s = 0; s < salePriceSelectors.length; s++) {
        try {
          var el = document.querySelector(salePriceSelectors[s]);
          if (el && el.textContent) { var r = extractPriceFromText(el.textContent.trim()); if (r) return r; }
        } catch(e) {}
      }
      var itempropEl = document.querySelector('[itemprop="price"]');
      if (itempropEl) {
        var content = itempropEl.getAttribute('content');
        if (content) {
          var currencyEl = document.querySelector('[itemprop="priceCurrency"]');
          return { price: content, currency: (currencyEl && currencyEl.getAttribute('content')) || 'USD' };
        }
      }
      var selectors = [
        '[itemprop="price"]','[data-price]','[data-product-price]',
        '.price:not(.price-compare):not(.was-price):not(.list-price)',
        '.product-price:not(.list-price):not(.original-price)',
        '[class*="price"]:not([class*="compare"]):not([class*="was"]):not([class*="old"]):not([class*="list"]):not([class*="original"])',
        '[class*="Price"]:not([class*="Compare"]):not([class*="Was"]):not([class*="Old"]):not([class*="List"]):not([class*="Original"])',
      ];
      var seen = [];
      var candidates = [];
      for (var i = 0; i < selectors.length; i++) {
        try {
          var els = document.querySelectorAll(selectors[i]);
          for (var j = 0; j < els.length; j++) {
            var elem = els[j];
            if (seen.indexOf(elem) !== -1) continue;
            seen.push(elem);
            var text = (elem.textContent || '').trim();
            if (!text) continue;
            var parsed = extractPriceFromText(text);
            if (parsed) candidates.push({ price: parsed.price, currency: parsed.currency, score: scorePriceElement(elem, titleText) });
          }
        } catch(e) {}
      }
      var spans = document.querySelectorAll('div,span,p,button');
      for (var k = 0; k < spans.length; k++) {
        var sp = spans[k];
        if (sp.children.length > 2) continue;
        var t = (sp.textContent || '').trim();
        if (t.length < 15 && /^[$£€¥]\\d/.test(t)) {
          if (seen.indexOf(sp) === -1) {
            seen.push(sp);
            var p2 = extractPriceFromText(t);
            if (p2) candidates.push({ price: p2.price, currency: p2.currency, score: scorePriceElement(sp, titleText) - 5 });
          }
        }
      }
      if (!candidates.length) return {};
      candidates.sort(function(a, b) { return b.score - a.score; });
      return { price: candidates[0].price, currency: candidates[0].currency };
    }

    // ── DOM image ─────────────────────────────────────────────────────────

    function extractImageFromDOM() {
      var selectors = [
        '[class*="product"] img[src*="product"]','[class*="gallery"] img',
        '[class*="product-image"] img','[data-product-image]','main img','article img','.product img',
      ];
      for (var i = 0; i < selectors.length; i++) {
        try {
          var img = document.querySelector(selectors[i]);
          if (img && img.src && img.src.indexOf('logo') === -1 && img.src.indexOf('icon') === -1) return img.src;
        } catch(e) {}
      }
      return undefined;
    }

    // ── Main ──────────────────────────────────────────────────────────────

    var jsonLd = extractJsonLd();
    var og = extractOpenGraph();
    var knownTitle = (jsonLd && jsonLd.title) || og.title || undefined;
    var domPrice = extractPriceFromDOM(knownTitle);
    var domImage = extractImageFromDOM();

    var title = (jsonLd && jsonLd.title) || og.title;
    var description = (jsonLd && jsonLd.description) || og.description;

    var result = {
      url: window.location.href,
      title: title ? decodeHtmlEntities(title) : undefined,
      description: description ? decodeHtmlEntities(description) : undefined,
      imageUrl: (jsonLd && jsonLd.imageUrl) || og.imageUrl || domImage,
      price: (jsonLd && jsonLd.price) || domPrice.price || og.price,
      currency: (jsonLd && jsonLd.currency) || domPrice.currency || og.currency,
      brand: (jsonLd && jsonLd.brand) || og.brand,
    };

    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'METADATA_RESULT', data: result }));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'METADATA_ERROR', error: String(e) }));
  }
})();
true; // required by injectJavaScript
`;
