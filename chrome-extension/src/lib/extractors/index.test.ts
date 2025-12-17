import { describe, it, expect, beforeEach } from "vitest";
import { extractMetadata } from "./index";

// Helper to set up document with HTML
function setupDOM(html: string) {
  document.body.innerHTML = html;
  // Also set the full document for JSON-LD extraction
  document.head.innerHTML = "";
}

describe("Price Extraction", () => {
  describe("data-price attribute", () => {
    it("extracts price from data-price attribute with numeric value", () => {
      setupDOM(`<span data-price="29.99">$29.99</span>`);
      const result = extractMetadata();
      expect(result.price).toBe("29.99");
    });

    it("falls back to text content when data-price is non-numeric (e.g., 'domestic')", () => {
      setupDOM(`<span data-price="domestic">$145.99</span>`);
      const result = extractMetadata();
      expect(result.price).toBe("145.99");
    });

    it("handles Bed Bath & Beyond style pricing", () => {
      setupDOM(`
        <div data-testid="current-price">
          <span data-price="domestic">$145.99</span>
        </div>
      `);
      const result = extractMetadata();
      expect(result.price).toBe("145.99");
    });
  });

  describe("Add to cart button extraction", () => {
    it("extracts price from add to cart button", () => {
      setupDOM(`
        <button class="btn--primary">
          <span>Add to cart</span>
          <div>$40</div>
        </button>
      `);
      const result = extractMetadata();
      expect(result.price).toBe("40");
    });

    it("extracts price from buy button parent", () => {
      setupDOM(`
        <div>
          <span>$99.00</span>
          <button class="buy-now">Buy Now</button>
        </div>
      `);
      const result = extractMetadata();
      expect(result.price).toBe("99.00");
    });
  });

  describe("Short price element scan", () => {
    it("finds standalone price in heading-style elements", () => {
      setupDOM(`
        <div class="product-info">
          <h1>Product Name</h1>
          <div class="text-h5">$40</div>
        </div>
      `);
      const result = extractMetadata();
      expect(result.price).toBe("40");
    });

    it("ignores long text that contains price", () => {
      setupDOM(`
        <div>This product costs $40 and is available now for shipping</div>
      `);
      const result = extractMetadata();
      // Should not extract because text is too long
      expect(result.price).toBeUndefined();
    });
  });

  describe("Currency detection", () => {
    it("detects USD from $ symbol", () => {
      setupDOM(`<span class="price">$29.99</span>`);
      const result = extractMetadata();
      expect(result.currency).toBe("USD");
    });

    it("detects EUR from € symbol", () => {
      setupDOM(`<span class="price">€29,99</span>`);
      const result = extractMetadata();
      expect(result.currency).toBe("EUR");
    });

    it("detects GBP from £ symbol", () => {
      setupDOM(`<span class="price">£29.99</span>`);
      const result = extractMetadata();
      expect(result.currency).toBe("GBP");
    });
  });

  describe("Price format normalization", () => {
    it("normalizes US format (1,234.56)", () => {
      setupDOM(`<span class="price">$1,234.56</span>`);
      const result = extractMetadata();
      expect(result.price).toBe("1234.56");
    });

    it("normalizes European format (1.234,56)", () => {
      setupDOM(`<span class="price">€1.234,56</span>`);
      const result = extractMetadata();
      expect(result.price).toBe("1234.56");
    });

    it("normalizes simple comma decimal (29,99)", () => {
      setupDOM(`<span class="price">€29,99</span>`);
      const result = extractMetadata();
      expect(result.price).toBe("29.99");
    });
  });

  describe("itemprop price", () => {
    it("extracts price from itemprop with content attribute", () => {
      setupDOM(`
        <span itemprop="price" content="39.99">$39.99</span>
        <meta itemprop="priceCurrency" content="USD">
      `);
      const result = extractMetadata();
      expect(result.price).toBe("39.99");
      expect(result.currency).toBe("USD");
    });
  });
});

