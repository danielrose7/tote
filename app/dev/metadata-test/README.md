# Metadata Test Lab

A dev-only tool for testing and documenting metadata extraction from product URLs.

## How to Access

```bash
npm run dev
```

Then visit: **http://localhost:3000/dev/metadata-test**

## Features

### 🧪 Test URLs
- Paste any product URL
- Automatically fetch metadata using Microlink
- See what data is extracted vs what should be extracted
- Track issues and severity

### 💾 Persistent Storage
- **Auto-save to localStorage** - Never lose your work (backup)
- **Save to File** - Writes test cases to `tests/metadata-test-cases.json`
- **Load from File** - Reload test cases from the JSON file
- **Export/Import** - Download/upload JSON for sharing

### 🔄 Iterative Testing
- Click **"Re-test"** on any test case to re-run metadata extraction
- Useful for testing improvements to extraction logic
- Compare before/after results

### 📊 Test Case Management
- View all test cases in sidebar
- Click to select and view details
- Edit expected values inline
- Tag common issues (no price, wrong image, etc.)
- Rate severity (critical, major, minor)
- Add notes for each test

## Workflow

### 1. Add Test Cases
1. Find a product URL (Shopify, Squarespace, etc.)
2. Paste URL and site name
3. Select category (prioritize indie sites!)
4. Add theme/template if known (e.g., "Dawn", "Bedford")
5. Click **"Test URL"**

### 2. Document Expected Values
1. Select the test case from sidebar
2. Fill in what the **correct** values should be:
   - Title (product name)
   - Description
   - Image URL (best product image)
   - Price (as displayed on site)
   - Currency
   - Brand
3. Tag any issues found
4. Rate severity

### 3. Save Progress
- Click **"💾 Save to File"** to persist to `tests/metadata-test-cases.json`
- This file is version-controlled and accessible to your code
- Use for building extraction tests and strategies

### 4. Re-test After Changes
When you improve metadata extraction:
1. Click **"🔄 Re-test"** on test cases
2. Compare new results to expected
3. Track improvements over time

## File Storage

### Where Test Cases Are Saved

**In-memory during session:**
- Changes tracked in React state

**Auto-saved to localStorage:**
- Backup on every change
- Survives page refresh
- Browser-specific

**Manually saved to file:**
- Click "💾 Save to File"
- Saves to: `tests/metadata-test-cases.json`
- Version-controlled with your code
- Accessible to build tests against

### Loading Priority

1. Try loading from `tests/metadata-test-cases.json` (via API)
2. Fallback to localStorage if API fails
3. Start empty if neither exists

## Use Cases

### Building Extraction Logic
1. Collect 30-50 diverse test URLs
2. Document what Microlink misses
3. Identify patterns (Shopify always has product JSON, etc.)
4. Build custom extractors for common failures
5. Test against saved test cases

### Comparing Extraction Methods
1. Save baseline results with Microlink
2. Implement custom extraction
3. Re-test all cases
4. Compare improvement rate

### Prioritizing Work
- Sort by severity (fix critical issues first)
- Group by category (all Shopify issues together)
- Track most common failure modes

## Tips

### Finding Good Test URLs
See: `tests/FINDING_INDIE_SITES.md` for tips on finding diverse indie sites

**Priority:**
- Shopify stores (10+ different themes)
- Squarespace stores (5+ templates)
- Big Cartel, Gumroad, Ko-fi
- Then major platforms (Amazon, Etsy)

### Documenting Patterns
See: `tests/PLATFORM_METADATA_PATTERNS.md` for extraction strategies

When testing, note:
- Which platform/theme
- What metadata sources exist (JSON-LD, OG tags, HTML)
- What's missing or wrong
- Any unique patterns

### Test Case Distribution

Aim for:
- 60% indie sites (Shopify, Squarespace, other)
- 30% mid-size/DTC brands
- 10% major platforms + edge cases

## API Endpoints

### GET `/api/dev/test-cases`
Load test cases from `tests/metadata-test-cases.json`

### POST `/api/dev/test-cases`
Save test cases to `tests/metadata-test-cases.json`

**Body:**
```json
{
  "testCases": [...]
}
```

## Keyboard Shortcuts

- `Enter` in URL field → Test URL
- Click test case in sidebar → View details

## Development

This tool is dev-only and should not be deployed to production. It helps with:

1. **Documentation** - Building test case library
2. **Testing** - Iterative testing of extraction logic
3. **Analysis** - Understanding metadata quality across platforms
4. **Planning** - Prioritizing extraction improvements

The saved JSON file can be used to:
- Build automated tests
- Generate extraction rules
- Track improvement metrics
- Share findings with team
