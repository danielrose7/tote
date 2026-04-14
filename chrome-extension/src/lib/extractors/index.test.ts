import { beforeEach, describe, expect, it } from "vitest";
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

describe("HTML Entity Decoding", () => {
	it("decodes &quot; in JSON-LD title", () => {
		document.head.innerHTML = `
      <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Heritage Stand Up® Shorts - 5&quot;",
          "description": "Durable shorts with a 5&quot; inseam",
          "offers": { "price": "79.00" }
        }
      </script>
    `;
		document.body.innerHTML = "";

		const result = extractMetadata();
		expect(result.title).toBe('Heritage Stand Up® Shorts - 5"');
		expect(result.description).toBe('Durable shorts with a 5" inseam');
	});

	it("decodes &amp; in Open Graph title", () => {
		document.head.innerHTML = `
      <meta property="og:title" content="Salt &amp; Pepper Shakers">
    `;
		document.body.innerHTML = "";

		const result = extractMetadata();
		expect(result.title).toBe("Salt & Pepper Shakers");
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

describe("Sale Price Priority", () => {
	it("extracts sale price over list price using data-testid", () => {
		// Based on real-world BFX (Borderfree) ecommerce markup
		setupDOM(`
      <div class="bfx-price-container">
        <span class="bfx-price bfx-list-price" data-testid="price-display-list-price">$50.00</span>
        <span class="bfx-price bfx-sale-price" data-testid="price-display-sales-price">$20.98</span>
      </div>
    `);
		const result = extractMetadata();
		expect(result.price).toBe("20.98");
	});

	it("extracts sale price when list price comes first in DOM", () => {
		setupDOM(`
      <div class="price-wrapper">
        <span class="list-price strikethrough">$100.00</span>
        <span class="sale-price">$79.99</span>
      </div>
    `);
		const result = extractMetadata();
		expect(result.price).toBe("79.99");
	});

	it("extracts current price using data-testid pattern", () => {
		setupDOM(`
      <div class="pricing">
        <span data-testid="original-price">$150.00</span>
        <span data-testid="current-price">$99.00</span>
      </div>
    `);
		const result = extractMetadata();
		expect(result.price).toBe("99.00");
	});

	it("extracts final-price using data-testid pattern", () => {
		setupDOM(`
      <div class="pricing">
        <del data-testid="was-price">$200.00</del>
        <span data-testid="final-price">$149.99</span>
      </div>
    `);
		const result = extractMetadata();
		expect(result.price).toBe("149.99");
	});

	it("extracts special price over regular price", () => {
		setupDOM(`
      <div class="product-price">
        <span class="regular-price">$45.00</span>
        <span class="special-price">$29.99</span>
      </div>
    `);
		const result = extractMetadata();
		expect(result.price).toBe("29.99");
	});

	it("selects variant matching URL ?variant= parameter (Smith Optics style)", () => {
		Object.defineProperty(window, "location", {
			configurable: true,
			writable: true,
			value: { ...window.location, search: "?variant=47037333766382" },
		});
		document.head.innerHTML = `
      <script type="application/ld+json">
        {
          "@type": "ProductGroup",
          "name": "Sliders",
          "hasVariant": [
            {
              "@type": "Product",
              "@id": "https://www.smithoptics.com/en-us/products/sliders?variant=11111111111111",
              "name": "Sliders - Matte Olive Oil | Chromapop Brown",
              "image": "https://cdn.shopify.com/olive-oil.jpg",
              "offers": { "price": "197.00", "priceCurrency": "USD" }
            },
            {
              "@type": "Product",
              "@id": "https://www.smithoptics.com/en-us/products/sliders?variant=47037333766382",
              "name": "Sliders - Electric Supernova | Chromapop Blue Mirror",
              "image": "https://cdn.shopify.com/electric-supernova.jpg",
              "offers": { "price": "197.00", "priceCurrency": "USD" }
            }
          ]
        }
      </script>
    `;
		document.body.innerHTML = "";
		const result = extractMetadata();
		expect(result.title).toBe(
			"Sliders - Electric Supernova | Chromapop Blue Mirror",
		);
		expect(result.imageUrl).toBe(
			"https://cdn.shopify.com/electric-supernova.jpg",
		);
		expect(result.price).toBe("197.00");
		// Restore
		Object.defineProperty(window, "location", {
			configurable: true,
			writable: true,
			value: { ...window.location, search: "" },
		});
	});

	it("selects variant via Shopify add-to-cart form input[name=id] (JS-driven selection)", () => {
		// When user clicks a color swatch, Shopify updates the hidden input before URL changes
		document.head.innerHTML = `
      <script type="application/ld+json">
        {
          "@type": "ProductGroup",
          "name": "Wildcat",
          "hasVariant": [
            {
              "@type": "Product",
              "@id": "https://www.smithoptics.com/en-us/products/wildcat?variant=11111111111111",
              "name": "Wildcat - Matte Black | ChromaPop Red Mirror",
              "image": "https://cdn.shopify.com/matte-black.jpg",
              "offers": { "price": "217.00", "priceCurrency": "USD" }
            },
            {
              "@type": "Product",
              "@id": "https://www.smithoptics.com/en-us/products/wildcat?variant=22222222222222",
              "name": "Wildcat - White | ChromaPop Violet Mirror",
              "image": "https://cdn.shopify.com/white-violet.jpg",
              "offers": { "price": "217.00", "priceCurrency": "USD" }
            }
          ]
        }
      </script>
    `;
		// Simulate Shopify's add-to-cart form with the currently selected variant ID
		document.body.innerHTML = `
      <form action="/cart/add">
        <input type="hidden" name="id" value="22222222222222">
        <button type="submit">Add to cart</button>
      </form>
    `;
		const result = extractMetadata();
		expect(result.title).toBe("Wildcat - White | ChromaPop Violet Mirror");
		expect(result.imageUrl).toBe("https://cdn.shopify.com/white-violet.jpg");
		expect(result.price).toBe("217.00");
	});

	it("falls back to ProductGroup name and skips image when variant cannot be matched", () => {
		// No URL param, no Shopify form — can't tell which variant is selected
		document.head.innerHTML = `
      <meta property="og:image" content="https://example.com/og-image.jpg">
      <script type="application/ld+json">
        {
          "@type": "ProductGroup",
          "name": "Wildcat",
          "hasVariant": [
            {
              "@type": "Product",
              "name": "Wildcat - Matte Black | ChromaPop Red Mirror",
              "image": "https://cdn.shopify.com/matte-black.jpg",
              "offers": { "price": "217.00", "priceCurrency": "USD" }
            }
          ]
        }
      </script>
    `;
		document.body.innerHTML = "";
		const result = extractMetadata();
		// Should use group name, not first variant's specific name
		expect(result.title).toBe("Wildcat");
		// Should use OG image, not the first (potentially wrong) variant's image
		expect(result.imageUrl).toBe("https://example.com/og-image.jpg");
		expect(result.price).toBe("217.00");
	});

	it("prefers JSON-LD price over recommended product card prices (Smith Optics)", () => {
		// Real-world case: Smith Optics Sliders page has $197 main product price in JSON-LD
		// but a "Complete Your Kit" section with a $25 sunglass case card that appears
		// earlier in the DOM price selector scan
		document.head.innerHTML = `
      <script type="application/ld+json">
        {
          "@type": "ProductGroup",
          "name": "Sliders",
          "brand": {"@type": "Brand", "name": "Smith Optics"},
          "hasVariant": [{
            "@type": "Product",
            "name": "Sliders - Matte Olive Oil | Chromapop Brown",
            "offers": {
              "@type": "Offer",
              "price": "197.00",
              "priceCurrency": "USD"
            }
          }]
        }
      </script>
    `;
		// DOM order: related product cards ($25, $217) appear BEFORE the main product price ($197)
		// so without JSON-LD extraction working, DOM scan would return $25 first
		document.body.innerHTML = `
      <section class="related-products">
        <h3>Complete Your Kit</h3>
        <div class="card">
          <h3>Large Sunglass Case</h3>
          <div class="price">
            <span class="price-item price-item--regular">$25.00 USD</span>
          </div>
        </div>
        <div class="card">
          <h3>Wildcat</h3>
          <div class="price">
            <span class="price-item price-item--regular">Starting at $217.00 USD</span>
          </div>
        </div>
      </section>
      <div class="product__info-container">
        <h1>Sliders</h1>
        <div class="price price--large price--show-badge">
          <span class="price-item price-item--regular">$197.00 USD</span>
        </div>
        <button type="submit" name="add" class="product-form__submit">
          <span>Add to cart</span>
        </button>
      </div>
    `;
		const result = extractMetadata();
		expect(result.price).toBe("197.00");
		expect(result.currency).toBe("USD");
	});

	it("extracts sale price from complex nested PriceDisplay component", () => {
		// Real-world case from retail site with list price and sale price
		setupDOM(`
      <div id="product-price">
        <div class="PriceDisplay_price-display__PU2nD PriceDisplay_enhanced-price-display__wC9j3" aria-hidden="true" data-alternate-price-display="true">
          <span data-testid="price-display-list-price" class="bfx-price bfx-list-price">$50</span>
          <span data-testid="price-display-sales-price" class="bfx-price bfx-sale-price">$44.97</span>
          <div class="PriceDisplay_alternative-sale-text__9WawT PriceDisplay_percentage__5_OXv">10% off</div>
        </div>
        <div class="PriceDisplay_sr-price__NA35y">Original price: $50, Sale price: $44.97</div>
        <div class="PriceDisplay_price-display-low-message__9jHzq">
          <div class="VariantMessages_messages__VXuXK"></div>
        </div>
      </div>
    `);
		const result = extractMetadata();
		expect(result.price).toBe("44.97");
	});

	it("ignores stale JSON-LD after SPA navigation when product URL doesn't match page (Sézane style)", () => {
		// Simulate: user navigated white → green-stripe → white via client-side routing.
		// JSON-LD is stale from the green-stripe page; og: tags were updated by the SPA router.
		Object.defineProperty(window, "location", {
			configurable: true,
			writable: true,
			value: {
				...window.location,
				href: "http://localhost/product/tomboy-shirt/white",
				pathname: "/product/tomboy-shirt/white",
				origin: "http://localhost",
			},
		});
		document.head.innerHTML = `
      <meta property="og:title" content="Tomboy Shirt - White - Organic Cotton">
      <meta property="og:image" content="https://cdn.example.com/white-shirt.jpg">
      <meta property="product:price:amount" content="110.00">
      <meta property="product:price:currency" content="USD">
      <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Tomboy Shirt - Ecru Green Stripes",
          "image": "https://cdn.example.com/green-stripes.jpg",
          "offers": {
            "url": "http://localhost/product/tomboy-shirt/ecru-green-stripes",
            "price": "110",
            "priceCurrency": "USD"
          }
        }
      </script>
    `;
		document.body.innerHTML = "";
		const result = extractMetadata();
		// Should fall back to og: tags, not use stale JSON-LD
		expect(result.title).toBe("Tomboy Shirt - White - Organic Cotton");
		expect(result.imageUrl).toBe("https://cdn.example.com/white-shirt.jpg");
		expect(result.price).toBe("110.00");
		// Restore
		Object.defineProperty(window, "location", {
			configurable: true,
			writable: true,
			value: {
				...window.location,
				href: "http://localhost/",
				pathname: "/",
				origin: "http://localhost",
			},
		});
	});

	it("uses og:image:secure_url when og:image is absent (Wakakuu style)", () => {
		document.head.innerHTML = `
      <meta property="og:title" content="Cardigan Coco Light grey">
      <meta property="og:image:secure_url" content="https://www.wakakuu.com/storage/product_image_001.jpg">
    `;
		document.body.innerHTML = "";
		const result = extractMetadata();
		expect(result.imageUrl).toBe(
			"https://www.wakakuu.com/storage/product_image_001.jpg",
		);
	});
});
