# Tote - Product Wishlist App

## Project Overview

**Tote** is a snazzy product link collection app built with Jazz (distributed database) and React. It helps users save, organize, and track products they want to remember with rich metadata, visual displays, and budget planning features.

**Live URL:** https://tote.tools
**Tech Stack:** React, TypeScript, Jazz (distributed DB), Vite, CSS Modules, Radix UI

---

## Core Concept

A personal, visual product wishlist with:
- Rich metadata extraction (Open Graph/Twitter Cards)
- Beautiful product cards with images
- Collections and organization
- Budget planning and savings calculators
- Multiple view modes (grid, masonry, table, kanban)
- Real-time sync across devices via Jazz

---

## Design Principles

1. **Visual First** - Beautiful product cards with prominent images
2. **Loose Data Structure** - Jazz CoValues instead of rigid SQL schema
3. **Personal & Private** - User's own collection, not social
4. **No Tailwind** - CSS Modules for styling
5. **Radix UI Components** - For accessible, unstyled primitives
6. **Real-time Sync** - Jazz handles all synchronization

---

## Current Status

### ✅ Completed Features

#### Phase 1: Enhanced Product Cards (COMPLETE)
- Beautiful card design with visual hierarchy
- Smooth hover animations and transitions
- Image loading states with shimmer skeletons
- Prominent price display as overlay badge
- Tags/labels system
- Quick action buttons (edit/delete) on hover
- Fully responsive for mobile devices
- Proper error handling for broken images

#### Phase 3: Edit & Delete Functionality (COMPLETE)
- **Delete Confirmation Dialog**
  - Radix AlertDialog component
  - Prevents accidental deletions
  - Smooth modal animations

- **Edit Link Dialog**
  - Edit title, description, price, tags, notes
  - Form validation
  - Real-time updates with Jazz
  - URL displayed for reference (non-editable)

- **Toast Notifications**
  - Success, error, and info variants
  - Slide-in animations from bottom-right
  - Auto-dismiss after 5 seconds
  - Swipe-to-dismiss support
  - Color-coded by type

### 🚧 Current Architecture

#### Schema (src/schema.ts)
```typescript
ProductLink = {
  url: string
  title?: string
  description?: string
  imageUrl?: string
  price?: string
  addedAt: Date
  notes?: string
  tags?: string[]
}

AccountRoot = {
  links: CoList<ProductLink>
}
```

#### Key Components
- `ProductCard` - Enhanced visual card with actions
- `ProductGrid` - Grid layout for cards
- `CollectionCard` - Visual card for collections with link count
- `CollectionView` - Collection detail view with links grid
- `AddLinkDialog` - Fetch metadata and add links (Formik + Yup validation)
- `EditLinkDialog` - Edit existing links (Formik + Yup validation)
- `CreateCollectionDialog` - Create new collections with color picker
- `EditCollectionDialog` - Edit collection details and set default
- `DeleteConfirmDialog` - Confirm deletions
- `ToastProvider` - Toast notification system
- `OfflineBanner` - Sticky banner showing offline status
- `Header` - App header (removed online/offline indicator)
- `AuthButton` - Jazz authentication

#### Utilities
- `metadata.ts` - Microlink API integration for fetching Open Graph/Twitter Card data
- `metadataExtractor.ts` - Helper functions for URL parsing and validation

#### Hooks
- `useOnlineStatus` - Detects online/offline state
- `useToast` - Toast notification context hook

---

## MVP Roadmap

### Phase 2: Collections System
**Status:** ✅ COMPLETE
**Priority:** High

**Schema Changes:**
```typescript
Collection = {
  name: string
  description?: string
  color?: string
  links: CoList<ProductLink>
  createdAt: Date
}

AccountRoot = {
  collections: CoList<Collection>
  defaultCollectionId?: string
}
```

**Completed Tasks:**
1. ✅ Updated schema to include Collections
2. ✅ Created CollectionList component (grid view)
3. ✅ Created CollectionCard component
4. ✅ Added "Create Collection" dialog with color picker
5. ✅ Added collection selector to AddLinkDialog (defaults to default collection)
6. ✅ Added ability to move links between collections (via edit dialog)
7. ✅ Created collection detail page with router
8. ✅ Added EditCollectionDialog with "Set as Default" functionality
9. ✅ Removed "uncollected links" - all links must belong to a collection
10. ✅ Added offline indicator banner

