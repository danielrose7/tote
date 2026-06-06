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
import { canUseChat } from "../../../lib/chatAuth";
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
	items: {
		id?: string;
		title: string;
		url: string;
		price?: string;
		description?: string;
		slotId?: string;
		slotName?: string;
	}[];
	slots?: { id: string; name: string; productIds: string[] }[];
}

// Accumulated extraction costs tracked across tool calls in one request
type ExtractionCosts = {
	cfCount: number;
	geminiInputTokens: number;
	geminiOutputTokens: number;
};

type ExtractProductOutput =
	| {
			title: string | null;
			url: string;
			imageUrl: string | null;
			price: string | null;
			currency: string | null;
			brand: string | null;
			description: string | null;
	  }
	| {
			type: "collection";
			title: string;
			url: string;
			products: {
				title: string | null;
				url: string;
				imageUrl: string | null;
				price: string | null;
				currency: string | null;
				brand: string | null;
				description: string | null;
			}[];
	  }
	| null;

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

const MARKETPLACE_SEARCH_EXCLUSIONS = [
	"site:amazon.com",
	"site:walmart.com",
	"site:ebay.com",
	"site:aliexpress.com",
	"site:temu.com",
];

const MARKETPLACE_HOST_PATTERNS = [
	/(^|\.)amazon\./i,
	/(^|\.)walmart\.com$/i,
	/(^|\.)ebay\.com$/i,
	/(^|\.)aliexpress\.com$/i,
	/(^|\.)temu\.com$/i,
];

function userExplicitlyRequestedMarketplace(query: string): boolean {
	return /\b(amazon|walmart|ebay|aliexpress|temu)\b/i.test(query);
}

function isGenericMarketplaceUrl(url: string): boolean {
	try {
		const hostname = new URL(url).hostname;
		return MARKETPLACE_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
	} catch {
		return false;
	}
}

function canonicalProductUrl(url: string): string {
	try {
		const parsed = new URL(url);
		parsed.hash = "";
		for (const param of [...parsed.searchParams.keys()]) {
			if (
				/^utm_/i.test(param) ||
				["fbclid", "gclid", "gbraid", "wbraid"].includes(param.toLowerCase())
			) {
				parsed.searchParams.delete(param);
			}
		}
		parsed.searchParams.sort();
		return parsed.href.replace(/\/$/, "").toLowerCase();
	} catch {
		return url.replace(/\/$/, "").toLowerCase();
	}
}

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

	if (!userExplicitlyRequestedMarketplace(query)) {
		for (const exclusion of MARKETPLACE_SEARCH_EXCLUSIONS) {
			if (!lowerQuery.includes(`-${exclusion}`)) {
				additions.push(`-${exclusion}`);
			}
		}
	}

	return [query.trim(), ...additions].filter(Boolean).join(" ");
}

