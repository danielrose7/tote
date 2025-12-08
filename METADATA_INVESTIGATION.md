# Metadata Extraction Investigation Plan

## Goal
Build a custom metadata extraction solution based on real-world test cases, using Microlink as a baseline to understand what's missing.

---

## Phase 1: Problem Collection & Analysis

### 1.1 Create Test URL Collection
Build a diverse set of test URLs from various sources:

**Priority: Indie/Small Business Sites** ⭐
These are where metadata quality varies the most:
- [ ] Shopify stores (10+ different themes)
  - [ ] Dawn theme (Shopify's default)
  - [ ] Debut theme (older default)
  - [ ] Brooklyn theme
  - [ ] Minimal theme
  - [ ] Prestige theme
  - [ ] Custom/heavily modified themes
  - [ ] Free vs paid themes
- [ ] Squarespace stores (5+ templates)
  - [ ] Bedford template
  - [ ] Brine template family
  - [ ] Avenue template
  - [ ] Five template
  - [ ] Default/minimal templates
- [ ] Wix e-commerce sites
- [ ] Big Cartel stores (artist/maker focused)
- [ ] Gumroad product pages
- [ ] Ko-fi shops
- [ ] Webflow e-commerce sites
- [ ] Individual artist/maker websites (custom HTML)

**Why these matter:**
- Often built by non-technical owners
- Templates may not implement OG tags correctly
- Images often not optimized or tagged properly
- Price display varies wildly by theme/customization
- This is likely your core user base!

**E-Commerce Platforms (Secondary Priority):**
- [ ] Amazon (baseline - usually works well)
- [ ] Etsy (good metadata, useful comparison)
- [ ] eBay (auctions vs Buy It Now)
- [ ] Big Box Retailers (Target, Walmart, Best Buy) - usually good
- [ ] Fashion/Apparel (Zara, H&M, Nordstrom)
- [ ] Direct-to-Consumer brands (Warby Parker, Allbirds)
- [ ] WooCommerce sites (WordPress plugin, varies by theme)

**Edge Cases:**
- [ ] Sites with JavaScript-rendered content (common in modern Shopify themes)
- [ ] Sites with login walls/paywalls
- [ ] Sites with anti-scraping measures
- [ ] Sites with regional redirects
- [ ] Sites with poor/missing OG tags (very common in indie sites)
- [ ] Sites with multiple product variants (size/color)
- [ ] Crowdfunding (Kickstarter, Indiegogo)
- [ ] Pre-order/coming soon products
- [ ] Sold out products with no price displayed

### 1.2 Document Current Microlink Behavior

For each test URL, record:

```typescript
interface TestCase {
  url: string;
  siteName: string;
  category: string; // "e-commerce" | "crowdfunding" | "marketplace" | etc

  // What Microlink returns
  microlinkResult: {
    title?: string;
    description?: string;
    imageUrl?: string;
    price?: string;
    error?: string;
  };

  // What we actually want
  expectedResult: {
    title: string;
    description: string;
    imageUrl: string;
    price?: string;
    currency?: string;
    availability?: string;
    brand?: string;
  };

  // Analysis
  issues: string[]; // e.g., "Wrong image (got logo instead of product)", "No price", "Title too generic"
  severity: "critical" | "major" | "minor";
  notes?: string;
}
```

### 1.3 Categorize Failure Modes

Group issues into categories:

1. **Missing Data**
   - No price extracted
   - No image URL
   - No description
   - No title

2. **Wrong Data**
   - Generic logo instead of product image
   - Site name instead of product title
   - Site description instead of product description
   - Wrong currency/format

3. **Incomplete Data**
   - Truncated descriptions
   - Low-resolution images when hi-res available
   - Missing variants (size, color)
   - Missing availability status

4. **Technical Issues**
   - CORS errors
   - CSP blocking
   - JavaScript-required content not loaded
   - Rate limiting
   - Geo-blocking

5. **Data Quality**
   - Too much markup in text
   - HTML entities not decoded
   - Poor image selection (first found vs best)
   - Generic/SEO-stuffed titles

---

## Phase 2: Extraction Strategy Research

For each failure category, research solutions:

### 2.1 Price Extraction Strategies

**Where to look (in priority order):**
1. Schema.org JSON-LD (`<script type="application/ld+json">`)
   - `Product` → `offers` → `price`
   - `Product` → `offers` → `priceCurrency`
2. Open Graph product tags
   - `og:price:amount`
   - `og:price:currency`
3. Microdata/RDFa
   - `itemprop="price"`
4. Meta tags
   - `meta[name="price"]`
5. HTML parsing (fallback)
   - Common selectors: `.price`, `[data-price]`, `.product-price`
   - Regex patterns: `/\$[\d,]+\.?\d*/`, `/€[\d,]+\.?\d*/`

**Test cases:**
- Sites with variant pricing (size/color dependent)
- Sale prices vs original prices
- Currency conversion/localization
- Subscription vs one-time pricing

### 2.2 Image Extraction Strategies

**Where to look (in priority order):**
1. Open Graph
   - `og:image` (but verify it's product, not logo)
   - `og:image:width` / `og:image:height` (prefer larger)
2. Schema.org JSON-LD
   - `Product` → `image` (can be array)
3. Twitter Cards
   - `twitter:image`
4. Product-specific selectors
   - `[itemprop="image"]`
   - `.product-image`, `#product-image`
   - Gallery first image
5. Image quality heuristics
   - Prefer larger dimensions
   - Prefer images in product containers
   - Avoid logos/icons (detect by size/name patterns)

**Test cases:**
- Sites with image galleries (multiple views)
- Sites with zoom/hi-res images
- Sites with lazy-loaded images
- Sites with placeholder images that load later

### 2.3 Title/Description Strategies

**Title sources (priority order):**
1. `og:title`
2. Schema.org JSON-LD `Product` → `name`
3. `<title>` tag (cleaned of site name suffix)
4. `<h1>` tag
5. `[itemprop="name"]`

**Description sources:**
1. `og:description`
2. Schema.org JSON-LD `Product` → `description`
3. `meta[name="description"]`
4. Product description containers

**Cleaning strategies:**
- Remove site name suffixes (` | Amazon.com`, ` - Best Buy`)
- Strip HTML entities
- Truncate to reasonable length
- Remove promotional text ("FREE SHIPPING!")

### 2.4 Additional Metadata

**Availability:**
- Schema.org `offers` → `availability`
- Stock status selectors
- "Add to cart" button state

**Brand:**
- Schema.org `brand` → `name`
- `og:brand`
- Brand selectors in HTML

**Variants:**
- Color/size options
- Price ranges for variants
- SKU numbers

---

## Phase 3: Technical Architecture

### 3.1 Approaches to Evaluate

**Option A: Client-Side Enhancement**
- Use Microlink as base
- Add client-side scraping for missing data
- Issues: CORS, CSP blocking, limited by browser security

**Option B: Serverless Proxy**
- Cloudflare Worker / Vercel Edge Function
- Fetch page HTML server-side (bypasses CORS)
- Extract data using metascraper + custom rules
- Return JSON to client

**Option C: Hybrid Approach**
- Try Microlink first (fast, handles most cases)
- Fall back to custom scraper for failures
- Cache results to avoid re-fetching

**Option D: Browser Automation**
- Use Puppeteer/Playwright for JS-heavy sites
- More expensive but handles dynamic content
- Could be serverless (Vercel, Browserless.io)

### 3.2 Recommended Architecture (Based on Findings)

```
User submits URL
    ↓
[Client] Validate URL
    ↓
[Client] Call metadata extraction API
    ↓
[Serverless Function]
    ├─→ Try Microlink API (fast path)
    ├─→ Fetch HTML directly (CORS-free)
    ├─→ Parse with custom extractors
    │   ├─→ JSON-LD extractor
    │   ├─→ Open Graph extractor
    │   ├─→ Microdata extractor
    │   ├─→ HTML selector fallbacks
    │   └─→ Heuristic ranking (choose best image/title)
    └─→ Return merged/best results
    ↓
[Client] Display preview & save to Jazz
```

### 3.3 Technology Choices

**Parsing Library Options:**
- `cheerio` - Fast, jQuery-like HTML parsing
- `metascraper` + plugins - Pre-built extractors
- `linkedom` - Lightweight DOM implementation
- Custom regex (for specific patterns)

**Hosting Options:**
- Cloudflare Workers (free tier: 100k requests/day)
- Vercel Edge Functions (free tier: 100k requests/month)
- AWS Lambda (more complex, but flexible)
- Self-hosted (most control, most maintenance)

**Caching Strategy:**
- Cache successful extractions (1 week?)
- Don't cache failures (might be transient)
- Use URL as cache key
- Consider Cloudflare KV or Vercel Edge Config

---

## Phase 4: Implementation Plan

### 4.1 Build Test Suite
```typescript
// tests/metadata.test.ts
describe('Metadata Extraction', () => {
  testCases.forEach(({ url, expected, issues }) => {
    it(`should extract from ${url}`, async () => {
      const result = await extractMetadata(url);
      expect(result.title).toBe(expected.title);
      expect(result.price).toBeDefined();
      expect(result.imageUrl).toContain('product');
      // etc...
    });
  });
});
```

### 4.2 Iterative Development
1. Start with Microlink baseline
2. Add JSON-LD extraction
3. Add Open Graph improvements
4. Add HTML fallback selectors
5. Add image quality ranking
6. Add price extraction
7. Add brand/availability extraction

### 4.3 Success Metrics
- **Coverage:** % of test URLs with complete data
- **Accuracy:** % of extracted data matching expectations
- **Performance:** < 2s average extraction time
- **Reliability:** < 5% error rate across test suite

---

## Phase 5: Testing & Iteration

### 5.1 Test Collection Tool

Build a simple UI to:
1. Paste URL
2. See Microlink results
3. See custom extractor results
4. See actual page preview
5. Mark expected values
6. Save as test case

### 5.2 Continuous Testing
- Run test suite on every change
- Track regression
- Update extractors as sites change
- Community contributions (crowd-source problematic URLs)

---

## Open Questions

1. **How to handle sites that require JavaScript?**
   - Start without, add browser automation later if needed
   - Most metadata is in static HTML for SEO

2. **How to handle geo-restricted content?**
   - Use proxy service?
   - Accept regional differences?
   - Let user manually edit?

3. **How to handle rate limiting?**
   - Respect robots.txt
   - Implement exponential backoff
   - Cache aggressively
   - Rotate user agents (carefully)

4. **How to handle authentication-required pages?**
   - Can't scrape these automatically
   - Provide manual entry option
   - Show clear error message

5. **What's our caching strategy?**
   - Cache successful results for 1 week?
   - Allow manual refresh?
   - How to invalidate stale data?

6. **Should we extract additional data?**
   - Reviews/ratings
   - Shipping info
   - Return policy
   - Related products

---

## Next Steps

1. **Start collecting test URLs** - Add 20-30 diverse product links
2. **Run Microlink baseline tests** - Document current behavior
3. **Categorize failures** - Group by issue type
4. **Prototype serverless scraper** - Simple Cloudflare Worker
5. **Implement top 3 extractors** - JSON-LD, OG, HTML fallback
6. **Compare results** - Measure improvement over baseline
7. **Iterate** - Add extractors for remaining issues

---

## Resources

- [Microlink API Docs](https://microlink.io/docs/api/getting-started/overview)
- [metascraper GitHub](https://github.com/microlinkhq/metascraper)
- [metascraper-shopping plugin](https://github.com/samirrayani/metascraper-shopping)
- [Schema.org Product](https://schema.org/Product)
- [Open Graph Protocol](https://ogp.me/)
- [Twitter Cards](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/markup)
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)
