# Backlog

Unscheduled ideas and deferred work. Not prioritized — just a place to avoid losing things.

---

## Infra

### Migrate KV (Redis) → Neon for curator session state

Replace Upstash/Redis with a `state JSONB` column on `curator_sessions`. KV is used purely as a JSON blob store — no Redis-specific features needed.

**Why:** One fewer infra dependency, simpler local dev, everything queryable in one place.

**Rough steps:**

1. `ALTER TABLE curator_sessions ADD COLUMN IF NOT EXISTS state JSONB`
2. Rewrite `src/lib/curatorSession.ts` — swap Redis calls for `SELECT`/`UPDATE ... SET state = state || $patch`
3. Remove `redis` dep and `KV_REDIS_URL` env var once confirmed working

Callers (`curate-collection.ts`, sync API) stay unchanged — only the `curatorSession.ts` implementation changes.

---

## Curator / Extraction

### Gemini URL Context as tier-2 extraction (replaces Anthropic web_search)

See `docs/EXTRACTION_PIPELINE_RESEARCH.md` for full benchmark results.

**Summary:** `gemini-3-flash-preview` with `tools: [{ url_context: {} }]` succeeded 7/8 URLs (including lululemon which blocks CF and Anthropic crawlers) at ~$0.95/1k URLs — vs ~$10/1k for Anthropic web_search. Single API call, 100% field coverage on products.

**If implemented:** Add between `extractViaCf()` and `extractViaWebSearch()` in `src/inngest/server-extraction.ts`. Auth via `X-goog-api-key` header, parse response with `parseJson()`. Note: incompatible with `responseMimeType: application/json` — parse free-form JSON from response. Wait for a stable (non-preview) `gemini-3-flash` model ID before shipping.

### Serper.dev as Google-backed alternative to Brave Search

[Serper.dev](https://serper.dev) returns Google search results as JSON — functionally identical to `braveSearch.ts` but backed by Google's index.

**Why consider it:** $0.30–1.00/1k queries (vs Brave at $3–5/1k), faster (1–2s), free 2,500 query trial. Google results have broader coverage than Brave for niche/international products.

**Why not urgent:** Brave is working well and the cost difference doesn't matter at current search volume. Worth revisiting if search becomes a meaningful cost line or if Brave has coverage gaps.

**If implemented:** Mirror `src/lib/braveSearch.ts` — same interface, swap endpoint and auth header.

### URL normalization at save time

Strip tracking params (`utm_*`, `gclid`, `gbraid`, `srsltid`, etc.) when saving URLs in the extension, mobile app, and curator pipeline.

**Why:** The same product URL arrives with different tracking params depending on how the user got there, causing duplicates and mismatched corpus entries.

**Reference:** `normalizeUrl()` in `chrome-extension/scripts/benchmark-cf.ts` — extract to a shared util and call it at save time before writing to Jazz/R2.
