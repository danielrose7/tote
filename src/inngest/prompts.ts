import { z } from 'zod';
import type {
  InterviewQuestion,
  SectionPlan,
  ExtractedSection,
  CollectionOutput,
  CurationGap,
} from './types';
import { CURATOR_PERSONA } from './workspace/CURATOR';

export const CURATOR_SYSTEM_PROMPT = CURATOR_PERSONA;

export const InterviewQuestionSchema = z.object({
  id: z.string().describe('snake_case identifier'),
  text: z.string().describe('The question text shown to the user'),
  options: z
    .array(
      z.object({
        value: z.string().describe('Short option label'),
        description: z.string().describe('One-line explanation'),
      }),
    )
    .min(2)
    .max(6),
  multi: z
    .preprocess(
      (v) =>
        typeof v !== 'boolean'
          ? [true, 1, 'true', 't', '1'].includes(v as never)
          : v,
      z.boolean(),
    )
    .describe('true if the user can select multiple options'),
});

export const InterviewQuestionsSchema = z
  .array(InterviewQuestionSchema)
  .min(3)
  .max(5);

const questionsJsonSchema = JSON.stringify(
  z.toJSONSchema(InterviewQuestionsSchema),
  null,
  2,
);

export function buildQuestionsPrompt(topic: string): string {
  return `Generate 3-5 focused interview questions to help curate a product collection on this topic:

"${topic}"

Questions should uncover:
- Who this is for and their specific context
- Quality, style, or value priorities relevant to this category
- Hard constraints (budget, availability, brand avoidances, etc.)

Rules:
- Make questions specific to the product category — not generic
- Provide 3-5 options per question with short descriptions
- Set multi: true when multiple selections make sense (e.g. priorities)
- Always include one constraints question with a "No constraints" option
- The last question should always ask about constraints

Return a JSON array matching this schema exactly — no markdown, no explanation:
${questionsJsonSchema}`;
}

function formatAnswers(
  questions: InterviewQuestion[],
  answers: Record<string, string>,
): string {
  return questions
    .map((q) => `${q.text}\n→ ${answers[q.id] ?? '(no answer)'}`)
    .join('\n\n');
}

export function buildUrlDiscoverySystemPrompt(): string {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' });
  const year = now.getFullYear();
  return `You are a product URL finder for a curation tool. The current month is ${month} ${year}.

Search strategy — follow this exactly:
1. Run ONE search at a time. Evaluate results before deciding whether to search again.
2. Stop searching as soon as you have reached the target URL count. Do not keep searching once you have enough.
3. When you have enough URLs, immediately output the JSON — no summary, no explanation, no preamble.

Search rules:
- Collect URLs only from search result titles and snippets — do not attempt to fetch or visit pages.
- Prefer brand-direct sites and independent specialty retailers. Avoid Amazon and generic marketplaces.
- Only include individual product pages — not category, collection, or search result pages.
- You have a limited search budget. Use only as many searches as needed.

Output: respond with ONLY this JSON, nothing else — { "urls": ["https://...", ...] }`;
}

