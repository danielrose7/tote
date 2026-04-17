import { z } from 'zod';
import type { BraveSearchResult } from './lib/braveSearch';
import type {
  CategoryResearchBrief,
  CollectionOutput,
  CurationGap,
  ExtractedSection,
  FramingBrief,
  InterviewQuestion,
  SectionPlan,
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

// Used for validation in the store and curate-collection function
export const InterviewQuestionsSchema = z
  .array(InterviewQuestionSchema)
  .min(3)
  .max(5);

// Used in prompts — flexible count so the model isn't forced into a fixed number
export const FollowUpQuestionsSchema = z.array(InterviewQuestionSchema).min(1);

const followUpQuestionsJsonSchema = JSON.stringify(
  z.toJSONSchema(FollowUpQuestionsSchema),
  null,
  2,
);

export const CategoryResearchBriefSchema = z.object({
  categorySummary: z.string(),
  tradeoffs: z.array(z.string()).min(2).max(8),
  pitfalls: z.array(z.string()).min(1).max(8),
  giftingConsiderations: z.array(z.string()).max(6),
  styleConsiderations: z.array(z.string()).max(6),
  suggestedLenses: z.array(z.string()).min(1).max(4),
  sectionHypotheses: z
    .array(z.object({ title: z.string(), rationale: z.string() }))
    .min(2)
    .max(8),
  followUpNeeded: z.boolean(),
  followUpQuestionGoals: z.array(z.string()).max(3),
});

export const FramingBriefSchema = z.object({
  recipientContext: z.string(),
  goal: z.string(),
  constraints: z.array(z.string()).max(8),
  tasteDirection: z.string(),
  tradeoffs: z.array(z.string()).min(1).max(6),
  successDefinition: z.string(),
  avoid: z.array(z.string()).max(6),
  planningNotes: z.array(z.string()).max(6),
});

const categoryResearchJsonSchema = JSON.stringify(
  z.toJSONSchema(CategoryResearchBriefSchema),
  null,
  2,
);

const framingBriefJsonSchema = JSON.stringify(
  z.toJSONSchema(FramingBriefSchema),
  null,
  2,
);

export function buildRound1QuestionsPrompt(topic: string): string {
  return `Generate 2-4 focused Round 1 interview questions to help curate a product collection.

<topic>${topic}</topic>

Round 1 should stay lightweight — uncovering who this is for, what outcome matters most, and hard constraints (budget, shipping, brand avoidances).

<rules>
- Keep questions broad and approachable — no jargon
- Ask fewer questions if the topic is already specific; more if it's genuinely ambiguous
- Provide 3-5 options per question with short descriptions
- Use multi: true only when multiple answers are genuinely useful
- Always end with a constraints question that includes a "No constraints" option
</rules>

Return a JSON array matching this schema exactly — no markdown, no explanation:
${followUpQuestionsJsonSchema}`;
}

export function buildCategoryResearchPrompt(
  topic: string,
  questions: InterviewQuestion[],
  answers: Record<string, string>,
): string {
  return `Research the category behind this curation request before planning the collection.

<topic>${topic}</topic>

<interview>
${formatAnswers(questions, answers)}
</interview>

<task>
- Identify the real subcategories and decision structure in this space
- Surface the main tradeoffs and buyer pitfalls
- Note gift-giving considerations if this appears gift-related
- Note art direction / taste considerations if this appears style-sensitive
- Decide whether a second round of questions would materially change the plan
</task>

<rules>
- Use web search to understand the category landscape — product URL collection comes in a later dedicated phase
- Focus on buyer decision-making, hospitality, and curation structure
- Set followUpNeeded: true only if one or two clarifications would meaningfully change what gets built
- Keep followUpQuestionGoals short and high-signal
</rules>

Return only valid JSON matching this schema:
${categoryResearchJsonSchema}`;
}

export function buildRound2QuestionsPrompt(
  topic: string,
  questions: InterviewQuestion[],
  answers: Record<string, string>,
  research: CategoryResearchBrief,
): string {
  return `Generate targeted Round 2 follow-up questions for this curation.

<topic>${topic}</topic>

<round_1>
${formatAnswers(questions, answers)}
</round_1>

<category_research>
${JSON.stringify(research, null, 2)}
</category_research>

<rules>
- Ask only what would resolve the highest-value ambiguity — usually 1-2 questions, more only if the category genuinely needs it
- Keep questions conversational and easy to answer
- Prefer fork-in-the-road questions over broad surveys
- Include a "No constraints" option if asking about constraints
</rules>

Return a JSON array matching this schema exactly — no markdown, no explanation:
${followUpQuestionsJsonSchema}`;
}

function formatFramingBrief(brief: FramingBrief): string {
  return JSON.stringify(brief, null, 2);
}

export function buildFramingPrompt(
  topic: string,
  round1Questions: InterviewQuestion[],
  round1Answers: Record<string, string>,
  research: CategoryResearchBrief,
  round2Questions: InterviewQuestion[] = [],
  round2Answers: Record<string, string> = {},
): string {
  const round2Block =
    round2Questions.length > 0
      ? `\n\n<round_2>\n${formatAnswers(round2Questions, round2Answers)}\n</round_2>`
      : '';

  return `Build a concise curatorial brief for the planner and curator to follow.

<topic>${topic}</topic>

<round_1>
${formatAnswers(round1Questions, round1Answers)}
</round_1>${round2Block}

<category_research>
${JSON.stringify(research, null, 2)}
</category_research>

<task>
Define:
- who this is for and the scenario
- what the collection is trying to accomplish
- taste or style direction if relevant
- the key tradeoffs the curator should navigate
- what success looks like
- what to avoid
- practical planning notes
</task>

Return only valid JSON matching this schema:
${framingBriefJsonSchema}`;
}

function formatAnswers(
  questions: InterviewQuestion[],
  answers: Record<string, string>,
): string {
  return questions
    .map((q) => `${q.text}\n→ ${answers[q.id] ?? '(no answer)'}`)
    .join('\n\n');
}

// Slim framing brief for URL discovery — omits curation-only fields
function formatUrlDiscoveryBrief(brief: FramingBrief): string {
  return JSON.stringify({
    goal: brief.goal,
    recipientContext: brief.recipientContext,
    constraints: brief.constraints,
    avoid: brief.avoid,
  });
}

type SearchResult = Pick<BraveSearchResult, 'title' | 'url' | 'description'>;
type ResultSet = { query: string; results: SearchResult[] };

function formatResultSets(resultSets: ResultSet[]): string {
  return JSON.stringify(
    resultSets.map((r) => ({
      query: r.query,
      results: r.results.map((s) => ({
        title: s.title,
        url: s.url,
        description: s.description,
      })),
    })),
  );
}

export function buildUrlQueryGenSystemPrompt(): string {
  const now = new Date();
  return `You are a search query planner for a product curation tool. Current month: ${now.toLocaleString('en-US', { month: 'long' })} ${now.getFullYear()}.

Generate queries that surface individual product pages on brand-direct and specialty retailer sites.
- Each query should target a different angle: material, use case, price tier, style, or construction
- Write queries around product attributes — not specific brand names (unless the brief names them)
- Queries should complement each other and cover different corners of the section

Return ONLY valid JSON: { "queries": ["query1", ...] }`;
}

export function buildUrlQueryGenPrompt(
  section: SectionPlan,
  topic: string,
  brief: FramingBrief,
): string {
  const candidateTarget = section.targetCount * 2 + 2;
  return `Generate 7 search queries to find individual product page URLs for the "${section.title}" section.

<topic>${topic}</topic>

<brief>${formatUrlDiscoveryBrief(brief)}</brief>

<section>
Title: ${section.title}
Rationale: ${section.rationale}
Target: ${candidateTarget} candidate URLs
</section>

Return ONLY valid JSON: { "queries": ["q1", "q2", "q3", "q4", "q5", "q6", "q7"] }`;
}

export function buildUrlExtractionSystemPrompt(): string {
  return `You are a product URL extractor. Given search results, identify individual product page URLs that match the brief.
- Include only individual product pages — not category, collection, or search result pages
- Prefer brand-direct sites and independent specialty retailers — exclude Amazon and generic marketplaces
- Apply all constraints from the brief

Return ONLY valid JSON: { "urls": ["https://...", ...] }`;
}

export function buildUrlExtractionPrompt(
  section: SectionPlan,
  resultSets: ResultSet[],
  brief: FramingBrief,
): string {
  const candidateTarget = section.targetCount * 2 + 2;
  return `Extract individual product page URLs for the "${section.title}" section from these search results.

<brief>${formatUrlDiscoveryBrief(brief)}</brief>

<section_rationale>${section.rationale}</section_rationale>

<search_results>${formatResultSets(resultSets)}</search_results>

Target ${candidateTarget} URLs across different brands. Return ONLY valid JSON: { "urls": ["https://...", ...] }`;
}

export function buildRefinementQueryGenPrompt(
  gap: CurationGap,
  topic: string,
  brief: FramingBrief,
): string {
  return `Generate 5 search queries to find product page URLs that address this curation gap.

<topic>${topic}</topic>

<brief>${formatUrlDiscoveryBrief(brief)}</brief>

<gap>
Type: ${gap.kind}
Section: ${gap.sectionTitle}
Description: ${gap.description}
Search hint: ${gap.searchHint}
</gap>

Use the search hint as a starting point. Return ONLY valid JSON: { "queries": ["q1", "q2", "q3", "q4", "q5"] }`;
}

export function buildRefinementExtractionPrompt(
  gap: CurationGap,
  resultSets: ResultSet[],
  brief: FramingBrief,
): string {
  return `Extract product page URLs that address this curation gap.

<gap>
Type: ${gap.kind}
Section: ${gap.sectionTitle}
Description: ${gap.description}
</gap>

<brief>${formatUrlDiscoveryBrief(brief)}</brief>

<search_results>${formatResultSets(resultSets)}</search_results>

Target 4-8 URLs. Return ONLY valid JSON: { "urls": ["https://...", ...] }`;
}

export function buildPlanPrompt(topic: string, brief: FramingBrief): string {
  return `Plan a focused product collection.

<topic>${topic}</topic>

<framing_brief>
${formatFramingBrief(brief)}
</framing_brief>

<task>
Determine:
1. A specific, purposeful title (not "Best X" or "Top Y")
2. A 1-2 sentence intro naming the real scenario
3. 3-6 named sections, each with a clear purpose and a targetCount

Use the framing brief to decide structure. Section roles may include safe defaults, practical anchors, signature picks, elevated options, or delight moments where relevant.
</task>

Return only valid JSON:
{
  "title": string,
  "intro": string,
  "sections": [{ "title": string, "slug": string, "targetCount": number, "rationale": string }]
}`;
}

export function buildCuratePrompt(
  planTitle: string,
  planIntro: string,
  extractedSections: ExtractedSection[],
  brief: FramingBrief,
): string {
  const sectionsJson = JSON.stringify(
    extractedSections.map((s) => ({
      title: s.title,
      items: s.items,
    })),
  );

  return `Curate a tight shortlist from extracted product page data for "${planTitle}".

<framing_brief>
${formatFramingBrief(brief)}
</framing_brief>

<intro_draft>${planIntro}</intro_draft>

<extracted_data>
${sectionsJson}
</extracted_data>

<task>
You have more candidates than you need — be selective. For each section, choose the best items from the extracted data.

Selection rules:
- Use only sourceUrl values present in the extracted data — the goal is an honest shortlist of real products, not a curated-sounding list with invented URLs
- Drop items with no usable data (missing title and description)
- Drop duplicates, near-duplicates, and weaker alternatives — keep the best per niche
- Prefer items that fit the recipient context, success definition, and tradeoffs in the framing brief
- Preserve room for one or two signature picks that feel unusually thoughtful rather than merely correct
- Flag sections with no usable extracted items as warnings rather than padding with weak picks

Writing rules:
- Derive the merchant name from the domain (e.g. gardenheir.com → "Gardenheir", america.felco.com → "FELCO")
- Write one specific, honest note per item using the extracted title, description, and product details
- Apply the lens consistently — if a note would be vague, drop the item instead

<note_examples>
<good>The welted leather sole is resoleable, and the Norwegian welt construction makes it genuinely waterproof — not just water-resistant.</good>
<bad>High quality construction with great attention to detail. A great choice for anyone looking for a reliable option.</bad>
</note_examples>
</task>

<warning_format>
Each warning must name: (1) the section affected, (2) exactly what is missing or wrong, (3) a search query written around product attributes and use case — not specific brands or sites, so real search results surface the best current options.
Format: "[section]: [problem] — search: [query]"
Only flag things that more URL discovery could actually fix.
</warning_format>

Return only valid JSON matching the schema in your system prompt.`;
}

export function buildHospitalityPassPrompt(
  collection: CollectionOutput,
  brief: FramingBrief,
): string {
  return `Improve a curated collection using hospitality principles.

<framing_brief>
${formatFramingBrief(brief)}
</framing_brief>

<current_collection>
${JSON.stringify(collection, null, 2)}
</current_collection>

<task>
- Keep the collection practical, specific, and grounded in real use
- Make it feel more tailored to the person or scenario in the brief
- Strengthen one or two items or notes so the collection feels unusually thoughtful
- Preserve valid URLs and items unless there is a clear reason to change them
- Keep note style concise and specific — skip filler and generic language
- Use warnings when the data is too weak to improve honestly
</task>

Return only valid JSON matching the schema in your system prompt.`;
}

export function buildGapsPrompt(collection: CollectionOutput): string {
  return `Review a curated product collection for actionable gaps.

<collection_title>${collection.title}</collection_title>

<warnings>
${collection.warnings.map((w, i) => `${i + 1}. ${w}`).join('\n')}
</warnings>

<task>
For each warning, produce a structured gap object.

Classify each gap as:
- "missing-section": no products found for an entire section
- "constraint-violation": a product conflicts with a stated hard constraint
- "coverage-gap": a specific sub-category or variant is missing from an otherwise populated section
- "quality-concern": a pick is weak or uncertain but cannot be improved by URL discovery alone

For each gap, write a concise searchHint — a web search query that would surface products to fill it. Write queries around product attributes and use case — attribute-based queries let real search results surface the best current options rather than anchoring on brands from training data.

<searchhint_examples>
<good>lightweight merino wool base layer hiking under $150</good>
<bad>site:icebreaker.com merino base layer</bad>
</searchhint_examples>

Set actionable: false for gaps where URL discovery cannot help (e.g. constraint-violation where the fix is removal, quality-concern without a clear replacement type).
</task>

Return only valid JSON array — no markdown, no explanation:
[{ "kind": "...", "sectionTitle": "...", "description": "...", "searchHint": "...", "actionable": true }]`;
}

export function buildRefinementUrlPrompt(
  gap: CurationGap,
  topic: string,
  brief: FramingBrief,
): string {
  return `Find 4-8 candidate product page URLs to address this gap.

<topic>${topic}</topic>

<gap>
Type: ${gap.kind}
Section: ${gap.sectionTitle}
Description: ${gap.description}
Search hint: ${gap.searchHint}
</gap>

<framing_brief>
${formatFramingBrief(brief)}
</framing_brief>

Search one query at a time. Stop as soon as you have 4-8 product page URLs.

<search_rules>
- Use the search hint as a starting point, but form queries around product attributes and use case — attribute-based queries let real search results surface the best current options
- Do not use site: filters unless the brief explicitly names a brand
- Collect URLs only from search result titles and snippets — do not fetch pages
- Prefer brand-direct sites and independent specialty retailers. Avoid Amazon and generic marketplaces.
- Return individual product page URLs only — not category or listing pages
</search_rules>

Output ONLY valid JSON when done: { "urls": ["https://...", ...] }`;
}

export function buildRefinementCuratePrompt(
  existing: CollectionOutput,
  newSections: ExtractedSection[],
  gaps: CurationGap[],
  brief: FramingBrief,
): string {
  return `Refine an existing curated collection by addressing identified gaps.

<existing_collection>
${JSON.stringify({ title: existing.title, intro: existing.intro, sections: existing.sections }, null, 2)}
</existing_collection>

<gaps_to_address>
${gaps.map((g) => `- [${g.kind}] ${g.sectionTitle}: ${g.description}`).join('\n')}
</gaps_to_address>

<new_extracted_data>
${JSON.stringify(
  newSections.map((s) => ({ title: s.title, items: s.items })),
  null,
  2,
)}
</new_extracted_data>

<framing_brief>
${formatFramingBrief(brief)}
</framing_brief>

<task>
Merge the new product data into the existing collection to address the listed gaps.

- Use only sourceUrl values present in the existing collection or the new extracted data — the goal is an honest shortlist, not a curated-sounding list with invented URLs
- Supplement or replace sections that had gaps; preserve all sections and items not affected
- Remove items that violate hard constraints listed in the gaps
- Deduplicate by sourceUrl — do not repeat items already in the collection
- Leave gaps unfilled and flagged as unresolved warnings when the provided data is insufficient
- Update warnings to reflect what was resolved and what remains
- Apply the same curatorial lens and note style as the existing collection
- Drop items with no usable data
</task>

Return only valid JSON matching the schema in your system prompt.`;
}
