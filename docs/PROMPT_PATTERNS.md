# Prompt Patterns Reference

Best practices for Claude prompts in this codebase, based on Anthropic guidance as of spring 2026. Apply these when writing or reviewing prompts in `src/inngest/prompts.ts` or elsewhere.

## Structure: Use XML tags

XML tags are the strongest signal for separating prompt sections. Claude was trained to treat them as semantic boundaries.

```
<context>
...background...
</context>

<task>
...what to do...
</task>

<rules>
- ...
</rules>
```

Most prompts here currently use plain prose + bullet lists. XML tags are worth adopting especially when a prompt has 3+ distinct sections (context, task, rules, schema, examples). Smaller prompts don't need them.

## JSON output: include the schema, not just a description

When asking for JSON, provide the exact schema shape — not just "return JSON." The more specific the contract, the fewer surprises.

We currently serialize Zod schemas to JSON and inject them directly into prompts (`z.toJSONSchema(...)`). This is the right pattern — keep it.

If a JSON parse failure is catastrophic, consider Anthropic's Structured Outputs API (enforces schema at the API layer). For the curator flow, our current retry + parse approach is fine.

## Positive framing over "do not"

Positive instructions are more reliable than negative ones. The model has to suppress a natural behavior rather than follow a clear directive.

```
# Less effective
Do not use site: filters in search queries.

# More effective
Form queries around product attributes and use case — let search results surface the best current sources.
```

Where we have "ONLY use sourceUrl values present in the extracted data above — never invent, guess, or hallucinate URLs", that negative version is intentional: it targets a specific known failure mode (URL hallucination). Specific, targeted negatives for known problems are fine. Broad negatives ("don't do X") are less reliable.

## Explain _why_ constraints exist

Claude generalizes from the reason behind a rule better than from the rule alone. Where a constraint isn't obvious, include the motivation.

```
# Without motivation — Claude follows it literally
Do not use site: filters.

# With motivation — Claude understands the principle
Do not use site: filters. Attribute-based queries let search results surface who makes the best thing right now, rather than anchoring on brands from training data.
```

This matters most for search and curation constraints, where the model's defaults (reaching for well-known brands) actively work against our goals.

## System prompt vs. user prompt

- **System prompt**: persona, persistent constraints, output format/schema. Keep it concise — Claude 4.6+ responds better to focused system prompts.
- **User prompt**: the task, the data, the context for this specific call.

Currently `CURATOR_PERSONA` (the system prompt) handles persona + output schema, and the individual prompt builders inject task-specific context as the user turn. That split is correct.

Watch for: putting dynamic context (specific topic, brief, extracted data) in the system prompt — it belongs in the user turn.

## Search-specific patterns

These apply to `buildUrlDiscoverySystemPrompt`, `buildRefinementUrlPrompt`, and any future search-driving prompts:

1. **Attribute-first queries** — form queries around use case and quality signals, not brands or sites. Let real search results surface who makes the best thing today.
2. **No `site:` filters** unless the brief explicitly names a brand.
3. **One search at a time** with evaluation before the next — already in place.
4. **Stop early** — "stop as soon as you have N URLs" prevents unnecessary searches.
5. **URL source discipline** — collect URLs from search result snippets only; do not fetch pages.

The `searchHint` field in gap objects flows into refinement searches — apply the same attribute-first discipline when writing hints (`buildGapsPrompt`, `buildCuratePrompt` warning examples).

## Few-shot examples

Including examples in prompts is the single highest-leverage technique for format compliance. When a prompt is producing inconsistent output, add 1-2 concrete examples before adding more rules.

We don't currently use examples in most prompts. The places most likely to benefit:

- `buildCuratePrompt` — example of a good product note vs. a vague one
- `buildGapsPrompt` — example of a good vs. bad `searchHint`

## Ordering matters for long prompts

For prompts with large data payloads (extracted product data, full collection JSON), put the data first and the task/rules after. This can meaningfully improve how well Claude attends to the data.

`buildCuratePrompt` already does this (brief → data → instructions). Keep that order.

## What we don't use (and why)

- **Extended thinking / `budget_tokens`**: Not used. The curator workflow is structured enough that we don't need Claude to reason aloud — we just want compliant JSON outputs. Adding thinking would increase latency and cost.
- **Prefilled assistant messages**: Deprecated on Claude 4.6. Don't use.
- **`questionsJsonSchema` (min 3, max 5)**: Removed from prompts — replaced by `followUpQuestionsJsonSchema` (min 1) to allow flexible question counts. The Zod schema is kept as an export for validation in the store.
