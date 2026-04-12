import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { RetryAfterError } from 'inngest';
import { inngest } from '../client';
import { writeSession, patchSession } from '../../lib/curatorSession';
import {
  createCuratorSession,
  completeCuratorSession,
  failCuratorSession,
} from '../../lib/curatorSessionsDb';
import { deductCredits, runCostCents } from '../../lib/credits';
import { curationChannel } from '../channels';
import {
  CURATOR_SYSTEM_PROMPT,
  URL_DISCOVERY_SYSTEM_PROMPT,
  buildQuestionsPrompt,
  buildPlanPrompt,
  buildUrlDiscoveryPrompt,
  buildCuratePrompt,
  buildGapsPrompt,
  buildRefinementUrlPrompt,
  buildRefinementCuratePrompt,
  InterviewQuestionsSchema,
} from '../prompts';
import { MOCK_URL_SECTIONS } from '../fixtures/url-sections';
import { createLLMClient } from '../llm';
import type {
  CurationMode,
  CurationStartEvent,
  CurationAnswersEvent,
  CurationSectionExtractedEvent,
  CollectionOutput,
  CurationGap,
  SectionPlan,
  ExtractedSection,
  UrlSection,
} from '../types';

const llm = createLLMClient();

type UrlDiscoveryPayload = { urls: string[] };

function parseJson<T>(text: string): T | null {
  // Strip markdown code fences if present
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
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
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatTimestamp(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
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
    const dir = join(process.cwd(), 'collections', '.sessions');
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, `${sessionId}.json`),
      JSON.stringify(data),
      'utf-8',
    );
  } catch {
    // Best-effort — fails silently in serverless environments
  }
}

function planTokenLimit(mode: CurationMode) {
  return mode === 'debug' ? 1000 : 4000;
}

function urlDiscoveryTokenLimit(mode: CurationMode) {
  return mode === 'debug' ? 1500 : 4000;
}

function curateTokenLimit(mode: CurationMode) {
  return mode === 'debug' ? 3000 : 16000;
}