**Key Architectural Decisions:**
- Store `defaultCollectionId` as string instead of CoMap reference for stability
- Use Next.js App Router for collection detail pages
- Collections are required - no "uncollected" links
- Default collection is pre-selected when adding new links

---

### Phase 3.5: Metadata Extraction Improvement
**Status:** 🚧 IN PROGRESS
**Priority:** High

**Goal:** Build custom metadata extraction to improve data quality from indie e-commerce sites

**Context:**
- Current Microlink API works for ~60-80% of sites
- Indie sites (Shopify, Squarespace) often have poor/missing metadata
- Need to extract prices, better images, complete product info
- CORS/CSP blocks client-side scraping, need serverless approach

**Infrastructure Complete:**
1. ✅ Created `/dev/metadata-test` - In-app testing UI
2. ✅ Test case persistence to `tests/metadata-test-cases.json`
3. ✅ Localhost-only navigation via header menu
4. ✅ Documentation for finding indie sites and extraction patterns
5. ✅ API routes for loading/saving test cases

**Next Steps:**
1. Collect 30-50 test cases (prioritize indie Shopify/Squarespace)
2. Analyze patterns and common failure modes
3. Build serverless metadata scraper (Cloudflare Worker or Vercel Edge)
4. Implement hybrid approach: Microlink first, custom scraper fallback
5. Add platform-specific extractors (Shopify product JSON, JSON-LD, etc.)

**Key Files:**
- `METADATA_INVESTIGATION.md` - Master research plan
- `METADATA_TESTING_SETUP.md` - Infrastructure overview
- `tests/FINDING_INDIE_SITES.md` - How to find test URLs
- `tests/PLATFORM_METADATA_PATTERNS.md` - Extraction strategies
- `app/dev/metadata-test/` - Testing UI

**Target Improvement:**
- 80%+ sites with complete metadata (vs 60% baseline)
- Price extraction for e-commerce sites
- Better image selection (product vs logo)
- Platform-specific optimizations

**Estimated Complexity:** High (but infrastructure is ready!)

---

### Phase 3.6: Chrome Extension
**Status:** 🚧 IN PROGRESS (Phase 1 & 2 Integration COMPLETE)
**Priority:** High

**Goal:** Browser extension to save products directly from any webpage, bypassing bot detection and JS-rendering issues.

**Key Benefits:**
- Runs in real browser context (bypasses Cloudflare, bot detection)
- Access to fully rendered DOM (solves JS-rendered content)
- Can handle age gates and modals
- One-click saving from any product page

**Detailed Plan:** `./plans/CHROME_EXTENSION.md`

### ✅ Phase 1 - MVP (COMPLETE)
All extraction, UI, and end-to-end integration working:
- ✓ Extension scaffolding with Vite + CRXJS + TypeScript + React
- ✓ Metadata extraction (JSON-LD, Open Graph, price, currency, platform detection)
- ✓ Popup UI with preview, collection selector, save button
- ✓ Content script messaging with full DOM access
- ✓ Comprehensive test suite (26 tests, all passing)
- ✓ Tested on: Under Armour, Target, Bed Bath & Beyond, Rose LA
- ✓ Price extraction handles: European format (1.234,56), US format (1,234.56), data attributes

### 🚧 Phase 2 - API Integration (IN PROGRESS)
- ✓ `POST /api/links/add` endpoint with CORS
- ✓ Save button wired to API with full payload
- ✓ Auth token auto-generation in extension
- ✓ Verified end-to-end on Under Armour (all metadata flowing correctly)
- ⏳ **NEXT**: Connect endpoint to Jazz database (Phase 2b)
- ⏳ **NEXT**: Build token generation UI (`/auth/extension` page)
- ⏳ **NEXT**: Fetch real collections from Jazz

### 📋 Phase 3 - Enhanced Features (PLANNED)
- Keyboard shortcut (Cmd+Shift+T) for quick save
- Right-click context menu
- Badge counter showing saved status
- Offline queue support

**Files Created:**
- `chrome-extension/` - Full extension package
- `app/api/links/add/route.ts` - Save link endpoint (working, needs Jazz integration)
- `chrome-extension/src/lib/extractors/` - Ported extraction logic
- `chrome-extension/src/popup/popup.tsx` - React UI with API integration
- `chrome-extension/CLAUDE.md` - Development guide with testing instructions

