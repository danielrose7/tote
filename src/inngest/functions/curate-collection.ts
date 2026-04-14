import { deductCredits, runCostCents } from "../../lib/credits";
import { patchSession, writeSession } from "../../lib/curatorSession";
import {
	completeCuratorSession,
	createCuratorSession,
	failCuratorSession,
} from "../../lib/curatorSessionsDb";
import { logStep } from "../../lib/curatorStepLog";
import { curationChannel } from "../channels";
import { inngest } from "../client";
import { createLLMClient } from "../llm";
import {
	buildCategoryResearchPrompt,
	buildCuratePrompt,
	buildFramingPrompt,
	buildGapsPrompt,
	buildHospitalityPassPrompt,
	buildPlanPrompt,
	buildRefinementCuratePrompt,
	buildRefinementUrlPrompt,
	buildRound1QuestionsPrompt,
	buildRound2QuestionsPrompt,
	buildUrlDiscoveryPrompt,
	buildUrlDiscoverySystemPrompt,
	CategoryResearchBriefSchema,
	CURATOR_SYSTEM_PROMPT,
	FollowUpQuestionsSchema,
	FramingBriefSchema,
	InterviewQuestionsSchema,
} from "../prompts";
import type {
	CollectionOutput,
	CurationAnswersEvent,
	CurationExtractionsEvent,
	CurationGap,
	CurationStartEvent,
	ExtractedSection,
	InterviewQuestion,
	SectionPlan,
	UrlSection,
} from "../types";

const llm = createLLMClient();

type UrlDiscoveryPayload = { urls: string[] };