export const curateCollection = inngest.createFunction(
  {
    id: 'curate-collection',
    retries: 14,
    triggers: [{ event: 'curation/start' as CurationStartEvent['name'] }],
    // Utah: singleton per session — no race conditions if triggered twice
    concurrency: { key: 'event.data.sessionId', limit: 1 },
    // Utah: cancel current run if user starts fresh for the same session
    cancelOn: [
      {
        event: 'curation/start' as CurationStartEvent['name'],
        if: 'async.data.sessionId == event.data.sessionId',
      },
    ],
    onFailure: async ({ event, step }) => {
      const sessionId = (event.data.event as CurationStartEvent).data.sessionId;
      console.error('[curate-collection] run-failed', {
        at: nowIso(),
        sessionId,
        error: event.data.error,
      });
      await step.run('persist-failure-phase', () =>
        Promise.all([
          patchSession(sessionId, { phase: 'error' }),
          failCuratorSession(sessionId),
        ]),
      );
    },
  },
  async ({ event, step, attempt }) => {
    const { sessionId, topic, requestedBy } = event.data;
    const ch = curationChannel({ sessionId });
    console.log('[curate-collection] run-start', {
      at: nowIso(),
      sessionId,
      topic,
    });

    await step.realtime.publish('acknowledged', ch.progress, {
      step: 'acknowledged',
      message: 'Workflow started — generating interview questions…',
    });

    // Step 1: Generate context-specific interview questions for this topic
    const generatedQuestions = await step.run(
      'generate-questions',
      async () => {
        const maxTokens = 4096 + attempt * 2048;
        const response = await llm.generate({
          system:
            'You are a product curation assistant. Return only valid JSON arrays — no markdown, no explanation.',
          prompt: buildQuestionsPrompt(topic),
          maxTokens,
        });
        if (response.summary.stopReason === 'max_tokens') {
          throw new Error(
            `Question generation hit max_tokens limit (${maxTokens}) — response truncated`,
          );
        }
        const raw = parseJson<unknown>(response.text);
        const result = InterviewQuestionsSchema.safeParse(raw);
        if (!result.success) {
          throw new Error(
            `Failed to parse questions: ${JSON.stringify(result.error.issues)} | raw: ${response.text.slice(0, 300)}`,
          );
        }
        return { questions: result.data, usage: response.usage };
      },
    );

    const questions = generatedQuestions.questions;

    await step.run('persist-questions', () =>
      patchSession(sessionId, {
        topic,
        questions,
        phase: 'interview',
        lastProgressMessage:
          'Interview questions sent — waiting for your answers.',
      }),
    );

    await step.realtime.publish('interview-questions', ch.interview, {
      questions,
    });
    await step.realtime.publish('interview-sent', ch.progress, {
      step: 'interview-sent',
      message: 'Interview questions sent — waiting for your answers.',
    });

    // Persist phase so reconnect can show the interview form without realtime replay
    await step.run('persist-interview-phase', () =>
      Promise.all([
        patchSession(sessionId, { phase: 'interview' }),
        createCuratorSession(sessionId, requestedBy, topic),
      ]),
    );

    // Step 2: Wait for interview answers (human-in-the-loop)
    const answersEvent = await step.waitForEvent('wait-for-answers', {
      event: 'curation/answers' as CurationAnswersEvent['name'],
      timeout: '15m',
      if: `async.data.sessionId == "${sessionId}"`,
    });

    if (!answersEvent) {
      await step.realtime.publish('timed-out', ch.progress, {
        step: 'error',
        message:
          'Timed out waiting for answers. Start a new session to try again.',
      });
      await step.run('persist-error-phase', () =>
        patchSession(sessionId, { phase: 'error' }),
      );
      return;
    }

    const { answers, mode } = {
      answers: answersEvent.data.answers,
      mode: answersEvent.data.mode,
    };
    console.log('[curate-collection] answers-received', {
      at: nowIso(),
      sessionId,
      answers,
    });

    await step.realtime.publish('answers-received', ch.progress, {
      step: 'answers-received',
      message: 'Answers received. Planning collection...',
    });

    await step.run('persist-running-phase', () =>
      patchSession(sessionId, {
        phase: 'planning',
        lastProgressMessage: 'Answers received. Planning collection...',
      }),
    );

    // Step 3: Plan the collection structure
    const planResult = await step.run('plan-collection', async () => {
      console.log('[curate-collection] plan:start', {
        at: nowIso(),
        sessionId,
      });
      const response = await llm.generate({
        system: CURATOR_SYSTEM_PROMPT,
        prompt: buildPlanPrompt(topic, questions, answers, mode),
        maxTokens: planTokenLimit(mode),
      });
      console.log('[curate-collection] plan:response', {
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
        console.error('[curate-collection] plan:parse-failed', {
          at: nowIso(),
          sessionId,
          textPreview: text.slice(0, 500),
        });
        throw new Error(`Failed to parse plan: ${text.slice(0, 200)}`);
      }
      console.log('[curate-collection] plan:done', {
        at: nowIso(),
        sessionId,
        sectionCount: parsed.sections.length,
        sections: parsed.sections.map((section) => section.slug),
      });
      return { ...parsed, usage: response.usage };
    });
    const plan = planResult;

    await step.realtime.publish('planned', ch.progress, {
      step: 'planned',
      message: `Plan ready: ${plan.sections.length} sections`,
      detail: plan.sections.map((s) => s.title).join(', '),
    });

    // Step 4: Discover URLs per section via web search (no page reading)
    // Each section is its own named step so it's individually memoized/retryable
    const isMock = process.env.CURATOR_MOCK === 'true';
    const urlSections: UrlSection[] = [];
    let totalInputTokens =
      (generatedQuestions.usage?.inputTokens ?? 0) +
      (planResult.usage?.inputTokens ?? 0);
    let totalOutputTokens =
      (generatedQuestions.usage?.outputTokens ?? 0) +
      (planResult.usage?.outputTokens ?? 0);
    let totalWebSearchRequests = 0;

    if (isMock) {
      // In mock mode, skip URL discovery entirely and use fixture sections as-is.
      for (const section of MOCK_URL_SECTIONS) {
        await step.realtime.publish(`found-urls-${section.slug}`, ch.progress, {
          step: 'found-urls',
          message: `Found ${section.urls.length} URLs for "${section.title}" (mock)`,
          detail: section.urls.map((u) => new URL(u).hostname).join(', '),
        });
        await step.realtime.publish(
          `section-urls-${section.slug}`,
          ch['section-urls'],
          {
            slug: section.slug,
            title: section.title,
            urls: section.urls,
            sectionIndex: urlSections.length,
            totalSections: MOCK_URL_SECTIONS.length,
            mock: true,
          },
        );
        urlSections.push(section);
      }
    } else {
      // Signal that all sections are being searched (publish upfront so ordering
      // is deterministic for Inngest replay before the parallel step block).
      for (const section of plan.sections) {
        const slug = parameterize(section.title);
        await step.realtime.publish(`searching-${slug}`, ch.progress, {
          step: 'searching',
          message: `Searching for "${section.title}"...`,
        });
      }

      // Discover URLs for all sections in parallel — each is a named step so
      // Inngest memoizes them individually and retries are per-section.
      const sectionDiscoveries = await Promise.all(
        plan.sections.map(async (section) => {
          const slug = parameterize(section.title);
          const found = await step.run(`find-urls-${slug}`, async () => {
            const startedAt = Date.now();
            console.log('[curate-collection] find-urls:start', {
              at: nowIso(),
              sessionId,
              section: section.title,
              slug,
            });
            try {
              const response = await llm.generateWithSearch({
                system: URL_DISCOVERY_SYSTEM_PROMPT,
                prompt: buildUrlDiscoveryPrompt(
                  section,
                  topic,
                  questions,
                  answers,
                  mode,
                ),
                maxTokens: urlDiscoveryTokenLimit(mode),
              });
              console.log('[curate-collection] find-urls:response', {
                at: nowIso(),
                sessionId,
                section: section.title,
                slug,
                durationMs: Date.now() - startedAt,
                ...response.summary,
              });

              const text = response.text;
              const parsed = parseJson<UrlDiscoveryPayload>(text);
              if (!parsed) {
                console.error('[curate-collection] find-urls:parse-failed', {
                  at: nowIso(),
                  sessionId,
                  section: section.title,
                  slug,
                  stopReason: response.summary.stopReason,
                  textPreview: text.slice(0, 500),
                });
                return { urls: [], usage: null };
              }
              console.log('[curate-collection] find-urls:done', {
                at: nowIso(),
                sessionId,
                section: section.title,
                slug,
                urlCount: parsed.urls.length,
              });
              return { urls: parsed.urls, usage: response.usage };
            } catch (error) {
              const status = (error as { status?: number })?.status;
              const retryAfter = (error as { headers?: Record<string, string> })
                ?.headers?.['retry-after'];
              console.error('[curate-collection] find-urls:error', {
                at: nowIso(),
                sessionId,
                section: section.title,
                slug,
                status,
                retryAfter,
                error: error instanceof Error ? error.message : String(error),
              });
              if (status === 429) {
                const waitMs = retryAfter
                  ? parseInt(retryAfter) * 1000
                  : 60_000;
                throw new RetryAfterError(
                  `Rate limited on find-urls for "${section.title}"`,
                  new Date(Date.now() + waitMs),
                );
              }
              throw error;
            }
          });
          return { section, slug, found };
        }),
      );

      // Aggregate token counts across all parallel discoveries
      for (const { found } of sectionDiscoveries) {
        totalInputTokens += found.usage?.inputTokens ?? 0;
        totalOutputTokens += found.usage?.outputTokens ?? 0;
        totalWebSearchRequests += found.usage?.webSearchRequests ?? 0;
      }

      // Deduct per-section credits in parallel
      if (requestedBy !== 'unknown') {
        await Promise.all(
          sectionDiscoveries
            .filter(({ found }) => found.usage != null)
            .map(({ slug, found }) =>
              step.run(`deduct-credits-urls-${slug}`, () =>
                deductCredits(
                  requestedBy,
                  runCostCents(
                    found.usage!.inputTokens,
                    found.usage!.outputTokens,
                    found.usage!.webSearchRequests,
                  ),
                  sessionId,
                  found.usage!.inputTokens,
                  found.usage!.outputTokens,
                  found.usage!.webSearchRequests,
                  `find-urls-${slug}`,
                ),
              ),
            ),
        );
      }

      // Publish results and build urlSections in deterministic order
      for (const [
        i,
        { section, slug, found },
      ] of sectionDiscoveries.entries()) {
        const domains = found.urls
          .map((u) => {
            try {
              return new URL(u).hostname;
            } catch {
              return u;
            }
          })
          .join(', ');

        await step.realtime.publish(`found-urls-${slug}`, ch.progress, {
          step: 'found-urls',
          message: `Found ${found.urls.length} URLs for "${section.title}"`,
          detail: domains || undefined,
        });

        await step.realtime.publish(
          `section-urls-${slug}`,
          ch['section-urls'],
          {
            slug,
            title: section.title,
            urls: found.urls,
            sectionIndex: i,
            totalSections: plan.sections.length,
          },
        );

        urlSections.push({ title: section.title, slug, urls: found.urls });
      }
    } // end URL discovery

    // Step 5: Persist URL data for reconnect, then wait for per-section extractions
    await step.run('persist-session-urls', () =>
      Promise.all([
        writeSessionState(sessionId, { urlSections, mock: isMock }),
        patchSession(sessionId, {
          phase: 'extracting',
          urlSections,
          lastProgressMessage: 'URL discovery complete — extracting pages...',
        }),
      ]),
    );

    // Also publish legacy urls topic for reconnect/sync restore in the browser
    await step.realtime.publish('urls-ready', ch.urls, {
      sections: urlSections,
      mock: isMock,
    });

    const totalUrlCount = urlSections.reduce((n, s) => n + s.urls.length, 0);
    await step.realtime.publish('extraction-queued', ch.progress, {
      step: 'extracting',
      message: `${totalUrlCount} URLs queued — extracting with extension...`,
    });

    // Collect one section-extracted event per section
    const extractedSections: ExtractedSection[] = [];
    for (const section of urlSections) {
      const sectionEvt = await step.waitForEvent(
        `wait-for-section-${section.slug}`,
        {
          event:
            'curation/section-extracted' as CurationSectionExtractedEvent['name'],
          timeout: '10m',
          if: `async.data.sessionId == "${sessionId}" && async.data.slug == "${section.slug}"`,
        },
      );

      if (!sectionEvt) {
        await step.realtime.publish(`timed-out-${section.slug}`, ch.progress, {
          step: 'error',
          message: `Timed out waiting for extraction of "${section.title}". Start a new session to try again.`,
        });
        await step.run(`persist-extraction-timeout-${section.slug}`, () =>
          patchSession(sessionId, { phase: 'error' }),
        );
        return;
      }

      extractedSections.push({
        slug: sectionEvt.data.slug,
        title: sectionEvt.data.title,
        items: sectionEvt.data.items,
      });

      // Track which sections are done for reconnect
      await step.run(`persist-extracted-slug-${section.slug}`, () =>
        patchSession(sessionId, {
          extractedSlugs: [...extractedSections.map((s) => s.slug)],
        }),
      );

      await step.realtime.publish(
        `section-extracted-${section.slug}`,
        ch.progress,
        {
          step: `section-extracted-${section.slug}`,
          message: `Extracted ${sectionEvt.data.items.length} items for "${sectionEvt.data.title}"`,
        },
      );
    }

    const totalExtracted = extractedSections.reduce(
      (n: number, s: ExtractedSection) => n + s.items.length,
      0,
    );
    console.log('[curate-collection] extractions-received', {
      at: nowIso(),
      sessionId,
      sectionCount: extractedSections.length,
      totalExtracted,
    });

    // Step 6: Curate the final shortlist and write the file
    await step.realtime.publish('curating', ch.progress, {
      step: 'curating',
      message: `Extracted ${totalExtracted} items — curating final shortlist...`,
    });

    await step.run('persist-curating-phase', () =>
      patchSession(sessionId, {
        phase: 'curating',
        lastProgressMessage: `Extracted ${totalExtracted} items — curating final shortlist...`,
      }),
    );

    const result = await step.run('curate-and-write', async () => {
      const startedAt = Date.now();
      console.log('[curate-collection] curate:start', {
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
          questions,
          answers,
          mode,
        ),
        maxTokens: curateTokenLimit(mode),
      });
      console.log('[curate-collection] curate:response', {
        at: nowIso(),
        sessionId,
        ...response.summary,
      });

      const text = response.text;
      const collection = parseJson<CollectionOutput>(text);

      if (!collection) {
        console.error('[curate-collection] curate:parse-failed', {
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
        const collectionsDir = join(process.cwd(), 'collections');
        await mkdir(collectionsDir, { recursive: true });
        await writeFile(
          join(collectionsDir, fileName),
          collectionJson,
          'utf-8',
        );
      } catch {
        // File write is best-effort — fails silently in serverless environments
      }

      const itemCount = collection.sections.reduce(
        (n, s) => n + s.items.length,
        0,
      );
      console.log('[curate-collection] curate:done', {
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
        usage: response.usage,
      };
    });

    totalInputTokens += result.usage?.inputTokens ?? 0;
    totalOutputTokens += result.usage?.outputTokens ?? 0;

    // Deduct per-step credits for curation
    if (requestedBy !== 'unknown' && result.usage) {
      await step.run('deduct-credits-curate', () =>
        deductCredits(
          requestedBy,
          runCostCents(
            result.usage!.inputTokens,
            result.usage!.outputTokens,
            0,
          ),
          sessionId,
          result.usage!.inputTokens,
          result.usage!.outputTokens,
          0,
          'curate-and-write',
        ),
      );
    }

    let currentCollection = parseJson<CollectionOutput>(result.json)!;

    // Step 7: Refinement passes (normal mode only, up to 2 passes)
    const maxRefinementPasses = mode === 'debug' ? 0 : 2;

    for (let pass = 1; pass <= maxRefinementPasses; pass++) {
      if (
        !currentCollection.warnings ||
        currentCollection.warnings.length === 0
      )
        break;

      await step.run(`persist-refine-phase-${pass}`, () =>
        patchSession(sessionId, {
          phase: 'refining',
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
        const gaps = parseJson<CurationGap[]>(response.text);
        return { gaps: gaps ?? [], usage: response.usage };
      });

      totalInputTokens += gapsResult.usage?.inputTokens ?? 0;
      totalOutputTokens += gapsResult.usage?.outputTokens ?? 0;

      if (requestedBy !== 'unknown' && gapsResult.usage) {
        await step.run(`deduct-credits-gaps-${pass}`, () =>
          deductCredits(
            requestedBy,
            runCostCents(
              gapsResult.usage!.inputTokens,
              gapsResult.usage!.outputTokens,
              0,
            ),
            sessionId,
            gapsResult.usage!.inputTokens,
            gapsResult.usage!.outputTokens,
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
          step: 'searching',
          message: `Finding URLs for gap: "${gap.description}"`,
        });

        const foundGap = await step.run(`find-urls-${gapSlug}`, async () => {
          try {
            const response = await llm.generateWithSearch({
              system: URL_DISCOVERY_SYSTEM_PROMPT,
              prompt: buildRefinementUrlPrompt(
                gap,
                topic,
                questions,
                answers,
                mode,
              ),
              maxTokens: urlDiscoveryTokenLimit(mode),
            });
            const parsed = parseJson<UrlDiscoveryPayload>(response.text);
            if (!parsed) return { urls: [], usage: null };
            return { urls: parsed.urls, usage: response.usage };
          } catch (error) {
            const status = (error as { status?: number })?.status;
            const retryAfter = (error as { headers?: Record<string, string> })
              ?.headers?.['retry-after'];
            if (status === 429) {
              const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 60_000;
              throw new RetryAfterError(
                `Rate limited on find-urls for gap "${gap.description}"`,
                new Date(Date.now() + waitMs),
              );
            }
            throw error;
          }
        });

        totalInputTokens += foundGap.usage?.inputTokens ?? 0;
        totalOutputTokens += foundGap.usage?.outputTokens ?? 0;
        totalWebSearchRequests += foundGap.usage?.webSearchRequests ?? 0;

        if (requestedBy !== 'unknown' && foundGap.usage) {
          await step.run(`deduct-credits-${gapSlug}`, () =>
            deductCredits(
              requestedBy,
              runCostCents(
                foundGap.usage!.inputTokens,
                foundGap.usage!.outputTokens,
                foundGap.usage!.webSearchRequests,
              ),
              sessionId,
              foundGap.usage!.inputTokens,
              foundGap.usage!.outputTokens,
              foundGap.usage!.webSearchRequests,
              `find-urls-${gapSlug}`,
            ),
          );
        }

        await step.realtime.publish(`found-urls-${gapSlug}`, ch.progress, {
          step: 'found-urls',
          message: `Found ${foundGap.urls.length} URLs for gap: "${gap.description}"`,
        });

        await step.realtime.publish(
          `section-urls-${gapSlug}`,
          ch['section-urls'],
          {
            slug: gapSlug,
            title: gap.description,
            urls: foundGap.urls,
            sectionIndex: gi,
            totalSections: actionableGaps.length,
          },
        );

        refinementUrlSections.push({
          title: gap.description,
          slug: gapSlug,
          urls: foundGap.urls,
        });

        // Pause between gap searches to avoid Tier-1 rate limits
        if (gi < actionableGaps.length - 1) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }

      // Persist gap URL sections so reconnecting clients can re-queue them
      await step.run(`persist-refinement-urls-${pass}`, () =>
        patchSession(sessionId, { refinementUrlSections }),
      );

      // 7c. Collect per-gap extractions from browser
      const refinedSections: ExtractedSection[] = [];
      for (const section of refinementUrlSections) {
        const gapEvt = await step.waitForEvent(
          `wait-for-refined-${section.slug}`,
          {
            event:
              'curation/section-extracted' as CurationSectionExtractedEvent['name'],
            timeout: '10m',
            if: `async.data.sessionId == "${sessionId}" && async.data.slug == "${section.slug}"`,
          },
        );
        if (!gapEvt) break; // timeout on a gap — proceed with what we have
        refinedSections.push({
          slug: gapEvt.data.slug,
          title: gapEvt.data.title,
          items: gapEvt.data.items,
        });

        // Track extracted gap slugs for reconnect deduplication
        await step.run(`persist-refined-slug-${section.slug}`, () =>
          patchSession(sessionId, {
            extractedSlugs: [
              ...extractedSections.map((s) => s.slug),
              ...refinedSections.map((s) => s.slug),
            ],
          }),
        );
      }

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
              questions,
              answers,
              mode,
            ),
            maxTokens: curateTokenLimit(mode),
          });
          const refined = parseJson<CollectionOutput>(response.text);
          return { collection: refined, usage: response.usage };
        },
      );

      totalInputTokens += refineResult.usage?.inputTokens ?? 0;
      totalOutputTokens += refineResult.usage?.outputTokens ?? 0;

      if (requestedBy !== 'unknown' && refineResult.usage) {
        await step.run(`deduct-credits-refine-${pass}`, () =>
          deductCredits(
            requestedBy,
            runCostCents(
              refineResult.usage!.inputTokens,
              refineResult.usage!.outputTokens,
              0,
            ),
            sessionId,
            refineResult.usage!.inputTokens,
            refineResult.usage!.outputTokens,
            0,
            `refine-collection-${pass}`,
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
            phase: 'refining',
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
        await step.realtime.publish('result', ch.result, {
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

    console.log('[curate-collection] token-totals', {
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
    await step.run('persist-session-result', () =>
      Promise.all([
        writeSession(sessionId, {
          phase: 'complete',
          tokenUsage,
          title: currentCollection.title,
          sectionCount: currentCollection.sections.length,
          itemCount: finalItemCount,
          json: finalJson,
        }),
        completeCuratorSession(sessionId, {
          mode,
          model: 'claude-sonnet-4-6',
          phase: 'complete',
          sectionCount: currentCollection.sections.length,
          itemCount: finalItemCount,
        }),
      ]),
    );

    await step.realtime.publish('result', ch.result, {
      ...result,
      json: finalJson,
      sectionCount: currentCollection.sections.length,
      itemCount: finalItemCount,
    });

    await step.realtime.publish('complete', ch.progress, {
      step: 'complete',
      message: 'Done.',
    });

    return { filePath: result.filePath };
  },
);