**Next Steps for Continuation:**
1. **Phase 2b - Jazz Integration**: Connect `/api/links/add` to Jazz database
   - Update `src/schema.ts` to add Link type
   - Implement token validation against Jazz apiTokens
   - Create Link documents and associate with collections

2. **Phase 2 - Token UI**: Build token generation interface
   - Create `/auth/extension` page for logged-in users
   - Add `POST /api/auth/generate-token` endpoint
   - Update extension to use real tokens instead of auto-generated ones

3. **Phase 2 - Collections**: Fetch real collections from Jazz
   - Create `GET /api/collections/list` endpoint
   - Update popup to fetch and display user's collections

See `./plans/CHROME_EXTENSION.md` for detailed implementation steps and quick resume guide.

---

### Phase 4: Custom Image Selection
**Status:** Pending
**Priority:** Medium (blocked on Phase 3.5 completion)

**Goal:** Let users choose or upload custom images for products

**Note:** This was originally conceived to solve poor metadata quality. With Phase 3.5's custom extraction, this becomes less critical but still valuable for user customization.

**Schema Changes:**
```typescript
ProductLink = {
  // ... existing fields
  customImage?: FileStream  // User-uploaded image
}
```

**Tasks:**
1. Add Jazz FileStream support for custom images
2. Create image upload component
3. Add image selection in AddLinkDialog (choose from fetched or upload)
4. Add image edit functionality in EditLinkDialog
5. Implement image cropping/resizing (optional)
6. Add image gallery view for selecting from previously uploaded

**Estimated Complexity:** Medium

---

### Phase 5: Budget Calculator
**Status:** Pending
**Priority:** High (Unique Feature!)

**Goal:** Help users plan purchases with monthly savings calculations

**Schema Changes:**
```typescript
ProductLink = {
  // ... existing fields
  targetPurchaseDate?: Date
  priority?: number  // 1-5 scale
  isPurchased: boolean
}
```

**Tasks:**
1. Update schema with budget-related fields
2. Create BudgetCalculator component
3. Add target date picker to ProductCard
4. Calculate monthly savings needed (price / months until target)
5. Create collection budget summary view
6. Add "mark as purchased" functionality
7. Add budget progress indicators
8. Create budget overview dashboard

**Example Calculation:**
- Product: $1,200 laptop
- Target Date: 6 months from now
- Monthly Savings Needed: $200/month

**Estimated Complexity:** Medium

---

### Phase 6: Item Prioritization
**Status:** Pending
**Priority:** Medium

**Goal:** Allow users to prioritize items within collections

**Tasks:**
1. Add drag-and-drop reordering (consider dnd-kit library)
2. Add manual priority setting (1-5 stars or numbers)
3. Update schema with order/priority field
4. Add sort options (by date, priority, price)
5. Visual indicators for high-priority items
6. Filter by priority level

**Estimated Complexity:** Medium

---

### Phase 7: View Modes
**Status:** Pending
**Priority:** Medium

**Goal:** Multiple ways to view product collections

**View Options:**
- **Grid** (current) - Card-based grid layout
- **List** - Compact rows with key info
- **Masonry** - Pinterest-style varying heights
- **Table** - Spreadsheet-like data view
- **Kanban** - Drag-and-drop board by status/priority

**Tasks:**
1. Create ListView component (compact rows)
2. Create MasonryView component (Pinterest-style)
3. Create TableView component (spreadsheet-like)
4. Create KanbanView component (board layout)
5. Add view mode selector to header
6. Persist user's preferred view mode in AccountRoot
7. Ensure all views work with collections
8. Make views responsive

**Estimated Complexity:** Medium-High

---

### Phase 8: Polish & Refinement
**Status:** Pending
**Priority:** Continuous

**Goal:** Production-ready polish and optimization

**Tasks:**
1. Add loading skeletons for better perceived performance
2. Implement error boundaries
3. Add empty states for all views
4. Optimize images (lazy loading, blur placeholders)
5. Add keyboard shortcuts (Cmd+K to add link, etc.)
6. Improve mobile experience
7. Add onboarding/tutorial for first-time users
8. Performance optimization (memo, lazy loading components)
9. Accessibility audit (ARIA labels, keyboard navigation)
10. Cross-browser testing
11. Add metadata/SEO for tote.tools
12. Add analytics (optional)

