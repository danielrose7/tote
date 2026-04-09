import Anthropic from "@anthropic-ai/sdk";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { inngest } from "../client";
import { writeSession, patchSession } from "../../lib/curatorSession";
import { curationChannel } from "../channels";
import {
	CURATOR_SYSTEM_PROMPT,
	URL_DISCOVERY_SYSTEM_PROMPT,
	buildPlanPrompt,
	buildUrlDiscoveryPrompt,
	buildCuratePrompt,
} from "../prompts";
import { MOCK_URL_SECTIONS } from "../fixtures/url-sections";
import type {
	CurationMode,
	CurationStartEvent,
	CurationAnswersEvent,
	CurationExtractionsEvent,
	CollectionOutput,
	SectionPlan,
	UrlSection,
} from "../types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type UrlDiscoveryPayload = { urls: string[] };

function extractText(response: Anthropic.Message): string {
	return response.content
		.filter((b): b is Anthropic.TextBlock => b.type === "text")
		.map((b) => b.text)
		.join("\n")
		.trim();
}

function parseJson<T>(text: string): T | null {
	// Try direct parse first
	try {
		return JSON.parse(text) as T;
	} catch {
		// Try to extract JSON block from mixed content
		const match = text.match(/\{[\s\S]*\}/);
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

function formatTimestamp(date: Date): string {
	const y = date.getFullYear();
	const mo = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	const h = String(date.getHours()).padStart(2, "0");
	const mi = String(date.getMinutes()).padStart(2, "0");
	return `${y}${mo}${d}-${h}${mi}`;
}

function nowIso(): string {
	return new Date().toISOString();
}

async function writeSessionState(
	sessionId: string,
	data: { urlSections: UrlSection[]; mock: boolean },
) {
	try {
		const dir = join(process.cwd(), "collections", ".sessions");
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, `${sessionId}.json`), JSON.stringify(data), "utf-8");
	} catch {
		// Best-effort — fails silently in serverless environments
	}
}

function planTokenLimit(mode: CurationMode) {
	return mode === "debug" ? 600 : 1000;
}

function urlDiscoveryTokenLimit(mode: CurationMode) {
	return mode === "debug" ? 800 : 1500;
}

function curateTokenLimit(mode: CurationMode) {
	return mode === "debug" ? 1800 : 4000;
}

function summarizeAnthropicContent(response: Anthropic.Message) {
	let textChars = 0;
	let textBlockCount = 0;
	let toolUseCount = 0;
	const toolNames: string[] = [];

	for (const block of response.content) {
		if (block.type === "text") {
			textBlockCount += 1;
			textChars += block.text.length;
			continue;
		}

		if (block.type === "server_tool_use" || block.type === "web_search_tool_result") {
			toolUseCount += 1;
			if ("name" in block && typeof block.name === "string") {
				toolNames.push(block.name);
			}
		}
	}

	return {
		stopReason: response.stop_reason ?? null,
		contentBlockTypes: response.content.map((block) => block.type),
		textBlockCount,
		textChars,
		toolUseCount,
		toolNames,
	};
}

