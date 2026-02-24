# Docs & SEO Plan

Living plan for improving Tote's documentation quality, search visibility, and discoverability.

## Done

- [x] Metadata exports (title, description, OG) on all docs pages + landing page
- [x] `sitemap.ts` — all public routes
- [x] `robots.ts` — allow public, disallow authenticated routes
- [x] JSON-LD `WebSite` schema in docs layout
- [x] New page: `/docs/getting-started`
- [x] New page: `/docs/extension`
- [x] New page: `/docs/selections-and-budgets`
- [x] Expanded content: adding-links (right-click, notes, editing, platform/brand detection)
- [x] Expanded content: collections (default collection, item count, delete, reorder)
- [x] Expanded content: slots (collapse/expand, reorder, delete behavior)
- [x] Updated docs nav with all new pages
- [x] Updated docs overview with cards for all pages

## Next: Content Quality & Search Friendliness

### ~~Add "What is Tote?" context to every page~~ Done
Each page's lead paragraph now includes a brief clause explaining what Tote is, so someone landing from search has immediate context.

### ~~Add FAQ sections to high-value pages~~ Done
Add an `<h2>Frequently Asked Questions</h2>` section at the bottom of key pages with question-phrased headings. These match long-tail search queries and enable Google FAQ rich results.

Target pages and example questions:
- **Getting Started**: "Is Tote free?", "What stores does Tote work with?", "Do I need the Chrome extension?"
- **Extension**: "Does Tote work on Firefox/Safari?", "Why isn't the extension showing product details?", "How do I pin the Tote extension?"
- **Collections**: "How many collections can I have?", "Can I move products between collections?", "What happens when I delete a collection?"
- **Sharing**: "Can people edit my shared collection?", "Is my shared collection public?", "How do I stop sharing a collection?"
- **Selections & Budgets**: "Do unselected products count toward the budget?", "Can I set a budget without selection limits?"

### ~~Add FAQPage JSON-LD per page~~ Done
Each FAQ page now includes an inline `FAQPage` JSON-LD script matching the FAQ content.

### ~~Improve internal cross-linking~~ Done
Pages currently link "forward" but rarely sideways or back. Every page should link to 2-3 related pages beyond the obvious next step:
- Extension → Adding Links, Getting Started
- Adding Links → Extension, Collections
- Collections → Slots, Selections & Budgets
- Slots → Collections, Selections & Budgets
- Selections & Budgets → Collections, Slots
- Sharing → Collections, Getting Started

## Next: SEO Infrastructure

### Root layout metadata template
Add `title: { template: "%s — Tote", default: "Tote" }` to the root layout so every page gets consistent branding as a fallback.

### Canonical URLs
Add `alternates: { canonical: "https://tote.tools/docs/..." }` to every page's metadata to prevent trailing-slash duplicate indexing.

### OG image
Create a default Open Graph image (1200x630) for link previews on social/messaging. Either a static PNG or a Next.js `opengraph-image.tsx` that generates one.

### Twitter/X card metadata
Add `twitter: { card: "summary_large_image" }` to the root or per-page metadata for proper rendering on X.

### llms.txt
Create a `/public/llms.txt` file summarizing what Tote is, key features, and linking to docs pages. Emerging convention for LLM crawlers (ChatGPT, Perplexity, etc.).

## Later: More Pages

### `/docs/price-tracking`
Refreshing product data, "Refresh All" in collections, how price updates work via extension vs. server-side fallback. Currently spread across adding-links and extension with no dedicated page.

### `/docs/offline-and-sync`
How Tote works offline, what syncs and when, the offline banner, and the local-first architecture. This is a differentiating feature with zero documentation.

### `/docs/table-view`
Dedicated page for the table/list view: sortable columns (title, price, slot, date), compact layout, when to use it vs. grid view. Currently a one-sentence mention in collections.

### `/docs/keyboard-shortcuts`
Once keyboard shortcuts ship (on roadmap), document them here.

## Later: Non-Code Discoverability

### Google Search Console
Submit sitemap manually to get indexed faster. Not code — just a setup task.

### Chrome Web Store listing
Optimize extension description, screenshots, and keywords. The CWS listing is a discovery channel independent of the website.

### Product Hunt / directories
Launch on PH, list on AlternativeTo and similar directories. Generates backlinks (the #1 ranking factor).

### Blog / changelog
A `/blog` or `/changelog` with use-case posts ("How to organize a home renovation wishlist") creates long-tail search entry points that docs pages alone won't capture.
