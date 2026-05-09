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
 │                          File                           │                         Purpose                         │
 ├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ src/app/api/chat/route.ts                               │ Streaming POST — streamText with tools, credit tracking │
 ├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ src/components/CollectionChat/CollectionChat.tsx        │ Floating button → panel, useChat hook                   │
 ├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ src/components/CollectionChat/CollectionChat.module.css │ Panel styles (CSS vars, floating fixed position)        │
 ├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 │ src/components/CollectionChat/ProductSuggestionCard.tsx │ Tool result card with "Add to Tote" + "↗ Visit"         │
 └─────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────┘

 Modified files

 ┌──────────────────────────────────────────────────┬───────────────────────────────────────────────────┐
 │                       File                       │                      Change                       │
 ├──────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ src/components/CollectionView/CollectionView.tsx │ Add <CollectionChat> with collection context prop │
 ├──────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ src/app/(app)/curate/CuratePageClient.tsx        │ Warning rows: add "Find better option →" button   │
 └──────────────────────────────────────────────────┴───────────────────────────────────────────────────┘

 ---
 API Route (/api/chat)

 // POST body
 {
   messages: UIMessage[];           // AI SDK message history
   collectionContext: {             // Serialized from Jazz (client-side)
     title: string;
     items: { title: string; url: string; price?: string }[];
   } | null;
   seedContext?: string;            // Pre-seeded from curator warning
 }

 Auth: auth() from @clerk/nextjs/server — same as all other curator routes.

 Model: anthropic('claude-sonnet-4-6') via @ai-sdk/anthropic — consistent with MODELS.sonnet.

 Tools (both server-side with execute):

 1. search_products — takes a natural-language query, runs braveSearch() (reuse src/lib/braveSearch.ts) with count: 10, returns top results as { title, url, description }[]
 2. extract_product — takes a URL, calls extractUrl(url) from src/inngest/server-extraction.ts (CF browser worker → Gemini URL Context fallback). Returns first extracted item as { title, url, imageUrl, price,
 currency, description }. Returns null if both tiers fail. Tracks cfCount and Gemini usage separately for credit accounting.

 Multi-step: stopWhen: stepCountIs(4) — prevents runaway loops. Typical flow: search → extract 2–3 URLs → respond with cards.

 Credit tracking via onStepFinish + per-extract accounting:

 // After streamText completes (onFinish or accumulated onStepFinish):
 // - Anthropic tokens from AI SDK usage object → runCostCents(inputTokens, outputTokens, 0, MODELS.sonnet)
 // - Brave search calls → braveSearchCount * BRAVE_SEARCH_COST_CENTS
 // - CF sessions → cfCount * CF_PUPPETEER_COST_CENTS
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
   collectionContext: serializeCollection(collection),  // title + item list
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

 1. Sets local state: chatSeedContext = warningString
     In the warnings section (currently lines 907–916), each warning string gets a <button> "Find better option →". Clicking it:

     1. Sets local state: chatSeedContext = warningString
     2. Opens the CollectionChat panel

     ---
     Key Utilities to Reuse

     ┌─────────────────────────────────────┬──────────────────────────────────┬─────────────────────────────────────────┐
     │               Utility               │               Path               │                  Usage                  │
     ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
     │ braveSearch()                       │ src/lib/braveSearch.ts           │ search_products tool                    │
     ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
     │ extractUrl()                        │ src/inngest/server-extraction.ts │ extract_product tool (CF → Gemini)      │
     ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
     │ extractViaCf() / extractViaGemini() │ src/inngest/server-extraction.ts │ Called via extractUrl()                 │
     ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
     │ deductCredits()                     │ src/lib/credits.ts               │ onStepFinish handler                    │
     ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
     │ runCostCents()                      │ src/lib/credits.ts               │ Cost calculation                        │
     ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
     │ MODELS.sonnet                       │ src/lib/models.ts                │ Model name constant                     │
     ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
     │ Block.create + $jazz.push           │ src/components/AddLinkDialog     │ Jazz mutations                          │
     ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
     │ CSS variables                       │ src/styles/variables.css         │ Panel styles                            │
     ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
     │ useToast()                          │ src/components/ToastNotification │ "Added to collection" feedback          │
     ├─────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
     │ isCurator()                         │ src/inngest/curator-auth.ts      │ Route auth (same as other curator APIs) │
     └─────────────────────────────────────┴──────────────────────────────────┴─────────────────────────────────────────┘

     ---
     Verification

     1. Unit: pnpm build — no TypeScript errors
     2. Chat route: curl -X POST /api/chat with a message and collectionContext: null — verify streaming response
     3. Tool calling: ask "find me a waterproof hiking jacket under $150" — verify search tool fires, extract tool fires on ≥1 URL, suggestion card renders
     4. Add to Tote: click Add on a suggestion card — verify product appears in Jazz collection without page reload
     5. Credit tracking: check credit_transactions table after a chat turn — verify row with type='deduction', correct token counts, step_label='chat'
     6. Curator warnings: complete a curation with warnings → click "Find better option" → verify chat opens with warning pre-loaded in system context
     7. Null collection mode: verify suggestion cards show visit link only (no Add button) when no collection is loaded

⏺ Let me start implementing. First, installing packages and reading the key files I'll need.