describe("JSON-LD Extraction", () => {
  it("extracts product data from JSON-LD", () => {
    document.head.innerHTML = `
      <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Test Product",
          "description": "A great product",
          "image": "https://example.com/image.jpg",
          "offers": {
            "price": "49.99",
            "priceCurrency": "USD"
          }
        }
      </script>
    `;
    document.body.innerHTML = "";

    const result = extractMetadata();
    expect(result.title).toBe("Test Product");
    expect(result.description).toBe("A great product");
    expect(result.imageUrl).toBe("https://example.com/image.jpg");
    expect(result.price).toBe("49.99");
    expect(result.currency).toBe("USD");
  });

  it("handles @graph array in JSON-LD", () => {
    document.head.innerHTML = `
      <script type="application/ld+json">
        {
          "@graph": [
            { "@type": "WebSite", "name": "My Store" },
            {
              "@type": "Product",
              "name": "Graph Product",
              "offers": { "price": "29.99" }
            }
          ]
        }
      </script>
    `;
    document.body.innerHTML = "";

    const result = extractMetadata();
    expect(result.title).toBe("Graph Product");
    expect(result.price).toBe("29.99");
  });
});

describe("Open Graph Extraction", () => {
  it("extracts from Open Graph meta tags", () => {
    document.head.innerHTML = `
      <meta property="og:title" content="OG Product Title">
      <meta property="og:description" content="OG Description">
      <meta property="og:image" content="https://example.com/og-image.jpg">
      <meta property="og:price:amount" content="59.99">
      <meta property="og:price:currency" content="USD">
    `;
    document.body.innerHTML = "";

    const result = extractMetadata();
    expect(result.title).toBe("OG Product Title");
    expect(result.description).toBe("OG Description");
    expect(result.imageUrl).toBe("https://example.com/og-image.jpg");
    expect(result.price).toBe("59.99");
  });

  it("falls back to document title", () => {
    document.head.innerHTML = `<title>Page Title</title>`;
    document.body.innerHTML = "";

    const result = extractMetadata();
    expect(result.title).toBe("Page Title");
  });
});

describe("Platform Detection", () => {
  it("detects Shopify", () => {
    setupDOM(`
      <link href="https://cdn.shopify.com/s/files/..." rel="stylesheet">
    `);
    const result = extractMetadata();
    expect(result.platform).toBe("shopify");
  });

  it("detects Squarespace", () => {
    setupDOM(`
      <link href="https://static1.squarespace.com/..." rel="stylesheet">
    `);
    const result = extractMetadata();
    expect(result.platform).toBe("squarespace");
  });

  it("detects WooCommerce", () => {
    setupDOM(`
      <body class="woocommerce woocommerce-page">
        <div class="wc-product"></div>
      </body>
    `);
    const result = extractMetadata();
    expect(result.platform).toBe("woocommerce");
  });
});

describe("Confidence Calculation", () => {
  it("returns confidence 1 when all critical fields extracted", () => {
    document.head.innerHTML = `
      <meta property="og:title" content="Product">
      <meta property="og:image" content="https://example.com/img.jpg">
    `;
    document.body.innerHTML = `<span class="price">$49.99</span>`;

    const result = extractMetadata();
    expect(result.confidence).toBe(1);
  });

  it("returns confidence 0.67 when 2 of 3 critical fields extracted", () => {
    document.head.innerHTML = `
      <meta property="og:title" content="Product">
      <meta property="og:image" content="https://example.com/img.jpg">
    `;
    document.body.innerHTML = "";

    const result = extractMetadata();
    expect(result.confidence).toBeCloseTo(0.67, 1);
  });
});

describe("Real-world Test Cases", () => {
  it("handles Rose Los Angeles style (price in button)", () => {
    setupDOM(`
      <h1>High Energy</h1>
      <button class="btn btn--primary">
        <span>Add to cart</span>
        <div>$40</div>
      </button>
    `);
    const result = extractMetadata();
    expect(result.price).toBe("40");
  });

  it("handles Target style (standard price class)", () => {
    document.head.innerHTML = `
      <meta property="og:title" content="O-Cedar EasyWring Spin Mop">
      <meta property="og:image" content="https://target.scene7.com/image.jpg">
    `;
    document.body.innerHTML = `
      <span data-test="product-price">$39.99</span>
    `;
    const result = extractMetadata();
    expect(result.title).toBe("O-Cedar EasyWring Spin Mop");
    expect(result.price).toBe("39.99");
  });

  it("handles Bed Bath & Beyond style (data-price='domestic')", () => {
    document.head.innerHTML = `
      <meta property="og:title" content="Kate and Laurel Floating Table">
    `;
    setupDOM(`
      <div data-testid="current-price">
        <span data-price="domestic">$145.99</span>
      </div>
    `);
    const result = extractMetadata();
    expect(result.price).toBe("145.99");
  });
});
