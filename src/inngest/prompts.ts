import { z } from "zod";
import type {
	CategoryResearchBrief,
	CollectionOutput,
	CurationGap,
	ExtractedSection,
	FramingBrief,
	InterviewQuestion,
	SectionPlan,
} from "./types";
import { CURATOR_PERSONA } from "./workspace/CURATOR";

export const CURATOR_SYSTEM_PROMPT = CURATOR_PERSONA;

export const InterviewQuestionSchema = z.object({
	id: z.string().describe("snake_case identifier"),
	text: z.string().describe("The question text shown to the user"),
	options: z
		.array(
			z.object({
				value: z.string().describe("Short option label"),
				description: z.string().describe("One-line explanation"),
			}),
		)
		.min(2)
		.max(6),
	multi: z
		.preprocess(
			(v) =>
				typeof v !== "boolean"
					? [true, 1, "true", "t", "1"].includes(v as never)
					: v,
			z.boolean(),
		)
		.describe("true if the user can select multiple options"),
});

export const InterviewQuestionsSchema = z
	.array(InterviewQuestionSchema)
	.min(3)
	.max(5);

export const FollowUpQuestionsSchema = z.array(InterviewQuestionSchema).min(1);

const questionsJsonSchema = JSON.stringify(
	z.toJSONSchema(InterviewQuestionsSchema),
	null,
	2,
);

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
	return `Generate exactly 3 focused Round 1 interview questions to help curate a product collection on this topic:

"${topic}"

Round 1 should stay lightweight. It should uncover:
- Who this is for and the scenario
- What outcome matters most
- Hard constraints (budget, shipping, brand avoidances, etc.)

Rules:
- Keep the questions broad and approachable — no jargon
- Make the questions specific enough to anchor the brief, but not exhaustive
- Provide 3-5 options per question with short descriptions
- Use multi: false unless multiple answers are genuinely helpful
- Always include one constraints question with a "No constraints" option
- The last question should always ask about constraints

Return a JSON array matching this schema exactly — no markdown, no explanation:
${followUpQuestionsJsonSchema}`;
}

export function buildCategoryResearchPrompt(
	topic: string,
	questions: InterviewQuestion[],
	answers: Record<string, string>,
): string {
	return `Research the category behind this curation request before planning the collection.

Topic: ${topic}

${formatAnswers(questions, answers)}

Your job:
- Identify the real subcategories and decision structure in this space
- Surface the main tradeoffs and buyer pitfalls
- Note gift-giving considerations if this appears gift-related
- Note art direction / taste considerations if this appears style-sensitive
- Decide whether a second round of questions is needed

Rules:
- Use web search to understand the category, not to collect product URLs yet
- Focus on buyer decision-making, hospitality, and curation structure
- Keep followUpQuestionGoals short and high-signal
- Set followUpNeeded to true only if one or two clarifications would materially improve the plan

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

Topic: ${topic}

Round 1:
${formatAnswers(questions, answers)}

Category research:
${JSON.stringify(research, null, 2)}

Rules:
- Ask only what is necessary to resolve the highest-value ambiguity
- Usually ask 1-2 questions, but ask more if the category genuinely needs it
- Keep the questions conversational and easy to answer
- Prefer fork-in-the-road questions over broad surveys
- If a constraints question is needed, include a "No constraints" option

Return a JSON array matching this schema exactly — no markdown, no explanation:
${questionsJsonSchema}`;
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
			? `\n\nRound 2:\n${formatAnswers(round2Questions, round2Answers)}`
			: "";

	return `Build a concise curatorial brief that the planner and curator should follow.

Topic: ${topic}

Round 1:
${formatAnswers(round1Questions, round1Answers)}${round2Block}

Category research:
${JSON.stringify(research, null, 2)}

The brief should define:
- who this is for
- what the collection is trying to do
- the taste or style direction if relevant
- the main tradeoffs
- what success looks like
- what to avoid
- practical planning notes

Return only valid JSON matching this schema:
${framingBriefJsonSchema}`;
}

function formatAnswers(
	questions: InterviewQuestion[],
	answers: Record<string, string>,
): string {
	return questions
		.map((q) => `${q.text}\n→ ${answers[q.id] ?? "(no answer)"}`)
		.join("\n\n");
}

