# Curator Pricing Strategy

Research conducted April 2026. Documents conclusions from AI SaaS unit economics research
and product decisions for Tote's curator feature monetization.

## Product Model

Tote is split into two tiers:

| Tier | Features | Price |
|---|---|---|
| **Free** | Chrome extension, collections, sharing | $0 forever |
| **Curator** | AI-powered collection curation | Credits required |

The extension, collections, and sharing are the free hook — real value, no time limit,
no credit wall. The curator is a paid power feature from the first run.

**No free curator tier.** Giving away AI runs and hoping users convert has poor empirical
support (see research below). Requiring upfront purchase creates genuine buy-in and
filters for users who see real value in the feature.

## Key Research Findings

### Gross Margin Targets

- Minimum viable gross margin on AI features: **60%**
- Healthy target for a bootstrapped product: **65–75%**
- This means raw LLM costs must stay under **25–35% of revenue**
- Required markup over raw API cost: **3–5x minimum, 5–7x for comfort**

### What Bad Unit Economics Looks Like

- **Perplexity (2024):** spent 164% of revenue on compute ($57M costs on $34M revenue)
- **Cursor:** was sending ~100% of revenue to Anthropic; one agentic task generated a
  $7,225 invoice for a single user — they had to issue public refunds
- Both started with flat/generous models that didn't account for heavy users
- **Fix is always the same:** deduct at actual cost, charge at marked-up cost, hard cap free usage

### Freemium Conversion Reality

- Median freemium → paid conversion across SaaS: **2–5%**
- Top performers: 5–10%
- Implication: to get 100 paid users, you need 2,000–5,000 free users
- Free-tier AI usage is a real cost line — uncapped, it scales linearly with signups
- AI tools that gate on quality (not quantity) convert better because the gate itself
  demonstrates value

### Pricing Model Hierarchy

| Model | Margin Profile | Best For |
|---|---|---|
| Per token/call | Thin, ~30–50% | Commodity, developer tools |
| Per workflow/task | Moderate, 50–70% | Defined automation |
| Per outcome | Best, 60–80%+ | High-value, measurable ROI |

The industry is moving toward outcome-based pricing. Cost-plus credits are a practical
starting point, not a long-term strategy.

## Curator Cost Reality

### What We Track Today

- `inputTokens` + `outputTokens` per session via Anthropic `response.usage`
- Stored in Jazz (`CuratorSession`) and Neon (`credit_transactions`)

### What We're Missing

Web search tool calls (`web_search_20250305`) add cost beyond tokens:
- Anthropic charges **$10 per 1,000 web searches** ($0.01/search)
- Search results also bulk up input tokens on subsequent turns
- URL discovery phase runs one search per section — a normal-mode run with 5 sections
  costs ~$0.05 in search fees alone, before tokens

**This means actual per-run costs are materially higher than token math alone.**
Need to track `response.usage.server_tool_use.web_search_requests` and include
that in the credit deduction formula.

### Estimated Cost Per Run (rough, pending better instrumentation)

| Mode | Token cost | Search cost | Total (est.) | At 5x markup |
|---|---|---|---|---|
| Debug | ~$0.04 | ~$0.02 | ~$0.06 | ~$0.30 |
| Normal | ~$0.15 | ~$0.05 | ~$0.20 | ~$1.00 |

These are estimates. Instrument properly before finalizing credit prices.

## Current Implementation

### Credit Packs (test mode, to be repriced after instrumentation)

| Pack | Price | Notes |
|---|---|---|
| Starter | $5 | `price_1TKn8dIRyPXUFa52ClYqRPKI` |
| Standard | $10 | `price_1TKn8fIRyPXUFa52XCsjtETI` |
| Pro | $25 | `price_1TKn8gIRyPXUFa52q6XX47mt` |

These prices are not final. Reprice after real cost data is collected.

### Ledger

- **`user_credits`** — current balance per user (cents), Stripe customer ID
- **`credit_transactions`** — immutable log of every grant, purchase, and deduction
  with full context (tokens, session IDs, Stripe session IDs)
- No free grant on signup — first run requires purchasing credits

### Deduction Formula (current, incomplete)

```ts
// In src/lib/credits.ts
function tokenCostCents(inputTokens: number, outputTokens: number): number {
  return Math.ceil((inputTokens / 1_000_000) * 300 + (outputTokens / 1_000_000) * 1500);
}
```

Missing: web search request cost. Needs to become:

```ts
function runCostCents(inputTokens: number, outputTokens: number, webSearchRequests: number): number {
  const tokenCost = (inputTokens / 1_000_000) * 300 + (outputTokens / 1_000_000) * 1500;
  const searchCost = webSearchRequests * 1; // $0.01/search = 1 cent
  return Math.ceil((tokenCost + searchCost) * MARGIN_MULTIPLIER);
}
```

`MARGIN_MULTIPLIER` should be set after real cost data is collected. Target: 5x.

## Open TODOs

- [ ] Track `web_search_requests` from `response.usage.server_tool_use` in the Inngest function
- [ ] Run 10–20 real curator sessions and log actual total costs to calibrate
- [ ] Set `MARGIN_MULTIPLIER` based on real data
- [ ] Reprice Stripe packs to reflect true cost + margin
- [ ] Remove `ensureFreeCredits()` call from `POST /api/curate/start` (no free tier)
- [ ] Build credit balance display into the curator new-session page (not just history page)
