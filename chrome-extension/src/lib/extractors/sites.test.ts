import { afterEach, describe, expect, it } from "vitest";
import { retailerFixtures } from "./__fixtures__/retailers";
import { extractMetadata } from "./index";
import { extractPriceFromText } from "./shared";
import { siteAdapterFor } from "./sites";

const originalLocation = window.location;

// Site adapters key off window.location.hostname, which jsdom won't let
// pushState change across origins — swap the location object instead.
function loadPage(url: string, head: string, body: string) {
	const parsed = new URL(url);
	Object.defineProperty(window, "location", {
		configurable: true,
		writable: true,
		value: {
			href: parsed.href,
			hostname: parsed.hostname,
			pathname: parsed.pathname,
			search: parsed.search,
			origin: parsed.origin,
			protocol: parsed.protocol,
			host: parsed.host,
		},
	});
	document.head.innerHTML = head;
	document.body.innerHTML = body;
	// innerHTML doesn't execute scripts, but JSON-LD is read as text, so
	// re-create those so querySelectorAll finds them with their content.
	for (const s of Array.from(document.head.querySelectorAll("script"))) {
		const copy = document.createElement("script");
		copy.type = s.type;
		copy.textContent = s.textContent;
		s.replaceWith(copy);
	}
}

afterEach(() => {
	Object.defineProperty(window, "location", {
		configurable: true,
		writable: true,
		value: originalLocation,
	});
	document.head.innerHTML = "";
	document.body.innerHTML = "";
});

describe("retailer product pages", () => {
	for (const fixture of retailerFixtures) {
		it(fixture.name, () => {
			loadPage(fixture.url, fixture.head, fixture.body);
			const result = extractMetadata();

			expect(result.title).toBe(fixture.expected.title);
			expect(result.price).toBe(fixture.expected.price);
			expect(result.currency).toBe(fixture.expected.currency ?? "USD");
			expect(result.imageUrl).toBe(fixture.expected.imageUrl);
			expect(result.pageType).toBe("product");
			expect(result.confidence).toBe(1);
			if (fixture.expected.imagesMatch) {
				expect(result.images?.length).toBeGreaterThan(1);
				for (const image of result.images ?? []) {
					expect(image).toMatch(fixture.expected.imagesMatch);
				}
			}
		});
	}
});

describe("site adapter host matching", () => {
	it.each([
		["www.amazon.com", "amazon"],
		["smile.amazon.co.uk", "amazon"],
		["www.target.com", "target"],
		["www.wayfair.com", "wayfair"],
		["www.allmodern.com", "wayfair"],
		["www.walmart.com", "walmart"],
	])("%s → %s", (host, id) => {
		expect(siteAdapterFor(host)).toBe(id);
	});

	it.each(["notamazon.com", "amazon.com.evil.io", "targetpractice.com", "www.etsy.com"])(
		"does not match %s",
		(host) => {
			expect(siteAdapterFor(host)).toBeUndefined();
		},
	);
});

describe("glued accessibility / superscript prices", () => {
	it.each([
		["$9.99$9.99", "9.99"], // offscreen copy + visual spans
		["$9.999.99", "9.99"], // symbol rendered once, digits twice
		["$169.99$16999", "169.99"], // Best Buy price block
		["$1,299.00$1,299.00", "1299.00"],
		["$1,299.001,299.00", "1299.00"],
		["€1.234,56", "1234.56"], // still European
		["$1,234", "1234"],
		["$40.", "40"],
	])("%s → %s", (text, price) => {
		expect(extractPriceFromText(text)?.price).toBe(price);
	});
});

describe("adapter fallback behaviour", () => {
	it("Target before hydration: no price, and no carousel price is borrowed", () => {
		loadPage(
			"https://www.target.com/p/holiday-throw-wondershop/-/A-1014483528",
			`<meta property="og:title" content="Holiday Throw - Wondershop™"><meta property="og:image" content="https://target.scene7.com/is/image/Target/GUEST_f06ea356-6235-4a1a-8e64-4b5f21ec486d">`,
			`<h1 data-test="product-title">Holiday Candy Cane Throw - Wondershop™</h1>
			 <section><div class="price">$24.99</div></section>`,
		);
		const result = extractMetadata();
		expect(result.title).toBe("Holiday Candy Cane Throw - Wondershop™");
		expect(result.price).toBeUndefined();
		expect(result.imageUrl).toBe(
			"https://target.scene7.com/is/image/Target/GUEST_f06ea356-6235-4a1a-8e64-4b5f21ec486d",
		);
	});

	it("Amazon with no #productTitle falls back to a cleaned document title", () => {
		loadPage(
			"https://www.amazon.com/dp/B0157T1ZK2",
			"<title>Amazon.com: Bedsure Fleece Throw : Home &amp; Kitchen</title>",
			`<span class="a-price priceToPay"><span class="a-offscreen">$9.99</span></span>`,
		);
		const result = extractMetadata();
		expect(result.title).toBe("Bedsure Fleece Throw");
		expect(result.price).toBe("9.99");
	});

	it("adapter values win over JSON-LD, and JSON-LD fills what the adapter missed", () => {
		loadPage(
			"https://www.walmart.com/ip/thing/1",
			`<script type="application/ld+json">{"@type":"Product","name":"LD name","image":"https://i5.walmartimages.com/seo/ld.jpeg","offers":{"price":"50.00","priceCurrency":"USD"}}</script>`,
			`<h1 id="main-title">Hero name</h1>`,
		);
		const result = extractMetadata();
		expect(result.title).toBe("Hero name");
		expect(result.price).toBe("50.00");
		expect(result.imageUrl).toBe("https://i5.walmartimages.com/seo/ld.jpeg");
	});
});

