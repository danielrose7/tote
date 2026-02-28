# Use Case Pages Plan

## Goal
Add dedicated use case pages to improve organic discoverability. Target search intent ("gift wishlist app", "home renovation organizer") rather than feature descriptions ("how collections work").

## Why
- Current public content is landing page + 7 reference docs, all feature-oriented
- Wishlist/shopping organizer space has low SEO competition — most competitors have thin pages
- Notion, Miro, Trello all drive significant organic traffic through use case pages with a hub-and-spoke internal linking model

---

## Phase 1: Scaffolding
Set up the shared infrastructure before writing any content pages.

- [ ] Create `src/app/(public)/use-cases/layout.tsx` — shared layout (header with "Use Cases" label, sidebar nav, WebSite JSON-LD). Mirror the docs layout pattern from `src/app/(public)/docs/layout.tsx`
- [ ] Create `src/app/(public)/use-cases/page.tsx` — hub page with card gallery linking to each use case
- [ ] Reuse `docs.module.css` styles (import from `../docs/docs.module.css`)
- [ ] Update `src/app/sitemap.ts` — add `/use-cases` hub URL
- [ ] Update `src/app/robots.ts` — add `/use-cases/` to allowed paths
- [ ] Add "Use Cases" link to landing page footer (`src/app/(public)/page.tsx`)
- [ ] Verify: `pnpm build` passes, hub page renders in dev

## Phase 2: First Use Case Page (gift-shopping)
Build one page end-to-end to establish the template, then replicate.

- [ ] Create `src/app/(public)/use-cases/gift-shopping/page.tsx`
- [ ] Metadata: title, description, canonical `/use-cases/gift-shopping`, OG tags
- [ ] Page content following the template structure (see below)
- [ ] FAQPage JSON-LD (3-4 questions)
- [ ] Add to sitemap
- [ ] Add to hub page cards
- [ ] Verify: page renders, JSON-LD valid, metadata correct in dev tools

## Phase 3: Home Renovation Page
- [ ] Create `src/app/(public)/use-cases/home-renovation/page.tsx`
- [ ] Same structure as gift-shopping, content focused on renovation/furnishing
- [ ] Add to sitemap + hub page
- [ ] Add "Related use cases" cross-links between gift-shopping and home-renovation

## Phase 4: Personal Style Page
- [ ] Create `src/app/(public)/use-cases/personal-style/page.tsx`
- [ ] Wardrobe/fashion/capsule wardrobe angle
- [ ] Add to sitemap + hub page + cross-links

## Phase 5: Family Shopping Page
- [ ] Create `src/app/(public)/use-cases/family-shopping/page.tsx`
- [ ] Shared/collaborative shopping angle
- [ ] Add to sitemap + hub page + cross-links

## Phase 6: Professional Projects Page
- [ ] Create `src/app/(public)/use-cases/professional-projects/page.tsx`
- [ ] Interior design / contractor / client project management angle
- [ ] Add to sitemap + hub page + cross-links

## Phase 7: Polish & Cross-linking
- [ ] Update `public/llms.txt` with use case pages
- [ ] Add cross-link from docs hub (`src/app/(public)/docs/page.tsx`) to use cases
- [ ] Ensure all pages cross-link to 2-3 sibling use cases ("Related use cases" section)
- [ ] Final `pnpm build` — confirm everything statically renders

---

## Page Template Structure
Each use case page follows this pattern:

```
1. H1                — Outcome headline ("Never lose track of a gift idea again")
2. Lead paragraph    — 1-2 sentences addressing the pain point
3. CTA               — "Get started — it's free"
4. "The problem"     — What's broken without Tote (2-3 sentences)
5. "How Tote helps"  — 3-4 feature cards framed for THIS use case
6. "How it works"    — 3 numbered steps for this scenario
7. Tip box           — One power-user tip
8. FAQs              — 3-4 questions with FAQPage JSON-LD
9. Related use cases — Links to 2-3 sibling pages
10. Final CTA        — "Try Tote — it's free"
```

## Use Case Details

### Gift Lists & Wishlists (`/use-cases/gift-shopping`)
- **Search intent:** "gift wishlist app", "shared gift list", "birthday wishlist organizer"
- **Pain:** Wishlists scattered across Amazon, store accounts, text messages, spreadsheets
- **Story:** Building a holiday gift list, sharing it so family can see what you want, avoiding duplicates
- **Features highlighted:** Collections (one per occasion), sharing (invite + public links), selections
- **FAQs:** Can others see my wishlist? Share with non-Tote users? Avoid duplicate gifts? Use as registry?

### Home Renovation & Furnishing (`/use-cases/home-renovation`)
- **Search intent:** "home renovation organizer", "furniture shopping tracker", "renovation budget tool"
- **Pain:** 47 browser tabs of furniture, losing track of what goes where, blowing the budget
- **Story:** Room-by-room renovation with slots per category, price tracking, sharing with partner/contractor
- **Features:** Collections + slots, budgets, price refresh, sharing
- **FAQs:** Budget per room? Share with contractor? Works with IKEA/Wayfair?

### Wardrobe & Style Board (`/use-cases/personal-style`)
- **Search intent:** "wardrobe planner app", "fashion wishlist", "capsule wardrobe tracker"
- **Pain:** Saving clothes across Zara, H&M, Depop, boutiques — forgetting what you saved where
- **Story:** Building a seasonal capsule wardrobe, curating by category, watching for sales
- **Features:** Seasonal collections, slots, selections, price tracking
- **FAQs:** Organize by season? Track sale prices? Works with Zara/H&M?

### Shared Family Shopping (`/use-cases/family-shopping`)
- **Search intent:** "shared shopping list app", "family wishlist", "collaborative shopping"
- **Pain:** Partners texting links, families duplicating purchases, no single source of truth
- **Story:** Partners furnishing a home together, family coordinating back-to-school shopping
- **Features:** Sharing, real-time collaboration, budgets, per-project collections
- **FAQs:** Partner can add items? Both need accounts? Separate collections?

### Professional Design & Client Projects (`/use-cases/professional-projects`)
- **Search intent:** "interior design mood board tool", "contractor material organizer"
- **Pain:** Managing sourcing across clients/projects, sharing options for approval
- **Story:** Interior designer organizing materials per client, sharing curated board for sign-off
- **Features:** Multiple collections per client, sharing for approval, budgets, price tracking
- **FAQs:** Multiple client projects? View-only sharing? Share for approval?

---

## Code Reuse
- **Styles:** Import `docs.module.css` from `../docs/docs.module.css` — reuse `.article`, `.lead`, `.card`, `.tip`, `.tipLabel`
- **Layout:** Mirror `docs/layout.tsx` structure (sticky header, sidebar nav, content area)
- **Metadata:** Same export pattern as all docs pages
- **JSON-LD:** Same FAQPage pattern used in docs pages

## Not In Scope (for now)
- OG images / social preview cards (separate effort)
- Testimonials / reviews (add when Chrome Web Store reviews exist)
- Video demos or product screenshots
- Additional JSON-LD schemas (Organization, SoftwareApplication, BreadcrumbList)
