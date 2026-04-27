# Collection Grouping + Search Architecture

## Context

The collection list is growing unwieldy (30+ collections, heading toward hundreds as templates are added for SEO/discoverability). Three meaningfully different collection states need organizational separation: personal/active, dormant, and templates. Rather than introducing a full folder/nesting hierarchy, a lightweight `group` string field on collections solves the immediate problem and scales to future needs. Search and public collection indexing are designed in but not yet implemented.

## Jazz Medium-Term Viability Note

Jazz is currently **v2 alpha** — no stable v1.0 exists. Production usage reports are sparse; it's primarily used in MVPs and experimental contexts. For Tote at current scale (small user base, pre-launch), the risk is manageable. Alternatives worth monitoring: **PowerSync** (most mature, broad React Native support), **ElectricSQL** (rebuilding on Postgres read-path sync), **Triplit** (full-stack CRDT, good DX). Revisit if Jazz sync reliability becomes a user-facing issue post-launch.

---

## Phase 1: Collection Groups ← build next

### Schema (`src/schema.ts`)

Two additive, backwards-compatible changes — no migration needed (optional fields, Jazz handles missing gracefully):

```ts
// In CollectionData:
group: z.string().optional(),  // e.g. "Templates", "Work", "Gifts"

// In AccountRoot:
groupOrder: z.array(z.string()).optional(),  // for future manual group ordering
```

### Grouping logic (shared pattern, both platforms)

```
ungrouped collections → shown first, no header
named groups → sorted by groupOrder array, then alphabetically for remainder
```

When no collection has a group set → visually identical to today (no headers rendered).

### Web: CollectionList (`src/components/CollectionList/CollectionList.tsx`)

- Add `groupCollections(blocks, groupOrder?)` utility (inline or extracted)
- Replace flat `collectionBlocks.map(...)` with loop over `CollectionGroup[]`
- Section header (`<h2 className={styles.groupTitle}>`) only rendered for named groups
- CSS: add `.groupTitle` + `.group + .group` separator — mirrors existing `.sharedSection` pattern

```ts
type CollectionGroup = { name: string | null; blocks: LoadedBlock[] };

function groupCollections(
  blocks: LoadedBlock[],
  groupOrder?: string[],
): CollectionGroup[] {
  const grouped = new Map<string, LoadedBlock[]>();
  const ungrouped: LoadedBlock[] = [];
  for (const block of blocks) {
    const g = block.collectionData?.group;
    if (!g) {
      ungrouped.push(block);
    } else {
      if (!grouped.has(g)) grouped.set(g, []);
      grouped.get(g)!.push(block);
    }
  }
  const allGroupNames = [...grouped.keys()];
  const ordered = [
    ...(groupOrder ?? []).filter((g) => grouped.has(g)),
    ...allGroupNames
      .filter((g) => !(groupOrder ?? []).includes(g))
      .sort((a, b) => a.localeCompare(b)),
  ];
  const result: CollectionGroup[] = [];
  if (ungrouped.length > 0) result.push({ name: null, blocks: ungrouped });
  for (const name of ordered) result.push({ name, blocks: grouped.get(name)! });
  return result;
}
```

### Web: EditCollectionDialog (`src/components/EditCollectionDialog/EditCollectionDialog.tsx`)

- Add `group: ""` to Formik `initialValues`
- Derive `existingGroups: string[]` from `account.root.blocks` (deduplicated, sorted) via `useMemo`
- UI: `<input type="text" list="group-suggestions">` + `<datalist>` — no new dependency, native browser autocomplete, free-form input
- Save: `group: values.group.trim() || undefined`
- Place after Name field, before Color picker

### Web: CreateCollectionDialog (`src/components/CreateCollectionDialog/CreateCollectionDialog.tsx`)

- Same pattern as EditCollectionDialog
- Lower priority — group can always be assigned after creation via Edit

### Mobile: CollectionListContent (`mobile-app/App.tsx`)

- Replace `FlatList` → `SectionList`
- Add `buildCollectionSections(collections)` utility inline
- `renderSectionHeader` returns `null` for ungrouped section — no visual change for users without groups
- New styles: `sectionHeaderRow`, `sectionHeaderText` (small caps, gray — similar to slot headers in CollectionDetailScreen)

### Mobile: EditCollectionModal (`mobile-app/src/screens/CollectionDetailScreen.tsx`)

- Add `group` state, reset in `useEffect` on `visible`
- Plain `TextInput` — no datalist equivalent in RN; suggestions via prop from parent can be added later
- Save: `group: group.trim() || undefined`

### Verification

- Create 3+ collections, assign different groups → sections appear with headers
- Collections with no group appear at top without a header
- Ungrouped-only user sees no visual change from today
- Saving an empty group string stores `undefined` (no phantom empty group)
- Mobile SectionList renders section headers correctly
- `groupOrder` on AccountRoot persists (no UI yet — verify via Jazz DevTools)