function parseJson<T>(text: string): T | null {
	// Strip markdown code fences if present
	const stripped = text
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```\s*$/, "")
		.trim();
	// Try direct parse first
	try {
		return JSON.parse(stripped) as T;
	} catch {
		// Try to extract JSON array or object from mixed content
		const match = stripped.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
		if (match) {
			try {
				return JSON.parse(match[0]) as T;
			} catch {
				return null;
			}
		}
		return null;
	}
}

function parameterize(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

function nowIso(): string {
	return new Date().toISOString();
}

function planTokenLimit() {
	return 4000;
}

function interviewTokenLimit() {
	return 4000;
}

function researchTokenLimit() {
	return 5000;
}

function framingTokenLimit() {
	return 4000;
}

function urlDiscoveryTokenLimit() {
	return 4000;
}

function curateTokenLimit() {
	return 16000;
}

function hospitalityTokenLimit() {
	return 12000;
}

export const curateCollection = inngest.createFunction(
	{
		id: "curate-collection",
		retries: 14,
		triggers: [{ event: "curation/start" as CurationStartEvent["name"] }],
		// Utah: singleton per session — no race conditions if triggered twice
		concurrency: { key: "event.data.sessionId", limit: 1 },
		// Utah: cancel current run if user starts fresh for the same session
		cancelOn: [
			{
				event: "curation/start" as CurationStartEvent["name"],
				if: "async.data.sessionId == event.data.sessionId",
			},
		],
		onFailure: async ({ event, step }) => {
			const sessionId = (event.data.event as CurationStartEvent).data.sessionId;
			console.error("[curate-collection] run-failed", {
				at: nowIso(),
				sessionId,
				error: event.data.error,
			});
			await step.run("persist-failure-phase", () =>
				Promise.all([
					patchSession(sessionId, { phase: "error" }),
					failCuratorSession(sessionId),
				]),
			);
		},
	},
	async ({ event, step, attempt }) => {
		const { sessionId, topic, requestedBy } = event.data;
		const ch = curationChannel({ sessionId });
		console.log("[curate-collection] run-start", {
			at: nowIso(),
			sessionId,
			topic,
		});

		await step.realtime.publish("acknowledged", ch.progress, {
			step: "acknowledged",
			message: "Workflow started — generating Round 1 questions…",
		});

		// Step 1: Generate context-specific Round 1 questions
		const round1QuestionResult = await step.run(
			"generate-questions-r1",
			async () => {
				const maxTokens = 4096 + attempt * 2048;
				const response = await llm.generate({
					system:
						"You are a product curation assistant. Return only valid JSON arrays — no markdown, no explanation.",
					prompt: buildRound1QuestionsPrompt(topic),
					maxTokens: Math.max(maxTokens, interviewTokenLimit()),
				});
				const raw = parseJson<unknown>(response.text);
				const result = InterviewQuestionsSchema.safeParse(raw);
				if (!result.success) {
					throw new Error(
						`Failed to parse questions: ${JSON.stringify(result.error.issues)} | raw: ${response.text.slice(0, 300)}`,
					);
				}
				return {
					questions: result.data,
					usage: response.usage,
					summary: response.summary,
				};
			},
		);

		const round1Questions = round1QuestionResult.questions;

		await step.run("persist-round-1-questions", () =>
			patchSession(sessionId, {
				topic,
				questions: round1Questions,
				questionRound: 1,
				phase: "interview-round-1",
				lastProgressMessage:
					"Round 1 questions sent — waiting for your answers.",
			}),
		);

		await step.realtime.publish("interview-round-1-questions", ch.interview, {
			round: 1,
			questions: round1Questions,
		});
		await step.realtime.publish("interview-round-1-sent", ch.progress, {
			step: "interview-round-1-sent",
			message: "Round 1 questions sent — waiting for your answers.",
		});

		// Persist phase so reconnect can show the interview form without realtime replay
		await step.run("persist-initial-phase", () =>
			Promise.all([
				patchSession(sessionId, { phase: "interview-round-1" }),
				createCuratorSession(sessionId, requestedBy, topic),
			]),
		);

		let totalInputTokens = round1QuestionResult.usage?.inputTokens ?? 0;
		let totalOutputTokens = round1QuestionResult.usage?.outputTokens ?? 0;
		let totalWebSearchRequests = 0;

		if (requestedBy !== "unknown" && round1QuestionResult.usage) {
			const usage = round1QuestionResult.usage;
			await step.run("deduct-credits-generate-questions-r1", () =>
				deductCredits(
					requestedBy,
					runCostCents(usage.inputTokens, usage.outputTokens, 0),
					sessionId,
					usage.inputTokens,
					usage.outputTokens,
					0,
					"generate-questions-r1",
					{
						durationMs: round1QuestionResult.summary?.durationMs,
					},
				),
			);
		}

		// Step 2: Wait for Round 1 answers
		const round1AnswersEvent = await step.waitForEvent("wait-for-answers-r1", {
			event: "curation/answers" as CurationAnswersEvent["name"],
			timeout: "15m",
			if: `async.data.sessionId == "${sessionId}" && async.data.round == 1`,
		});

		if (!round1AnswersEvent) {
			await step.realtime.publish("timed-out", ch.progress, {
				step: "error",
				message:
					"Timed out waiting for answers. Start a new session to try again.",
			});
			await step.run("persist-error-phase", () =>
				patchSession(sessionId, { phase: "error" }),
			);
			return;
		}

		const round1Answers = round1AnswersEvent.data.answers;
		console.log("[curate-collection] answers-round-1-received", {
			at: nowIso(),
			sessionId,
			answers: round1Answers,
		});

		await step.realtime.publish("answers-round-1-received", ch.progress, {
			step: "answers-round-1-received",
			message: "Round 1 answers received. Researching the category...",
		});

		await step.run("persist-research-phase", () =>
			patchSession(sessionId, {
				phase: "researching",
				answers: round1Answers,
				lastProgressMessage:
					"Round 1 answers received. Researching the category...",
			}),
		);

		// Step 3: Research the category before planning
		const categoryResearchResult = await step.run(
			"category-research",
			async () => {
				const response = await llm.generateWithSearch({
					system: CURATOR_SYSTEM_PROMPT,
					prompt: buildCategoryResearchPrompt(
						topic,
						round1Questions,
						round1Answers,
					),
					maxTokens: researchTokenLimit(),
				});
				const raw = parseJson<unknown>(response.text);
				const result = CategoryResearchBriefSchema.safeParse(raw);
				if (!result.success) {
					throw new Error(
						`Failed to parse category research: ${JSON.stringify(result.error.issues)} | raw: ${response.text.slice(0, 300)}`,
					);
				}
				await logStep(sessionId, "category-research", "completed", {
					tradeoffCount: result.data.tradeoffs.length,
					followUpNeeded: result.data.followUpNeeded,
					sectionHypothesisCount: result.data.sectionHypotheses.length,
				});
				return {
					research: result.data,
					usage: response.usage,
					summary: response.summary,
				};
			},
		);

		totalInputTokens += categoryResearchResult.usage?.inputTokens ?? 0;
		totalOutputTokens += categoryResearchResult.usage?.outputTokens ?? 0;
		totalWebSearchRequests +=
			categoryResearchResult.usage?.webSearchRequests ?? 0;

		if (requestedBy !== "unknown" && categoryResearchResult.usage) {
			const usage = categoryResearchResult.usage;
			await step.run("deduct-credits-category-research", () =>
				deductCredits(
					requestedBy,
					runCostCents(
						usage.inputTokens,
						usage.outputTokens,
						usage.webSearchRequests,
					),
					sessionId,
					usage.inputTokens,
					usage.outputTokens,
					usage.webSearchRequests,
					"category-research",
					{
						durationMs: categoryResearchResult.summary?.durationMs,
						codeExecutionCount:
							categoryResearchResult.summary?.codeExecutionCount,
					},
				),
			);
		}

		const research = categoryResearchResult.research;

		await step.run("persist-category-research", () =>
			patchSession(sessionId, {
				phase: research.followUpNeeded ? "interview-round-2" : "framing",
				researchBriefJson: JSON.stringify(research),
				lastProgressMessage: research.followUpNeeded
					? "Category research complete — preparing follow-up questions."
					: "Category research complete — building curatorial brief.",
			}),
		);

		await step.realtime.publish("category-research-complete", ch.progress, {
			step: "category-research-complete",
			message: research.followUpNeeded
				? "Category research complete. A few follow-up questions will sharpen the direction."
				: "Category research complete. Building curatorial brief...",
			detail: research.suggestedLenses.join(", ") || undefined,
		});

		let round2Questions: InterviewQuestion[] = [];
		let round2Answers: Record<string, string> = {};

		if (research.followUpNeeded) {
			const round2QuestionResult = await step.run(
				"generate-questions-r2",
				async () => {
					const response = await llm.generate({
						system:
							"You are a product curation assistant. Return only valid JSON arrays — no markdown, no explanation.",
						prompt: buildRound2QuestionsPrompt(
							topic,
							round1Questions,
							round1Answers,
							research,
						),
						maxTokens: interviewTokenLimit(),
					});
					const raw = parseJson<unknown>(response.text);
					const result = FollowUpQuestionsSchema.safeParse(raw);
					if (!result.success) {
						throw new Error(
							`Failed to parse round 2 questions: ${JSON.stringify(result.error.issues)} | raw: ${response.text.slice(0, 300)}`,
						);
					}
					return {
						questions: result.data,
						usage: response.usage,
						summary: response.summary,
					};
				},
			);

			totalInputTokens += round2QuestionResult.usage?.inputTokens ?? 0;
			totalOutputTokens += round2QuestionResult.usage?.outputTokens ?? 0;

			if (requestedBy !== "unknown" && round2QuestionResult.usage) {
				const usage = round2QuestionResult.usage;
				await step.run("deduct-credits-generate-questions-r2", () =>
					deductCredits(
						requestedBy,
						runCostCents(usage.inputTokens, usage.outputTokens, 0),
						sessionId,
						usage.inputTokens,
						usage.outputTokens,
						0,
						"generate-questions-r2",
						{
							durationMs: round2QuestionResult.summary?.durationMs,
						},
					),
				);
			}

			round2Questions = round2QuestionResult.questions;

			await step.run("persist-round-2-questions", () =>
				patchSession(sessionId, {
					questions: round2Questions,
					questionRound: 2,
					phase: "interview-round-2",
					lastProgressMessage:
						"Round 2 questions sent — waiting for your answers.",
				}),
			);

			await step.realtime.publish("interview-round-2-questions", ch.interview, {
				round: 2,
				questions: round2Questions,
			});
			await step.realtime.publish("interview-round-2-sent", ch.progress, {
				step: "interview-round-2-sent",
				message: "Round 2 questions sent — waiting for your answers.",
			});

			const round2AnswersEvent = await step.waitForEvent(
				"wait-for-answers-r2",
				{
					event: "curation/answers" as CurationAnswersEvent["name"],
					timeout: "15m",
					if: `async.data.sessionId == "${sessionId}" && async.data.round == 2`,
				},
			);

			if (!round2AnswersEvent) {
				await step.realtime.publish("timed-out-r2", ch.progress, {
					step: "error",
					message:
						"Timed out waiting for follow-up answers. Start a new session to try again.",
				});
				await step.run("persist-error-phase-r2", () =>
					patchSession(sessionId, { phase: "error" }),
				);
				return;
			}

			round2Answers = round2AnswersEvent.data.answers;

			await step.realtime.publish("answers-round-2-received", ch.progress, {
				step: "answers-round-2-received",
				message: "Round 2 answers received. Building curatorial brief...",
			});

			await step.run("persist-framing-phase", () =>
				patchSession(sessionId, {
					phase: "framing",
					answers: { ...round1Answers, ...round2Answers },
					lastProgressMessage:
						"Round 2 answers received. Building curatorial brief...",
				}),
			);
		} else {
			await step.run("persist-no-followup-framing-phase", () =>
				patchSession(sessionId, {
					phase: "framing",
					questionRound: 1,
					answers: round1Answers,
					lastProgressMessage: "Building curatorial brief...",
				}),
			);
		}

		// Step 4: Build framing brief
		const framingResult = await step.run("build-framing-brief", async () => {
			const response = await llm.generate({
				system: CURATOR_SYSTEM_PROMPT,
				prompt: buildFramingPrompt(
					topic,
					round1Questions,
					round1Answers,
					research,
					round2Questions,
					round2Answers,
				),
				maxTokens: framingTokenLimit(),
			});
			const raw = parseJson<unknown>(response.text);
			const result = FramingBriefSchema.safeParse(raw);
			if (!result.success) {
				throw new Error(
					`Failed to parse framing brief: ${JSON.stringify(result.error.issues)} | raw: ${response.text.slice(0, 300)}`,
				);
			}
			await logStep(sessionId, "build-framing-brief", "completed", {
				hasTasteDirection: Boolean(result.data.tasteDirection),
				constraintCount: result.data.constraints.length,
				tradeoffCount: result.data.tradeoffs.length,
			});
			return {
				brief: result.data,
				usage: response.usage,
				summary: response.summary,
			};
		});

		totalInputTokens += framingResult.usage?.inputTokens ?? 0;
		totalOutputTokens += framingResult.usage?.outputTokens ?? 0;

		if (requestedBy !== "unknown" && framingResult.usage) {
			const usage = framingResult.usage;
			await step.run("deduct-credits-build-framing-brief", () =>
				deductCredits(
					requestedBy,
					runCostCents(usage.inputTokens, usage.outputTokens, 0),
					sessionId,
					usage.inputTokens,
					usage.outputTokens,
					0,
					"build-framing-brief",
					{
						durationMs: framingResult.summary?.durationMs,
					},
				),
			);
		}

		const framingBrief = framingResult.brief;

		await step.realtime.publish("framing-complete", ch.progress, {
			step: "framing-complete",
			message: "Curatorial brief ready. Planning collection...",
			detail: framingBrief.goal,
		});

		await step.run("persist-planning-phase", () =>
			patchSession(sessionId, {
				phase: "planning",
				questionRound: round2Questions.length > 0 ? 2 : 1,
				answers: { ...round1Answers, ...round2Answers },
				framingBriefJson: JSON.stringify(framingBrief),
				lastProgressMessage: "Curatorial brief ready. Planning collection...",
			}),
		);

		// Step 5: Plan the collection structure
		const planResult = await step.run("plan-collection", async () => {
			console.log("[curate-collection] plan:start", {
				at: nowIso(),
				sessionId,
			});
			const response = await llm.generate({
				system: CURATOR_SYSTEM_PROMPT,
				prompt: buildPlanPrompt(topic, framingBrief),
				maxTokens: planTokenLimit(),
			});
			console.log("[curate-collection] plan:response", {
				at: nowIso(),
				sessionId,
				...response.summary,
			});

			const text = response.text;
			const parsed = parseJson<{
				title: string;
				intro: string;
				sections: SectionPlan[];
			}>(text);

			if (!parsed) {
				console.error("[curate-collection] plan:parse-failed", {
					at: nowIso(),
					sessionId,
					textPreview: text.slice(0, 500),
				});
				throw new Error(`Failed to parse plan: ${text.slice(0, 200)}`);
			}
			console.log("[curate-collection] plan:done", {
				at: nowIso(),
				sessionId,
				sectionCount: parsed.sections.length,
				sections: parsed.sections.map((section) => section.slug),
			});
			await logStep(sessionId, "plan-collection", "completed", {
				sectionCount: parsed.sections.length,
				sections: parsed.sections.map((s) => ({
					slug: s.slug,
					title: s.title,
				})),
			});
			return { ...parsed, usage: response.usage, summary: response.summary };
		});
		const plan = planResult;

		totalInputTokens += planResult.usage?.inputTokens ?? 0;
		totalOutputTokens += planResult.usage?.outputTokens ?? 0;

		if (requestedBy !== "unknown" && planResult.usage) {
			const usage = planResult.usage;
			await step.run("deduct-credits-plan-collection", () =>
				deductCredits(
					requestedBy,
					runCostCents(usage.inputTokens, usage.outputTokens, 0),
					sessionId,
					usage.inputTokens,
					usage.outputTokens,
					0,
					"plan-collection",
					{
						durationMs: planResult.summary?.durationMs,
					},
				),
			);
		}

		await step.realtime.publish("planned", ch.progress, {
			step: "planned",
			message: `Plan ready: ${plan.sections.length} sections`,
			detail: plan.sections.map((s) => s.title).join(", "),
		});

		// Step 6: Discover URLs per section via web search (no page reading)
		// Each section is its own named step so it's individually memoized/retryable
		const urlSections: UrlSection[] = [];

		// Discover URLs sequentially — publish searching event per section just before it starts
		for (const section of plan.sections) {
			const slug = parameterize(section.title);

			await step.realtime.publish(`searching-${slug}`, ch.progress, {
				step: "searching",
				message: `Searching for "${section.title}"...`,
			});

			const found = await step.run(`find-urls-${slug}`, async () => {
				const startedAt = Date.now();
				console.log("[curate-collection] find-urls:start", {
					at: nowIso(),
					sessionId,
					section: section.title,
					slug,
				});
				const response = await llm.generateWithSearch({
					system: buildUrlDiscoverySystemPrompt(),
					prompt: buildUrlDiscoveryPrompt(section, topic, framingBrief),
					maxTokens: urlDiscoveryTokenLimit(),
				});
				console.log("[curate-collection] find-urls:response", {
					...response.summary,
					at: nowIso(),
					sessionId,
					section: section.title,
					slug,
					durationMs: Date.now() - startedAt,
				});

				const text = response.text;
				const parsed = parseJson<UrlDiscoveryPayload>(text);
				if (!parsed) {
					console.error("[curate-collection] find-urls:parse-failed", {
						at: nowIso(),
						sessionId,
						section: section.title,
						slug,
						stopReason: response.summary.stopReason,
						textPreview: text.slice(0, 500),
					});
					return {
						urls: [] as string[],
						usage: null,
						summary: response.summary,
						parseFailed: true,
					};
				}
				console.log("[curate-collection] find-urls:done", {
					at: nowIso(),
					sessionId,
					section: section.title,
					slug,
					urlCount: parsed.urls.length,
				});
				return {
					urls: parsed.urls,
					usage: response.usage,
					summary: response.summary,
					parseFailed: false,
				};
			});

			totalInputTokens += found.usage?.inputTokens ?? 0;
			totalOutputTokens += found.usage?.outputTokens ?? 0;
			totalWebSearchRequests += found.usage?.webSearchRequests ?? 0;

			if (requestedBy !== "unknown" && found.usage) {
				const usage = found.usage;
				await step.run(`deduct-credits-urls-${slug}`, () =>
					deductCredits(
						requestedBy,
						runCostCents(
							usage.inputTokens,
							usage.outputTokens,
							usage.webSearchRequests,
						),
						sessionId,
						usage.inputTokens,
						usage.outputTokens,
						usage.webSearchRequests,
						`find-urls-${slug}`,
						{
							urlCount: found.urls.length,
							codeExecutionCount: found.summary?.codeExecutionCount,
							durationMs: found.summary?.durationMs,
						},
					),
				);
			}

			const domains = found.urls
				.map((u) => {
					try {
						return new URL(u).hostname;
					} catch {
						return u;
					}
				})
				.join(", ");

			await step.realtime.publish(`found-urls-${slug}`, ch.progress, {
				step: found.parseFailed ? "search-parse-failed" : "found-urls",
				message: found.parseFailed
					? `Search returned an unreadable response for "${section.title}"`
					: `Found ${found.urls.length} URLs for "${section.title}"`,
				detail: found.parseFailed
					? "No URLs could be extracted from the model output. This is likely a parsing or formatting issue."
					: domains || undefined,
			});

			urlSections.push({ title: section.title, slug, urls: found.urls });
		}

		// Send all sections in one message so the browser knows the full URL count upfront
		await step.realtime.publish("section-urls", ch["section-urls"], {
			sections: urlSections,
		});

		// Step 7: Persist URL data for reconnect, then wait for extractions
		await step.run("persist-session-urls", () =>
			patchSession(sessionId, {
				phase: "extracting",
				urlSections,
				lastProgressMessage: "URL discovery complete — extracting pages...",
			}),
		);

		// Also publish urls topic for reconnect/sync restore in the browser
		await step.realtime.publish("urls-ready", ch.urls, {
			sections: urlSections,
		});

		const totalUrlCount = urlSections.reduce((n, s) => n + s.urls.length, 0);
		await step.realtime.publish("urls-found", ch.progress, {
			step: "urls-found",
			message: `${totalUrlCount} URLs found across ${urlSections.length} sections`,
		});
		await step.realtime.publish("extraction-queued", ch.progress, {
			step: "extracting",
			message: `Extracting pages with extension...`,
		});

		// Wait for all sections to be extracted in one bulk event
		const extractionsEvt = await step.waitForEvent("wait-for-extractions", {
			event: "curation/extractions" as CurationExtractionsEvent["name"],
			timeout: "30m",
			if: `async.data.sessionId == "${sessionId}"`,
		});

		if (!extractionsEvt) {
			await step.realtime.publish("timed-out-extractions", ch.progress, {
				step: "error",
				message:
					"Timed out waiting for extractions. Start a new session to try again.",
			});
			await step.run("persist-extraction-timeout", () =>
				patchSession(sessionId, { phase: "error" }),
			);
			return;
		}

		const extractedSections: ExtractedSection[] = extractionsEvt.data.sections;
		await step.run("persist-extracted-slugs", () =>
			patchSession(sessionId, {
				extractedSlugs: extractedSections.map((s) => s.slug),
			}),
		);

		const totalExtracted = extractedSections.reduce(
			(n: number, s: ExtractedSection) => n + s.items.length,
			0,
		);
		console.log("[curate-collection] extractions-received", {
			at: nowIso(),
			sessionId,
			sectionCount: extractedSections.length,
			totalExtracted,
		});

		// Step 6: Curate the initial collection
		await step.realtime.publish("curating", ch.progress, {
			step: "curating",
			message: `Extracted ${totalExtracted} items — curating initial collection...`,
		});

		await step.run("persist-curating-phase", () =>
			patchSession(sessionId, {
				phase: "curating",
				lastProgressMessage: `Extracted ${totalExtracted} items — curating initial collection...`,
			}),
		);

		const result = await step.run("curate-and-write", async () => {
			const startedAt = Date.now();
			console.log("[curate-collection] curate:start", {
				at: nowIso(),
				sessionId,
				sectionCount: extractedSections.length,
			});
			const response = await llm.generate({
				system: CURATOR_SYSTEM_PROMPT,
				prompt: buildCuratePrompt(
					plan.title,
					plan.intro,
					extractedSections,
					framingBrief,
				),
				maxTokens: curateTokenLimit(),
			});
			console.log("[curate-collection] curate:response", {
				at: nowIso(),
				sessionId,
				...response.summary,
			});

			const text = response.text;
			const collection = parseJson<CollectionOutput>(text);

			if (!collection) {
				console.error("[curate-collection] curate:parse-failed", {
					at: nowIso(),
					sessionId,
					textPreview: text.slice(0, 1000),
				});
				throw new Error(`Failed to parse collection: ${text.slice(0, 200)}`);
			}

			const collectionJson = JSON.stringify(collection);
			const itemCount = collection.sections.reduce(
				(n, s) => n + s.items.length,
				0,
			);
			console.log("[curate-collection] curate:done", {
				at: nowIso(),
				sessionId,
				durationMs: Date.now() - startedAt,
				sectionCount: collection.sections.length,
				itemCount,
				warningCount: collection.warnings.length,
			});
			const candidateCount = extractedSections.reduce(
				(n, s) => n + s.items.length,
				0,
			);
			await logStep(sessionId, "curate-and-write", "completed", {
				candidateCount,
				itemCount,
				sectionCount: collection.sections.length,
				warningCount: collection.warnings.length,
				warnings: collection.warnings,
			});

			return {
				title: collection.title,
				sectionCount: collection.sections.length,
				candidateCount,
				itemCount,
				json: collectionJson,
				usage: response.usage,
				summary: response.summary,
			};
		});

		totalInputTokens += result.usage?.inputTokens ?? 0;
		totalOutputTokens += result.usage?.outputTokens ?? 0;

		// Deduct per-step credits for curation
		if (requestedBy !== "unknown" && result.usage) {
			const usage = result.usage;
			await step.run("deduct-credits-curate", () =>
				deductCredits(
					requestedBy,
					runCostCents(usage.inputTokens, usage.outputTokens, 0),
					sessionId,
					usage.inputTokens,
					usage.outputTokens,
					0,
					"curate-and-write",
					{
						candidateCount: result.candidateCount,
						durationMs: result.summary?.durationMs,
					},
				),
			);
		}

		let currentCollection = parseJson<CollectionOutput>(result.json);
		if (!currentCollection) {
			throw new Error("Failed to restore collection after initial curation.");
		}

		// Step 8: Hospitality pass before refinement
		await step.realtime.publish("hospitality", ch.progress, {
			step: "hospitality",
			message:
				"Applying a hospitality pass to make the shortlist feel more thoughtful...",
		});

		await step.run("persist-hospitality-phase", () =>
			patchSession(sessionId, {
				phase: "hospitality",
				lastProgressMessage:
					"Applying a hospitality pass to make the shortlist feel more thoughtful...",
			}),
		);

		const hospitalityResult = await step.run("hospitality-pass", async () => {
			const response = await llm.generate({
				system: CURATOR_SYSTEM_PROMPT,
				prompt: buildHospitalityPassPrompt(currentCollection, framingBrief),
				maxTokens: hospitalityTokenLimit(),
			});
			const refined = parseJson<CollectionOutput>(response.text);
			if (refined) {
				await logStep(sessionId, "hospitality-pass", "completed", {
					itemCount: refined.sections.reduce((n, s) => n + s.items.length, 0),
					warningCount: refined.warnings.length,
				});
			}
			return {
				collection: refined,
				usage: response.usage,
				summary: response.summary,
			};
		});

		totalInputTokens += hospitalityResult.usage?.inputTokens ?? 0;
		totalOutputTokens += hospitalityResult.usage?.outputTokens ?? 0;

		if (requestedBy !== "unknown" && hospitalityResult.usage) {
			const usage = hospitalityResult.usage;
			await step.run("deduct-credits-hospitality-pass", () =>
				deductCredits(
					requestedBy,
					runCostCents(usage.inputTokens, usage.outputTokens, 0),
					sessionId,
					usage.inputTokens,
					usage.outputTokens,
					0,
					"hospitality-pass",
					{
						durationMs: hospitalityResult.summary?.durationMs,
					},
				),
			);
		}

		if (hospitalityResult.collection) {
			currentCollection = hospitalityResult.collection;
		}

		// Step 9: Refinement passes (up to 2 passes)
		const maxRefinementPasses = 2;

		for (let pass = 1; pass <= maxRefinementPasses; pass++) {
			if (
				!currentCollection.warnings ||
				currentCollection.warnings.length === 0
			)
				break;

			await step.run(`persist-refine-phase-${pass}`, () =>
				patchSession(sessionId, {
					phase: "refining",
					refinementPass: pass,
					lastProgressMessage: `Refinement pass ${pass}: analysing warnings...`,
				}),
			);

			await step.realtime.publish(`refining-${pass}`, ch.progress, {
				step: `refining-${pass}`,
				message: `Refinement pass ${pass}: analysing ${currentCollection.warnings.length} warnings...`,
			});

			// 7a. Parse gaps from warnings
			const gapsResult = await step.run(`parse-gaps-${pass}`, async () => {
				const response = await llm.generate({
					system: CURATOR_SYSTEM_PROMPT,
					prompt: buildGapsPrompt(currentCollection),
					maxTokens: 2000,
				});
				const gaps = parseJson<CurationGap[]>(response.text) ?? [];
				await logStep(sessionId, `parse-gaps-${pass}`, "completed", {
					gapCount: gaps.length,
					actionableCount: gaps.filter((g) => g.actionable).length,
					gaps: gaps.map((g) => ({
						kind: g.kind,
						description: g.description,
						actionable: g.actionable,
					})),
				});
				return { gaps, usage: response.usage };
			});

			totalInputTokens += gapsResult.usage?.inputTokens ?? 0;
			totalOutputTokens += gapsResult.usage?.outputTokens ?? 0;

			if (requestedBy !== "unknown" && gapsResult.usage) {
				const usage = gapsResult.usage;
				await step.run(`deduct-credits-gaps-${pass}`, () =>
					deductCredits(
						requestedBy,
						runCostCents(usage.inputTokens, usage.outputTokens, 0),
						sessionId,
						usage.inputTokens,
						usage.outputTokens,
						0,
						`parse-gaps-${pass}`,
					),
				);
			}

			const actionableGaps = gapsResult.gaps.filter((g) => g.actionable);
			if (actionableGaps.length === 0) break;

			await step.run(`persist-gaps-${pass}`, () =>
				patchSession(sessionId, { gaps: actionableGaps }),
			);

			// 7b. URL discovery per gap
			const refinementUrlSections: UrlSection[] = [];
			for (let gi = 0; gi < actionableGaps.length; gi++) {
				const gap = actionableGaps[gi];
				const gapSlug = `gap-${pass}-${gi}`;

				await step.realtime.publish(`searching-${gapSlug}`, ch.progress, {
					step: "searching",
					message: `Finding URLs for gap: "${gap.description}"`,
				});

				const foundGap = await step.run(`find-urls-${gapSlug}`, async () => {
					const response = await llm.generateWithSearch({
						system: buildUrlDiscoverySystemPrompt(),
						prompt: buildRefinementUrlPrompt(gap, topic, framingBrief),
						maxTokens: urlDiscoveryTokenLimit(),
					});
					const parsed = parseJson<UrlDiscoveryPayload>(response.text);
					if (!parsed)
						return {
							urls: [] as string[],
							usage: null,
							summary: response.summary,
							parseFailed: true,
						};
					return {
						urls: parsed.urls,
						usage: response.usage,
						summary: response.summary,
						parseFailed: false,
					};
				});

				totalInputTokens += foundGap.usage?.inputTokens ?? 0;
				totalOutputTokens += foundGap.usage?.outputTokens ?? 0;
				totalWebSearchRequests += foundGap.usage?.webSearchRequests ?? 0;

				if (requestedBy !== "unknown" && foundGap.usage) {
					const usage = foundGap.usage;
					await step.run(`deduct-credits-${gapSlug}`, () =>
						deductCredits(
							requestedBy,
							runCostCents(
								usage.inputTokens,
								usage.outputTokens,
								usage.webSearchRequests,
							),
							sessionId,
							usage.inputTokens,
							usage.outputTokens,
							usage.webSearchRequests,
							`find-urls-${gapSlug}`,
							{
								urlCount: foundGap.urls.length,
								codeExecutionCount: foundGap.summary?.codeExecutionCount,
								durationMs: foundGap.summary?.durationMs,
							},
						),
					);
				}

				await step.realtime.publish(`found-urls-${gapSlug}`, ch.progress, {
					step: foundGap.parseFailed ? "search-parse-failed" : "found-urls",
					message: foundGap.parseFailed
						? `Search returned an unreadable response for gap: "${gap.description}"`
						: `Found ${foundGap.urls.length} URLs for gap: "${gap.description}"`,
					detail: foundGap.parseFailed
						? "No URLs could be extracted from the model output. This is likely a parsing or formatting issue."
						: undefined,
				});

				refinementUrlSections.push({
					title: gap.description,
					slug: gapSlug,
					urls: foundGap.urls,
				});
			}

			// Send all gap sections in one message
			await step.realtime.publish(
				`gap-section-urls-${pass}`,
				ch["section-urls"],
				{
					sections: refinementUrlSections,
				},
			);

			// Persist gap URL sections so reconnecting clients can re-queue them
			await step.run(`persist-refinement-urls-${pass}`, () =>
				patchSession(sessionId, { refinementUrlSections }),
			);

			// 7c. Wait for all gap extractions in one bulk event
			const gapExtractionsEvt = await step.waitForEvent(
				`wait-for-gap-extractions-${pass}`,
				{
					event: "curation/extractions" as CurationExtractionsEvent["name"],
					timeout: "30m",
					if: `async.data.sessionId == "${sessionId}"`,
				},
			);
			if (!gapExtractionsEvt) break; // timeout — proceed with what we have
			const refinedSections: ExtractedSection[] =
				gapExtractionsEvt.data.sections;
			await step.run(`persist-refined-slugs-${pass}`, () =>
				patchSession(sessionId, {
					extractedSlugs: [
						...extractedSections.map((s) => s.slug),
						...refinedSections.map((s) => s.slug),
					],
				}),
			);

			if (refinedSections.length === 0) break;

			// 7d. Merge refinement pass
			const refineResult = await step.run(
				`refine-collection-${pass}`,
				async () => {
					const response = await llm.generate({
						system: CURATOR_SYSTEM_PROMPT,
						prompt: buildRefinementCuratePrompt(
							currentCollection,
							refinedSections,
							actionableGaps,
							framingBrief,
						),
						maxTokens: curateTokenLimit(),
					});
					const refined = parseJson<CollectionOutput>(response.text);
					if (refined) {
						const refinedItemCount = refined.sections.reduce(
							(n, s) => n + s.items.length,
							0,
						);
						await logStep(sessionId, `refine-collection-${pass}`, "completed", {
							itemCount: refinedItemCount,
							sectionCount: refined.sections.length,
							warningCount: refined.warnings.length,
						});
					}
					const candidateCount = refinedSections.reduce(
						(n, s) => n + s.items.length,
						0,
					);
					return {
						collection: refined,
						usage: response.usage,
						summary: response.summary,
						candidateCount,
					};
				},
			);

			totalInputTokens += refineResult.usage?.inputTokens ?? 0;
			totalOutputTokens += refineResult.usage?.outputTokens ?? 0;

			if (requestedBy !== "unknown" && refineResult.usage) {
				const usage = refineResult.usage;
				await step.run(`deduct-credits-refine-${pass}`, () =>
					deductCredits(
						requestedBy,
						runCostCents(usage.inputTokens, usage.outputTokens, 0),
						sessionId,
						usage.inputTokens,
						usage.outputTokens,
						0,
						`refine-collection-${pass}`,
						{
							candidateCount: refineResult.candidateCount,
							durationMs: refineResult.summary?.durationMs,
						},
					),
				);
			}

			if (refineResult.collection) {
				currentCollection = refineResult.collection;
				const refinedJson = JSON.stringify(currentCollection);
				const refinedItemCount = currentCollection.sections.reduce(
					(n, s) => n + s.items.length,
					0,
				);
				// Update persisted result with refined collection (still in-progress)
				await step.run(`persist-refine-result-${pass}`, () =>
					patchSession(sessionId, {
						phase: "refining",
						tokenUsage: {
							inputTokens: totalInputTokens,
							outputTokens: totalOutputTokens,
							webSearchRequests: totalWebSearchRequests,
						},
						title: currentCollection.title,
						sectionCount: currentCollection.sections.length,
						itemCount: refinedItemCount,
						json: refinedJson,
					}),
				);
				await step.realtime.publish("result", ch.result, {
					...result,
					json: refinedJson,
					sectionCount: currentCollection.sections.length,
					itemCount: refinedItemCount,
				});
				await step.realtime.publish(`refine-complete-${pass}`, ch.progress, {
					step: `refine-complete-${pass}`,
					message: `Refinement pass ${pass} complete — ${refinedItemCount} items across ${currentCollection.sections.length} sections`,
				});
			}
		}

		const tokenUsage = {
			inputTokens: totalInputTokens,
			outputTokens: totalOutputTokens,
			webSearchRequests: totalWebSearchRequests,
		};

		console.log("[curate-collection] token-totals", {
			at: nowIso(),
			sessionId,
			...tokenUsage,
		});

		const finalItemCount = currentCollection.sections.reduce(
			(n, s) => n + s.items.length,
			0,
		);
		const finalJson = JSON.stringify(currentCollection);

		// Persist final result
		await step.run("persist-session-result", () =>
			Promise.all([
				writeSession(sessionId, {
					phase: "complete",
					tokenUsage,
					title: currentCollection.title,
					sectionCount: currentCollection.sections.length,
					itemCount: finalItemCount,
					json: finalJson,
				}),
				completeCuratorSession(sessionId, {
					model: "claude-sonnet-4-6",
					phase: "complete",
					sectionCount: currentCollection.sections.length,
					itemCount: finalItemCount,
				}),
			]),
		);

		await step.realtime.publish("result", ch.result, {
			...result,
			json: finalJson,
			sectionCount: currentCollection.sections.length,
			itemCount: finalItemCount,
		});

		await step.realtime.publish("complete", ch.progress, {
			step: "complete",
			message: "Done.",
		});
	},
);
