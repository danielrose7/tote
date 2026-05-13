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

	it("resolves Cuckoo product media with custom lazy-image elements", () => {
		const html = `
			<div class="product__media card media media--adapt_first mobile:media--adapt_first flex w-full flex-auto relative overflow-hidden" data-media-type="image" data-media-id="35054680768765">
				<img
					src="//cuckooamerica.com/cdn/shop/files/CR-0605F_88bada74-4e2e-4208-af14-7e672a4c0f53.jpg?v=1744215150&amp;width=2200"
					alt="6-Cup Micom Rice Cooker (CR-0605F)"
					srcset="//cuckooamerica.com/cdn/shop/files/CR-0605F_88bada74-4e2e-4208-af14-7e672a4c0f53.jpg?v=1744215150&amp;width=200 200w, //cuckooamerica.com/cdn/shop/files/CR-0605F_88bada74-4e2e-4208-af14-7e672a4c0f53.jpg?v=1744215150&amp;width=2200 2200w"
					width="2200"
					height="2200"
					loading="eager"
					fetchpriority="high"
					class="w-full"
					is="lazy-image"
				>
				<button type="button" is="media-lightbox-button" aria-label="Open media 1 in modal"></button>
			</div>
		`;

		expect(
			extractImageFromHtml(html, "https://cuckooamerica.com/products/cr-0605f"),
		).toBe(
			"https://cuckooamerica.com/cdn/shop/files/CR-0605F_88bada74-4e2e-4208-af14-7e672a4c0f53.jpg?v=1744215150&width=2200",
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