---

## Phase 2: Search (design only — implement after Phase 1)

### Key architecture decisions

1. **Search state lives above the list** — `CollectionsPage` (web) / `CollectionListContent` (mobile) hold `searchQuery`; list components receive it as a prop
2. **Filter runs before grouping** — pass filtered `LoadedBlock[]` into `groupCollections()`; groups collapse naturally with no changes to grouping logic
3. **No library needed initially** — `name.toLowerCase().includes(query)` is instant for hundreds of collections; add MiniSearch later if fuzzy matching matters
4. **Fields to search** — collection `name` (primary), `collectionData.description` (secondary), `collectionData.group` (so typing a group name filters to it)
5. **Product-level search** — Phase 3 concern, not now

### When ready to implement

1. Add `searchQuery?: string` prop to `CollectionList` and mobile equivalent
2. Add `<input type="search">` above collection list on web; `TextInput` above `SectionList` on mobile
3. Filter before grouping; show "No collections match your search" empty state variant
4. (Optional later) swap `includes()` for MiniSearch if fuzzy matching becomes important

---

## Phase 3: Public Collections in Neon (design only — implement after Phase 2)

### Motivation — three problems solved together

1. **Clerk metadata cap** — `slug → publishedId` mappings are stored in Clerk public metadata, which has an ~8KB per-user limit. Publishing dozens of template collections will hit this ceiling. Neon removes the cap and makes slug resolution a proper DB lookup.

2. **SSR for public pages** — `/s/[username]/[slug]` and `/view/[id]` currently require Jazz hydration client-side. Neon enables full SSR: faster Core Web Vitals, better SEO, og:image/title/description without JS.

3. **Discovery and search** — Jazz has no global query mechanism. Neon enables `SELECT` across all public collections for browse/explore pages, full-text search, and eventually semantic/vector search.

### Architecture — CQRS pattern

Jazz remains the write model and source of truth. Neon is a derived read model populated by the publish workflow.

```
Publish → /api/publish
  ├── Jazz: create public CoValue clone (existing)
  ├── Clerk: write slug → publishedId (keep during transition, then remove)
  └── Neon: upsert row in public_collections (new)

Unpublish → /api/unpublish
  ├── Jazz: clear publishedId (existing)
  ├── Clerk: remove slug entry (existing, then remove)
  └── Neon: soft-delete or delete row (new)

Slug resolution → /s/[username]/[slug]
  └── Neon lookup replaces Clerk metadata fetch
```

### Neon schema

```sql
CREATE TABLE public_collections (
  id            TEXT PRIMARY KEY,      -- Jazz publishedId
  slug          TEXT,
  username      TEXT,
  user_id       TEXT,                  -- Clerk user ID
  name          TEXT,
  description   TEXT,
  color         TEXT,
  layout        TEXT,
  allow_cloning BOOLEAN DEFAULT true,
  products      JSONB,                 -- denormalized snapshot: slots + products
  published_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ,

  -- Add both search columns from day one (cheap, no maintenance burden)
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(products::text, '')
    )
  ) STORED,                            -- auto-synced generated column, free
  embedding     vector(1536)           -- NULL until semantic search is ready
);

CREATE INDEX idx_public_collections_slug     ON public_collections (username, slug);
CREATE INDEX idx_public_collections_search   ON public_collections USING gin(search_vector);
CREATE INDEX idx_public_collections_embedding ON public_collections USING hnsw (embedding vector_cosine_ops);
```

`search_vector` is a generated column — stays in sync with every upsert automatically. `embedding` stays NULL until semantic search is wired; HNSW index has no cost on NULL rows.

### Search on JSONB

- **Full-text / keyword**: `search_vector` covers name + description + all product text extracted from JSONB. GIN index makes it fast.
- **Semantic / LLM**: Generate embedding from flattened collection text at publish time (one API call to OpenAI/similar). Store in `embedding`. pgvector cosine search handles retrieval. JSONB is just the source material.

### What this unlocks

- `/templates` browse page — SSR, simple `SELECT ... ORDER BY published_at DESC`
- Proper og:image, title, description on public pages without JS
- Full-text search across all public collections
- Semantic search ("find collections about minimalist workwear") — add embeddings when ready
- Analytics additions (view counts, clone counts) — natural SQL
- No Clerk metadata cap on published collections

### Migration path from Clerk metadata

1. Dual-write to Neon AND Clerk during transition
2. Update slug resolution to read Neon first, fall back to Clerk
3. Backfill existing published collections from Clerk metadata → Neon
4. Remove Clerk writes once Neon is confirmed stable

---

## Related docs

- `PRODUCT.md` — product principles
- `MOBILE_FEATURE_PARITY.md` — web vs iOS feature tracking
- `src/schema.ts` — Jazz schema (CollectionData, AccountRoot)
- `src/components/CollectionList/CollectionList.tsx` — web collection list
- `mobile-app/App.tsx` — mobile collection list
