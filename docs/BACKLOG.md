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

### Jina Reader as tier-3 extraction fallback

`reader.jina.ai/{url}` fetches any URL and returns clean markdown using their own headless infrastructure — designed for bot-blocking situations.

**Why:** CF (tier-1) and Anthropic web_search (tier-2) both fail on sites that block crawlers (confirmed: lululemon blocks both). Jina is a single `fetch` call, free tier available, no HTML parsing needed.

**If implemented:** Slot between Anthropic web_search and `failed` tier in `extractUrl()` in `src/inngest/server-extraction.ts`. Pass the markdown to Claude with `PageSchema` — no tools needed.

**Already ruled out:** Anthropic document URL source (`type: "url"` document block) — fails with download/format errors on real e-commerce pages. Not viable for arbitrary web content.

### URL normalization at save time

Strip tracking params (`utm_*`, `gclid`, `gbraid`, `srsltid`, etc.) when saving URLs in the extension, mobile app, and curator pipeline.

**Why:** The same product URL arrives with different tracking params depending on how the user got there, causing duplicates and mismatched corpus entries.

**Reference:** `normalizeUrl()` in `chrome-extension/scripts/benchmark-cf.ts` — extract to a shared util and call it at save time before writing to Jazz/R2.
