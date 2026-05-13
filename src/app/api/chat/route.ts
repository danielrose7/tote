import {
	createGoogleGenerativeAI,
	type GoogleLanguageModelOptions,
} from "@ai-sdk/google";
import { auth } from "@clerk/nextjs/server";
import {
	convertToModelMessages,
	stepCountIs,
	streamText,
	tool,
	type UIMessage,
} from "ai";
import { z } from "zod";
import { extractUrl } from "../../../inngest/server-extraction";
import { braveSearch } from "../../../lib/braveSearch";
import {
	CF_PUPPETEER_COST_CENTS,
	deductCredits,
	hasPositiveCreditBalance,
	runCostCents,
} from "../../../lib/credits";
import { MODELS } from "../../../lib/models";

export const maxDuration = 60;

const google = createGoogleGenerativeAI({
	apiKey: process.env.GEMINI_API_KEY,
});

interface CollectionContext {
	title: string;
	description?: string;
	curatorSessionId?: string;
	curatorTopic?: string;
	curatorBriefJson?: string;
	items: { title: string; url: string; price?: string }[];
}

// Accumulated extraction costs tracked across tool calls in one request
type ExtractionCosts = {
	cfCount: number;
	geminiInputTokens: number;
	geminiOutputTokens: number;
};

const CHAT_THINKING_BUDGET = 1024;

const INFORMATIONAL_SEARCH_TERMS = [
	"blog",
	"blogs",
	"care guide",
	"care information",
	"guide",
	"guides",
	"how to",
	"information",
	"resource",
	"resources",
	"routine",
	"tips",
];

function buildProductSearchQuery(
	query: string,
	collection: CollectionContext | null,
): string {
	const lowerQuery = query.toLowerCase();
	const additions: string[] = [];

	if (!/\b(buy|shop|product|products|gift|gifts|for sale)\b/i.test(query)) {
		additions.push("buy", "shop");
	}

	if (
		collection?.title &&
		/\b(gift|gifts|giving|present|presents)\b/i.test(collection.title) &&
		!/\b(gift|gifts|giving|present|presents)\b/i.test(query)
	) {
		additions.push("gift");
	}

	for (const term of INFORMATIONAL_SEARCH_TERMS) {
		const excludedTerm = term.includes(" ") ? `-"${term}"` : `-${term}`;
		if (
			!lowerQuery.includes(`-${term}`) &&
			!lowerQuery.includes(`-"${term}"`)
		) {
			additions.push(excludedTerm);
		}
	}

	return [query.trim(), ...additions].filter(Boolean).join(" ");
}

