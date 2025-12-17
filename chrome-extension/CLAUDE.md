# Tote Chrome Extension - Development Guide

Quick reference for common development tasks.

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server with hot reload
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Testing

Comprehensive test suite using Vitest + jsdom for DOM extraction testing.

```bash
# Run tests in watch mode (re-run on file changes)
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
│   │   ├── popup.tsx       # React popup UI
│   │   └── popup.css
│   └── lib/
│       └── extractors/
│           ├── index.ts    # Main extraction orchestrator
│           ├── index.test.ts
│           └── types.ts
├── assets/icons/           # Extension icons
└── dist/                   # Built output (load this in chrome://extensions/)
```

## Loading the Extension

1. Run `pnpm build`
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select `/Users/dan/personal/tote/chrome-extension/dist`
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
  - Listens for messages from popup
  - Runs `extractMetadata()` on current page
  - Returns results via Chrome messaging API

- **Popup UI**: `src/popup/popup.tsx`
  - React component displaying extracted metadata
  - Shows preview with title, image, price
  - Collection selector (mock data for now)

## End-to-End Testing (Phase 2 Integration)

Extension now saves links to `POST /api/links/add` endpoint.

### Prerequisites
1. Main Tote app running: `cd /Users/dan/personal/tote && pnpm dev` (port 3000)
2. Extension built: `pnpm build`
3. Extension loaded in `chrome://extensions/` (unpacked from `dist/`)

### Manual Test Flow
1. Visit a product page (e.g., https://www.target.com/p/o-cedar-easywring-spin-mop-and-bucket-system/-/A-50335649)
2. Click extension icon → popup opens with extracted metadata
3. Select collection from dropdown
4. Click "Save to Tote"
5. Watch for:
   - Loading spinner while saving
   - Success message + green checkmark
   - Check browser console for API logs

### API Endpoint Details
- **URL**: `POST http://localhost:3000/api/links/add`
- **Required fields**: `url`, `collectionId`, `authToken`
- **Optional fields**: `title`, `description`, `imageUrl`, `price`, `currency`
- **CORS**: Enabled for extension requests
- **Response**: `{ success: true, linkId, received: {...} }`

### Debug Tips
- **Check token**: Open DevTools → Application → Storage → Local Storage → look for `authToken` key
- **Check API logs**: Watch terminal output from `pnpm dev` for `[Extension Save]` logs
- **Network tab**: Check XHR request to `/api/links/add` with full payload

## Next Steps

- **Phase 2b**: Connect endpoint to Jazz database (actual saving)
- **Phase 2**: Add token generation UI (`/auth/extension` page on web app)
- **Phase 3**: Enhanced features (keyboard shortcuts, right-click menu, badge counter)

## Common Issues

**Tests failing after code change:**
- Ensure you're running `pnpm test:run` to see all failures at once
- Test DOM setup with `setupDOM()` function
- Remember: European price format `1.234,56` (dot=thousand, comma=decimal)

**Extension not updating:**
- Rebuild: `pnpm build`
- Reload in `chrome://extensions/` (reload button next to extension)
- Hard refresh the test page (Cmd+Shift+R)

**"Cannot find module" errors:**
- Run `pnpm install` to ensure all deps are installed
- Check that path aliases in `tsconfig.json` match vite config
