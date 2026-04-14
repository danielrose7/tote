import type { ExtractedItem } from "../types";

/**
 * Mock extracted items keyed by URL, used when CURATOR_MOCK=true.
 * Sourced from run 01KNFZCKAP8MS8236W3VWS5WK1
 * Topic: "For the 3-Month-Old Whose Parents Think About What Things Are Made Of"
 */
export const MOCK_EXTRACTED_ITEMS: Record<
	string,
	Omit<ExtractedItem, "sourceUrl">
> = {
	"https://piccalio.com/products/play-mat": {
		title: "Piccalio Reversible Play Mat",
		description:
			"Soft, non-toxic play mat made from water-based, non-toxic foam. Reversible with two pattern options. Easy to wipe clean. BPA and formamide free.",
		price: "$129",
		brand: "Piccalio",
		availability: "in stock",
		imageUrl: "https://piccalio.com/cdn/shop/products/play-mat.jpg",
	},
	"https://gathre.com/products/padded-mini": {
		title: "Gathre Padded Mini Mat",
		description:
			"Leather-look mat with built-in padding. Waterproof, foldable, and spot-clean easy. Works as a play mat, changing mat, or outdoor blanket.",
		price: "$95",
		brand: "Gathre",
		availability: "in stock",
		imageUrl: "https://gathre.com/cdn/shop/products/padded-mini.jpg",
	},
	"https://pehr.com/products/play-mat": {
		title: "Pehr Quilted Play Mat",
		description:
			"100% organic cotton quilted play mat with natural dyes. Generous size, machine washable, reversible. Made to GOTS standards.",
		price: "$148",
		brand: "Pehr",
		availability: "in stock",
		imageUrl: "https://pehr.com/cdn/shop/products/play-mat.jpg",
	},
	"https://ergobaby.com/baby-carrier/embrace/": {
		title: "Ergobaby Embrace Newborn Carrier",
		description:
			"Ultra-soft, stretchy newborn carrier designed for babies 7–25 lbs. No insert needed. Machine washable. Supports ergonomic M-position seating.",
		price: "$78.00",
		brand: "Ergobaby",
		availability: "in stock",
		imageUrl: "https://ergobaby.com/cdn/shop/products/embrace-carrier.jpg",
	},
	"https://www.cottonbabies.com/collections/tula-explore-carriers": {
		title: "Tula Explore Baby Carrier",
		description:
			"Ergonomic carrier suitable from birth to 45 lbs without an infant insert. Hip-healthy design with adjustable fit. Available in multiple fabrics including cotton and linen blends.",
		price: "$169.00",
		brand: "Tula",
		availability: "in stock",
		imageUrl: "https://www.cottonbabies.com/cdn/shop/products/tula-explore.jpg",
	},
	"https://earthmamaorganics.com/products/simply-non-scents-castile-baby-wash":
		{
			title: "Simply Non-Scents Castile Baby Wash",
			description:
				"Fragrance-free castile soap made with organic calendula and coconut oil. EWG Verified, USDA certified organic. Safe for sensitive newborn skin. Tear-free formula.",
			price: "$11.99",
			brand: "Earth Mama",
			availability: "in stock",
			imageUrl:
				"https://earthmamaorganics.com/cdn/shop/products/castile-baby-wash.jpg",
		},
	"https://tubbytodd.com/collections/bath-products": {
		title: "Tubby Todd All Over Ointment",
		description:
			"Multi-purpose skin protectant for sensitive and eczema-prone baby skin. Pediatrician tested, fragrance-free, and formulated without common irritants. A cult favourite for dry, rashy skin.",
		price: "$22.00",
		brand: "Tubby Todd",
		availability: "in stock",
		imageUrl: "https://tubbytodd.com/cdn/shop/products/all-over-ointment.jpg",
	},
};