describe("JSON-LD ImageObject (Etsy / Best Buy)", () => {
	it("reads contentURL from an ImageObject array", () => {
		loadPage(
			"https://www.etsy.com/listing/1702915637/solstice-mug-handmade-pottery-mug-with",
			`<meta property="og:image" content="https://i.etsystatic.com/12/r/il/00b10c/5918841167/il_1080xN.5918841167_7pog.jpg">
			 <meta property="product:price:amount" content="38.75">
			 <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Solstice Mug: Handmade Pottery Mug with Sun Design","url":"https://www.etsy.com/listing/1702915637/solstice-mug-handmade-pottery-mug-with","image":[{"@type":"ImageObject","contentURL":"https://i.etsystatic.com/12/r/il/00b10c/5918841167/il_fullxfull.5918841167_7pog.jpg","thumbnail":"https://i.etsystatic.com/12/c/1500/1500/0/0/il/00b10c/5918841167/il_340x270.5918841167_7pog.jpg"},{"@type":"ImageObject","contentURL":"https://i.etsystatic.com/12/r/il/7a1b2c/5918841201/il_fullxfull.5918841201_ab12.jpg"}],"offers":{"@type":"AggregateOffer","lowPrice":"34.87","price":"34.87","priceCurrency":"USD"}}</script>`,
			`<h1>Solstice Mug: Handmade Pottery Mug with Sun Design</h1>`,
		);
		const result = extractMetadata();
		expect(result.title).toBe(
			"Solstice Mug: Handmade Pottery Mug with Sun Design",
		);
		expect(result.price).toBe("34.87");
		expect(result.imageUrl).toBe(
			"https://i.etsystatic.com/12/r/il/00b10c/5918841167/il_fullxfull.5918841167_7pog.jpg",
		);
		expect(result.images).toContain(
			"https://i.etsystatic.com/12/r/il/7a1b2c/5918841201/il_fullxfull.5918841201_ab12.jpg",
		);
	});
});

describe("Wayfair gallery", () => {
	it("collects distinct gallery photos sharing the og:image stem", () => {
		const fixture = retailerFixtures.find((f) => f.name.startsWith("wayfair: lamp set"));
		if (!fixture) throw new Error("fixture missing");
		loadPage(fixture.url, fixture.head, fixture.body);
		const result = extractMetadata();
		expect(result.images).toHaveLength(3);
	});
});

describe("JSON-LD url matching", () => {
	const bestBuyLd = (url: string) =>
		`<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Anker - Soundcore Liberty 5 Pro Max Noise Cancelling Earbuds with AI Note Taker Case - Black","url":"${url}","image":"https://pisces.bbystatic.com/image2/BestBuy_US/images/products/2b2ad3e0-b299-439a-832d-dbb09aca50db.jpg","offers":{"@type":"Offer","price":229.99,"priceCurrency":"USD"}}</script>`;

	it("accepts Best Buy JSON-LD whose url is a prefix of the /sku/ page path", () => {
		loadPage(
			"https://www.bestbuy.com/product/anker-soundcore-liberty-5-pro-max-noise-cancelling-earbuds-with-ai-note-taker-case-black/JJ858RS8GQ/sku/6673217",
			bestBuyLd(
				"https://www.bestbuy.com/product/anker-soundcore-liberty-5-pro-max-noise-cancelling-earbuds-with-ai-note-taker-case-black/JJ858RS8GQ",
			),
			// Carousel price that the DOM heuristic used to pick instead.
			`<h1>Anker - Soundcore Liberty 5 Pro Max</h1>
			 <section class="carousel"><div class="price">$199.99</div></section>
			 <div data-testid="price-block-customer-price">$229.99$22999</div>`,
		);
		const result = extractMetadata();
		expect(result.title).toBe(
			"Anker - Soundcore Liberty 5 Pro Max Noise Cancelling Earbuds with AI Note Taker Case - Black",
		);
		expect(result.price).toBe("229.99");
		expect(result.imageUrl).toBe(
			"https://pisces.bbystatic.com/image2/BestBuy_US/images/products/2b2ad3e0-b299-439a-832d-dbb09aca50db.jpg",
		);
	});

	it("still rejects JSON-LD left over from a different product (SPA navigation)", () => {
		loadPage(
			"https://www.bestbuy.com/product/hp-omnibook-3/J3PPHFY77J",
			`${bestBuyLd("https://www.bestbuy.com/product/anker-soundcore-liberty-5-pro-max/JJ858RS8GQ")}<meta property="og:title" content="HP OmniBook 3">`,
			"",
		);
		expect(extractMetadata().title).toBe("HP OmniBook 3");
	});
});
