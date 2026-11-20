// Retailer product-page fixtures, hand-trimmed from live pages (Nov 2026).
//
// Each mirrors the real DOM structure the extractor depends on — ids, classes,
// data-test hooks, nesting, and the decoys that used to win (sponsored
// carousels, list/was prices, accessibility duplicates, superscript cents).
// Only product content is kept; scripts, tracking attributes and session data
// are dropped. Values (titles, prices, image ids) are what the page showed.

// Escape a value for use inside a double-quoted HTML attribute.
const attr = (value: string) => value.replace(/"/g, "&quot;");

export interface RetailerFixture {
	name: string;
	url: string;
	head: string;
	body: string;
	expected: {
		title: string;
		price: string;
		currency?: string;
		imageUrl: string;
		/** Every gallery image must be one of the product's own photos. */
		imagesMatch?: RegExp;
	};
}

// ── Amazon ────────────────────────────────────────────────────────────────

function amazonPage(opts: {
	asin: string;
	title: string;
	category: string;
	imageId: string;
	thumbIds: string[];
	whole: string;
	fraction: string;
	listPrice?: string;
	savings?: string;
}): Pick<RetailerFixture, "url" | "head" | "body"> {
	const price = `$${opts.whole}.${opts.fraction}`;
	const img = (size: string) =>
		`https://m.media-amazon.com/images/I/${opts.imageId}._AC_${size}_.jpg`;
	const dynamic = JSON.stringify({
		[img("SY355")]: [355, 355],
		[img("SY450")]: [450, 450],
		[img("SX679")]: [679, 679],
	}).replace(/"/g, "&quot;");
	const thumbs = opts.thumbIds
		.map(
			(id) =>
				`<li class="a-spacing-small item imageThumbnail a-declarative"><span class="a-list-item"><span class="a-button a-button-thumbnail a-button-toggle"><span class="a-button-inner"><input class="a-button-input" type="submit"><span class="a-button-text" aria-hidden="true"><img alt="" src="https://m.media-amazon.com/images/I/${id}._AC_US40_.jpg"></span></span></span></span></li>`,
		)
		.join("");
	const listPrice = opts.listPrice
		? `<div class="a-section a-spacing-small aok-align-center"><span><span class="apex-basisprice-feature"><span class="aok-relative"><span class="a-size-small aok-offscreen apex-basisprice-offscreen-label">List Price: ${opts.listPrice}</span><span class="a-size-small a-color-secondary aok-align-center basisPrice" aria-hidden="true"><span class="apex-basisprice-label">List Price:</span><span class="a-price a-text-price apex-basisprice-value" data-a-size="s" data-a-color="secondary"><span class="a-offscreen">${opts.listPrice}</span><span aria-hidden="true">${opts.listPrice}</span></span></span></span></span></span></div>`
		: "";
	return {
		url: `https://www.amazon.com/dp/${opts.asin}`,
		head: `<title>Amazon.com: ${opts.title} : ${opts.category}</title><meta name="description" content="Buy ${attr(opts.title)}">`,
		body: `
<header id="navbar-main"><div id="nav-belt"><a id="nav-logo-sprites" class="nav-logo-link" href="/"><span class="nav-sprite nav-logo-base"></span></a></div></header>
<div id="dp" class="a-container"><div id="ppd">
  <div id="leftCol">
    <div id="imageBlock_feature_div"><div id="imageBlock" class="a-section imageBlockRearch">
      <div id="altImages" class="a-fixed-left-grid-col a-col-left"><ul class="a-unordered-list a-nostyle a-button-list a-vertical a-spacing-top-extra-large regularAltImageViewLayout">
        ${thumbs}
        <li class="a-spacing-small item videoThumbnail"><img alt="" src="https://m.media-amazon.com/images/I/videoPoster._SX35_SY46_CR,0,0,35,46_.jpg"></li>
      </ul></div>
      <div id="main-image-container" class="a-dynamic-image-container"><ul class="a-unordered-list a-nostyle a-horizontal list maintain-height">
        <li class="image item itemNo0 selected maintain-height"><span class="a-list-item"><span class="a-declarative"><div id="imgTagWrapperId" class="imgTagWrapper">
          <img alt="${attr(opts.title)}" src="${img("SX679")}" data-old-hires="${img("SL1500")}" id="landingImage" data-a-dynamic-image="${dynamic}" class="a-dynamic-image a-stretch-horizontal">
        </div></span></span></li>
      </ul></div>
    </div></div>
  </div>
  <div id="centerCol" class="centerColAlign">
    <div id="titleSection" class="a-section a-spacing-none"><h1 id="title" class="a-size-large a-spacing-none"><span id="productTitle" class="a-size-large product-title-word-break">        ${opts.title}       </span></h1></div>
    <div id="corePriceDisplay_desktop_feature_div" class="celwidget"><div class="a-section apex-core-price-identifier">
      <div class="a-section a-spacing-none aok-align-center aok-relative">
        <span class="aok-offscreen" id="apex-pricetopay-accessibility-label">${price}${opts.savings ? ` with ${opts.savings} percent savings` : ""}</span>
        ${opts.savings ? `<span class="apex-savings-container"><span class="a-size-large a-color-price savingPriceOverride aok-align-center reinventPriceSavingsPercentageMargin savingsPercentage" aria-hidden="true">-${opts.savings}%</span></span>` : ""}
        <span class="a-price aok-align-center reinventPricePriceToPayMargin priceToPay apex-pricetopay-value" data-a-size="xl" data-a-color="base"><span class="a-offscreen"> </span><span aria-hidden="true"><span class="a-price-symbol">$</span><span class="a-price-whole">${opts.whole}<span class="a-price-decimal">.</span></span><span class="a-price-fraction">${opts.fraction}</span></span></span>
        <span id="taxInclusiveMessage" class="a-size-mini a-color-base aok-align-center aok-nowrap"></span>
      </div>
      ${listPrice}
    </div></div>
  </div>
  <div id="rightCol"><div id="buybox"><div id="corePrice_feature_div" class="celwidget">
    <div class="a-section a-spacing-micro"><span class="a-price a-text-price a-size-medium apexPriceToPay" data-a-size="b" data-a-color="price"><span class="a-offscreen">${price}</span><span aria-hidden="true">${price}</span></span></div>
    <div id="tp_price_block_total_price_ww" class="a-section"><span class="a-price" data-a-size="xl" data-a-color="base"><span class="a-offscreen">${price}</span><span aria-hidden="true"><span class="a-price-symbol">$</span><span class="a-price-whole">${opts.whole}<span class="a-price-decimal">.</span></span><span class="a-price-fraction">${opts.fraction}</span></span></span></div>
  </div></div></div>
</div>
<div id="sp_detail" class="a-begin a-carousel-container" aria-label="Products related to this item"><div class="a-row a-carousel-controls"><ol class="a-carousel" role="list">
  <li class="a-carousel-card" role="listitem"><div class="a-section sp_offerVertical p13n-asin sp_ltr_offer"><a class="a-link-normal" href="/sspa/click"><img alt="Boll &amp; Branch Bed Blanket, King" src="https://m.media-amazon.com/images/I/51LvRHkHBfL._AC_SR100,100_QL65_.jpg" height="100" width="100"></a><div class="a-row"><a class="a-link-normal" href="/sspa/click"><span class="a-price" data-a-size="l" data-a-color="base"><span class="a-offscreen">$279.00</span><span aria-hidden="true"><span class="a-price-symbol">$</span><span class="a-price-whole">279<span class="a-price-decimal">.</span></span><span class="a-price-fraction">00</span></span></span></a></div></div></li>
  <li class="a-carousel-card" role="listitem"><div class="a-section sp_offerVertical p13n-asin sp_ltr_offer"><a class="a-link-normal" href="/sspa/click"><img alt="Sponsored Ad - Fleece Throw" src="https://m.media-amazon.com/images/I/417EaTOte+L._AC_SR100,100_QL65_.jpg" height="100" width="100"></a><div class="a-row"><span class="a-price" data-a-size="l" data-a-color="base"><span class="a-offscreen">$21.99</span><span aria-hidden="true">$21.99</span></span></div></div></li>
</ol></div></div>`,
	};
}

const amazonFixtures: RetailerFixture[] = [
	{
		name: "amazon: fleece throw on sale (list price + sponsored carousel decoys)",
		...amazonPage({
			asin: "B0157T1ZK2",
			title:
				"Bedsure Soft Fleece Throw Bed Blanket for Couch Grey - Lightweight Fuzzy Cozy Christmas Decorations Gifts for Women, Blankets and Throws for Sofa, Couch, Travel, Camping, 50x60 inches",
			category: "Home & Kitchen",
			imageId: "917qEKD6XpL",
			thumbIds: ["917qEKD6XpL", "81Ok3cMzVJL", "71yjsYPZ8IL", "81b1KoWTB+L"],
			whole: "9",
			fraction: "99",
			listPrice: "$17.99",
			savings: "44",
		}),
		expected: {
			title:
				"Bedsure Soft Fleece Throw Bed Blanket for Couch Grey - Lightweight Fuzzy Cozy Christmas Decorations Gifts for Women, Blankets and Throws for Sofa, Couch, Travel, Camping, 50x60 inches",
			price: "9.99",
			currency: "USD",
			imageUrl:
				"https://m.media-amazon.com/images/I/917qEKD6XpL._AC_SL1500_.jpg",
			imagesMatch:
				/^https:\/\/m\.media-amazon\.com\/images\/I\/(917qEKD6XpL\._AC_SL1500_|917qEKD6XpL|81Ok3cMzVJL|71yjsYPZ8IL|81b1KoWTB\+L)\.jpg$/,
		},
	},
	{
		name: "amazon: clamp desk lamp, no list price",
		...amazonPage({
			asin: "B0BNHNG5CY",
			title:
				"Led Desk Lamp with Clamp, Architect Desk Lamp for Home Office, 24W Brightest Workbench Office Lighting",
			category: "Tools & Home Improvement",
			imageId: "81f0B2GPxyL",
			thumbIds: ["81f0B2GPxyL", "71r8NKYcL9L"],
			whole: "59",
			fraction: "99",
		}),
		expected: {
			title:
				"Led Desk Lamp with Clamp, Architect Desk Lamp for Home Office, 24W Brightest Workbench Office Lighting",
			price: "59.99",
			imageUrl:
				"https://m.media-amazon.com/images/I/81f0B2GPxyL._AC_SL1500_.jpg",
		},
	},
	{
		name: "amazon: gold desk lamp with $29.99 list price",
		...amazonPage({
			asin: "B0GWTXXCB6",
			title: 'LED Desk Lamp with Clamp, 17" Stepless Dimming Light(Gold)',
			category: "Tools & Home Improvement",
			imageId: "71CJ9yiulCL",
			thumbIds: ["71CJ9yiulCL"],
			whole: "24",
			fraction: "98",
			listPrice: "$29.99",
			savings: "17",
		}),
		expected: {
			title: 'LED Desk Lamp with Clamp, 17" Stepless Dimming Light(Gold)',
			price: "24.98",
			imageUrl:
				"https://m.media-amazon.com/images/I/71CJ9yiulCL._AC_SL1500_.jpg",
		},
	},
	{
		name: "amazon: four-figure price keeps its thousands",
		...amazonPage({
			asin: "B0DLHBD8X2",
			title: "Sectional Sofa Couch, 112\" Modular Sofa",
			category: "Home & Kitchen",
			imageId: "81qkS9mfp1L",
			thumbIds: ["81qkS9mfp1L"],
			whole: "1,299",
			fraction: "00",
			listPrice: "$1,599.00",
			savings: "19",
		}),
		expected: {
			title: 'Sectional Sofa Couch, 112" Modular Sofa',
			price: "1299.00",
			imageUrl:
				"https://m.media-amazon.com/images/I/81qkS9mfp1L._AC_SL1500_.jpg",
		},
	},
	{
		name: "amazon: cream throw blanket",
		...amazonPage({
			asin: "B08BC2MSKW",
			title:
				"Bedsure GentleSoft Cream Throw Blanket for Couch - 300GSM Soft Fleece Blanket",
			category: "Home & Kitchen",
			imageId: "81BYOX0bpJL",
			thumbIds: ["81BYOX0bpJL", "81w5yNDw4cL"],
			whole: "14",
			fraction: "99",
			listPrice: "$20.99",
			savings: "29",
		}),
		expected: {
			title:
				"Bedsure GentleSoft Cream Throw Blanket for Couch - 300GSM Soft Fleece Blanket",
			price: "14.99",
			imageUrl:
				"https://m.media-amazon.com/images/I/81BYOX0bpJL._AC_SL1500_.jpg",
		},
	},
];

// ── Target ────────────────────────────────────────────────────────────────

function targetPage(opts: {
	slug: string;
	tcin: string;
	ogTitle: string;
	h1: string;
	ogImage: string;
	gallery: string[];
	price: string;
	regular?: string;
}): Pick<RetailerFixture, "url" | "head" | "body"> {
	const scene7 = (id: string) =>
		`https://target.scene7.com/is/image/Target/GUEST_${id}`;
	const gallery = opts.gallery
		.map(
			(id, i) =>
				`<div data-test="image-gallery-item-${i}" class="styles_zoomableImage"><div class="styles_ndsImage"><img alt="${attr(opts.h1)}, ${i + 1} of ${opts.gallery.length}" src="${scene7(id)}?wid=600&amp;hei=600&amp;qlt=80" srcset="${scene7(id)}?wid=600&amp;hei=600&amp;qlt=80 600w, ${scene7(id)}?wid=1200&amp;hei=1200&amp;qlt=80 1200w"></div></div>`,
		)
		.join("");
	return {
		url: `https://www.target.com/p/${opts.slug}/-/A-${opts.tcin}`,
		head: `<title>${opts.ogTitle} : Target</title><meta content="${attr(opts.ogTitle)}" property="og:title"><meta content="${scene7(opts.ogImage)}" property="og:image"><meta content="product" property="og:type"><meta content="Read reviews and buy ${attr(opts.ogTitle)} at Target." property="og:description">`,
		body: `
<header data-test="@web/Header"><a data-test="@web/GlobalHeader/TargetLogo" href="/"><img alt="Target home" src="https://target.scene7.com/is/content/Target/GUEST_logo.svg"></a></header>
<main id="pageBodyContainer">
  <div class="sc-PdpWrapper">
    <section id="PdpImageGallerySection"><div data-test="image-gallery-grid">${gallery}</div></section>
    <div class="styles_productDetailContent">
      <h1 data-test="product-title" class="styles_ndsHeading">${opts.h1}</h1>
      <div data-test="module-product-detail-price-v2"><div class="styles_productDetailPrice"><div data-test="price-cdui" class="styles_priceCduiContainer"><div data-test="price-cdui-row" class="h-display-flex">
        <div data-test="@web/Price/PriceFull" class="styles_priceFullLineHeight"><div><div><span><span data-test="product-price" class="styles_currentPriceFontSize">${opts.price}</span></span></div>
        ${opts.regular ? `<div><span data-test="product-regular-price" class="styles_regularPrice">reg ${opts.regular}</span></div><div class="styles_sale">Sale</div>` : ""}</div></div>
      </div></div></div></div>
      <button data-test="shippingButton" type="button">Add to cart</button>
    </div>
  </div>
  <section data-test="@web/Recommendations"><h2>Similar items</h2><ul>
    <li data-test="@web/site-top-of-funnel/ProductCardWrapper"><a href="/p/other/-/A-1"><img alt="" src="${scene7("00000000-rec1")}?wid=300"></a><div data-test="current-price"><span>$24.99</span></div></li>
  </ul></section>
</main>`,
	};
}

const targetFixtures: RetailerFixture[] = [
	{
		name: "target: sale lamp (regular price decoy, og:image is a different variant)",
		...targetPage({
			slug: "23-farmhouse-ceramic-urn-pot-table-lamp-nourison",
			tcin: "88151818",
			ogTitle: 'Nourison 23" Farmhouse Ceramic Urn Pot Table Lamp',
			h1: 'Nourison 23" Distressed Beige Ceramic Urn Table Lamp',
			ogImage: "96e7f64d-ae7c-4c3f-ad58-6fb7f0c0e7ac",
			gallery: [
				"be840e24-d7b8-4042-a7a4-049a884b9b7f",
				"99b33ade-9658-493f-9775-833ae9abcc3d",
				"259beed4-9d43-4528-96ac-2d40478a04e4",
			],
			price: "$89.99",
			regular: "$150.00",
		}),
		expected: {
			title: 'Nourison 23" Distressed Beige Ceramic Urn Table Lamp',
			price: "89.99",
			imageUrl:
				"https://target.scene7.com/is/image/Target/GUEST_be840e24-d7b8-4042-a7a4-049a884b9b7f?wid=1200&hei=1200&qlt=80",
			imagesMatch: /^https:\/\/target\.scene7\.com\/is\/image\/Target\/GUEST_(?!00000000)/,
		},
	},
	{
		name: "target: Threshold lamp at regular price",
		...targetPage({
			slug: "turned-metal-collection-table-lamp-threshold",
			tcin: "1012453050",
			ogTitle: "Turned Metal Collection Table Lamp - Threshold™",
			h1: "Turned Metal Collection Table Lamp Black - Threshold™",
			ogImage: "14a005b5-5ca8-402e-8e8d-e6588304583d",
			gallery: [
				"14a005b5-5ca8-402e-8e8d-e6588304583d",
				"f7d5ddbd-322a-4e87-b2c3-90cd4a40e8dd",
			],
			price: "$50.00",
		}),
		expected: {
			title: "Turned Metal Collection Table Lamp Black - Threshold™",
			price: "50.00",
			imageUrl:
				"https://target.scene7.com/is/image/Target/GUEST_14a005b5-5ca8-402e-8e8d-e6588304583d?wid=1200&hei=1200&qlt=80",
		},
	},
	{
		name: "target: Hearth & Hand lamp",
		...targetPage({
			slug: "ceramic-lamp-with-scallop-shade-sour-cream-oatmeal-hearth-38-hand-8482-with-magnolia",
			tcin: "94688355",
			ogTitle: "Ceramic Lamp with Scallop Shade Sour Cream/Oatmeal - Hearth &amp; Hand™ with Magnolia",
			h1: "Ceramic Lamp with Scallop Shade Sour Cream/Oatmeal - Hearth &amp; Hand™ with Magnolia",
			ogImage: "bbd149be-493f-4db6-920a-621c41bd2906",
			gallery: ["bbd149be-493f-4db6-920a-621c41bd2906"],
			price: "$24.99",
		}),
		expected: {
			title:
				"Ceramic Lamp with Scallop Shade Sour Cream/Oatmeal - Hearth & Hand™ with Magnolia",
			price: "24.99",
			imageUrl:
				"https://target.scene7.com/is/image/Target/GUEST_bbd149be-493f-4db6-920a-621c41bd2906?wid=1200&hei=1200&qlt=80",
		},
	},
	{
		name: "target: Wondershop throw (variant title differs from og:title)",
		...targetPage({
			slug: "holiday-throw-wondershop",
			tcin: "1014483528",
			ogTitle: "Holiday Throw - Wondershop™",
			h1: "Holiday Candy Cane Throw - Wondershop™",
			ogImage: "f06ea356-6235-4a1a-8e64-4b5f21ec486d",
			gallery: [
				"f06ea356-6235-4a1a-8e64-4b5f21ec486d",
				"a8ecbbf2-01bb-4b6a-b860-63532eb6b2a9",
				"7ef7ecea-2a01-4ff0-a389-aeb2b59dbe2d",
			],
			price: "$10.00",
		}),
		expected: {
			title: "Holiday Candy Cane Throw - Wondershop™",
			price: "10.00",
			imageUrl:
				"https://target.scene7.com/is/image/Target/GUEST_f06ea356-6235-4a1a-8e64-4b5f21ec486d?wid=1200&hei=1200&qlt=80",
		},
	},
	{
		name: "target: price range renders the low end",
		...targetPage({
			slug: "turned-metal-collection-table-lamp-threshold",
			tcin: "1012453003",
			ogTitle: "Tuscan Collection Large Table Lamp - Threshold™",
			h1: "Tuscan Collection Large Table Lamp - Threshold™",
			ogImage: "24294dfa-48f5-4dcf-afc4-f52de21930f2",
			gallery: ["24294dfa-48f5-4dcf-afc4-f52de21930f2"],
			price: "$60.00 - $70.00",
		}),
		expected: {
			title: "Tuscan Collection Large Table Lamp - Threshold™",
			price: "60.00",
			imageUrl:
				"https://target.scene7.com/is/image/Target/GUEST_24294dfa-48f5-4dcf-afc4-f52de21930f2?wid=1200&hei=1200&qlt=80",
		},
	},
];

// ── Wayfair ───────────────────────────────────────────────────────────────

function wayfairPage(opts: {
	path: string;
	brand: string;
	name: string;
	imageId: string;
	imagePath: string;
	lead: string;
	was?: string;
	perItem?: string;
	avif?: boolean;
}): Pick<RetailerFixture, "url" | "head" | "body"> {
	const cdn = opts.avif
		? "https://assets.wfcdn.com/avif/im"
		: "https://assets.wfcdn.com/im";
	return {
		url: `https://www.wayfair.com/lighting/pdp/${opts.path}.html`,
		head: `<title>${opts.brand} ${opts.name} &amp; Reviews | Wayfair</title><meta property="og:title" content="${attr(`${opts.brand} ${opts.name}`)} &amp; Reviews | Wayfair"><meta property="og:image" content="${cdn}/${opts.imageId}/compr-r85/${opts.imagePath}.jpg"><script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[]}</script>`,
		body: `
<header><a href="/" aria-label="Wayfair home"><img alt="Wayfair logo" src="https://assets.wfcdn.com/asset/logo.svg"></a></header>
<div class="y4m0pb8"><div class="y4m0pb9"><div data-hb-id="FluidImage-wrapper" class="_16fu6t114b"><img data-hb-id="FluidImage" class="_16fu6t1y7" alt="${attr(opts.name)}" src="https://assets.wfcdn.com/im/11111111/resize-h800-w800%5Ecompr-r85/${opts.imagePath}-1812875766.jpg"></div></div>
<div class="y4m0pb9"><div data-hb-id="FluidImage-wrapper" class="_16fu6t114b"><img data-hb-id="FluidImage" class="_16fu6t1y7" alt="" src="https://assets.wfcdn.com/im/11111112/resize-h800-w800%5Ecompr-r85/${opts.imagePath}-1812875767.jpg"></div></div>
<div class="y4m0pb9"><div data-hb-id="FluidImage-wrapper" class="_16fu6t114b"><img data-hb-id="FluidImage" class="_16fu6t1y7" alt="" src="https://assets.wfcdn.com/im/11111113/resize-h1600-w1600%5Ecompr-r85/${opts.imagePath}-1812875767.jpg"></div></div></div>
<div data-hb-id="BoxV3"><h1 data-hb-id="Heading" data-rtl-id="listingHeaderNameHeading" class="_16fu6t116t _1vbawaw7">${opts.name}</h1>
<div data-hb-id="BoxV3" class="_16fu6t119a"><div data-test-id="PricingFull">
  <span data-test-id="PricingFull-leadPrice"><span data-hb-id="BoxV3" data-test-id="PriceDisplay">${opts.lead}</span></span>
  ${opts.perItem ? `<span data-test-id="PricingFull-perItemPrice"><span data-hb-id="BoxV3" data-test-id="PriceDisplay">${opts.perItem} per item</span></span>` : ""}
  ${opts.was ? `<span data-test-id="PricingFull-strikethroughPrice">was<s data-hb-id="BoxV3" data-test-id="PriceDisplay">${opts.was}</s></span>` : ""}
</div>
<div data-test-id="FinancingPriceTransformationMessage">or 0% APR Offer | Ends 11/18</div></div></div>
<div data-hb-id="BoxV3"><img data-hb-id="FluidImage" data-test-id="ListingLeadImage-Image" alt="Basics by Wayfair" src="https://assets.wfcdn.com/im/22222222/resize-h300-w300%5Ecompr-r85/FMedium+%28Standard%29+Base+-+Basics+by+Wayfair%E2%84%A2.jpg"><span data-test-id="PriceDisplay">$19.99</span></div>`,
	};
}

const wayfairFixtures: RetailerFixture[] = [
	{
		name: "wayfair: lamp set on sale (strikethrough + financing decoys)",
		...wayfairPage({
			path: "lark-manor-25-louann-table-lamp-set-with-night-light-and-usb-ports-w110951038",
			brand: "Lark Manor™",
			name: '25" Louann Table Lamp Set With Night Light And USB Ports',
			imageId: "48212417",
			imagePath:
				"3216/321680391/25%22+Louann+Table+Lamp+Set+With+Night+Light+And+USB+Ports",
			lead: "$124.99",
			was: "$169.99",
		}),
		expected: {
			title: '25" Louann Table Lamp Set With Night Light And USB Ports',
			price: "124.99",
			imageUrl:
				"https://assets.wfcdn.com/im/48212417/compr-r85/3216/321680391/25%22+Louann+Table+Lamp+Set+With+Night+Light+And+USB+Ports.jpg",
			// og:image + two distinct gallery photos (the 1600px resize is a dupe);
			// the "Basics by Wayfair" upsell image must not appear.
			imagesMatch: /^https:\/\/assets\.wfcdn\.com\/im\/.*Louann\+Table\+Lamp\+Set/,
		},
	},
	{
		name: "wayfair: set of 2 with per-item price decoy",
		...wayfairPage({
			path: "winston-porter-19-h-classic-metal-table-lamps-w114210419",
			brand: "Winston Porter",
			name: '19" H Classic Metal Table Lamps (Set of 2)',
			imageId: "94967524",
			imagePath: "3505/350518497/19%22+H+Classic+Metal+Table+Lamps",
			lead: "$43.99",
			was: "$47.99",
			perItem: "$22.00",
		}),
		expected: {
			title: '19" H Classic Metal Table Lamps (Set of 2)',
			price: "43.99",
			imageUrl:
				"https://assets.wfcdn.com/im/94967524/compr-r85/3505/350518497/19%22+H+Classic+Metal+Table+Lamps.jpg",
		},
	},
	{
		name: "wayfair: iPhone user agent gets an AVIF og:image — normalized to JPEG",
		...wayfairPage({
			path: "winston-porter-19-h-classic-metal-table-lamps-w114210419",
			brand: "Winston Porter",
			name: '19" H Classic Metal Table Lamps (Set of 2)',
			imageId: "94967524",
			imagePath: "3505/350518497/19%22+H+Classic+Metal+Table+Lamps",
			lead: "$43.99",
			avif: true,
		}),
		expected: {
			title: '19" H Classic Metal Table Lamps (Set of 2)',
			price: "43.99",
			imageUrl:
				"https://assets.wfcdn.com/im/94967524/compr-r85/3505/350518497/19%22+H+Classic+Metal+Table+Lamps.jpg",
		},
	},
	{
		name: "wayfair: tripod lamp",
		...wayfairPage({
			path: "wade-logan-brabazon-solid-wood-tripod-lamp-w100793434",
			brand: "Wade Logan®",
			name: "Brabazon Solid Wood Table Lamp (Set of 2)",
			imageId: "70217165",
			imagePath: "2741/274158011/Brabazon+Solid+Wood+Table+Lamp",
			lead: "$49.99",
			was: "$99.99",
			perItem: "$25.00",
		}),
		expected: {
			title: "Brabazon Solid Wood Table Lamp (Set of 2)",
			price: "49.99",
			imageUrl:
				"https://assets.wfcdn.com/im/70217165/compr-r85/2741/274158011/Brabazon+Solid+Wood+Table+Lamp.jpg",
		},
	},
	{
		name: "wayfair: four-figure sofa",
		...wayfairPage({
			path: "wade-logan-ainsley-sectional-w005123456",
			brand: "Wade Logan®",
			name: 'Ainsley 112" Modular Sectional',
			imageId: "12345678",
			imagePath: "1111/111111111/Ainsley+112%22+Modular+Sectional",
			lead: "$1,849.99",
			was: "$2,499.00",
		}),
		expected: {
			title: 'Ainsley 112" Modular Sectional',
			price: "1849.99",
			imageUrl:
				"https://assets.wfcdn.com/im/12345678/compr-r85/1111/111111111/Ainsley+112%22+Modular+Sectional.jpg",
		},
	},
];

// ── Walmart ───────────────────────────────────────────────────────────────

function walmartPage(opts: {
	slug: string;
	id: string;
	title: string;
	image: string;
	thumbs: string[];
	hero: string;
	was?: string;
}): Pick<RetailerFixture, "url" | "head" | "body"> {
	const img = (name: string) =>
		`https://i5.walmartimages.com/seo/${name}.jpeg`;
	return {
		url: `https://www.walmart.com/ip/${opts.slug}/${opts.id}`,
		head: `<title>${opts.title} - Walmart.com</title><meta property="og:title" content="${attr(opts.title)} - Walmart.com"><meta property="og:image" content="${img(opts.image)}?odnHeight=612&amp;odnWidth=612&amp;odnBg=FFFFFF"><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"${opts.title.replace(/"/g, '\\"')}"}</script>`,
		body: `
<header data-testid="responsiveHeader"><img alt="" src="https://i5.walmartimages.com/dfw/63fd9f59-4ce6-96de-4331-b8ec-c5191226d378/v1/spark-icon.svg"></header>
<section data-testid="carousel-container" aria-label="Customers also considered"><ul>
  <li><div data-automation-id="product-price"><div aria-hidden="true">Now$2735</div><span class="w_iUH7">current price Now $27.35, Was $34.99</span></div></li>
  <li><div data-automation-id="product-price"><div aria-hidden="true">$12599</div><span class="w_iUH7">current price $125.99</span></div></li>
</ul></section>
<div data-testid="vertical-carousel-container">${opts.thumbs
			.map(
				(t) =>
					`<button data-testid="item-page-vertical-carousel-hero-image-button"><div data-seo-id="hero-carousel-image" data-testid="media-thumbnail"><img loading="lazy" alt="" src="${img(t)}?odnHeight=80&amp;odnWidth=80&amp;odnBg=FFFFFF"></div></button>`,
			)
			.join("")}</div>
<div data-testid="shop-the-background"><img loading="eager" alt="${attr(opts.title)}" src="${img(opts.image)}?odnHeight=573&amp;odnWidth=573&amp;odnBg=FFFFFF"></div>
<h1 id="main-title" class="dark-gray mv1 lh-copy f4 mh0 b" itemprop="name" data-fs-element="name">${opts.title}</h1>
<div data-testid="add-to-cart-section"><span data-testid="price-wrap" class="b lh-copy dark-gray f1 mr2"><span class="w_iUH7">USD</span><span itemprop="price" data-seo-id="hero-price" data-fs-element="price" aria-hidden="false">${opts.hero}</span></span>
${opts.was ? `<span class="strike">${opts.was}</span>` : ""}
<button data-automation-id="atc">Add to cart</button></div>`,
	};
}

const walmartFixtures: RetailerFixture[] = [
	{
		name: "walmart: Mainstays lamp (carousel superscript-cents decoys)",
		...walmartPage({
			slug: "Mainstays-12-75-inch-Height-White-Ball-Table-Lamp",
			id: "14639523376",
			title: "Mainstays White Ball Table Lamp with White Shade",
			image:
				"Mainstays-White-Ball-Table-Lamp_9b1f2c4e-6d8a-4f1e-9a2b-3c4d5e6f7a8b.a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
			thumbs: [
				"Mainstays-White-Ball-Table-Lamp_9b1f2c4e-6d8a-4f1e-9a2b-3c4d5e6f7a8b.a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
				"Mainstays-White-Ball-Table-Lamp_side.b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6",
			],
			hero: "$12.97",
		}),
		expected: {
			title: "Mainstays White Ball Table Lamp with White Shade",
			price: "12.97",
			imageUrl:
				"https://i5.walmartimages.com/seo/Mainstays-White-Ball-Table-Lamp_9b1f2c4e-6d8a-4f1e-9a2b-3c4d5e6f7a8b.a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.jpeg?odnHeight=612&odnWidth=612&odnBg=FFFFFF",
			imagesMatch: /^https:\/\/i5\.walmartimages\.com\/seo\/Mainstays-White-Ball/,
		},
	},
	{
		name: "walmart: Better Homes & Gardens lamp",
		...walmartPage({
			slug: "Better-Homes-Gardens-14-in-Reactive-Red-Glaze-Ceramic-Table-Lamp-with-Integrated-LED",
			id: "19973457407",
			title:
				"Better Homes &amp; Gardens 14 in Lily Reactive Red Glaze Ceramic Table Lamp with Integrated LED",
			image:
				"Better-Homes-Gardens-14-in-Lily-Reactive-Red-Glaze_3e2f-afec-7e89937d87d9.a109158b0c9cd016dce1fb4eb82c74b8",
			thumbs: [
				"Better-Homes-Gardens-14-in-Lily-Reactive-Red-Glaze_3e2f-afec-7e89937d87d9.a109158b0c9cd016dce1fb4eb82c74b8",
			],
			hero: "$39.88",
		}),
		expected: {
			title:
				"Better Homes & Gardens 14 in Lily Reactive Red Glaze Ceramic Table Lamp with Integrated LED",
			price: "39.88",
			imageUrl:
				"https://i5.walmartimages.com/seo/Better-Homes-Gardens-14-in-Lily-Reactive-Red-Glaze_3e2f-afec-7e89937d87d9.a109158b0c9cd016dce1fb4eb82c74b8.jpeg?odnHeight=612&odnWidth=612&odnBg=FFFFFF",
		},
	},
];

export const retailerFixtures: RetailerFixture[] = [
	...amazonFixtures,
	...targetFixtures,
	...wayfairFixtures,
	...walmartFixtures,
];