**Estimated Complexity:** Medium

---

## Suggested MVP Scope

For a **production-ready MVP**:

### Must Have:
- ✅ Phase 1: Enhanced Product Cards
- ✅ Phase 2: Collections System
- ✅ Phase 3: Edit & Delete Functionality
- 🚧 Phase 3.5: Metadata Extraction Improvement (critical for quality)
- 📋 Phase 3.6: Chrome Extension (solves bot detection, JS-rendering)
- Phase 5: Budget Calculator (unique differentiator!)

### Nice to Have (v1.1):
- Phase 4: Custom Image Selection
- Phase 6: Item Prioritization
- Phase 7: View Modes (Grid + List initially)

### Continuous:
- Phase 8: Polish & Refinement (ongoing throughout)

**Current Focus:** Phase 3.6 - Chrome Extension prototype. Bypasses bot detection and handles JS-rendered content that server-side extraction cannot.

---

## Future Feature Ideas

**Beyond MVP:**
- Price tracking - Monitor price changes over time
- Availability checking - Check if items are still in stock
- Shared collections - Share wishlists with friends/family
- ~~Browser extension~~ → Now Phase 3.6!
- Import from other services - Amazon wishlist, Pinterest, etc.
- Export options - PDF, CSV, print-friendly view
- Collaborative collections - Multiple users editing same collection
- AI suggestions - Similar products, price alerts
- Gift registry mode - Mark items as "purchased by friend"

---

## Technical Decisions

### Metadata Extraction Lessons Learned

**What We Tried:**
1. **Microlink API (Current Solution)** ✅
   - Simple fetch to `https://api.microlink.io/?url=...`
   - Acts as CORS proxy and metadata extractor
   - Returns Open Graph, Twitter Cards, and JSON-LD data
   - **Pros:** Simple, works, no CORS issues
   - **Cons:** Limited extraction for some sites, external dependency

2. **Client-Side Iframe Extraction** ❌
   - Tried loading product pages in iframe and extracting metadata via postMessage
   - **Failed due to:** Content Security Policy (CSP) `frame-ancestors 'none'` directive
   - Most e-commerce sites block iframe embedding for security
   - **Lesson:** Web apps cannot bypass CSP like browser extensions can
   - Arc browser's "Little Arc" works because it has extension privileges

3. **Manual Entry Fallback** ⚠️
   - Considered allowing manual entry of all fields
   - **Decision:** Keep simple - Microlink with auto-generated title fallback
   - Users can edit metadata after adding link

**Current Implementation:**
- Microlink API fetches metadata automatically on submit
- Fallback to URL-based title generation if fetch fails
- Offline detection prevents failed fetch attempts
- All metadata fields editable after creation

**Key Takeaway:** CORS and CSP are real constraints for web apps. Browser extensions have privileges that web apps don't. Keep it simple with external API + fallbacks.

### React & Next.js Lessons Learned

**React Hooks Rules:**
- **Critical:** All hooks must be called in the same order on every render
- Hooks cannot be called after conditional returns or early exits
- **Example Error:** Declaring `useState` after an early return breaks Rules of Hooks
- **Fix:** Move all hooks to the top of the component before any returns

**SSR Hydration Issues:**
- **Problem:** Server-rendered HTML must match initial client render
- **Example:** Online/offline status differs between server and client
- **Solution:** Use `mounted` state to prevent rendering until client-side:
  ```typescript
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  ```
- **Lesson:** Any state that differs between server and client needs this pattern

**Formik Best Practices:**
- Prefer Formik over multiple `useState` hooks for complex forms
- Provides validation, touched state, error handling in one place
- Works well with Yup for schema validation
- Reduces boilerplate and prevents state management bugs

### Metadata Extraction Strategy

**Current Approach:**
- Using Microlink API as baseline
- Works well for ~60-80% of sites with good Open Graph tags
- Issues with indie sites lacking proper metadata

**Improvement Plan:**
1. **Test-Driven Development**
   - Collect real test cases from diverse sites
   - Prioritize indie Shopify/Squarespace stores
   - Document what works vs what doesn't