export function buildUrlDiscoverySystemPrompt(): string {
	const now = new Date();
	const month = now.toLocaleString("en-US", { month: "long" });
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

export function buildPlanPrompt(topic: string, brief: FramingBrief): string {
	return `Topic: ${topic}

Framing brief:
${formatFramingBrief(brief)}

Plan a focused product collection. Determine:
1. A specific, purposeful title (not "Best X" or "Top Y")
2. A 1-2 sentence intro naming the real scenario
3. 3-6 named sections, each with a clear purpose and a targetCount (how many items to find)

Use the framing brief to decide the structure. Section roles may include safe defaults, practical anchors, signature picks, elevated options, or delight moments where relevant.

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
	brief: FramingBrief,
): string {
	const candidateTarget = section.targetCount * 2 + 2;
	return `Find ${candidateTarget} candidate product page URLs for the "${section.title}" section of a collection on: ${topic}

Framing brief:
${formatFramingBrief(brief)}

Section rationale: ${section.rationale}

Search one query at a time. Stop as soon as you have ${candidateTarget} product page URLs across different brands and retailers.

Output ONLY valid JSON when done: { "urls": ["https://...", ...] }`;
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

	return `You have extracted product page data for a collection titled "${planTitle}".

Framing brief:
${formatFramingBrief(brief)}

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
- Prefer items that fit the recipient context, success definition, and tradeoffs in the framing brief
- Where relevant, preserve room for one or two signature picks that feel unusually thoughtful rather than merely correct

When flagging warnings, be specific and actionable. Each warning must name:
  1. The section affected
  2. Exactly what is missing or wrong (specific product type, constraint violated, etc.)
  3. A ready-to-use search query to find a replacement (e.g. "wool base layer merino under $100 site:icebreaker.com OR woolx.com")
Format: "[section]: [problem] — search: [query]"
Only flag things that more URL discovery could actually fix. Skip informational gaps that are just editorial notes.

Return only valid JSON matching the schema in your system prompt.`;
}

export function buildHospitalityPassPrompt(
	collection: CollectionOutput,
	brief: FramingBrief,
): string {
	return `You are improving a curated collection using hospitality principles.

Framing brief:
${formatFramingBrief(brief)}

Current collection:
${JSON.stringify(collection, null, 2)}

Your job:
- Keep the collection practical and decision-useful
- Make it feel more specifically tailored to the person or scenario
- Strengthen one or two items or notes so the collection feels unusually thoughtful
- Do not add fluff, extra sections, or generic luxury language

Rules:
- Preserve valid URLs and items unless there is a clear reason to remove or replace them
- Keep note style concise and specific
- Use warnings when the data is too weak to improve honestly

Return only valid JSON matching the schema in your system prompt.`;
}

export function buildGapsPrompt(collection: CollectionOutput): string {
	return `You are reviewing a curated product collection for actionable gaps.

Collection: "${collection.title}"

Warnings flagged by the curator:
${collection.warnings.map((w, i) => `${i + 1}. ${w}`).join("\n")}

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
	brief: FramingBrief,
): string {
	return `Find 4-8 candidate product page URLs to address this gap in a collection on: ${topic}

Gap type: ${gap.kind}
Section: ${gap.sectionTitle}
Gap description: ${gap.description}
Search hint: ${gap.searchHint}

Framing brief:
${formatFramingBrief(brief)}

Search one query at a time. Stop as soon as you have 4-8 product page URLs.
Use web search. Prioritise independent specialty retailers.
Return individual product page URLs only — not category or listing pages.
Output ONLY valid JSON when done: { "urls": ["https://...", ...] }`;
}

export function buildRefinementCuratePrompt(
	existing: CollectionOutput,
	newSections: ExtractedSection[],
	gaps: CurationGap[],
	brief: FramingBrief,
): string {
	return `You are refining an existing curated product collection by addressing identified gaps.

Existing collection:
${JSON.stringify({ title: existing.title, intro: existing.intro, sections: existing.sections }, null, 2)}

Gaps being addressed in this pass:
${gaps.map((g) => `- [${g.kind}] ${g.sectionTitle}: ${g.description}`).join("\n")}

New extracted product data for these gaps:
${JSON.stringify(
	newSections.map((s) => ({ title: s.title, items: s.items })),
	null,
	2,
)}

Framing brief:
${formatFramingBrief(brief)}

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
