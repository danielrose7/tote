/**
 * Injected into the hidden WebView via injectJavaScript().
 * Adapted from chrome-extension/src/lib/extractors/index.ts —
 * same logic, wrapped as an IIFE, posts result via ReactNativeWebView.
 *
 * TODO: This is a hand-ported ES5 duplicate of chrome-extension/src/lib/extractors/index.ts.
 * Any fixes to the extraction logic must be applied in both places. Consider
 * extracting to a shared package so changes only need to happen once.
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

    // Well-formed numbers: 1,234.56 / 1.234,56 / 1234.56 / 29,99 / 40
    var VALID_NUMBER = /^(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)$/;

    // Big retailers render a price twice for accessibility (an offscreen "$9.99"
    // next to visual "$" "9" "." "99" spans), or superscript the cents, so the
    // element text reads "$9.99$9.99" or "$9.999.99". When the digit run isn't a
    // well-formed number, keep the leading "d.dd" (or "d,dd") price.
    function firstWellFormedNumber(raw) {
      if (VALID_NUMBER.test(raw)) return raw;
      var decimal = raw.match(/^\\d{1,3}(?:,\\d{3})*\\.\\d{2}|^\\d+[.,]\\d{2}/);
      if (decimal) return decimal[0];
      var integer = raw.match(/^\\d+/);
      return integer ? integer[0] : raw;
    }

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
      var numericMatch = priceStr.match(/\\d[\\d.,]*/);
      if (!numericMatch) return null;
      var price = firstWellFormedNumber(numericMatch[0].replace(/[.,]+$/, ''));
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

    // JSON-LD ImageObject: { url } or { contentUrl } (Etsy spells it contentURL)
    function imageObjectUrl(img) {
      if (typeof img === 'string') return img;
      if (!img || typeof img !== 'object') return undefined;
      var url = img.url || img.contentUrl || img.contentURL;
      return typeof url === 'string' ? url : undefined;
    }

    function extractImage(image) {
      if (!image) return undefined;
      return imageObjectUrl(Array.isArray(image) ? image[0] : image);
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

    // Fix URLs that JSON-LD generators over-encode (%3F→?, %3D→=, %26→&).
    function fixOverEncodedUrl(url) {
      return url.replace(/%3F/gi, '?').replace(/%3D/gi, '=').replace(/%26/gi, '&');
    }

    // Reject Shopify lazy-load template URLs like image_{width}x.jpg before JS substitutes real values.
    function hasTemplateVariable(url) {
      return /\\{[^}]+\\}/.test(url);
    }

    function resolveUrl(url) {
      if (!url) return undefined;
      url = fixOverEncodedUrl(url);
      if (hasTemplateVariable(url)) return undefined;
      if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) return url;
      // Protocol-relative URLs — always treat as https.
      if (url.indexOf('//') === 0) return 'https:' + url;
      try { return new URL(url, window.location.href).href; } catch(e) { return url; }
    }

    function urlPathMatchesPage(url) {
      try {
        var resolved = new URL(url, window.location.href);
        if (resolved.origin !== window.location.origin) return true;
        var normalize = function(p) { return p.replace(/\\/+$/, '').toLowerCase(); };
        var ld = normalize(resolved.pathname);
        var page = normalize(window.location.pathname);
        // Same product when one path extends the other: Best Buy's JSON-LD url is
        // /product/<slug>/<id> while the page is /product/<slug>/<id>/sku/<sku>.
        // A stale SPA product (the case this guards against) has a different path.
        return ld === page || page.indexOf(ld + '/') === 0 || ld.indexOf(page + '/') === 0;
      } catch(e) { return true; }
    }

    function productCanonicalUrl(product) {
      var offers = product && product.offers;
      var offerUrl = Array.isArray(offers) ? (offers[0] && offers[0].url) : (offers && offers.url);
      return offerUrl || (product && product.url) || (product && product['@id']) || undefined;
    }

    function extractJsonLd() {
      var scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (var i = 0; i < scripts.length; i++) {
        try {
          var data = JSON.parse(scripts[i].textContent || '');
          var match = findProduct(data);
          if (match) {
            var p = match.product;
            var canonicalUrl = productCanonicalUrl(p);
            if (canonicalUrl && !urlPathMatchesPage(canonicalUrl)) return null;
            var priceInfo = extractProductPrice(p.offers);
            return {
              title: match.groupName || p.name,
              description: p.description,
              imageUrl: match.variantMatched ? resolveUrl(extractImage(p.image)) : undefined,
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
        imageUrl: getMeta(['og:image', 'og:image:secure_url', 'twitter:image']),
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

    // ── Image exclusion & active slide ────────────────────────────────────

    var IMAGE_EXCLUDE_PATTERNS = /logo|icon|favicon|sprite|placeholder|spacer|pixel|tracking|badge|avatar|rating|star|wordmark|share.?image/i;

    function isExcludedImage(url, alt, image) {
      if (IMAGE_EXCLUDE_PATTERNS.test(url)) return true;
      if (alt && IMAGE_EXCLUDE_PATTERNS.test(alt)) return true;
      if (image && (image.getAttribute('itemprop') || '').toLowerCase() === 'logo') return true;
      return false;
    }

    var ACTIVE_SLIDE_SELECTORS = [
      '.flickity-cell.is-selected',
      '.slick-slide.slick-active.slick-current',
      '.swiper-slide-active',
      '[data-slide].active',
      '.carousel-item.active',
      '[class*="slide"][aria-selected="true"]',
      '[class*="slide"][aria-current="true"]',
    ];

    function extractActiveSlideImage() {
      for (var i = 0; i < ACTIVE_SLIDE_SELECTORS.length; i++) {
        try {
          var slide = document.querySelector(ACTIVE_SLIDE_SELECTORS[i]);
          if (slide) {
            var img = slide.querySelector('img');
            if (img) {
              var url = resolveUrl(img.src || img.getAttribute('src') || '');
              var alt = img.getAttribute('alt') || '';
              if (url && !isExcludedImage(url, alt, img)) return url;
            }
          }
        } catch(e) {}
      }
      return undefined;
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
          if (img && img.src
            && !isExcludedImage(img.src, img.getAttribute('alt') || '', img)
            && !img.closest('[aria-modal="true"],[role="dialog"],dialog')) {
            return img.src;
          }
        } catch(e) {}
      }
      return undefined;
    }

    // ── Collection/listing items ─────────────────────────────────────────

    function normalizeWhitespace(text) {
      var normalized = text ? String(text).replace(/\\s+/g, ' ').trim() : '';
      return normalized || undefined;
    }

    function isLikelyProductUrl(url) {
      try {
        var parsed = new URL(url, window.location.href);
        var path = parsed.pathname.toLowerCase();
        if (parsed.origin !== window.location.origin) return false;
        if (path === window.location.pathname.toLowerCase()) return false;
        return /\\/products?\\//.test(path) || /\\/p\\//.test(path) || /\\/product[-/]/.test(path) || /\\/shop\\/.+/.test(path);
      } catch(e) { return false; }
    }

    function isLikelyCollectionPage() {
      var path = window.location.pathname.toLowerCase();
      if (/\\/products?\\//.test(path) || /\\/p\\//.test(path) || /\\/product[-/]/.test(path)) return false;
      return /\\/collections?\\//.test(path) || /\\/categories?\\//.test(path) || /\\/catalog\\//.test(path) || /\\/shop\\//.test(path) || /\\/search/.test(path) || /\\/strollers?\\//.test(path) || /\\/car-seats?\\//.test(path) || /\\/accessories?\\//.test(path);
    }

    function findLikelyProductCard(anchor) {
      var current = anchor;
      var best = anchor;
      var depth = 0;
      while (current && current !== document.body && depth < 8) {
        var classId = ((current.getAttribute('class') || '') + ' ' + (current.getAttribute('id') || '')).toLowerCase();
        var links = current.querySelectorAll('a[href]');
        var productLinkCount = 0;
        for (var i = 0; i < links.length; i++) {
          if (isLikelyProductUrl(links[i].href)) productLinkCount++;
        }
        var textLength = ((current.textContent || '').replace(/\\s+/g, ' ').trim()).length;
        if (/product|card|tile|grid|item|result|listing/.test(classId) && productLinkCount <= 4 && textLength <= 2200) {
          best = current;
        }
        current = current.parentElement;
        depth++;
      }
      return best;
    }

    function resolveCardImage(card) {
      var img = card.querySelector('img');
      if (!img) return undefined;
      var srcset = img.getAttribute('data-srcset') || img.getAttribute('srcset') || '';
      if (srcset) {
        var first = srcset.split(',')[0].trim().split(/\\s+/)[0];
        if (first) return resolveUrl(first);
      }
      return resolveUrl(img.getAttribute('data-src') || img.getAttribute('src') || img.src || '');
    }

    function extractTitleFromCard(card, anchor) {
      var selectors = ['[class*="title"]','[class*="name"]','[data-testid*="title"]','[data-testid*="name"]','h2','h3','h4'];
      for (var i = 0; i < selectors.length; i++) {
        try {
          var el = card.querySelector(selectors[i]);
          var text = normalizeWhitespace(el && el.textContent);
          if (text && text.length <= 140 && !PRICE_REGEX.test(text)) return text;
          PRICE_REGEX.lastIndex = 0;
        } catch(e) {}
      }
      var aria = normalizeWhitespace(anchor.getAttribute('aria-label'));
      if (aria && aria.length <= 140) return aria;
      var anchorText = normalizeWhitespace(anchor.textContent);
      if (anchorText && anchorText.length <= 140 && !/buy|shop|explore|view/i.test(anchorText)) return anchorText;
      var img = card.querySelector('img[alt]');
      var alt = normalizeWhitespace(img && img.getAttribute('alt'));
      return alt && alt.length <= 180 ? alt : undefined;
    }

    function extractPriceFromCard(card) {
      var selectors = ['[itemprop="price"]','[data-price]','[class*="price"]','[class*="Price"]','[data-testid*="price"]'];
      for (var i = 0; i < selectors.length; i++) {
        try {
          var els = card.querySelectorAll(selectors[i]);
          for (var j = 0; j < els.length; j++) {
            var content = els[j].getAttribute('content') || els[j].getAttribute('data-price');
            if (content && /^[\\d.,]+$/.test(content)) return { price: content, currency: undefined };
            var parsed = extractPriceFromText(els[j].textContent || '');
            if (parsed) return parsed;
          }
        } catch(e) {}
      }
      return extractPriceFromText(card.textContent || '') || {};
    }

    function extractBrandFromCard(card) {
      var selectors = ['[itemprop="brand"]','[class*="brand"]','[class*="vendor"]','[data-testid*="brand"]'];
      for (var i = 0; i < selectors.length; i++) {
        try {
          var text = normalizeWhitespace((card.querySelector(selectors[i]) || {}).textContent);
          if (text && text.length <= 80) return text;
        } catch(e) {}
      }
      return undefined;
    }

    function extractDescriptionFromCard(card, title, price) {
      var pieces = [];
      var selectors = ['[class*="description"]','[class*="subtitle"]','[class*="summary"]','[class*="feature"]','p','li'];
      for (var i = 0; i < selectors.length && pieces.length < 6; i++) {
        try {
          var els = card.querySelectorAll(selectors[i]);
          for (var j = 0; j < els.length && pieces.length < 6; j++) {
            var text = normalizeWhitespace(els[j].textContent);
            if (!text || text === title || (price && text.indexOf(price) !== -1)) continue;
            if (/^(buy|shop|explore|compare|previous|next)$/i.test(text)) continue;
            if (text.length < 4 || text.length > 220) continue;
            if (pieces.indexOf(text) === -1) pieces.push(text);
          }
        } catch(e) {}
      }
      return pieces.length ? pieces.join(' | ') : undefined;
    }

    function extractCollectionItems() {
      var byKey = {};
      var anchors = document.querySelectorAll('a[href]');
      for (var i = 0; i < anchors.length; i++) {
        var anchor = anchors[i];
        if (!isLikelyProductUrl(anchor.href)) continue;
        var sourceUrl = resolveUrl(anchor.getAttribute('href') || anchor.href);
        if (!sourceUrl) continue;
        var card = findLikelyProductCard(anchor);
        var priceInfo = extractPriceFromCard(card);
        var title = extractTitleFromCard(card, anchor);
        var imageUrl = resolveCardImage(card);
        var brand = extractBrandFromCard(card);
        var description = extractDescriptionFromCard(card, title, priceInfo.price);
        if (!title && !imageUrl && !priceInfo.price) continue;
        var normalizedTitle = title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '';
        var key = normalizedTitle && priceInfo.price ? normalizedTitle + ':' + priceInfo.price : sourceUrl;
        if (byKey[key]) continue;
        byKey[key] = {
          url: sourceUrl,
          title: title,
          description: description,
          imageUrl: imageUrl,
          price: priceInfo.price,
          currency: priceInfo.currency,
          brand: brand,
          pageType: 'product',
        };
      }
      var items = [];
      Object.keys(byKey).slice(0, 24).forEach(function(key) { items.push(byKey[key]); });
      return items;
    }

    // ── Site adapters ─────────────────────────────────────────────────────
    // Host-aware extraction for big retailers. Mirrors
    // chrome-extension/src/lib/extractors/sites.ts — keep in sync. The app only
    // saves title, imageUrl and price, so galleries are not ported.

    function siteText(selector) {
      var el = document.querySelector(selector);
      var t = el && el.textContent ? el.textContent.replace(/\\s+/g, ' ').trim() : '';
      return t || undefined;
    }

    function sitePriceFrom(selectors, read) {
      for (var i = 0; i < selectors.length; i++) {
        var els = document.querySelectorAll(selectors[i]);
        for (var j = 0; j < els.length; j++) {
          var raw = read ? read(els[j]) : els[j].textContent;
          var parsed = raw ? extractPriceFromText(raw) : null;
          if (parsed) return parsed;
        }
      }
      return {};
    }

    // Largest srcset candidate, else src. Ignores data: placeholders.
    function siteImgUrl(img) {
      if (!img) return undefined;
      var srcset = img.getAttribute('srcset');
      if (srcset) {
        var best = null;
        var entries = srcset.split(',');
        for (var i = 0; i < entries.length; i++) {
          var parts = entries[i].trim().split(/\\s+/);
          var w = parseInt(parts[1] || '', 10) || 0;
          if (parts[0] && (!best || w > best.w)) best = { url: parts[0], w: w };
        }
        if (best) return resolveUrl(best.url);
      }
      var src = img.getAttribute('src');
      return src && src.indexOf('data:') !== 0 ? resolveUrl(src) : undefined;
    }

    function amazonPriceText(el) {
      var off = el.querySelector('.a-offscreen');
      var t = off && off.textContent ? off.textContent.trim() : '';
      return t || el.textContent;
    }

    function amazonMainImage() {
      var img = document.querySelector('#landingImage, #imgTagWrapperId img, #main-image, #main-image-container img, img[data-a-hires]');
      if (!img) return undefined;
      var hires = img.getAttribute('data-old-hires') || img.getAttribute('data-a-hires');
      if (hires) return resolveUrl(hires);
      var dynamic = img.getAttribute('data-a-dynamic-image');
      if (dynamic) {
        try {
          var sizes = JSON.parse(dynamic);
          var bestUrl = null, bestArea = -1;
          Object.keys(sizes).forEach(function(u) {
            var area = sizes[u][0] * sizes[u][1];
            if (area > bestArea) { bestArea = area; bestUrl = u; }
          });
          if (bestUrl) return resolveUrl(bestUrl);
        } catch(e) {}
      }
      return siteImgUrl(img);
    }

    // "Amazon.com: Bedsure Fleece Throw : Home & Kitchen" → "Bedsure Fleece Throw"
    function amazonDocumentTitle() {
      var m = document.title.match(/^Amazon\\.[a-z.]+\\s*:\\s*(.+)$/i);
      if (!m) return undefined;
      return m[1].replace(/\\s+:\\s+[^:]+$/, '').trim() || undefined;
    }

    function wayfairJpeg(url) {
      return url ? url.replace(/(assets\\.wfcdn\\.com)\\/avif\\/im\\//, '$1/im/') : url;
    }

    function merge(a, b) {
      var out = {};
      Object.keys(a).forEach(function(k) { out[k] = a[k]; });
      Object.keys(b).forEach(function(k) { out[k] = b[k]; });
      return out;
    }

    var SITE_ADAPTERS = [
      {
        id: 'amazon',
        hosts: /(^|\\.)amazon\\.(com|ca|co\\.uk|de|fr|it|es|nl|se|pl|com\\.au|com\\.mx|com\\.br|co\\.jp|in|sg|ae)$/,
        extract: function() {
          return merge({
            title: siteText('#productTitle') || siteText('#title') || amazonDocumentTitle(),
            imageUrl: amazonMainImage(),
          }, sitePriceFrom([
            '#corePriceDisplay_desktop_feature_div .priceToPay',
            '#corePriceDisplay_mobile_feature_div .priceToPay',
            '#corePrice_feature_div .priceToPay',
            '#corePrice_mobile_feature_div .priceToPay',
            '#apex_desktop .priceToPay',
            '.priceToPay',
            '#corePrice_feature_div .a-price:not(.a-text-price)',
            '#corePrice_mobile_feature_div .a-price:not(.a-text-price)',
            '#apex_desktop .a-price:not(.a-text-price)',
            '#tp_price_block_total_price_ww',
            '#price_inside_buybox',
            '#priceblock_dealprice',
            '#priceblock_ourprice',
          ], amazonPriceText));
        },
      },
      {
        // Target fetches the price after hydration — Main waits for it (waitForContent).
        id: 'target',
        hosts: /(^|\\.)target\\.com$/,
        extract: function() {
          return merge({
            title: siteText('[data-test="product-title"]'),
            imageUrl: siteImgUrl(document.querySelector('[data-test="image-gallery-item-0"] img')),
          }, sitePriceFrom(['[data-test="product-price"]']));
        },
      },
      {
        // iPhone user agents get an AVIF og:image behind a .jpg name.
        id: 'wayfair',
        hosts: /(^|\\.)(wayfair|allmodern|birchlane|jossandmain|perigold)\\.(com|ca|co\\.uk|de)$/,
        extract: function() {
          var og = document.querySelector('meta[property="og:image"]');
          var ogUrl = og && og.getAttribute('content');
          return merge({
            title: siteText('h1[data-rtl-id="listingHeaderNameHeading"]'),
            imageUrl: wayfairJpeg(ogUrl ? resolveUrl(ogUrl) : undefined),
          }, sitePriceFrom([
            '[data-test-id="PricingFull-leadPrice"]',
            '[data-test-id="StandardPricingPrice-PRIMARY"]',
          ]));
        },
      },
      {
        // Carousel tiles superscript the cents ("$12599"); trust only the hero price.
        id: 'walmart',
        hosts: /(^|\\.)walmart\\.(com|ca)$/,
        extract: function() {
          return merge({
            title: siteText('#main-title, h1[itemprop="name"]'),
          }, sitePriceFrom(['[data-seo-id="hero-price"]', '[itemprop="price"]']));
        },
      },
    ];

    // adapter is set whenever the host matched; the generic DOM heuristics are
    // then skipped (they pick sponsored thumbnails and carousel prices there).
    function extractFromSite() {
      var host = window.location.hostname.toLowerCase();
      for (var i = 0; i < SITE_ADAPTERS.length; i++) {
        var a = SITE_ADAPTERS[i];
        if (!a.hosts.test(host)) continue;
        try { return merge({ adapter: a.id }, a.extract()); }
        catch(e) { return { adapter: a.id }; }
      }
      return {};
    }

    // ── Main ──────────────────────────────────────────────────────────────

    // Retailer sites that render the price client-side (Target fetches it per
    // store after hydration) aren't ready at onLoadEnd. When an adapter matched
    // but price or image is still missing, watch the DOM and report as soon as
    // both appear — or after WAIT_TIMEOUT_MS with whatever we have.
    var WAIT_TIMEOUT_MS = 4000;
    // Throttle, not debounce: a carousel that mutates continuously would keep
    // resetting a debounce until the timeout. This checks at most every 100ms.
    var CHECK_INTERVAL_MS = 100;

    function extractAll() {
      // Retailer adapters win when the host matches; on those pages the generic
      // DOM heuristics are skipped and only structured data (JSON-LD, og:) is
      // used as a fallback for anything the adapter missed.
      var site = extractFromSite();
      var useDom = !site.adapter;
      var jsonLd = extractJsonLd();
      var og = extractOpenGraph();
      var knownTitle = site.title || (jsonLd && jsonLd.title) || og.title || undefined;
      var domPrice = useDom ? extractPriceFromDOM(knownTitle) : {};
      var domImage = useDom ? extractImageFromDOM() : undefined;
      var activeSlideUrl = useDom ? extractActiveSlideImage() : undefined;
      var collectionItems = extractCollectionItems();
      var shouldTreatAsCollection = collectionItems.length >= 2 && isLikelyCollectionPage();

      // Filter og:image through isExcludedImage — store-wide share images
      // (e.g. Shopify-share-image.png) must not become the primary product image.
      var ogImageUrl = og.imageUrl;
      var filteredOgImageUrl = ogImageUrl && !isExcludedImage(ogImageUrl) ? ogImageUrl : undefined;

      var title = site.title || (jsonLd && jsonLd.title) || og.title;
      var description = (jsonLd && jsonLd.description) || og.description;
      // Keep price and currency from the same source.
      var priceSource = [site, jsonLd, domPrice, og].filter(function(p) { return p && p.price; })[0];

      // Image priority: site adapter > JSON-LD variant match > active carousel slide > og:image > DOM fallback.
      return {
        adapter: site.adapter,
        result: {
          url: window.location.href,
          title: title ? decodeHtmlEntities(title) : undefined,
          description: description ? decodeHtmlEntities(description) : undefined,
          imageUrl: site.imageUrl || (jsonLd && jsonLd.imageUrl) || activeSlideUrl || filteredOgImageUrl || domImage,
          price: priceSource && priceSource.price,
          currency: (priceSource && priceSource.currency) || (jsonLd && jsonLd.currency) || domPrice.currency || og.currency,
          brand: (jsonLd && jsonLd.brand) || og.brand,
          pageType: shouldTreatAsCollection
            ? 'collection'
            : (title || priceSource ? 'product' : 'unknown'),
          collectionItems: shouldTreatAsCollection ? collectionItems : undefined,
        },
      };
    }

    function post(message) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }

    function isComplete(extracted) {
      return !extracted.adapter || Boolean(extracted.result.price && extracted.result.imageUrl);
    }

    function waitForContent(initial) {
      var state = { watching: true };
      window.__toteExtractorWatch = state;
      var latest = initial.result;
      var pendingCheck = null;
      var observer = null;
      var timeout = null;

      function stop() {
        state.watching = false;
        if (observer) observer.disconnect();
        if (pendingCheck) clearTimeout(pendingCheck);
        if (timeout) clearTimeout(timeout);
      }

      function finish() {
        if (!state.watching) return;
        stop();
        post({ type: 'METADATA_RESULT', data: latest });
      }

      function check() {
        pendingCheck = null;
        if (!state.watching) return;
        try {
          var extracted = extractAll();
          latest = extracted.result;
          if (isComplete(extracted)) finish();
        } catch(e) {
          stop();
          post({ type: 'METADATA_ERROR', error: String(e) });
        }
      }

      observer = new MutationObserver(function() {
        if (!pendingCheck) pendingCheck = setTimeout(check, CHECK_INTERVAL_MS);
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['src', 'srcset', 'content', 'data-old-hires', 'data-a-hires'],
      });
      timeout = setTimeout(function() {
        check();
        finish();
      }, WAIT_TIMEOUT_MS);
    }

    // onLoadEnd can fire more than once for the same document (some redirects
    // and SPA routing), injecting this script again. Let the first watcher
    // report rather than starting a second one that posts a competing result.
    var existing = window.__toteExtractorWatch;
    if (existing && existing.watching) return;

    var initial = extractAll();
    if (isComplete(initial)) {
      post({ type: 'METADATA_RESULT', data: initial.result });
    } else {
      waitForContent(initial);
    }
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'METADATA_ERROR', error: String(e) }));
  }
})();
true; // required by injectJavaScript
`;