2. **Custom Extraction Service**
   - Serverless function (Cloudflare Worker or Vercel Edge)
   - Bypasses CORS/CSP by fetching server-side
   - Platform-specific extractors (Shopify product JSON, etc.)
   - JSON-LD, Open Graph, HTML fallback chain

3. **Hybrid Approach**
   ```
   User adds URL
     ↓
   Try Microlink (fast, 60-80% success)
     ↓
   If missing data → Custom scraper
     ↓
   Merge best results
   ```

4. **Continuous Improvement**
   - Test Lab for iterative testing
   - Version-controlled test cases
   - Measure improvement over time

**Key Resources:**
- `METADATA_INVESTIGATION.md` - Research plan
- `tests/PLATFORM_METADATA_PATTERNS.md` - Extraction strategies per platform
- `/dev/metadata-test` - Testing UI

### Why Jazz?
- **Distributed Database** - Syncs across all devices automatically
- **Real-time Collaboration** - Built-in, no WebSocket setup needed
- **Offline-First** - Works offline, syncs when back online
- **No Backend Required** - Jazz Cloud handles infrastructure
- **Type-Safe** - CoValues with Zod schemas
- **Version Control** - Edit history built-in

### Why CSS Modules over Tailwind?
- Better separation of concerns
- Scoped styles prevent conflicts
- More maintainable for complex components
- Design tokens via CSS variables
- No build-time overhead
- Easier to theme

### Why Radix UI?
- Unstyled primitives - Full design control
- Accessibility built-in
- Keyboard navigation
- Focus management
- ARIA attributes
- Works great with CSS Modules

---

## Development Workflow

### Getting Started
```bash
# Install dependencies
pnpm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Project Structure
```
app/                              # Next.js App Router
├── collections/
│   ├── [id]/
│   │   └── page.tsx             # Collection detail page
│   └── page.tsx                 # Collections list page
├── layout.tsx                   # Root layout
└── page.tsx                     # Home redirect

src/
├── components/
│   ├── AddLinkDialog/
│   ├── CollectionCard/
│   ├── CollectionView/
│   ├── CreateCollectionDialog/
│   ├── DeleteConfirmDialog/
│   ├── EditCollectionDialog/
│   ├── EditLinkDialog/
│   ├── Header/
│   ├── OfflineBanner/
│   ├── ProductCard/
│   ├── ProductGrid/
│   └── ToastNotification/
├── hooks/
│   └── useOnlineStatus.ts
├── styles/
│   ├── reset.css
│   └── variables.css
├── utils/
│   ├── metadata.ts
│   └── metadataExtractor.ts
├── AuthButton.tsx
├── Main.tsx
├── schema.ts
└── index.css
```

### Code Style
- TypeScript strict mode
- Biome for formatting and linting
- CSS Modules with BEM-like naming
- Functional components with hooks
- Jazz-first data patterns

---

## Success Metrics

### User Experience
- Fast load times (< 2s initial load)
- Instant UI updates (Jazz real-time sync)
- Mobile-friendly (responsive down to 320px)
- Accessible (WCAG 2.1 AA compliant)

### Technical
- TypeScript 100% coverage
- No console errors
- Build size < 500KB gzipped
- Lighthouse score > 90

### Business
- Easy onboarding (< 1 minute to first link)
- High engagement (users add 10+ links)
- Cross-device usage (desktop + mobile)
- Retention (users return weekly)

---

## Questions & Decisions

### Open Questions:
1. Should collections support nesting? (Collections within collections)
2. Price tracking: Automatic via API or manual entry?
3. Should we support multiple images per product?
4. Privacy: Encrypted collections for sensitive items?
5. Import/export: What formats? (JSON, CSV, HTML?)

### Design Decisions:
- ✅ Use Microlink API for metadata extraction
- ✅ CSS Modules over Tailwind
- ✅ Radix UI for component primitives
- ✅ Jazz Cloud for sync and storage
- ✅ Vite for build tooling

---

## Contact & Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/tote/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/tote/discussions)
- **Jazz Support:** [Jazz Discord](https://discord.gg/utDMjHYg42)

---

## License

[Add your license here]

---

**Last Updated:** December 16, 2024
**Version:** 0.0.207
**Status:** Active Development - Phase 3.6 (Chrome Extension)
