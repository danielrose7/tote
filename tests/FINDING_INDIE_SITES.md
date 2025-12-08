# Finding Indie Sites for Testing

This guide helps you find diverse indie/small business sites for metadata extraction testing.

---

## How to Identify Platform & Theme

### Shopify Sites

**Detection Methods:**
1. **View Page Source** - Look for:
   - `cdn.shopify.com` in scripts/stylesheets
   - `Shopify.theme = {"name":"ThemeName"` in JavaScript
   - `<!-- BEGIN theme-check-disable -->` comments

2. **Browser DevTools:**
   - Open DevTools → Network tab
   - Look for requests to `*.myshopify.com` or `cdn.shopify.com`

3. **URL Patterns:**
   - Checkout URLs: `store.com/checkout`
   - Cart URLs: `store.com/cart`
   - Product URLs: `store.com/products/product-name`

4. **Theme Detection:**
   - Check `<meta name="theme-name" content="...">`
   - Look in page source for theme attribution comments
   - Use [What Shopify Theme](https://whatshopifytheme.com/) tool

**Common Shopify Themes:**
- **Dawn** - Current default (2021+)
- **Debut** - Previous default (2016-2021)
- **Brooklyn** - Popular free theme
- **Minimal** - Older free theme
- **Prestige** - Premium theme
- **Empire** - Premium theme
- **Warehouse** - Premium theme

### Squarespace Sites

**Detection Methods:**
1. **View Page Source** - Look for:
   - `static1.squarespace.com` in resources
   - `<script src="//assets.squarespace.com/..."`
   - Template name in `<body class="...">`

2. **Footer:**
   - Often has "Powered by Squarespace" (if not removed)

3. **URL Structure:**
   - Product pages: `site.com/shop/product-name`
   - Cart: `site.com/cart`

4. **Template Detection:**
   - Check body class: `<body class="... template-name-..."`
   - Use [Squarespace Template Detector](https://isitsquarespace.com/)

**Common Squarespace Templates:**
- **Bedford** - Very popular
- **Brine** family - Versatile, highly customizable
- **Avenue** - Fashion-focused
- **Five** - Modern, minimal
- **Skye** - Newsletter/content focus

### Other Platforms

**Big Cartel:**
- URLs: `*.bigcartel.com` or custom domain
- Footer: "Powered by Big Cartel"
- Very simple structure, limited themes

**Gumroad:**
- URLs: `*.gumroad.com` or custom domain
- Simple product pages
- Often single-item sales

**Ko-fi:**
- URLs: `ko-fi.com/username/shop`
- Very minimal, creator-focused
- Simple product listings

**Wix:**
- View source → `static.wixstatic.com`
- Often has `.wixsite.com` in URL
- Heavy JavaScript rendering

**Webflow:**
- View source → `assets.website-files.com`
- Clean, custom-designed sites
- Often high-quality metadata

---

## Where to Find Indie Sites

### 1. Instagram Shopping
- Follow indie brands, artists, makers
- Click links in bio
- Many use Shopify/Squarespace

### 2. Reddit Communities
- r/Entrepreneur
- r/smallbusiness
- r/ecommerce
- r/Etsy (many sellers have own sites too)
- Niche subreddits (r/jewelry, r/streetwear, etc.)

### 3. Product Hunt
- Filter by "E-commerce" category
- Many indie DTC brands launch here
- Good mix of platforms

### 4. "Made on Shopify" Showcase
- https://www.shopify.com/blog/best-shopify-stores
- Official Shopify examples
- Variety of themes

### 5. Discover Squarespace Sites
- https://www.squarespace.com/websites/templates (example sites)
- Follow links from template previews

### 6. Indie Maker Directories
- https://www.indiehackers.com/products
- https://www.producthunt.com/
- Many have product pages

### 7. Artisan/Handmade Marketplaces
Look for sellers with external shops:
- Etsy seller profiles (many link to own site)
- Faire wholesale marketplace
- Instagram maker tags (#supportsmallbusiness)

### 8. Random Discovery
- Google: `"powered by shopify" + [niche]` (jewelry, candles, apparel)
- Google: `site:myshopify.com` (finds all Shopify stores)
- Google: `"powered by squarespace" + shop`

---

## Test Case Priority

Aim for this distribution in your test suite:

**High Priority (60% of tests):**
- 25% Shopify indie (variety of themes)
- 20% Squarespace indie (variety of templates)
- 15% Other indie platforms (Big Cartel, Gumroad, Ko-fi, Wix, Webflow)

**Medium Priority (30% of tests):**
- 10% DTC brands (custom sites, usually good metadata)
- 10% Fashion/apparel (mid-size brands)
- 10% Niche e-commerce (specialized products)

**Low Priority (10% of tests):**
- 5% Major platforms (Amazon, eBay - baseline)
- 5% Edge cases (crowdfunding, pre-orders, etc.)

---

## What to Look For When Testing

### Theme Patterns to Note

**Shopify Dawn (2021+ default):**
- Usually has good OG tags (built-in)
- Product JSON-LD often present
- Images: check if `cdn.shopify.com` URLs include size parameters
- Price: usually in schema.org markup

**Shopify Debut (older default):**
- Mixed OG tag quality
- May be missing product schema
- Custom modifications common

**Custom/Heavily Modified Themes:**
- Most likely to have issues
- Owner may have removed/broken default metadata
- Most valuable test cases!

**Squarespace:**
- Generally good OG tags (platform default)
- Product schema varies by template
- Images often optimized but check quality
- Price extraction can be tricky

**Big Cartel:**
- Very basic metadata
- Often missing OG images
- Prices may not be in structured format
- Great test case for fallback strategies

### Common Issues by Platform

**Shopify Issues:**
- Variant products (size/color) - which price to show?
- Sold out products - price hidden
- Collection pages vs product pages
- Apps that modify product display

**Squarespace Issues:**
- Template customization breaks defaults
- Product galleries - which image is "main"?
- Sale prices vs regular prices
- Limited product schema support

**Indie Platform Issues:**
- Basic/missing OG tags
- No structured data (JSON-LD)
- Poor image quality/selection
- Inconsistent price formatting
- Custom domains may have different behavior than platform subdomains

---

## Quick Start Examples

Try these example searches to find test URLs:

```
"powered by shopify" ceramic mug
site:myshopify.com jewelry
"powered by squarespace" art prints
site:bigcartel.com stickers
gumroad.com digital downloads
ko-fi.com/*/shop prints
```

Then verify the platform/theme and test in your tester tool!

---

## Test Case Template

When you find a good indie site:

1. **Identify Platform/Theme**
   - Use detection methods above
   - Note in "Platform Detail" field

2. **Test Multiple Product Types**
   - Simple product (single price)
   - Product with variants (sizes/colors)
   - Sold out product
   - Pre-order/coming soon

3. **Document Everything**
   - What metadata is present?
   - What's missing?
   - What's wrong?
   - Is it theme-specific or site-specific?

4. **Save Test Case**
   - Generate JSON from tester
   - Add to test suite
   - Note patterns for extraction strategy

---

## Goal

Collect **30-50 indie site test cases** covering:
- ✅ 10+ different Shopify themes
- ✅ 5+ different Squarespace templates
- ✅ 5+ other indie platforms
- ✅ Mix of product types (simple, variants, sold out)
- ✅ Geographic diversity (different currencies)
- ✅ Niche diversity (fashion, home goods, art, food, etc.)

This will give you a robust test suite to build your custom extraction logic against!