export async function POST(req: Request) {
	const { userId } = await auth();
	if (!userId) {
		return new Response("Unauthorized", { status: 401 });
	}

	if (!(await hasPositiveCreditBalance(userId))) {
		return Response.json({ error: "Insufficient credits" }, { status: 402 });
	}

	const body = await req.json();
	const {
		messages,
		collectionContext,
		collectionId,
		seedContext,
	}: {
		messages: UIMessage[];
		collectionContext: CollectionContext | null;
		collectionId?: string;
		seedContext?: string;
	} = body;

	const extractionCosts: ExtractionCosts = {
		cfCount: 0,
		geminiInputTokens: 0,
		geminiOutputTokens: 0,
	};
	let braveSearchCount = 0;

	const systemPrompt = buildSystemPrompt(collectionContext, seedContext);

	const modelMessages = await convertToModelMessages(messages);

	const result = streamText({
		model: google(MODELS.geminiFlash),
		system: systemPrompt,
		messages: modelMessages,
		providerOptions: {
			google: {
				thinkingConfig: {
					thinkingBudget: CHAT_THINKING_BUDGET,
					includeThoughts: false,
				},
			} satisfies GoogleLanguageModelOptions,
		},
		stopWhen: stepCountIs(4),
		tools: {
			clarify_search_direction: tool({
				description:
					"Ask one short natural-language clarification question when the user request is too broad to search well. Use this instead of search_products when there is no seed context/contextual URL and the user gave only a theme, vibe, or broad direction.",
				inputSchema: z.object({
					question: z
						.string()
						.describe(
							"A concise question offering 2–4 product directions in prose. Ask only for the direction needed to search well.",
						),
				}),
				execute: async ({ question }) => ({
					type: "clarification",
					question,
				}),
			}),

			search_products: tool({
				description:
					"Search the web for purchasable products matching a query. Use this to find candidate product URLs, not articles, guides, care resources, or inspiration pages.",
				inputSchema: z.object({
					query: z
						.string()
						.describe(
							"Specific shopping query for purchasable products — focus on attributes, use case, price range, and product category. Include shopping intent such as buy/shop/gift/product, and avoid informational words like guide, routine, blog, resources, or how-to.",
						),
				}),
				execute: async ({ query }) => {
					braveSearchCount++;
					const productQuery = buildProductSearchQuery(
						query,
						collectionContext,
					);
					const results = await braveSearch({ query: productQuery, count: 10 });
					return results.map((r) => ({
						title: r.title,
						url: r.url,
						description: r.description,
					}));
				},
			}),

			extract_product: tool({
				description:
					"Fetch a product page URL and extract structured metadata (title, price, image, description). Use this on individual product page URLs found via search.",
				inputSchema: z.object({
					url: z
						.string()
						.url()
						.describe("A direct product page URL to extract metadata from"),
				}),
				execute: async ({ url }) => {
					try {
						const result = await extractUrl(url);

						if (result.tier === "cf" || result.tier === "collection-expanded") {
							extractionCosts.cfCount++;
						} else if (result.tier === "gemini") {
							extractionCosts.geminiInputTokens += result.usage.inputTokens;
							extractionCosts.geminiOutputTokens += result.usage.outputTokens;
						}

						const items = result.items
							.filter((i) => i.title || i.imageUrl || i.price)
							.slice(0, result.tier === "collection-expanded" ? 3 : 1)
							.map((item) => ({
								title: item.title ?? null,
								url: item.sourceUrl ?? url,
								imageUrl: item.imageUrl ?? null,
								price: item.price ?? null,
								currency: item.currency ?? null,
								brand: item.brand ?? null,
								description: item.description ?? null,
							}));
						if (items.length === 0) return null;
						if (result.tier === "collection-expanded") {
							let hostname = url;
							try {
								hostname = new URL(url).hostname.replace(/^www\./, "");
							} catch {}
							return {
								type: "collection",
								title: `Products from ${hostname}`,
								url,
								products: items,
							};
						}
						return items[0];
					} catch {
						return null;
					}
				},
			}),
		},

		onError(error) {
			console.error("[chat] streamText error", error);
		},

		async onFinish({ usage }) {
			try {
				// Chat model (Gemini Flash) tokens
				const chatCents = runCostCents(
					usage.inputTokens ?? 0,
					usage.outputTokens ?? 0,
					0,
					MODELS.geminiFlash,
				);
				const searchCents = braveSearchCount * 0.5; // BRAVE_SEARCH_COST_CENTS
				const cfCents = extractionCosts.cfCount * CF_PUPPETEER_COST_CENTS;
				// Extraction fallback via Gemini URL Context
				const extractionCents = runCostCents(
					extractionCosts.geminiInputTokens,
					extractionCosts.geminiOutputTokens,
					0,
					MODELS.geminiFlash,
				);

				const totalCents = Math.ceil(
					chatCents + searchCents + cfCents + extractionCents,
				);

				await deductCredits(
					userId,
					totalCents,
					`chat:${collectionId ?? "search"}`,
					usage.inputTokens ?? 0,
					usage.outputTokens ?? 0,
					braveSearchCount,
					"chat",
					{
						cfCount: extractionCosts.cfCount,
						model: MODELS.geminiFlash,
						provider: "google",
						feature: "chat",
						referenceId: collectionId ?? "search",
						metadata: {
							extractionInputTokens: extractionCosts.geminiInputTokens,
							extractionOutputTokens: extractionCosts.geminiOutputTokens,
							chatCents,
							searchCents,
							cfCents,
							extractionCents,
							collectionId: collectionId ?? null,
							curatorSessionId: collectionContext?.curatorSessionId ?? null,
						},
					},
				);
			} catch (err) {
				console.warn("[chat] credit deduction failed", err);
			}
		},
	});

	return result.toUIMessageStreamResponse({ sendReasoning: false });
}

