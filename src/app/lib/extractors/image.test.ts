import { describe, expect, it } from "vitest";
import { extractImageFromHtml } from "./image";
import { extractJsonLd } from "./json-ld";
import { extractOpenGraph } from "./open-graph";

describe("extractor image handling", () => {
	it("resolves Shopify protocol-relative product media srcsets", () => {
		const html = `
			<div class="product__media media media--transparent">
				<img
					src="//babyktan.com/cdn/shop/files/AI_ORGANIC.png?v=1772565537&amp;width=1946"
					srcset="//babyktan.com/cdn/shop/files/AI_ORGANIC.png?v=1772565537&amp;width=246 246w, //babyktan.com/cdn/shop/files/AI_ORGANIC.png?v=1772565537&amp;width=1946 1946w"
					width="1946"
					height="1297"
				>
			</div>
		`;

		expect(
			extractImageFromHtml(
				html,
				"https://babyktan.com/products/baby-ktan-organic-baby-wrap-carrier-infant-and-child-sling-simple-wrap-holder-for-babywearing",
			),
		).toBe(
			"https://babyktan.com/cdn/shop/files/AI_ORGANIC.png?v=1772565537&width=1946",
		);
	});

	it("extracts JSON-LD single ImageObject urls", () => {
		const html = `
			<script type="application/ld+json">
				{
					"@context": "https://schema.org",
					"@type": "Product",
					"name": "Single Stroller 3.0",
					"image": {
						"@type": "ImageObject",
						"url": "//hellomockingbird.com/cdn/shop/files/black_charcoalpenny_singlestroller.png?v=1769464454&width=1024"
					}
				}
			</script>
		`;

		expect(
			extractJsonLd(
				html,
				"https://hellomockingbird.com/products/mockingbird-stroller",
			)?.imageUrl,
		).toBe(
			"https://hellomockingbird.com/cdn/shop/files/black_charcoalpenny_singlestroller.png?v=1769464454&width=1024",
		);
	});

	it("falls back from og:image to og:image:secure_url", () => {
		const html = `
			<meta property="og:image:secure_url" content="//babyktan.com/cdn/shop/files/AI_ORGANIC.png?v=1772565537">
		`;

		expect(
			extractOpenGraph(
				html,
				"https://babyktan.com/products/baby-ktan-organic-baby-wrap-carrier-infant-and-child-sling-simple-wrap-holder-for-babywearing",
			)?.imageUrl,
		).toBe("https://babyktan.com/cdn/shop/files/AI_ORGANIC.png?v=1772565537");
	});
});