export function buildPlanPrompt(
  topic: string,
  questions: InterviewQuestion[],
  answers: Record<string, string>,
): string {
  return `Topic: ${topic}

${formatAnswers(questions, answers)}

Plan a focused product collection. Determine:
1. A specific, purposeful title (not "Best X" or "Top Y")
2. A 1-2 sentence intro naming the real scenario
3. 3-6 named sections, each with a clear purpose and a targetCount (how many items to find)

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
  questions: InterviewQuestion[],
  answers: Record<string, string>,
): string {
  const candidateTarget = section.targetCount * 2 + 2;
  return `Find ${candidateTarget} candidate product page URLs for the "${section.title}" section of a collection on: ${topic}

${formatAnswers(questions, answers)}

Section rationale: ${section.rationale}

Search one query at a time. Stop as soon as you have ${candidateTarget} product page URLs across different brands and retailers.

Output ONLY valid JSON when done: { "urls": ["https://...", ...] }`;
}

export function buildCuratePrompt(
  planTitle: string,
  planIntro: string,
  extractedSections: ExtractedSection[],
  questions: InterviewQuestion[],
  answers: Record<string, string>,
): string {
  const sectionsJson = JSON.stringify(
    extractedSections.map((s) => ({
      title: s.title,
      items: s.items,
    })),
  );

  return `You have extracted product page data for a collection titled "${planTitle}".

${formatAnswers(questions, answers)}

Intro (use as-is or refine): ${planIntro}

Extracted product data per section (scraped from product pages via browser extension):
${sectionsJson}

You have more candidates than you need — be selective. Curate a tight shortlist from this extracted data:
- ONLY use sourceUrl values present in the extracted data above — never invent, guess, or hallucinate URLs
- If a section has no usable extracted items, flag it as a warning instead of making up products
- Use sourceUrl as the product URL
- Derive the merchant name from the domain (e.g. gardenheir.com → "Gardenheir", america.felco.com → "FELCO")
- Write one specific, honest note per item using the extracted title, description, and product details
- Drop items with no usable data (missing title and description)
- Drop duplicates, near-duplicates, and weaker alternatives — keep the best per niche
- Apply the lens strictly and ruthlessly — if the note would be vague, drop the item instead

When flagging warnings, be specific and actionable. Each warning must name:
  1. The section affected
  2. Exactly what is missing or wrong (specific product type, constraint violated, etc.)
  3. A ready-to-use search query to find a replacement (e.g. "wool base layer merino under $100 site:icebreaker.com OR woolx.com")
Format: "[section]: [problem] — search: [query]"
Only flag things that more URL discovery could actually fix. Skip informational gaps that are just editorial notes.

Return only valid JSON matching the schema in your system prompt.`;
}

export function buildGapsPrompt(collection: CollectionOutput): string {
  return `You are reviewing a curated product collection for actionable gaps.

Collection: "${collection.title}"

Warnings flagged by the curator:
${collection.warnings.map((w, i) => `${i + 1}. ${w}`).join('\n')}

For each warning, produce a structured gap object. Classify each as:
- "missing-section": no products were found for an entire section
- "constraint-violation": a product conflicts with a stated hard constraint
- "coverage-gap": a specific sub-category or variant is missing from an otherwise populated section
- "quality-concern": a pick is weak or uncertain but cannot be improved by URL discovery alone

For each gap, write a concise searchHint — a web search query that would find products to fill it.
Set actionable: false for gaps where new URL discovery cannot help (e.g. constraint-violation where you'd just remove the item, quality-concern without a clear replacement).

Return only valid JSON array — no markdown, no explanation:
[{ "kind": "...", "sectionTitle": "...", "description": "...", "searchHint": "...", "actionable": true }]`;
}

export function buildRefinementUrlPrompt(
  gap: CurationGap,
  topic: string,
  questions: InterviewQuestion[],
  answers: Record<string, string>,
): string {
  return `Find 4-8 candidate product page URLs to address this gap in a collection on: ${topic}

Gap type: ${gap.kind}
Section: ${gap.sectionTitle}
Gap description: ${gap.description}
Search hint: ${gap.searchHint}

${formatAnswers(questions, answers)}

Search one query at a time. Stop as soon as you have 4-8 product page URLs.
Use web search. Prioritise independent specialty retailers.
Return individual product page URLs only — not category or listing pages.
Output ONLY valid JSON when done: { "urls": ["https://...", ...] }`;
}

export function buildRefinementCuratePrompt(
  existing: CollectionOutput,
  newSections: ExtractedSection[],
  gaps: CurationGap[],
  questions: InterviewQuestion[],
  answers: Record<string, string>,
): string {
  return `You are refining an existing curated product collection by addressing identified gaps.

Existing collection:
${JSON.stringify({ title: existing.title, intro: existing.intro, sections: existing.sections }, null, 2)}

Gaps being addressed in this pass:
${gaps.map((g) => `- [${g.kind}] ${g.sectionTitle}: ${g.description}`).join('\n')}

New extracted product data for these gaps:
${JSON.stringify(
  newSections.map((s) => ({ title: s.title, items: s.items })),
  null,
  2,
)}

${formatAnswers(questions, answers)}

Instructions:
- ONLY use sourceUrl values present in the existing collection or the new extracted data above — never invent, guess, or hallucinate URLs
- If a gap cannot be filled with the provided data, leave it flagged as an unresolved warning
- Merge new product data into the existing collection, supplementing or replacing sections that had gaps
- Remove items that violate hard constraints listed in the gaps
- Do not duplicate items already in the collection (match by sourceUrl)
- Update warnings to reflect what was resolved and what remains unresolved
- Preserve all sections and items not affected by the listed gaps
- Apply the same curatorial lens and note style as the existing collection
- Drop items with no usable data

Return only valid JSON matching the schema in your system prompt.`;
}
