# Tote Chrome Extension - Development Guide

**See [../PRODUCT.md](../PRODUCT.md) for product principles and values.**

Quick reference for common development tasks.

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server with hot reload
pnpm dev

# Build for production
pnpm build

# Build + zip for Chrome Web Store submission
pnpm build:zip
```

## Testing

Comprehensive test suite using Vitest + jsdom for DOM extraction testing.

```bash
# Run tests in watch mode
pnpm test

# Run tests once
pnpm test:run
```

**Test Coverage:**

- Price extraction (26 test cases)
  - Multiple formats: `$29.99`, `€1.234,56`, `£29,99`
  - Data attributes: `data-price`, `itemprop="price"`
  - Button/container detection
- Currency detection (USD, EUR, GBP, JPY, INR, KRW, AUD, CAD, SEK, CHF)
- DOM extraction (Open Graph, JSON-LD, platform detection)
- Real-world cases (Rose LA, Target, Bed Bath & Beyond)

**Key test files:**

- `src/lib/extractors/index.test.ts` - All extraction logic tests

## Project Structure

```
chrome-extension/
├── manifest.json           # Manifest V3 configuration
├── src/
│   ├── content/
│   │   └── extractor.ts    # Content script (runs on every page)
│   ├── background/
│   │   └── service-worker.ts
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.tsx       # Root popup component + error boundary
│   │   ├── SaveUI.tsx      # Save flow UI (collection picker, save button)
│   │   └── popup.css
│   ├── lib/
│   │   ├── captureApi.ts   # API client — fetchCaptureCollections, submitCapture, createCollection
│   │   ├── captureStore.ts # Local IndexedDB cache + outbox for offline queuing
│   │   ├── extractors/
│   │   │   ├── index.ts    # Main extraction orchestrator
│   │   │   ├── index.test.ts
│   │   │   └── types.ts
│   │   └── config.ts       # APP_URL and other constants
│   └── providers/
│       └── ExtensionProviders.tsx  # ClerkProvider wrapper
├── assets/icons/           # Extension icons
└── dist/                   # Built output (load this in chrome://extensions/)
```

## Architecture

The extension uses Clerk for auth and talks directly to the Tote API — no local database or Jazz sync.

1. **Authentication**: `@clerk/chrome-extension` — `getToken()` provides a JWT for API requests
2. **Collections**: fetched from `/api/v2/collections` on popup open, cached in IndexedDB
3. **Saving**: `POST /api/v2/capture` with extracted metadata + target collection ID
4. **Offline**: captures queue in an IndexedDB outbox (`captureStore.ts`) and flush on next open

## Loading the Extension

1. Run `pnpm build`
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `dist/` folder
6. Reload after making changes

## Debugging

**Console Logs:**

- Content script: `Inspect element` → Console tab on any page
- Popup: Right-click extension icon → "Inspect popup"
- Background worker: `chrome://extensions/` → "Service Worker" link

**Test Cases:**
Problem sites that were originally failing:

- https://roselosangeles.com/products/high-energy-delights (age gate, JS-rendered)
- https://www.target.com/p/o-cedar-easywring-spin-mop-and-bucket-system/-/A-50335649 (JS-rendered)
- https://www.bedbathandbeyond.com/Home-Garden/Kate-and-Laurel-Kato-Floating-Side-Table/37666070/product.html (data-price attribute)

## Key Files to Know

- **Extraction Logic**: `src/lib/extractors/index.ts`
  - `extractMetadata()` - Main entry point for DOM extraction
  - `extractPriceFromDOM()` - Handles price extraction from multiple patterns
  - `extractJsonLd()` - JSON-LD schema parsing
  - `extractOpenGraph()` - Meta tag extraction

- **Content Script**: `src/content/extractor.ts`
  - Listens for messages from popup via Chrome messaging API
  - Runs `extractMetadata()` on current page DOM

- **API Client**: `src/lib/captureApi.ts`
  - `fetchCaptureCollections()` - list user's collections
  - `submitCapture()` - save a product to a collection
  - `createCollection()` - create a new collection

## Extraction Logic — Keep Two Files in Sync

Any fix to `src/lib/extractors/index.ts` must also be applied to `../mobile-app/src/lib/extractorScript.ts`. See the root `CLAUDE.md` for details.

## Common Issues

**Tests failing after code change:**

- Run `pnpm test:run` to see all failures at once
- Remember: European price format `1.234,56` (dot=thousand, comma=decimal)

**Extension not updating:**

- Rebuild: `pnpm build`
- Reload in `chrome://extensions/` (reload button next to extension)
- Hard refresh the test page (Cmd+Shift+R)

**"Cannot find module" errors:**

- Run `pnpm install`
- Check path aliases in `tsconfig.json` match vite config
