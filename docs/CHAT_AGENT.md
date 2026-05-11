Collection Chat Agent

Context

The curator produces warnings for gaps it couldn't fill — products that are missing, weak, or violate a constraint. These are currently dead-end text strings. Separately, users browsing their collections have no
way to search for new products from within Tote.

This builds a floating chat agent on collection pages powered by Vercel AI SDK. The agent can search for products (Brave Search → metadata extraction → suggestion cards), and let users add them directly. It uses
the same credit/token tracking infrastructure as the curator. The curator completion screen also gets "Find better option" buttons on each warning, which open the chat pre-seeded with the gap context.

---

Architecture

Packages to install

pnpm add ai @ai-sdk/anthropic @ai-sdk/react

New files

┌─────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│ File │ Purpose │
├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
│ src/app/api/chat/route.ts │ Streaming POST — streamText with tools, credit tracking │
├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
│ src/components/CollectionChat/CollectionChat.tsx │ Floating button → panel, useChat hook │
├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
│ src/components/CollectionChat/CollectionChat.module.css │ Panel styles (CSS vars, floating fixed position) │
├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
│ src/components/CollectionChat/ProductSuggestionCard.tsx │ Tool result card with "Add to Tote" + "↗ Visit" │
└─────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────┘

Modified files

┌──────────────────────────────────────────────────┬───────────────────────────────────────────────────┐
│ File │ Change │
├──────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
│ src/components/CollectionView/CollectionView.tsx │ Add <CollectionChat> with collection context prop │
├──────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
│ src/app/(app)/curate/CuratePageClient.tsx │ Warning rows: add "Find better option →" button │
└──────────────────────────────────────────────────┴───────────────────────────────────────────────────┘

---

API Route (/api/chat)

// POST body
{
messages: UIMessage[]; // AI SDK message history
collectionContext: { // Serialized from Jazz (client-side)
title: string;
items: { title: string; url: string; price?: string }[];
} | null;
seedContext?: string; // Pre-seeded from curator warning
}

Auth: auth() from @clerk/nextjs/server — same as all other curator routes.

Model: anthropic('claude-sonnet-4-6') via @ai-sdk/anthropic — consistent with MODELS.sonnet.

Tools (both server-side with execute):

1.  search_products — takes a natural-language query, runs braveSearch() (reuse src/lib/braveSearch.ts) with count: 10, returns top results as { title, url, description }[]
2.  extract_product — takes a URL, calls extractUrl(url) from src/inngest/server-extraction.ts (CF browser worker → Gemini URL Context fallback). Returns first extracted item as { title, url, imageUrl, price,
    currency, description }. Returns null if both tiers fail. Tracks cfCount and Gemini usage separately for credit accounting.

Multi-step: stopWhen: stepCountIs(4) — prevents runaway loops. Typical flow: search → extract 2–3 URLs → respond with cards.

Credit tracking via onStepFinish + per-extract accounting:

// After streamText completes (onFinish or accumulated onStepFinish):
// - Anthropic tokens from AI SDK usage object → runCostCents(inputTokens, outputTokens, 0, MODELS.sonnet)
// - Brave search calls → braveSearchCount _ BRAVE_SEARCH_COST_CENTS
// - CF sessions → cfCount _ CF_PUPPETEER_COST_CENTS
// - Gemini tokens → runCostCents(geminiInput, geminiOutput, 0, MODELS.geminiFlash)
// All summed and passed to deductCredits() with stepLabel: 'chat'
deductCredits(userId, totalCents, `chat:${collectionId ?? 'search'}`, ...)

Response: result.toUIMessageStreamResponse()

---

Chat Component (CollectionChat)

Props:

interface CollectionChatProps {
collection: CoMap | null; // Jazz block — null when used without a collection
ownerGroup: Group | null; // For Jazz mutations
seedContext?: string; // Pre-fill first assistant message or system hint
}

State: ephemeral — useChat from @ai-sdk/react, no persistence.

Body passed with every message:

body: {
collectionContext: serializeCollection(collection), // title + item list
seedContext,
}

Message rendering — iterate message.parts:

- type === 'text' → plain text
- type === 'tool-call' (toolName extract_product) → small spinner "Looking up [url]..."
- type === 'tool-result' (toolName extract_product) → <ProductSuggestionCard> with Add button

Floating UI:

- Fixed position bottom-right, z-index above collection
- Closed state: round button with chat icon + label
- Open state: 380px × 520px panel, white/surface background, shadow-xl, border-radius-lg
- Input at bottom, messages scroll above
- If seedContext provided: first assistant message auto-populated

---

ProductSuggestionCard

Props: { product: ExtractedProduct; onAdd: () => void; } where onAdd calls the Jazz mutation pattern from AddLinkDialog (lines 98–127):

