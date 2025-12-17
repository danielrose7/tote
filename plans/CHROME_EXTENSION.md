# Chrome Extension Plan for Tote

## Status: Phase 2 Integration Complete ✓

### Phase 1: MVP - COMPLETE ✓
All extraction, UI, and end-to-end integration working:
- ✓ Extension scaffolding with Vite + CRXJS + TypeScript + React
- ✓ Metadata extraction (JSON-LD, Open Graph, price, currency, platform detection)
- ✓ Popup UI with preview, collection selector, save button
- ✓ Content script messaging
- ✓ `POST /api/links/add` endpoint with CORS
- ✓ `chrome.storage.local` integration for auth token
- ✓ End-to-end testing verified on Under Armour (title, description, image, price, currency all extracted)

### Phase 2: API Integration - IN PROGRESS
- ✓ Save button wired to API endpoint
- ✓ Auth token auto-generation in extension
- ✓ Full payload sent to `/api/links/add` with all metadata
- ⏳ **NEXT**: Connect endpoint to Jazz database (Phase 2b)
- ⏳ **NEXT**: Build token generation UI at `/auth/extension` (Phase 2)
- ⏳ **NEXT**: Fetch real collections from Jazz (Phase 2)

### Phase 3: Enhanced Features - PLANNED
- Keyboard shortcuts (Cmd+Shift+T for quick save)
- Right-click context menu
- Badge counter
- Offline queue support

---

## Overview

Build a Chrome extension that allows users to save products to their Tote collections directly from any webpage.

---

## Phase 1: MVP - Add Current Page to Collection

### Goal
One-click saving of the current page to a Tote collection with extracted metadata.

### Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Content Script  │────▶│ Background/SW    │────▶│ Popup UI        │
│ (extracts meta) │     │ (manages state)  │     │ (collection UI) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │ Tote API         │
                        │ POST /api/links  │
                        └──────────────────┘
```

### Extension Structure

```
chrome-extension/
├── manifest.json           # Manifest V3
├── src/
│   ├── content/
│   │   └── extractor.ts    # Runs on page, extracts metadata
│   ├── background/
│   │   └── service-worker.ts
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.tsx       # React popup UI
│   │   └── popup.css
│   └── lib/
│       ├── extractors/     # Reuse from app/lib/extractors
│       │   ├── json-ld.ts
│       │   ├── open-graph.ts
│       │   ├── price.ts
│       │   └── types.ts
│       └── api.ts          # API client
├── assets/
│   └── icons/              # Extension icons
└── build/                  # Bundled output
```

### Content Script (extractor.ts)

Reuse extraction logic from existing codebase:
- `app/lib/extractors/json-ld.ts` - works as-is (pure regex)
- `app/lib/extractors/open-graph.ts` - adapt for DOM queries
- `app/lib/extractors/price.ts` - works as-is (pure regex)
- `app/lib/extractors/shopify.ts` - adapt for DOM detection

**Key advantage**: Content script runs IN the page context, so:
- No CORS issues
- Can access rendered DOM (solves JS-rendered content)
- Can see age-gate modals and interact with them
- Bypasses bot detection (it's a real browser)

### Popup UI

Simple React popup:
1. Show extracted metadata preview (title, image, price)
2. Collection dropdown (fetched from Tote API)
3. "Save to Tote" button
4. Success/error states

### New API Endpoint

**POST /api/links/add**

```typescript
// Request
{
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  price?: string;
  collectionId: string;
  authToken: string;  // Phase 2
}

// Response
{
  success: boolean;
  linkId?: string;
  error?: string;
}
```

### Implementation Tasks (Phase 1)

1. [ ] Create extension scaffolding with Manifest V3
2. [ ] Port extraction logic to content script
3. [ ] Build popup UI with React
4. [ ] Create POST /api/links/add endpoint
5. [ ] Implement chrome.storage for session management
6. [ ] Add extension icons and branding
7. [ ] Test on problem sites (Roselosangeles, Target, etc.)

---

## Phase 2: Authentication

### Challenge

Jazz uses passkey authentication which doesn't work in extension context. Need a bridge.

### Options Considered

| Approach | Pros | Cons |
|----------|------|------|
| **Clerk.js** | Full-featured, extension support, multiple auth methods | External dependency, monthly cost |
| **Custom token flow** | Simple, no new deps | Need to build token management |
| **OAuth via web app** | Works with existing Jazz | Clunky UX (redirect flow) |

### Recommended: Custom Token Flow

1. User logs into tote.tools (existing passkey auth)
2. Web app generates a long-lived API token stored in Jazz
3. Extension redirects to tote.tools/auth/extension
4. Web app stores token in chrome.storage.sync
5. Extension uses token for all API calls

**Schema Addition:**
```typescript
AccountRoot = {
  // ... existing
  apiTokens: co.list(ApiToken);  // Extension tokens
}

