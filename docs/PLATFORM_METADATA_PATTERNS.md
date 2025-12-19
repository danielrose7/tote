# Platform Metadata Patterns Reference

Quick reference for how different platforms typically structure their product metadata. Use this to build extraction strategies.

---

## Shopify

### Default Metadata Structure

**Open Graph Tags (Usually Present):**
```html
<meta property="og:type" content="product">
<meta property="og:title" content="Product Name">
<meta property="og:description" content="Product description...">
<meta property="og:image" content="https://cdn.shopify.com/s/files/1/xxxx/xxxx/products/image.jpg">
<meta property="og:price:amount" content="29.99">
<meta property="og:price:currency" content="USD">
```

**Product JSON (Always Present):**
```javascript
// Found in <script> tags or via AJAX
// URL: /products/{handle}.js
{
  "id": 123456789,
  "title": "Product Name",
  "description": "<p>HTML description</p>",
  "vendor": "Brand Name",
  "product_type": "Category",
  "price": 2999, // cents
  "price_min": 2999,
  "price_max": 4999,
  "available": true,
  "images": ["//cdn.shopify.com/..."],
  "featured_image": "//cdn.shopify.com/...",
  "variants": [
    {
      "id": 987654321,
      "title": "Small / Blue",
      "price": 2999,
      "available": true
    }
  ]
}
```

**JSON-LD (Theme Dependent):**
```json
{
  "@context": "http://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "description": "Product description",
  "image": "https://cdn.shopify.com/...",
  "brand": {
    "@type": "Brand",
    "name": "Brand Name"
  },
  "offers": {
    "@type": "Offer",
    "price": "29.99",
    "priceCurrency": "USD",
    "availability": "http://schema.org/InStock",
    "url": "https://store.com/products/product-name"
  }
}
```

### Shopify-Specific Extraction Strategy

**Priority Order:**
1. **Product JSON** (`/products/{handle}.js`) - Most reliable
   - Always available via AJAX
   - Structured data, easy to parse
   - Contains all variants

2. **JSON-LD** (if present in HTML)
   - Standard schema.org format
   - Usually accurate

3. **Open Graph tags**
   - Fallback for basic info
   - May not have all data

4. **HTML selectors** (last resort)
   - `.product-title`, `.product__title`
   - `.price`, `.product__price`
   - `.product-description`, `.product__description`

**Common Issues:**
- Variant pricing: shows "from $X" when multiple prices
- Sold out: price may be hidden
- Sale prices: OG tags may show original, not sale price
- Currency: depends on user location (Shopify Markets)
- Images: CDN URLs include size params (`_200x.jpg`) - can get larger

**Image URL Optimization:**
```javascript
// Shopify CDN URLs can be resized
// Original: https://cdn.shopify.com/...image_200x.jpg
// Want larger: https://cdn.shopify.com/...image_1024x1024.jpg
// Remove size: https://cdn.shopify.com/...image.jpg (original)
```

---

## Squarespace

### Default Metadata Structure

**Open Graph Tags (Usually Present):**
```html
<meta property="og:type" content="product">
<meta property="og:title" content="Product Name">
<meta property="og:description" content="Product description">
<meta property="og:image" content="https://images.squarespace-cdn.com/...">
<meta property="og:price:amount" content="29.99">
<meta property="og:price:currency" content="USD">
```

**JSON-LD (Sometimes Present):**
```json
{
  "@context": "http://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "description": "Description",
  "image": "https://images.squarespace-cdn.com/...",
  "offers": {
    "@type": "Offer",
    "price": "29.99",
    "priceCurrency": "USD",
    "availability": "http://schema.org/InStock"
  }
}
```

### Squarespace-Specific Extraction Strategy

**Priority Order:**
1. **JSON-LD** (if present)
2. **Open Graph tags**
3. **HTML selectors**
   - `.product-title`
   - `.product-price`
   - `.product-description`
   - `.sqs-gallery` (product images)

**Common Issues:**
- Templates vary widely in metadata quality
- Older templates may lack JSON-LD
- Custom code blocks can override defaults
- Product variants less structured than Shopify
- Images: Squarespace CDN has format params (`?format=1000w`)

**Image URL Optimization:**
```javascript
// Squarespace CDN URLs can be resized
// Original: https://images.squarespace-cdn.com/...?format=500w
// Want larger: https://images.squarespace-cdn.com/...?format=2500w
// Or remove format param for original
```

---

## Big Cartel

### Typical Structure

**Metadata (Basic):**
```html
<meta property="og:title" content="Product Name">
<meta property="og:description" content="Description">
<meta property="og:image" content="https://images.bigcartel.com/...">
<!-- Often missing og:price -->
```

**HTML Selectors:**
- `.product-title`, `h1.product_name`
- `.price`, `.product_price`
- `.product-description`

**Common Issues:**
- Very minimal metadata
- Often missing structured data
- Price may only be in HTML text
- Limited customization = more consistent patterns

**Extraction Strategy:**
- Rely heavily on HTML selectors
- Price: regex parse from HTML text
- Images: usually straightforward (one main image)

