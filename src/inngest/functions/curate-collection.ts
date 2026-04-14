import { inngest } from '../client';
import { writeSession, patchSession } from '../../lib/curatorSession';
import {
  createCuratorSession,
  completeCuratorSession,
  failCuratorSession,
} from '../../lib/curatorSessionsDb';
import { logStep } from '../../lib/curatorStepLog';
import { deductCredits, runCostCents } from '../../lib/credits';
import { curationChannel } from '../channels';
import {
  CURATOR_SYSTEM_PROMPT,
  buildUrlDiscoverySystemPrompt,
  buildQuestionsPrompt,
  buildPlanPrompt,
  buildUrlDiscoveryPrompt,
  buildCuratePrompt,
  buildGapsPrompt,
  buildRefinementUrlPrompt,
  buildRefinementCuratePrompt,
  InterviewQuestionsSchema,
} from '../prompts';
import { createLLMClient } from '../llm';
import type {
  CurationMode,
  CurationStartEvent,
  CurationAnswersEvent,
  CurationExtractionsEvent,
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

function nowIso(): string {
  return new Date().toISOString();
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
      await logStep(sessionId, 'plan-collection', 'completed', {
        sectionCount: parsed.sections.length,
        sections: parsed.sections.map((s) => ({
          slug: s.slug,
          title: s.title,
        })),
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
    const urlSections: UrlSection[] = [];
    let totalInputTokens =
      (generatedQuestions.usage?.inputTokens ?? 0) +
      (planResult.usage?.inputTokens ?? 0);
    let totalOutputTokens =
      (generatedQuestions.usage?.outputTokens ?? 0) +
      (planResult.usage?.outputTokens ?? 0);
    let totalWebSearchRequests = 0;

    // Discover URLs sequentially — publish searching event per section just before it starts
    for (const section of plan.sections) {
      const slug = parameterize(section.title);

      await step.realtime.publish(`searching-${slug}`, ch.progress, {
        step: 'searching',
        message: `Searching for "${section.title}"...`,
      });

      const found = await step.run(`find-urls-${slug}`, async () => {
        const startedAt = Date.now();
        console.log('[curate-collection] find-urls:start', {
          at: nowIso(),
          sessionId,
          section: section.title,
          slug,
        });
        const response = await llm.generateWithSearch({
          system: buildUrlDiscoverySystemPrompt(),
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
          console.error('[curate-collection] find-urls:parse-failed', {
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
          };
        }
        console.log('[curate-collection] find-urls:done', {
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
        };
      });

      totalInputTokens += found.usage?.inputTokens ?? 0;
      totalOutputTokens += found.usage?.outputTokens ?? 0;
      totalWebSearchRequests += found.usage?.webSearchRequests ?? 0;

      if (requestedBy !== 'unknown' && found.usage) {
        await step.run(`deduct-credits-urls-${slug}`, () =>
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
        .join(', ');

      await step.realtime.publish(`found-urls-${slug}`, ch.progress, {
        step: 'found-urls',
        message: `Found ${found.urls.length} URLs for "${section.title}"`,
        detail: domains || undefined,
      });

      urlSections.push({ title: section.title, slug, urls: found.urls });
    }

    // Send all sections in one message so the browser knows the full URL count upfront
    await step.realtime.publish('section-urls', ch['section-urls'], {
      sections: urlSections,
    });

    // Step 5: Persist URL data for reconnect, then wait for extractions
    await step.run('persist-session-urls', () =>
      patchSession(sessionId, {
        phase: 'extracting',
        urlSections,
        lastProgressMessage: 'URL discovery complete — extracting pages...',
      }),
    );

    // Also publish urls topic for reconnect/sync restore in the browser
    await step.realtime.publish('urls-ready', ch.urls, {
      sections: urlSections,
    });

    const totalUrlCount = urlSections.reduce((n, s) => n + s.urls.length, 0);
    await step.realtime.publish('urls-found', ch.progress, {
      step: 'urls-found',
      message: `${totalUrlCount} URLs found across ${urlSections.length} sections`,
    });
    await step.realtime.publish('extraction-queued', ch.progress, {
      step: 'extracting',
      message: `Extracting pages with extension...`,
    });

    // Wait for all sections to be extracted in one bulk event
    const extractionsEvt = await step.waitForEvent('wait-for-extractions', {
      event: 'curation/extractions' as CurationExtractionsEvent['name'],
      timeout: '30m',
      if: `async.data.sessionId == "${sessionId}"`,
    });

    if (!extractionsEvt) {
      await step.realtime.publish('timed-out-extractions', ch.progress, {
        step: 'error',
        message:
          'Timed out waiting for extractions. Start a new session to try again.',
      });
      await step.run('persist-extraction-timeout', () =>
        patchSession(sessionId, { phase: 'error' }),
      );
      return;
    }

    const extractedSections: ExtractedSection[] = extractionsEvt.data.sections;
    await step.run('persist-extracted-slugs', () =>
      patchSession(sessionId, {
        extractedSlugs: extractedSections.map((s) => s.slug),
      }),
    );

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

    // Step 6: Curate the initial collection
    await step.realtime.publish('curating', ch.progress, {
      step: 'curating',
      message: `Extracted ${totalExtracted} items — curating initial collection...`,
    });

    await step.run('persist-curating-phase', () =>
      patchSession(sessionId, {
        phase: 'curating',
        lastProgressMessage: `Extracted ${totalExtracted} items — curating initial collection...`,
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
      const itemCount = collection.sections.reduce(
        (n, s) => n + s.items.length,
        0,
      );
      console.log('[curate-collection] curate:done', {
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
      await logStep(sessionId, 'curate-and-write', 'completed', {
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
          {
            candidateCount: result.candidateCount,
            durationMs: result.summary?.durationMs,
          },
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
        const gaps = parseJson<CurationGap[]>(response.text) ?? [];
        await logStep(sessionId, `parse-gaps-${pass}`, 'completed', {
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
          const response = await llm.generateWithSearch({
            system: buildUrlDiscoverySystemPrompt(),
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
          if (!parsed)
            return {
              urls: [] as string[],
              usage: null,
              summary: response.summary,
            };
          return {
            urls: parsed.urls,
            usage: response.usage,
            summary: response.summary,
          };
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
              {
                urlCount: foundGap.urls.length,
                codeExecutionCount: foundGap.summary?.codeExecutionCount,
                durationMs: foundGap.summary?.durationMs,
              },
            ),
          );
        }

        await step.realtime.publish(`found-urls-${gapSlug}`, ch.progress, {
          step: 'found-urls',
          message: `Found ${foundGap.urls.length} URLs for gap: "${gap.description}"`,
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
        ch['section-urls'],
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
          event: 'curation/extractions' as CurationExtractionsEvent['name'],
          timeout: '30m',
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
              questions,
              answers,
              mode,
            ),
            maxTokens: curateTokenLimit(mode),
          });
          const refined = parseJson<CollectionOutput>(response.text);
          if (refined) {
            const refinedItemCount = refined.sections.reduce(
              (n, s) => n + s.items.length,
              0,
            );
            await logStep(sessionId, `refine-collection-${pass}`, 'completed', {
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
  },
);