const block = Block.create({ type: 'product', name, productData: {...}, createdAt: new Date() }, ownerGroup)
collection.children.$jazz.push(block)

Card shows: product image (or placeholder), title, merchant/price, description snippet, [Add to Tote] button + [↗] link.

After add: button shows "✓ Added", disabled.

---

Curator Warning Integration (CuratePageClient.tsx)

In the warnings section (currently lines 907–916), each warning string gets a <button> "Find better option →". Clicking it:

1.  Sets local state: chatSeedContext = warningString
    In the warnings section (currently lines 907–916), each warning string gets a <button> "Find better option →". Clicking it:
    1.  Sets local state: chatSeedContext = warningString
    2.  Opens the CollectionChat panel

    ***

    Key Utilities to Reuse

    ┌─────────────────────────────────────┬──────────────────────────────────┬─────────────────────────────────────────┐
    │ Utility │ Path │ Usage │
    ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
    │ braveSearch() │ src/lib/braveSearch.ts │ search_products tool │
    ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
    │ extractUrl() │ src/inngest/server-extraction.ts │ extract_product tool (CF → Gemini) │
    ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
    │ extractViaCf() / extractViaGemini() │ src/inngest/server-extraction.ts │ Called via extractUrl() │
    ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
    │ deductCredits() │ src/lib/credits.ts │ onStepFinish handler │
    ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
    │ runCostCents() │ src/lib/credits.ts │ Cost calculation │
    ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
    │ MODELS.sonnet │ src/lib/models.ts │ Model name constant │
    ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
    │ Block.create + $jazz.push │ src/components/AddLinkDialog │ Jazz mutations │
    ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
    │ CSS variables │ src/styles/variables.css │ Panel styles │
    ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
    │ useToast() │ src/components/ToastNotification │ "Added to collection" feedback │
    ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
    │ isCurator() │ src/inngest/curator-auth.ts │ Route auth (same as other curator APIs) │
    └─────────────────────────────────────┴──────────────────────────────────┴─────────────────────────────────────────┘

    ***

    Verification
    1.  Unit: pnpm build — no TypeScript errors
    2.  Chat route: curl -X POST /api/chat with a message and collectionContext: null — verify streaming response
    3.  Tool calling: ask "find me a waterproof hiking jacket under $150" — verify search tool fires, extract tool fires on ≥1 URL, suggestion card renders
    4.  Add to Tote: click Add on a suggestion card — verify product appears in Jazz collection without page reload
    5.  Credit tracking: check credit_transactions table after a chat turn — verify row with type='deduction', correct token counts, step_label='chat'
    6.  Curator warnings: complete a curation with warnings → click "Find better option" → verify chat opens with warning pre-loaded in system context
    7.  Null collection mode: verify suggestion cards show visit link only (no Add button) when no collection is loaded

---

Status / Completed

- [x] API route `/api/chat` — Gemini Flash via @ai-sdk/google, braveSearch + extractUrl tools, credit tracking
- [x] CollectionChat floating panel — useChat, seedContext auto-submit, Stop button, open/close
- [x] ProductSuggestionCard — image, title, price, Add to Tote, Visit link
- [x] Inline URL add buttons — TextWithAddButtons renders URLs in assistant text with + Add
- [x] CollectionNotes — CRUD notes panel on collections, seeded from curator warnings
- [x] Curator warning integration — structured { text, url } warnings, "Find with AI" per note
- [x] correctionExample in curator brief — LLM-generated placeholder for the correction textarea
- [x] AI SDK v6 typed tool part fix — tools come through as 'tool-{name}' not 'dynamic-tool'

---

Roadmap

### Collection-page URL handling

When Brave returns a category or listing page (Wayfair, Amazon search), `extractUrl` detects `pageType: 'collection'` and runs `expandCollection`. The chat route already takes `items[0]`, but `expandCollection` can return empty on blocked pages. Work needed:

- Verify `expandCollection` returns populated items for common retailers
- Pre-filter Brave results to exclude known listing-URL patterns (e.g. `/s?`, `/search`, `/category/`) before passing to `extract_product`

### Chat brief / framing

Like the curator's `FramingBrief`, give the chat agent a structured brief attached to the collection:

- Fields: intent (what the collection is for), constraints (budget, audience, occasion), taste direction
- Stored as a dedicated field on the `Block` schema or as a special `CollectionNote`
- Injected into the system prompt alongside the item list, so the agent makes targeted recommendations without re-explanation each turn
- Could be human-authored, LLM-generated from the collection, or both

---

Plan: bring collection chat closer to curator quality

Current state