---

## Gumroad

### Typical Structure

**Metadata:**
```html
<meta property="og:title" content="Product Name">
<meta property="og:description" content="Description">
<meta property="og:image" content="https://public-files.gumroad.com/...">
<meta property="og:price:amount" content="29">
<meta property="og:price:currency" content="USD">
```

**Extraction Strategy:**
- Good OG tag coverage
- Price usually in OG tags
- Simple structure (single products)
- May have "name your price" (variable pricing)

---

## WooCommerce (WordPress)

### Default Structure

**JSON-LD (Usually Present):**
```json
{
  "@context": "http://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "description": "Description",
  "image": "https://site.com/wp-content/uploads/...",
  "offers": {
    "@type": "Offer",
    "price": "29.99",
    "priceCurrency": "USD"
  }
}
```

**HTML Selectors (Theme Dependent):**
- `.product_title`, `.entry-title`
- `.price`, `.woocommerce-Price-amount`
- `.woocommerce-product-details__short-description`

**Common Issues:**
- Highly theme-dependent
- Plugins can modify output
- Variable products (like Shopify variants)
- SEO plugins may affect metadata

**Extraction Strategy:**
- JSON-LD first (most reliable)
- OG tags (if present)
- WooCommerce-specific selectors as fallback
- Look for `woocommerce` class names

---

## Webflow

### Typical Structure

**Metadata (Usually Good):**
```html
<meta property="og:title" content="Product Name">
<meta property="og:description" content="Description">
<meta property="og:image" content="https://assets.website-files.com/...">
```

**Common Patterns:**
- Custom-designed, varies by site
- Usually good metadata (designers care about SEO)
- E-commerce may use Webflow native or third-party (Foxy, Snipcart)
- Clean HTML structure

**Extraction Strategy:**
- OG tags usually reliable
- JSON-LD sometimes present
- Custom selectors needed (no standard classes)

---

## Wix

### Typical Structure

**Metadata:**
```html
<meta property="og:title" content="Product Name">
<meta property="og:description" content="Description">
<meta property="og:image" content="https://static.wixstatic.com/...">
```

**Common Issues:**
- Heavy JavaScript rendering
- Metadata in HTML but content may be JS-loaded
- Standard extraction may work for meta tags
- Product details may require JS execution

**Extraction Strategy:**
- OG tags from static HTML
- May need browser automation for full content
- Wix Stores has consistent structure once identified

---

## Extraction Priority Matrix

| Platform | 1st Priority | 2nd Priority | 3rd Priority | Needs JS? |
|----------|-------------|-------------|-------------|-----------|
| **Shopify** | Product JSON API | JSON-LD | OG tags | No |
| **Squarespace** | JSON-LD | OG tags | HTML selectors | No |
| **Big Cartel** | HTML selectors | OG tags | - | No |
| **Gumroad** | OG tags | HTML selectors | - | No |
| **WooCommerce** | JSON-LD | OG tags | HTML selectors | No |
| **Webflow** | OG tags | JSON-LD | Custom selectors | No |
| **Wix** | OG tags | HTML selectors | - | Maybe |

---

## Common Patterns Across All Platforms

### Price Extraction Sources (in order)

1. **Schema.org JSON-LD**
   ```javascript
   const script = document.querySelector('script[type="application/ld+json"]');
   const data = JSON.parse(script.textContent);
   const price = data.offers.price;
   ```

2. **Open Graph**
   ```javascript
   const price = document.querySelector('meta[property="og:price:amount"]')?.content;
   const currency = document.querySelector('meta[property="og:price:currency"]')?.content;
   ```

3. **Microdata**
   ```javascript
   const price = document.querySelector('[itemprop="price"]')?.content;
   ```

4. **HTML Text Parsing**
   ```javascript
   // Find elements with common price class names
   const priceEl = document.querySelector('.price, .product-price, [class*="price"]');
   // Regex: /[$£€¥]\s*[\d,]+\.?\d*/
   ```

### Image Extraction Sources

1. **Schema.org JSON-LD**
   ```javascript
   const image = data.image; // or data.image[0] if array
   ```

2. **Open Graph**
   ```javascript
   const image = document.querySelector('meta[property="og:image"]')?.content;
   ```

3. **Product-specific selectors**
   ```javascript
   const image = document.querySelector('.product-image img, [class*="product"] img');
   ```

4. **Largest image heuristic**
   ```javascript
   // Find largest image in product container
   // Avoid logos (usually < 200px)
   ```

---

## Testing Checklist per Platform

When testing an indie site:

- [ ] Identify platform/theme
- [ ] Check for JSON-LD (View Source → search `application/ld+json`)
- [ ] Check OG tags (View Source → search `og:`)
- [ ] Test product JSON endpoint (Shopify: `/products/{handle}.js`)
- [ ] Note which data is present/missing/wrong
- [ ] Test with variants (if applicable)
- [ ] Test with sold-out product (if available)
- [ ] Note image quality/URL pattern
- [ ] Note price format/currency
- [ ] Document in test case

This will help build pattern-based extraction rules!
