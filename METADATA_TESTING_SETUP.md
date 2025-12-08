# Metadata Testing Setup - Complete! ✅

We've built a complete testing infrastructure for iteratively improving metadata extraction for Tote.

---

## 🎯 What We Built

### 1. **In-App Metadata Test Lab**
**Location:** `http://localhost:3000/dev/metadata-test`

A full-featured testing UI where you can:
- ✅ Test any product URL with current Microlink extraction
- ✅ Document expected values (what should be extracted)
- ✅ Tag issues and rate severity
- ✅ Re-test URLs after making changes to extraction logic
- ✅ Save test cases to file for version control
- ✅ Import/export test cases as JSON

**Key Features:**
- **Persistent storage** - Saves to `tests/metadata-test-cases.json`
- **Auto-backup** - Also saves to localStorage
- **Iterative testing** - Re-run tests after code changes
- **Visual comparison** - See Microlink results vs expected side-by-side

### 2. **Documentation & Guides**

**`METADATA_INVESTIGATION.md`** - Master plan covering:
- Problem collection strategy (prioritizing indie sites)
- Extraction strategies (JSON-LD, OG tags, HTML fallbacks)
- Technical architecture options
- Implementation roadmap

**`tests/FINDING_INDIE_SITES.md`** - How to find test URLs:
- Detecting Shopify themes (Dawn, Debut, Brooklyn, etc.)
- Detecting Squarespace templates (Bedford, Brine, etc.)
- Where to find indie sites (Instagram, Reddit, Google tricks)
- Platform/theme identification methods

**`tests/PLATFORM_METADATA_PATTERNS.md`** - Extraction reference:
- Shopify metadata structure (Product JSON, JSON-LD, OG tags)
- Squarespace patterns by template
- Big Cartel, Gumroad, Ko-fi, Wix, Webflow patterns
- Priority matrix for each platform
- Common HTML selectors and extraction strategies

### 3. **Test Infrastructure**

**`tests/metadata-test-cases.json`** - Structured test case storage
- Version-controlled test cases
- Categorized by platform/priority
- Tracks failure modes

**`tests/metadata-test-schema.json`** - JSON schema for validation

**`app/api/dev/test-cases/route.ts`** - API for file persistence
- GET: Load test cases from file
- POST: Save test cases to file

---

## 🚀 How to Use

### Quick Start

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open the Test Lab:**
   ```
   http://localhost:3000/dev/metadata-test
   ```

3. **Add your first test case:**
   - Find a Shopify indie store (see finding guide)
   - Paste product URL
   - Enter site name and category
   - Click "Test URL"
   - Fill in expected values
   - Tag issues
   - Click "💾 Save to File"

### Iterative Development Workflow

```
1. Collect 20-30 test cases
   ↓
2. Identify common patterns/failures
   ↓
3. Build custom extraction logic
   ↓
4. Re-test all cases (click "🔄 Re-test")
   ↓
5. Measure improvement
   ↓
6. Repeat!
```

---

## 📋 Test Collection Goals

### Priority Distribution

**High Priority (60%):**
- Shopify indie stores - 10+ different themes
- Squarespace indie stores - 5+ templates
- Other indie platforms (Big Cartel, Gumroad, Ko-fi, Wix, Webflow)

**Why?** These are your core users and have the most variable metadata quality.

**Medium Priority (30%):**
- DTC brands with custom sites
- Fashion/apparel sites
- Niche e-commerce

**Low Priority (10%):**
- Major platforms (Amazon, eBay) - baseline comparison
- Edge cases (crowdfunding, pre-orders)

### Target: 30-50 Diverse Test Cases

Each test case should document:
- ✅ Platform/theme used
- ✅ What Microlink extracted
- ✅ What should be extracted
- ✅ Issues found
- ✅ Severity rating
- ✅ Notes on patterns

---

## 🔧 Next Steps