export async function POST(req: Request) {
	const { userId } = await auth();
	if (!userId) {
		return new Response("Unauthorized", { status: 401 });
	}

	if (!(await canUseChat())) {
		return Response.json({ error: "Forbidden" }, { status: 403 });
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
	const extractedProductCache = new Map<
		string,
		Promise<ExtractProductOutput>
	>();
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
			organize_collection: tool({
				description:
					"Propose a slot organization for the current collection's existing products. Use this when the user asks to organize, tidy, group, clean up, make slots, make sections, restructure, or sort the current collection. Never use this for finding new products.",
				inputSchema: z.object({
					summary: z
						.string()
						.describe(
							"One concise sentence describing the proposed organization.",
						),
					slots: z
						.array(
							z.object({
								name: z.string().describe("Proposed slot name."),
								rationale: z
									.string()
									.describe("Short reason these products belong together."),
								existingSlotId: z
									.string()
									.optional()
									.describe(
										"Existing slot ID to reuse/rename. Omit for a new slot.",
									),
								productIds: z
									.array(z.string())
									.describe("Existing product IDs to move into this slot."),
							}),
						)
						.describe("Final proposed slots and product memberships."),
					removeSlotIds: z
						.array(z.string())
						.optional()
						.describe(
							"Existing slot IDs to remove after moving products. Only include slots made empty by this plan or clearly redundant empty slots.",
						),
					ungroupedProductIds: z
						.array(z.string())
						.optional()
						.describe(
							"Product IDs that should stay directly in the collection because they are ambiguous or do not fit the proposed slots.",
						),
				}),
				execute: async (proposal) => ({
					type: "organization_proposal",
					...proposal,
				}),
			}),

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
					"Search the web for purchasable products matching a query. Use this to find candidate product URLs on brand-direct and specialty retailer sites, not Amazon, generic marketplaces, articles, guides, care resources, or inspiration pages.",
				inputSchema: z.object({
					query: z
						.string()
						.describe(
							"Specific shopping query for purchasable products — focus on attributes, use case, price range, and product category. Include shopping intent such as buy/shop/gift/product. Avoid Amazon/generic marketplaces and informational words like guide, routine, blog, resources, or how-to.",
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
						.describe(
							"A direct product page URL to extract metadata from. Prefer brand-direct and specialty retailer URLs; avoid Amazon and generic marketplaces unless the user explicitly requested that marketplace.",
						),
				}),
				execute: async ({ url }) => {
					const cacheKey = canonicalProductUrl(url);
					const cached = extractedProductCache.get(cacheKey);
					if (cached) return cached;

					const extraction = (async (): Promise<ExtractProductOutput> => {
						try {
							if (
								isGenericMarketplaceUrl(url) &&
								!modelMessages.some(
									(message) =>
										message.role === "user" &&
										Array.isArray(message.content) &&
										message.content.some(
											(part) =>
												part.type === "text" &&
												userExplicitlyRequestedMarketplace(part.text),
										),
								)
							) {
								return null;
							}

							const result = await extractUrl(url);

							if (
								result.tier === "cf" ||
								result.tier === "collection-expanded"
							) {
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
					})();

					extractedProductCache.set(cacheKey, extraction);
					return extraction;
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
		"2. If the user asks to organize, tidy, group, clean up, make slots, make sections, restructure, or sort CURRENT items, call organize_collection ONCE and stop.",
		"3. If the request needs product-search direction first, call clarify_search_direction ONCE and stop.",
		"4. If the request is concrete enough, translate it into a shopping query for purchasable products, then call search_products ONCE with that focused query.",
		"5. Call extract_product on 2–4 distinct, most promising individual product page URLs from the search results — call them in parallel if possible.",
		"6. Stop after extract_product calls complete. The UI renders product cards automatically.",
		"</workflow>",
		"",
		"<organize_current_items>",
		"- The collection_context below is authoritative. It already contains the current products and IDs available to organize.",
		"- If Items already in collection are listed, do not ask the user to provide item names or IDs.",
		"- If no current products are listed in collection_context, say the collection items are not loaded and ask the user to refresh before organizing.",
		"- Use organize_collection only for existing products already listed in collection_context.",
		"- Never suggest or search for new products in organize_collection.",
		"- Use product IDs exactly as provided. Do not invent product IDs.",
		"- Prefer a soft tidy by default: respect useful existing slots, add stray products where they belong, and remove only empty/redundant slots.",
		"- If the user says redo everything, start over, or full tidy, you may propose a new slot structure for all products.",
		'- Slot names should describe decision criteria or utility, not generic buckets. Good: "Used daily", "Worth the counter space", "Consumables and refills". Weak: "Miscellaneous", "Other", "Products".',
		"- Leave ambiguous products ungrouped instead of forcing them into a bad slot.",
		"</organize_current_items>",
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
		"- Prefer brand-direct, maker, independent retailer, and specialty retailer product pages.",
		"- Avoid Amazon and generic marketplaces unless the user explicitly asks for one. They are weak candidates for Tote curation because the collection should point to specific makers, brands, and specialty stores when possible.",
		"- Extract URLs that look like individual purchasable product pages. Informational pages, category navigation, roundups, and advice pages are weak candidates because the user needs addable products.",
		"- Deduplicate before extraction: never call extract_product twice for the same URL, same canonical product page, or same product model.",
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
		"- Prefer direct product pages over category or listing pages.",
		"- Do not show or extract duplicate products. If two search results point to the same product, keep the stronger direct product page and discard the duplicate.",
		"- Do not extract Amazon or generic marketplace URLs unless the user explicitly requested that marketplace.",
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
				.map((i) => {
					const details = [
						i.id ? `id: ${i.id}` : null,
						i.price ? `price: ${i.price}` : null,
						i.slotName ? `slot: ${i.slotName}` : "slot: none",
						i.description
							? `description: ${i.description.slice(0, 160)}`
							: null,
					]
						.filter(Boolean)
						.join("; ");
					return `  - ${i.title}${details ? ` (${details})` : ""}`;
				})
				.join("\n");
			parts.push(`Items already in collection:\n${itemList}`);
			parts.push("Avoid suggesting products already in the collection.");
		} else {
			parts.push("Items already in collection: none loaded");
		}
		if (collection.slots && collection.slots.length > 0) {
			const slotList = collection.slots
				.map(
					(slot) =>
						`  - ${slot.name} (id: ${slot.id}; products: ${slot.productIds.join(", ") || "none"})`,
				)
				.join("\n");
			parts.push(`Existing slots:\n${slotList}`);
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