function buildSystemPrompt(
	collection: CollectionContext | null,
	seedContext?: string,
): string {
	const parts: string[] = [
		"<role>",
		"You are a helpful product search assistant for Tote, a product curation tool.",
		"Your job is to help users find products to add to their collections.",
		"</role>",
		"",
		"<workflow>",
		"1. Decide whether the user's request is concrete enough to search now.",
		"2. If the request needs direction first, call clarify_search_direction ONCE and stop.",
		"3. If the request is concrete enough, translate it into a shopping query for purchasable products, then call search_products ONCE with that focused query.",
		"4. Call extract_product on 2–4 of the most promising individual product page URLs from the search results — call them in parallel if possible.",
		"5. Stop after extract_product calls complete. The UI renders product cards automatically.",
		"</workflow>",
		"",
		"<clarification>",
		"- Use clarify_search_direction when the user gives only a broad theme, vibe, or collection direction and there is no seed_context or contextual URL.",
		"- Make the question easy to answer by offering 2–4 product directions in prose.",
		"- Use the collection context to choose useful directions, but avoid inventing a full brief.",
		"- After clarify_search_direction, stop. Wait for the user to answer before searching.",
		'- Example: User says "we need more plant stuff" in a kitchen gift collection. Ask: "Should I look first for edible indoor growing kits, practical plant-care tools, decorative planters, or low-maintenance live plants?"',
		"</clarification>",
		"",
		"<query_planning>",
		"- Silently form 2–3 candidate queries before calling search_products. Choose the query most likely to return individual product pages.",
		"- Build the chosen query from: product form + differentiating attributes + recipient/use case + collection constraint + shopping intent.",
		"- Favor attribute-first queries around use case and quality signals. This lets current search results surface the best makers and retailers instead of anchoring on brands from model memory.",
		"- Prefer concrete buyable nouns over abstract topic nouns. Good query nouns include kit, set, tool, appliance, organizer, pan, knife, scale, lamp, subscription, refill, accessory, bundle, planter, garden, or sprouter.",
		"- Add 1–3 specific attributes that separate useful products from generic results: material, size, compatibility, countertop, compact, starter, self-watering, dishwasher-safe, rechargeable, under $X, gift, beginner, professional, indoor, etc.",
		"- Include collection context when it matters, but do not overfit to the collection title if it would make the query unnatural.",
		"- Translate vague, conversational, or thematic requests into buyable product forms. Keep the query broad enough that multiple brands or stores could match unless the user named a brand.",
		"</query_planning>",
		"",
		"<result_selection>",
		"- Treat phrases like missing, gap, need more, or options as a request for products that fill a collection gap.",
		"- Search for objects someone can buy, not content about the topic. Use product-category nouns and shopping intent words such as buy, shop, gift, product, kit, tool, or countertop when relevant.",
		"- Prefer brand-direct, maker, and specialty retailer product pages over editorial roundups, marketplace search pages, category pages, or care guides.",
		"- Extract URLs that look like individual purchasable product pages. Informational pages, category navigation, roundups, and advice pages are weak candidates because the user needs addable products.",
		"</result_selection>",
		"",
		"<examples>",
		'- User: "we are missing [broad category] options". Weak query: "[broad category] resources". Strong query: "[buyable product forms in that category] [relevant collection constraint] buy shop".',
		'- User: "need something for sourdough" in a home-cook collection. Weak query: "sourdough ideas". Strong query: "sourdough starter kit bread lame proofing basket gift buy".',
		'- User: "more storage maybe?" in a small-kitchen collection. Weak query: "kitchen storage ideas". Strong query: "compact kitchen organizer stackable pantry storage product buy".',
		'- User: "less plasticky option" for an existing item. Weak query: "eco friendly alternative". Strong query: "stainless steel glass alternative [product category] durable buy".',
		"</examples>",
		"",
		"<rules>",
		"- Stay in scope: you are only for finding product suggestions to add to the current collection.",
		"- If the user asks how Tote works, asks for account/billing/support help, asks about app features, or asks anything unrelated to finding products, briefly explain that you do not have Tote support or account tools in this chat and can only search for products for the current collection. Then ask what kind of product they want to find.",
		"- For concrete product requests, complete the workflow in a single search + extract round.",
		"- For broad requests, ask one clarification question with clarify_search_direction instead of searching prematurely.",
		"- Wait until extract_product calls have completed before any text response.",
		"- Let extracted product cards carry product details; keep assistant text empty after successful extraction.",
		"- Use only URLs and product facts present in tool results.",
		"- Prefer direct product pages over category or listing pages",
		"</rules>",
	];

	if (collection) {
		parts.push("", "<collection_context>");
		parts.push(`Current collection: "${collection.title}"`);
		if (collection.description) {
			parts.push(`Collection intro: ${collection.description}`);
		}
		if (collection.curatorTopic) {
			parts.push(`Original curator request: ${collection.curatorTopic}`);
		}
		if (collection.curatorBriefJson) {
			parts.push(
				"",
				"Original curator framing brief for this collection:",
				collection.curatorBriefJson,
				"Use this brief as the strongest source of intent, constraints, taste direction, and avoidances.",
			);
		}
		if (collection.items.length > 0) {
			const itemList = collection.items
				.slice(0, 20)
				.map((i) => `  - ${i.title}${i.price ? ` (${i.price})` : ""}`)
				.join("\n");
			parts.push(`Items already in collection:\n${itemList}`);
			parts.push("Avoid suggesting products already in the collection.");
		}
		parts.push("</collection_context>");
	}

	if (seedContext) {
		parts.push(
			"",
			"<seed_context>",
			`Context from the curator: ${seedContext}`,
		);
		parts.push(
			"The user wants to find a product to address this gap. Focus your search on this.",
		);
		parts.push("</seed_context>");
	}

	return parts.join("\n");
}