### 1. Start Collecting Test Cases
Use the Test Lab to build your test suite:
- Find indie Shopify/Squarespace stores
- Test product URLs
- Document expected results
- Save to file

### 2. Analyze Patterns
After 10-15 test cases, look for:
- Which platforms never extract price?
- Which return logos instead of product images?
- Common JSON-LD structures?
- Platform-specific extraction opportunities?

### 3. Build Custom Extractors
Based on patterns, create:
- Shopify Product JSON extractor (`/products/{handle}.js`)
- JSON-LD parser with e-commerce focus
- Platform-specific fallback strategies
- Image quality heuristics

### 4. Create Serverless Scraper
Options:
- **Cloudflare Worker** (100k requests/day free)
- **Vercel Edge Function** (100k requests/month free)
- **AWS Lambda** (more complex)

Why serverless?
- Bypasses CORS/CSP (server-side fetch)
- Fast and cheap
- Easy to deploy

### 5. Implement Hybrid Approach

```
User submits URL
    ↓
Try Microlink (fast, works for 60-80% of sites)
    ↓
If missing data → Call custom scraper
    ↓
Merge results → Return best data
```

---

## 📁 File Structure

```
app/
├── dev/
│   └── metadata-test/           # Test Lab UI
│       ├── page.tsx             # Main component
│       ├── MetadataTestPage.module.css
│       └── README.md            # Usage guide
├── api/
│   └── dev/
│       └── test-cases/
│           └── route.ts         # File persistence API

tests/
├── metadata-test-cases.json     # Saved test cases (version controlled)
├── metadata-test-schema.json    # JSON schema
├── FINDING_INDIE_SITES.md       # How to find test URLs
└── PLATFORM_METADATA_PATTERNS.md # Extraction strategies

METADATA_INVESTIGATION.md         # Master investigation plan
METADATA_TESTING_SETUP.md         # This file
```

---

## 🎓 Learning Resources

### Understanding Metadata Standards

**Open Graph Protocol:**
- https://ogp.me/
- Standard for social sharing metadata
- `og:title`, `og:image`, `og:price:amount`

**Schema.org Product:**
- https://schema.org/Product
- JSON-LD structured data
- E-commerce focused

**Twitter Cards:**
- https://developer.twitter.com/en/docs/twitter-for-websites/cards
- Similar to Open Graph

### Platform Documentation

**Shopify:**
- Product JSON: `GET /products/{handle}.js`
- Theme liquid documentation

**Squarespace:**
- Template system documentation
- Commerce API (limited)

---

## 💡 Key Insights

### Why Indie Sites Matter
- Often built by non-technical owners
- Templates not always configured correctly
- Most variable metadata quality
- Likely your core user base
- Biggest opportunity for improvement

### CORS/CSP Challenges
- Can't scrape from client-side (browser security)
- Iframe approach fails (CSP blocks)
- Need serverless proxy for custom extraction
- Microlink works because it's a proxy service

### Extraction Priority
For each platform, try in order:
1. **Platform-specific APIs** (Shopify product JSON)
2. **JSON-LD** (schema.org Product)
3. **Open Graph tags**
4. **HTML selectors** (fallback)

### Test-Driven Approach
- Collect real test cases first
- Build extraction based on patterns
- Measure improvement
- Iterate based on failures

---

## 🎉 What's Ready Now

✅ **Test Lab UI** - Ready to use at `/dev/metadata-test`
✅ **File persistence** - Saves to version-controlled JSON
✅ **Documentation** - Complete guides for testing & patterns
✅ **Test infrastructure** - Schema, storage, API

**Next:** Start collecting test cases and analyzing patterns!

---

## Questions?

See individual README files in each directory for more details:
- `app/dev/metadata-test/README.md` - Test Lab usage
- `tests/FINDING_INDIE_SITES.md` - Finding test URLs
- `tests/PLATFORM_METADATA_PATTERNS.md` - Extraction patterns
- `METADATA_INVESTIGATION.md` - Overall plan