ApiToken = co.map({
  token: co.string;
  name: co.string;      // "Chrome Extension"
  createdAt: co.date;
  lastUsedAt: co.date;
});
```

**New Pages/Endpoints:**
- `/auth/extension` - Token generation page
- `POST /api/auth/verify-token` - Validate token on API calls

### Future: Clerk.js Integration

If Clerk is added later (already in roadmap), extension auth becomes simpler:
- Clerk handles OAuth, magic links, passkeys
- Extension uses Clerk's browser SDK
- Session sharing via chrome.storage.sync

---

## Phase 3: Enhanced Features (Future)

### Quick Save (No Popup)
- Keyboard shortcut (Cmd+Shift+T)
- Saves to default collection instantly
- Shows browser notification

### Right-Click Context Menu
- "Save to Tote" on any link/image
- Collection submenu

### Badge Counter
- Show number of items in current collection
- Visual indicator when page is already saved

### Offline Support
- Queue saves when offline
- Sync when connection restored

---

## Technical Decisions

### Build Tool
Use **Vite** with CRXJS plugin for:
- TypeScript support
- React JSX
- Hot reload during development
- Manifest V3 compatibility

### State Management
- `chrome.storage.sync` for auth tokens (synced across devices)
- `chrome.storage.local` for cached collections
- React state for popup UI

### Reusable Code
~70-80% of extraction logic can be reused from:
- `/app/lib/extractors/*.ts` - Core extraction
- `/app/lib/extractors/types.ts` - TypeScript interfaces

---

## Files to Create/Modify

### New Files (Extension)
- `chrome-extension/manifest.json`
- `chrome-extension/src/content/extractor.ts`
- `chrome-extension/src/background/service-worker.ts`
- `chrome-extension/src/popup/*`
- `chrome-extension/src/lib/extractors/*` (ported)
- `chrome-extension/vite.config.ts`
- `chrome-extension/package.json`

### New Files (API)
- `app/api/links/add/route.ts` - Save link endpoint
- `app/api/auth/verify-token/route.ts` - Token validation (Phase 2)
- `app/auth/extension/page.tsx` - Token generation UI (Phase 2)

### Modified Files
- `src/schema.ts` - Add ApiToken schema (Phase 2)
- `PLAN.md` - Update with extension progress

---

## Decisions Made

1. **Bundle extractors** - Extraction runs in content script
   - Faster, works offline
   - Bypasses bot detection (runs in real browser context)
   - Can handle JS-rendered content and age gates

2. **Skip auth for prototype** - Phase 1 is local testing only
   - Build extraction + popup UI without auth
   - Use hardcoded/mock collection data for testing
   - Add real auth in Phase 2 before public release

---

## Phase 1 Implementation Steps

### Step 1: Extension Scaffolding
- Create `chrome-extension/` directory
- Set up Vite + CRXJS for Manifest V3
- Configure TypeScript, React
- Add extension icons

### Step 2: Port Extractors
Copy and adapt from `app/lib/extractors/`:
- `types.ts` - use as-is
- `json-ld.ts` - use as-is (pure regex)
- `open-graph.ts` - convert regex to DOM queries
- `price.ts` - use as-is (pure regex)
- `shopify.ts` - adapt detection for DOM

### Step 3: Content Script
- Inject into all pages
- Extract metadata on demand (message from popup)
- Return extracted data via chrome.runtime.sendMessage

### Step 4: Popup UI
- React component showing:
  - Page title + image preview
  - Extracted price (if found)
  - Collection dropdown (mock data for now)
  - "Save" button (logs to console for testing)
- Style to match Tote branding

### Step 5: Test on Problem Sites
Validate extraction works on:
- Roselosangeles (age gate)
- Target (JS-rendered)
- Bedbathandbeyond (JS-rendered)
- Amazon (bot detection bypass)

### Step 6: Wire Up Save (Placeholder)
- Console.log the save payload
- Prepare for Phase 2 API integration

---

## Phase 2b: Jazz Database Integration (NEXT TO DO)

### Goal
Connect the `/api/links/add` endpoint to Jazz so links are actually persisted to the database.

### Current State
- Endpoint exists at `/app/api/links/add/route.ts`
- Currently just validates input and returns mock success
- Full metadata arrives: url, title, description, imageUrl, price, currency
- Auth token included (but not yet validated)

### Implementation Steps

#### Step 1: Update Jazz Schema
**File**: `src/schema.ts`
- Add `Link` type/schema to store individual links
- Add `links: co.list(Link)` field to `AccountRoot`
- Fields: `url`, `title`, `description`, `imageUrl`, `price`, `currency`, `collectionId`, `createdAt`

#### Step 2: Implement Token Validation
**File**: `app/api/links/add/route.ts`
- Replace placeholder token check with real Jazz query
- Query AccountRoot for matching apiToken
- Return 401 if token invalid/expired
- Extract accountId from token for saving

#### Step 3: Implement Link Creation
**File**: `app/api/links/add/route.ts`
- Use Jazz to create Link document
- Associate with account + collection
- Return linkId from created document

#### Step 4: Test Integration
- Build extension: `pnpm build` (from chrome-extension/)
- Reload in chrome://extensions
- Save from a product page
- Verify link appears in Tote account collections (use Jazz dev tools)

---

## Phase 2: Token Generation UI (AFTER 2b)

### Goal
Allow authenticated users to generate API tokens for extension use.

### Implementation Steps

#### Step 1: Create `/auth/extension` Page
**File**: `app/auth/extension/page.tsx`
- Protected page (requires passkey login)
- Shows "Generate Extension Token" button
- Displays generated token (only once)
- Lists previously generated tokens with last-used dates

#### Step 2: Add Token Generation Endpoint
**File**: `app/api/auth/generate-token/route.ts`
- POST endpoint for creating new api tokens
- Stores in Jazz apiTokens list
- Returns token string

#### Step 3: Build Token Management UI
- Show existing tokens
- Ability to revoke tokens
- Auto-revoke if unused for 90 days

#### Step 4: Update Extension UI
**File**: `chrome-extension/src/popup/popup.tsx`
- Replace auto-generated test token with real token input
- Add "Get Token" button that opens `/auth/extension`
- Store provided token in chrome.storage.local

---

## Phase 3: Real Collections (AFTER PHASE 2)

### Goal
Fetch actual user collections from Jazz instead of using mock data.

### Files to Modify
- **Extension**: `chrome-extension/src/popup/popup.tsx`
- **API**: `app/api/collections/list/route.ts` (new endpoint)

### Implementation
1. Create `GET /api/collections` endpoint that returns user's collections
2. Popup fetches collections on load using auth token
3. Replace mock collection array with API response
4. Cache in chrome.storage.local with timestamp

---

## Quick Resume Guide

### To continue Phase 2b (Jazz Integration):
```bash
cd /Users/dan/personal/tote

# 1. Update schema.ts with Link type and links field
# 2. Implement token validation in app/api/links/add/route.ts
# 3. Implement link creation in same file
# 4. Test with: pnpm dev (main app) + extension loaded

# Rebuild extension if code changes
cd chrome-extension && pnpm build
```

### Key Files to Know
- **Schema**: `src/schema.ts` - Add Link type
- **API Endpoint**: `app/api/links/add/route.ts` - Main implementation
- **Jazz Docs**: Reference Jazz co.* for type definitions
- **Test**: Save from extension, check Jazz dev tools for persisted links

### Current Working State
- Extension fully builds and runs
- All extraction working (price, currency, description, images)
- Auth token auto-generated and stored
- API endpoint receiving full payload with CORS working
- Test token: `ext_test_*` format (auto-generated on extension install)

### Debug Commands
```bash
# Watch extension changes (from chrome-extension/)
pnpm dev

# Rebuild after changes
pnpm build

# Run tests to validate extraction still works
pnpm test:run

# Check API logs while testing
cd ../tote && pnpm dev  # Watch [Extension Save] logs
```

### Common Testing Sites
- https://www.underarmour.com/ (verified working)
- https://www.target.com/
- https://www.bedbathandbeyond.com/
- https://roselosangeles.com/