- `/api/chat` is a synchronous streaming route using AI SDK v6, Gemini Flash, `search_products`, and `extract_product`.
- The route has a hard-coded workflow prompt, but no curator-style structured brief beyond collection title, item titles, prices, and optional `seedContext`.
- Extraction already reuses `extractUrl()` from `src/inngest/server-extraction.ts`, including CF first and Gemini URL Context fallback. It only returns `items[0]`, so collection/listing page expansion can silently discard useful alternatives.
- Collection notes can launch chat via "Find with AI", but the seed is a raw note/warning string rather than a structured `CurationGap`.
- `CollectionChat` uses `useChat` from AI SDK v6 and renders typed tool parts (`tool-search_products`, `tool-extract_product`), but should be verified against the installed hook contract because v6 changed the client APIs.

Target behavior

The chat agent should feel like a lightweight, conversational continuation of the curator:

1. Understand the collection's job: who it is for, what success means, constraints, taste, avoidances, and unresolved gaps.
2. Search with the same attribute-led discipline as the curator instead of generic product search.
3. Prefer direct product URLs, but handle listing pages gracefully when search returns them.
4. Return a small set of addable product cards with honest caveats, not prose pretending to know more than extraction proved.
5. Stay fast enough for chat. Heavy multi-step research belongs elsewhere.

Staged implementation plan

### 1. Define a shared chat brief contract

Add a smaller cousin of `FramingBrief` for collection chat:

```ts
interface CollectionChatBrief {
  intent: string;
  recipientContext?: string;
  constraints: string[];
  tasteDirection?: string;
  avoid: string[];
  unresolvedGaps: Array<{
    kind?: CurationGapKind;
    text: string;
    searchHint?: string;
    url?: string;
  }>;
}
```

Recommended storage:

- Short term: derive it client-side/server-side from `collection.collectionData.description`, collection notes, collection title, and item list. No migration needed.
- Medium term: add `chatBrief` or `brief` to `CollectionData` once the shape settles.
- If a collection was created by the curator, preserve and attach the curator `framingBriefJson` when converting/importing the result into Jazz. That is the richest source and avoids re-inferring intent.

Do not store this as only another `CollectionNote`; notes are good for gaps/tasks, but the agent needs a stable brief object it can trust every turn.

### 2. Move prompt assembly into reusable helpers

Create `src/app/api/chat/prompts.ts` or `src/lib/collectionChatPrompt.ts` with:

- `CollectionChatBriefSchema`
- `buildCollectionChatBriefPrompt(...)` for optional LLM-assisted brief generation
- `buildCollectionChatSystemPrompt({ collection, brief, seedGap })`
- `formatCollectionForPrompt(...)`
- `formatGapForPrompt(...)`

The chat prompt should borrow curator rules, not the whole curator workflow:

- search around attributes, use case, price tier, materials, compatibility, and taste
- avoid known bad fits and existing collection URLs
- prefer brand-direct and specialty retailers
- treat extracted data as the only source of product facts
- if extraction is thin, surface uncertainty briefly and still show the card when useful

Keep the "one pass" guard, but make it less brittle:

- default: one search, extract 3-5 promising URLs
- allow one follow-up search only when the first result set is mostly listings, marketplaces, duplicates, or irrelevant
- cap total extract calls per request

### 3. Make seed context structured

Replace raw `seedContext?: string` with a structured request shape while keeping backward compatibility:

```ts
type ChatSeed =
  | { type: 'gap'; gap: CurationGap | { text: string; url?: string; searchHint?: string } }
  | { type: 'note'; text: string; url?: string }
  | { type: 'freeform'; text: string };
```

When a curator warning or collection note launches chat:

- run it through the same gap language as `buildGapsPrompt`
- preserve `searchHint` when available
- pass the note URL as a reference, not as the only thing to replace

This gives the chat agent the same "address this gap" footing the curator refinement pass has.

### 4. Improve extraction result handling

The current `extract_product` tool returns a single product. Change the internal extraction path to preserve multiple products:

- keep `extract_product` for direct URLs, returning one `SuggestedProduct`
- add `extract_products_from_url` or change output to `{ products: SuggestedProduct[], sourcePageType }`
- when `extractUrl()` returns multiple items from `collection-expanded`, render multiple cards
- dedupe by normalized URL against both the current collection and already-rendered tool results

Also add lightweight search-result filtering before extraction:

- downrank or skip obvious search/category URLs (`/search`, `/s?`, `/collections`, `/category`, faceted URLs)
- skip generic marketplaces by default unless the user asks for them
- prefer result titles/snippets that look like individual products

The curator already has URL extraction prompts that enforce individual product pages. Chat does not have that intermediate LLM filter today; adding a cheap deterministic filter first may be enough.

### 5. Verify and harden `useChat`

Before changing behavior, make the current chat loop mechanically reliable:

- Confirm the installed `@ai-sdk/react` v3 `useChat` API supports the current `{ input, handleInputChange, handleSubmit, sendMessage }` usage.
- If not, migrate to the v6 transport pattern expected by the package and pass `collectionContext`, `collectionId`, and seed data through the request body on each send.
- Add a small manual test route or story-like fixture for rendering AI SDK tool parts:
  - `tool-search_products` input available
  - `tool-extract_product` input available
  - `tool-extract_product` output available
  - failed extraction output
- Make auto-submit idempotent per structured seed id, not per raw string only.

### 6. Decide where Inngest belongs

Recommendation: keep normal chat out of Inngest for now.

Use the streaming `/api/chat` route for interactive turns because the user expects immediate tool statuses and cards. Inngest would add durable orchestration, but it also complicates streaming UI, cancellation, and the mental model of a chat turn.

Use Inngest for heavier side jobs:

- generating or refreshing a collection-level `CollectionChatBrief`
- importing/persisting curator `FramingBrief` onto the Jazz collection after curation
- batch "resolve all notes/gaps" workflows
- long-running refinement where multiple gaps need search, extraction, and a merge pass
- async observability if we want durable step logs matching curator sessions

Possible split:

- `/api/chat`: fast conversational search and addable suggestions
- `collection-chat/brief.refresh` Inngest function: derive/update brief from collection state and notes
- `collection-chat/gap.resolve` Inngest function later: curator-style refinement for one or more selected gaps

### 7. Share curator prompt primitives without coupling runtime

Move reusable prompt concepts from `src/inngest/prompts.ts` into neutral helpers:

- `FramingBriefSchema`, `CurationGap` formatting, and URL discovery brief formatting can live in a shared prompt module.
- Inngest-specific prompts can continue to compose those helpers.
- The chat route should not import large curator workflow prompts if it only needs formatting and rules.

This keeps the agent aligned with curator taste while avoiding a hard dependency on the whole Inngest workflow.

### 8. Verification checklist

- `pnpm build`
- manual chat turn with null collection
- manual chat turn with a real collection and existing duplicate URLs
- note/warning "Find with AI" opens chat and sends a structured seed
- query that returns a listing page produces multiple usable cards or a clear fallback
- extraction failure renders no broken card and gives a short useful message
- credit row uses `step_label='chat'` and includes model/search/extraction metadata

### 9. Link curator sessions to resulting Jazz collections

Yes: curator sessions and resulting collections should stay linked even though their data lives in different systems.

Recommended model:

- Neon curator session remains the durable process/audit record: topic, interview answers, research brief, market landscape, framing brief, extraction logs, token usage, final JSON, gaps.
- Jazz collection remains the collaborative user object: collection title/intro, product blocks, notes, sharing state, published clones.
- The link is a reference, not a replication strategy. Store enough curator context on the Jazz collection for prompt use and navigation, but keep the heavy trace in Neon.

Add curator provenance to `CollectionData`:

```ts
curatorSessionId?: string;
curatorTopic?: string;
curatorBriefJson?: string; // or structured chatBrief once schema is stable
curatorImportedAt?: string;
curatorVersion?: number;
```

Add the reverse pointer in Neon session state after import:

```ts
collectionId?: string;
collectionImportedAt?: string;
```

Implementation path:

1. Update `createCollectionFromPayload(payload, me, options?)` so the curate page can pass `{ sessionId, topic, framingBrief }`.
2. On import from `/curate/[sessionId]`, write those fields into `collection.collectionData`.
3. Add a small API route such as `POST /api/curate/link-collection` that patches the Neon session with the created Jazz collection id after `collectionBlock.$jazz.id` exists.
4. When building chat context, prefer `collection.collectionData.curatorBriefJson` over re-inferring a brief from title/items/notes.
5. In the collection UI, optionally show a small "Created by curator" reference linking back to `/curate/{sessionId}` for owners/admins.

Privacy/sharing rule:

- Do not expose the Neon trace through public/shared collection views by default. A shared Jazz collection may include products and notes, but the curator session can contain interview answers, budget details, and personal context.
- Public/published clones should either omit `curatorSessionId` or treat it as owner-only metadata. If we copy `curatorBriefJson` into a published clone, it should be a sanitized chat brief, not the full interview/research trail.

Why this helps chat:

- The chat agent can cite and obey the original framing brief without asking the user to restate intent.
- Notes generated from curator warnings can keep their gap/search-hint lineage.
- Future "resolve this gap" or "why did we pick this?" flows can jump back to the curator trace.
- Cost/debug history remains inspectable in Neon while the user-facing collection stays editable in Jazz.

Suggested first PR

1. Add shared chat brief/seed types and prompt builder.
2. Pass `chatBrief` and structured seed into `/api/chat`.
3. Update system prompt to use curator-style framing and gap rules.
4. Verify/fix `useChat` request handling.
5. Add multi-product extraction output handling if small; otherwise leave it as PR 2.