export const curateCollection = inngest.createFunction(
	{
		id: "curate-collection",
		retries: 0,
		timeouts: { finish: "30m" },
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
				patchSession(sessionId, { phase: "error" }),
			);
		},
	},
	async ({ event, step }) => {
		const { sessionId, topic } = event.data;
		const ch = curationChannel({ sessionId });
		console.log("[curate-collection] run-start", {
			at: nowIso(),
			sessionId,
			topic,
		});

		// Step 1: Send interview questions to the UI
		await step.realtime.publish("interview-questions", ch.interview, {
			questions: [
				{
					id: "audience",
					text: "Who is this collection for? Be specific — personal use, a gift for someone, or a public/demo collection?",
				},
				{
					id: "lens",
					text: "What is the primary curatorial lens? e.g. 'buy it once, make it last', 'what enthusiasts actually use', 'looks good and holds up', 'best value for the money'",
				},
				{
					id: "constraints",
					text: "Any hard constraints? e.g. budget ceiling, avoid Amazon, US availability only, or 'no constraints'",
				},
			],
		});
		await step.realtime.publish("interview-sent", ch.progress, {
			step: "interview-sent",
			message: "Interview questions sent — waiting for your answers.",
		});

		// Persist phase so reconnect can show the interview form without realtime replay
		await step.run("persist-interview-phase", () =>
			patchSession(sessionId, { phase: "interview" }),
		);

		// Step 2: Wait for interview answers (human-in-the-loop)
		const answersEvent = await step.waitForEvent("wait-for-answers", {
			event: "curation/answers" as CurationAnswersEvent["name"],
			timeout: "15m",
			if: `async.data.sessionId == "${sessionId}"`,
		});

		if (!answersEvent) {
			await step.realtime.publish("timed-out", ch.progress, {
				step: "error",
				message: "Timed out waiting for answers. Start a new session to try again.",
			});
			await step.run("persist-error-phase", () =>
				patchSession(sessionId, { phase: "error" }),
			);
			return;
		}

		const answers = answersEvent.data.answers;
		console.log("[curate-collection] answers-received", {
			at: nowIso(),
			sessionId,
			answers,
		});

		await step.realtime.publish("answers-received", ch.progress, {
			step: "answers-received",
			message: "Answers received. Planning collection...",
		});

		await step.run("persist-running-phase", () =>
			patchSession(sessionId, { phase: "planning" }),
		);

		// Step 3: Plan the collection structure
		const plan = await step.run("plan-collection", async () => {
			console.log("[curate-collection] plan:start", {
				at: nowIso(),
				sessionId,
			});
			const response = await anthropic.messages.create({
				model: "claude-sonnet-4-6",
				max_tokens: planTokenLimit(answers.mode),
				system: CURATOR_SYSTEM_PROMPT,
				messages: [{ role: "user", content: buildPlanPrompt(topic, answers) }],
			});
			console.log("[curate-collection] plan:response", {
				at: nowIso(),
				sessionId,
				...summarizeAnthropicContent(response),
			});

			const text = extractText(response);
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
			return parsed;
		});

		await step.realtime.publish("planned", ch.progress, {
			step: "planned",
			message: `Plan ready: ${plan.sections.length} sections`,
			detail: plan.sections.map((s) => s.title).join(", "),
		});

		// Step 4: Discover URLs per section via web search (no page reading)
		// Each section is its own named step so it's individually memoized/retryable
		const isMock = process.env.CURATOR_MOCK === "true";
		const urlSections: UrlSection[] = [];

		if (isMock) {
			// In mock mode, skip URL discovery entirely and use fixture sections as-is.
			// The plan step may generate different section names/slugs, so we can't
			// match by slug — just publish the fixtures directly.
			for (const section of MOCK_URL_SECTIONS) {
				await step.realtime.publish(`found-urls-${section.slug}`, ch.progress, {
					step: "found-urls",
					message: `Found ${section.urls.length} URLs for "${section.title}" (mock)`,
					detail: section.urls.map((u) => new URL(u).hostname).join(", "),
				});
				urlSections.push(section);
			}
		} else {

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
				try {
					const response = await anthropic.messages.create({
						model: "claude-sonnet-4-6",
						max_tokens: urlDiscoveryTokenLimit(answers.mode),
						system: URL_DISCOVERY_SYSTEM_PROMPT,
						tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
						messages: [
							{
								role: "user",
								content: buildUrlDiscoveryPrompt(section, topic, answers),
							},
						],
					});
					const responseSummary = summarizeAnthropicContent(response);
					console.log("[curate-collection] find-urls:response", {
						at: nowIso(),
						sessionId,
						section: section.title,
						slug,
						durationMs: Date.now() - startedAt,
						...responseSummary,
					});

					const text = extractText(response);
					const parsed = parseJson<UrlDiscoveryPayload>(text);
					if (!parsed) {
						console.error("[curate-collection] find-urls:parse-failed", {
							at: nowIso(),
							sessionId,
							section: section.title,
							slug,
							textPreview: text.slice(0, 500),
						});
						return { urls: [] };
					}
					console.log("[curate-collection] find-urls:done", {
						at: nowIso(),
						sessionId,
						section: section.title,
						slug,
						urlCount: parsed.urls.length,
					});
					return { urls: parsed.urls };
				} catch (error) {
					console.error("[curate-collection] find-urls:error", {
						at: nowIso(),
						sessionId,
						section: section.title,
						slug,
						error: error instanceof Error ? error.message : String(error),
					});
					return { urls: [] };
				}
			});

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
				step: "found-urls",
				message: `Found ${found.urls.length} URLs for "${section.title}"`,
				detail: domains || undefined,
			});

			urlSections.push({ title: section.title, slug, urls: found.urls });
		}

		} // end else (non-mock URL discovery)

		// Step 5: Send URLs to browser for extraction via Chrome extension
		const totalUrlCount = urlSections.reduce((n, s) => n + s.urls.length, 0);

		// Persist URL data so the browser can re-fetch if the realtime connection drops
		await step.run("persist-session-urls", () =>
			Promise.all([
				writeSessionState(sessionId, { urlSections, mock: isMock }),
				patchSession(sessionId, { phase: "extracting", urlSections }),
			]),
		);

		await step.realtime.publish("urls-ready", ch.urls, {
			sections: urlSections,
			mock: isMock,
		});

		await step.realtime.publish("extraction-queued", ch.progress, {
			step: "extracting",
			message: `${totalUrlCount} URLs ready — extracting with extension...`,
		});

		// Wait for browser to extract and send back results
		const extractionsEvent = await step.waitForEvent("wait-for-extractions", {
			event: "curation/extractions" as CurationExtractionsEvent["name"],
			timeout: "10m",
			if: `async.data.sessionId == "${sessionId}"`,
		});

		if (!extractionsEvent) {
			await step.realtime.publish("timed-out", ch.progress, {
				step: "error",
				message: "Timed out waiting for extraction results. Start a new session to try again.",
			});
			await step.run("persist-extraction-timeout", () =>
				patchSession(sessionId, { phase: "error" }),
			);
			return;
		}

		const extractedSections = extractionsEvent.data.sections;
		const totalExtracted = extractedSections.reduce((n, s) => n + s.items.length, 0);
		console.log("[curate-collection] extractions-received", {
			at: nowIso(),
			sessionId,
			sectionCount: extractedSections.length,
			totalExtracted,
		});

		await step.realtime.publish("extractions-received", ch.progress, {
			step: "curating",
			message: `Extracted ${totalExtracted} items — curating final shortlist...`,
		});

		// Step 6: Curate the final shortlist and write the file
		await step.realtime.publish("curating", ch.progress, {
			step: "curating",
			message: "Curating final shortlist...",
		});

		await step.run("persist-curating-phase", () =>
			patchSession(sessionId, { phase: "curating" }),
		);

		const result = await step.run("curate-and-write", async () => {
			const startedAt = Date.now();
			console.log("[curate-collection] curate:start", {
				at: nowIso(),
				sessionId,
				sectionCount: extractedSections.length,
			});
			const response = await anthropic.messages.create({
				model: "claude-sonnet-4-6",
				max_tokens: curateTokenLimit(answers.mode),
				system: CURATOR_SYSTEM_PROMPT,
				messages: [
					{
						role: "user",
						content: buildCuratePrompt(
							plan.title,
							plan.intro,
							extractedSections,
							answers,
						),
					},
				],
			});
			console.log("[curate-collection] curate:response", {
				at: nowIso(),
				sessionId,
				...summarizeAnthropicContent(response),
			});

			const text = extractText(response);
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
			const slug = parameterize(collection.title);
			const timestamp = formatTimestamp(new Date());
			const fileName = `${slug}-${timestamp}.json`;

			try {
				const collectionsDir = join(process.cwd(), "collections");
				await mkdir(collectionsDir, { recursive: true });
				await writeFile(join(collectionsDir, fileName), collectionJson, "utf-8");
			} catch {
				// File write is best-effort — fails silently in serverless environments
			}

			const itemCount = collection.sections.reduce(
				(n, s) => n + s.items.length,
				0,
			);
			console.log("[curate-collection] curate:done", {
				at: nowIso(),
				sessionId,
				durationMs: Date.now() - startedAt,
				filePath: `collections/${fileName}`,
				sectionCount: collection.sections.length,
				itemCount,
				warningCount: collection.warnings.length,
			});

			return {
				filePath: `collections/${fileName}`,
				title: collection.title,
				sectionCount: collection.sections.length,
				itemCount,
				json: collectionJson,
			};
		});

		// Persist result so sync route can recover it if browser was closed at completion
		await step.run("persist-session-result", () =>
			writeSession(sessionId, { phase: "complete", ...result }),
		);

		await step.realtime.publish("result", ch.result, result);

		await step.realtime.publish("complete", ch.progress, {
			step: "complete",
			message: "Done.",
		});

		return { filePath: result.filePath };
	},
);
