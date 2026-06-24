var Action = function () {};

Action.prototype = {
  run: function (arguments) {
    function meta(selector) {
      var el = document.querySelector(selector);
      return el
        ? (el.getAttribute('content') || el.textContent || '').trim()
        : null;
    }

    function findPrice() {
      // Schema.org
      var schema = document.querySelector('[itemprop="price"]');
      if (schema) {
        var v = schema.getAttribute('content') || schema.textContent;
        if (v) return v.trim();
      }
      // Common selectors
      var selectors = [
        '.price',
        '#price',
        '[class*="price"]',
        '[data-price]',
        '[class*="Price"]',
        '.product-price',
        '.sale-price',
      ];
      for (var i = 0; i < selectors.length; i++) {
        var el = document.querySelector(selectors[i]);
        if (el) {
          var text = el.textContent.trim();
          if (/[\$£€¥₹][\d,]+/.test(text) || /[\d,]+\s*[\$£€¥₹]/.test(text)) {
            return text;
          }
        }
      }
      return null;
    }

    arguments.completionFunction({
      title: meta('meta[property="og:title"]') || document.title || null,
      imageUrl: meta('meta[property="og:image"]') || null,
      description:
        meta('meta[property="og:description"]') ||
        meta('meta[name="description"]') ||
        null,
      price: findPrice(),
    });
  },

  finalize: function (arguments) {},
};

var ExtensionPreprocessingJS = new Action();
