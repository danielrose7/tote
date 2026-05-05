# Extraction Pipeline Research

Benchmark results and architecture recommendations from May 2026 research sprint.

## Current Architecture (as of May 2026)

```
Tier 1: CF Puppeteer worker     → DOM extraction, no LLM, ~$1/1k URLs
Tier 2: Anthropic web_search    → Claude + built-in search tool, ~$10/1k URLs
Tier 3: (none)
```

The Puppeteer worker has sophisticated bot bypass (spiral mouse movement, Turnstile handling) but DOM extraction misses brand/description on ~40% of pages. Tier-2 web_search fires when tier-1 returns an error or incomplete data.

## Benchmark Corpus

8 URLs chosen to stress-test bot detection and extraction quality:

| Domain             | Note                            |
| ------------------ | ------------------------------- |
| lululemon.com (×2) | CF-blocked product + collection |
| patagonia.com      | CF-blocked product              |
| titlenine.com      | CF-blocked collection           |
| rei.com            | Accessible product              |
| allbirds.com       | Accessible product              |
| outdoorgearlab.com | Editorial / collection-like     |
| net-a-porter.com   | Luxury retailer                 |

## Results by Approach

### CF Puppeteer Worker (current tier-1)

- **Success**: 5/8 (3 timeouts: patagonia, rei, net-a-porter)
- **Cost**: ~$1/1k URLs (CF Browser Rendering + Workers CPU, no LLM)
- **Field coverage** (on 5 successes):
  - Title: 100% · Price: 60% · Brand: 20% · Description: 60% · Image: 60%
- **Notes**: Lululemon fetched successfully but returned as product (no pageType discrimination). Brand/description gaps are DOM extraction limitations — the extractor can't always find these from HTML alone.

### Gemini URL Context — `gemini-3-flash-preview`

- **Success**: 7/8 (1 transient 503; patagonia + net-a-porter returned `error` pageType)
- **Cost**: ~$0.95/1k URLs ($0.30/M input, $2.50/M output; ~600 in + ~350 out per URL)
- **Field coverage** (on 2 confirmed products):
  - Title: 100% · Price: 100% · Brand: 100% · Description: 100% · Image: 100%
- **Notes**: Single API call, no Jina needed. Gemini's crawler bypassed lululemon bot block. Patagonia/net-a-porter blocked even Google's crawler. Latency 5–25s avg.

### Jina Reader → Claude Haiku (pipeline fallback)

- **Success**: 6/8 (rei + net-a-porter 422 from Jina)
- **Cost**: ~$13–17/1k URLs (Jina tokens negligible; dominated by Claude Haiku at $0.80/M in, $4.00/M out on 15–60k char pages)
- **Field coverage** (on 3 products): 100% across all fields
- **Notes**: Effective bot bypass for lululemon/patagonia. High cost due to large markdown payloads sent to Claude. Uses `X-Target-Selector` / `X-Remove-Selector` headers to trim responses.

### Anthropic web_search (current tier-2)

- **Cost**: ~$10/1k search calls + Claude token costs
- **Notes**: Not directly benchmarked in this sprint against the same corpus. Known to fail on lululemon (Anthropic's crawler blocked). Cost is fixed per search call regardless of page complexity.

## Cost Comparison

| Approach                      | Cost/1k URLs | vs. Anthropic web_search |
| ----------------------------- | ------------ | ------------------------ |
| CF Puppeteer (tier-1)         | ~$1          | 10× cheaper              |
| **Gemini URL Context**        | **~$1**      | **10× cheaper**          |
| Anthropic web_search (tier-2) | ~$10         | baseline                 |
| Jina → Claude Haiku           | ~$15         | 1.5× more expensive      |

## Recommended Architecture Change

Add **Gemini URL Context as tier-2**, pushing Anthropic web_search to tier-3 or removing it.

```
Tier 1: CF Puppeteer worker     → DOM extraction, no LLM, ~$1/1k URLs
Tier 2: Gemini URL Context      → LLM fetch+extract in one call, ~$1/1k URLs  ← NEW
Tier 3: Anthropic web_search    → fallback for sites Gemini can't reach, ~$10/1k URLs
```

**Why Gemini over Jina → Claude:**

- 15× cheaper ($1 vs $15/1k)
- Single API call vs two (Jina fetch + Claude extract)
- Better field coverage than DOM extraction
- Gemini's crawler bypasses a different set of bot blocks than CF

**Unknowns / risks:**

- `gemini-3-flash-preview` is a preview model — needs GA equivalent before production
- Latency (5–25s) is acceptable for async Inngest jobs but would be noticeable in synchronous flows
- Patagonia and net-a-porter are blocked at both CF and Gemini crawlers — no current solution
- Gemini pricing may change; model IDs will need updating as newer stable versions release

## Implementation Notes

- Integration point: `extractUrl()` in `src/inngest/server-extraction.ts`
- New tier slots between `extractViaCf()` and `extractViaWebSearch()`
- Token counts are available in `usageMetadata.promptTokenCount` / `candidatesTokenCount`
- Auth: `X-goog-api-key` header (not query param)
- Tool: `tools: [{ url_context: {} }]` — incompatible with `responseMimeType: application/json`, must parse JSON from free-form response
- Use `parseJson()` from `src/inngest/lib/parseJson.ts` for response parsing

## Benchmark Script

`scripts/benchmark-jina.ts` — supports modes: `cf-worker`, `gemini`, `pipeline`, `reader`, `cf-json`, `schema`, `search`

```bash
MODE=gemini npx tsx scripts/benchmark-jina.ts
MODE=cf-worker npx tsx scripts/benchmark-jina.ts
MODE=pipeline npx tsx scripts/benchmark-jina.ts
```
