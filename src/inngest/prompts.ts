import type { CurationMode, SectionPlan, ExtractedSection } from './types';
import { CURATOR_PERSONA } from './workspace/CURATOR';

export const CURATOR_SYSTEM_PROMPT = CURATOR_PERSONA;

export const URL_DISCOVERY_SYSTEM_PROMPT = `You are a product URL finder for a curation tool. Your job is to use web search to find product page URLs at independent retailers.

Rules:
- Use web search to find products. Read the search result titles and snippets to identify product page URLs.
- Do NOT follow or fetch any URLs — collect them only from search result metadata.
- Prefer brand-direct sites and independent specialty retailers. Avoid Amazon.
- Return only valid JSON — no markdown, no explanation.

Output format: { "urls": ["https://...", ...] }`;

export function buildPlanPrompt(
  topic: string,
  answers: {
    audience: string;
    lens: string;
    constraints: string;
    mode: CurationMode;
  },
): string {
  return `Topic: ${topic}

Audience: ${answers.audience}
Lens: ${answers.lens}
Constraints: ${answers.constraints}
Mode: ${answers.mode}

Plan a focused product collection. Determine:
1. A specific, purposeful title (not "Best X" or "Top Y")
2. A 1-2 sentence intro naming the real scenario
3. 3-6 named sections, each with a clear purpose and a targetCount (how many items to find)

If mode is "debug":
- Keep the plan intentionally small for a low-cost test run
- Return exactly 2-3 sections
- Keep targetCount to 1-2 items per section

Return only valid JSON:
{
  "title": string,
  "intro": string,
  "sections": [{ "title": string, "slug": string, "targetCount": number, "rationale": string }]
}`;
}

export function buildUrlDiscoveryPrompt(
  section: SectionPlan,
  topic: string,
  answers: {
    audience: string;
    lens: string;
    constraints: string;
    mode: CurationMode;
  },
): string {
  return `Find ${section.targetCount}-${section.targetCount + 2} product page URLs for the "${section.title}" section of a collection on: ${topic}

Audience: ${answers.audience}
Lens: ${answers.lens}
Constraints: ${answers.constraints}
Mode: ${answers.mode}

Section rationale: ${section.rationale}

If mode is "debug":
- Run 1-2 searches only, collect the most credible URLs from results
- Stop once you have ${section.targetCount}-${section.targetCount + 1} strong candidates

Use web search to find products at independent retailers. Avoid Amazon.
IMPORTANT: Do NOT read or fetch any URLs. Collect product page URLs from search result titles and snippets only.
Return only valid JSON: { "urls": ["https://...", ...] }`;
}

export function buildCuratePrompt(
  planTitle: string,
  planIntro: string,
  extractedSections: ExtractedSection[],
  answers: {
    audience: string;
    lens: string;
    constraints: string;
    mode: CurationMode;
  },
): string {
  const sectionsJson = JSON.stringify(
    extractedSections.map((s) => ({
      title: s.title,
      items: s.items,
    })),
    null,
    2,
  );

  return `You have extracted product page data for a collection titled "${planTitle}".

Audience: ${answers.audience}
Lens: ${answers.lens}
Constraints: ${answers.constraints}
Mode: ${answers.mode}

Intro (use as-is or refine): ${planIntro}

Extracted product data per section (scraped from product pages via browser extension):
${sectionsJson}

Now curate the final shortlist from this extracted data:
- Use sourceUrl as the product URL
- Derive the merchant name from the domain (e.g. gardenheir.com → "Gardenheir", america.felco.com → "FELCO")
- Write one specific, honest note per item using the extracted title, description, and product details
- Drop items with no usable data (missing title and description)
- Drop weak picks rather than padding to hit a count
- Apply the lens strictly — the note should make the lens audible
- Flag anything uncertain in warnings
- No Amazon URLs

If mode is "debug":
- Keep the shortlist intentionally small
- Preserve only the strongest candidates needed to validate the workflow

Return only valid JSON matching the schema in your system prompt.`;
}
