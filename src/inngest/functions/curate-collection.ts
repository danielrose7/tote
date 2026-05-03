import { deductCredits, runCostCents } from '../../lib/credits';
import { extractSection } from '../server-extraction';
import { patchSession, writeSession } from '../../lib/curatorSession';
import {
  completeCuratorSession,
  createCuratorSession,
  failCuratorSession,
} from '../../lib/curatorSessionsDb';
import { logProgressEvent, logStep } from '../../lib/curatorStepLog';
import { curationChannel } from '../channels';
import { inngest } from '../client';
import { createLLMClient } from '../llm';
import { parseJson } from '../lib/parseJson';
import {
  buildCategoryResearchPrompt,
  buildCuratePrompt,
  buildFramingPrompt,
  buildGapsPrompt,
  buildHospitalityPassPrompt,
  buildMarketLandscapePrompt,
  buildPlanPrompt,
  buildQueryClassificationPrompt,
  buildRefinementCuratePrompt,
  buildRefinementExtractionPrompt,
  buildRefinementQueryGenPrompt,
  buildRound1QuestionsPrompt,
  buildRound2QuestionsPrompt,
  buildUrlExtractionPrompt,
  buildUrlExtractionSystemPrompt,
  buildUrlQueryGenPrompt,
  buildUrlQueryGenSystemPrompt,
  CategoryResearchBriefSchema,
  CURATOR_SYSTEM_PROMPT,
  FollowUpQuestionsSchema,
  FramingBriefSchema,
  InterviewQuestionsSchema,
  MarketLandscapeSchema,
} from '../prompts';
import type {
  CollectionOutput,
  CurationAnswersEvent,
  CurationBriefApprovedEvent,
  CurationExtractionsEvent,
  CurationGap,
  CurationStartEvent,
  ExtractedSection,
  InterviewQuestion,
  QueryClassification,
  QueryType,
  SectionPlan,
  UrlSection,
} from '../types';

const llm = createLLMClient();

type UrlDiscoveryPayload = { urls: string[] };

function parameterize(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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
      message: 'Workflow started — generating Round 1 questions…',
    });

    // Step 0: Classify the query type (cheap Haiku call, runs in parallel perception)
    const classificationResult = await step.run('classify-query', async () => {
      const response = await llm.generate({
        model: 'claude-haiku-4-5-20251001',
        system:
          'Classify product curation requests. Return only valid JSON — no markdown, no explanation.',
        prompt: buildQueryClassificationPrompt(topic),
        maxTokens: 300,
      });
      const parsed = parseJson<QueryClassification>(response.text);
      return (
        parsed ?? ({ type: 'general', signals: [] } as QueryClassification)
      );
    });

    const queryType: QueryType = classificationResult.type;

    await step.run('persist-query-type', () =>
      patchSession(sessionId, { queryType }),
    );

    // Step 1: Generate context-specific Round 1 questions
    const round1QuestionResult = await step.run(
      'generate-questions-r1',
      async () => {
        const maxTokens = 4096 + attempt * 2048;
        const response = await llm.generate({
          system:
            'You are a product curation assistant. Return only valid JSON arrays — no markdown, no explanation.',
          prompt: buildRound1QuestionsPrompt(topic, queryType),
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

    await step.run('persist-round-1-questions', () =>
      patchSession(sessionId, {
        topic,
        questions: round1Questions,
        questionRound: 1,
        phase: 'interview-round-1',
        lastProgressMessage:
          'Round 1 questions sent — waiting for your answers.',
      }),
    );

    await step.realtime.publish('interview-round-1-questions', ch.interview, {
      round: 1,
      questions: round1Questions,
    });
    await step.realtime.publish('interview-round-1-sent', ch.progress, {
      step: 'interview-round-1-sent',
      message: 'Round 1 questions sent — waiting for your answers.',
    });

    // Persist phase so reconnect can show the interview form without realtime replay
    await step.run('persist-initial-phase', () =>
      Promise.all([
        patchSession(sessionId, { phase: 'interview-round-1' }),
        createCuratorSession(sessionId, requestedBy, topic),
        logProgressEvent(sessionId, {
          step: 'interview-round-1-sent',
          message: 'Round 1 questions sent — waiting for your answers.',
          ts: Date.now(),
        }),
      ]),
    );

    // Generate a short display title for the session using Haiku — runs in
    // parallel with waiting for answers so there's no latency cost.
    await step.run('generate-session-title', async () => {
      const response = await llm.generate({
        model: 'claude-haiku-4-5-20251001',
        system:
          'You generate concise titles for product curation sessions. Return only the title — no quotes, no punctuation, no explanation.',
        prompt: `Generate a 3-5 word title that captures the essence of this curation request.

<examples>
Input: "I want to find the best minimalist running shoes for wide feet, focusing on road running, under $150" → Minimalist Wide Running Shoes
Input: "Looking for kitchen knives as a gift for my dad who loves cooking Japanese food" → Japanese Kitchen Knives Gift
Input: "Baby gear for a 3-month-old — natural materials, considered design, small condo in Salt Lake City" → Natural Baby Gear Essentials
</examples>

<request>${topic}</request>`,
        maxTokens: 60,
      });
      const title = response.text.trim().replace(/^["']|["']$/g, '');
      await Promise.all([
        title ? patchSession(sessionId, { title }) : Promise.resolve(),
        logStep(sessionId, 'generate-session-title', 'completed', {
          title,
          inputTokens: response.usage?.inputTokens ?? 0,
          outputTokens: response.usage?.outputTokens ?? 0,
          durationMs: response.summary.durationMs,
        }),
      ]);
    });

    let totalInputTokens = round1QuestionResult.usage?.inputTokens ?? 0;
    let totalOutputTokens = round1QuestionResult.usage?.outputTokens ?? 0;
    let totalWebSearchRequests = 0;

    await step.run('deduct-credits-generate-questions-r1', () =>
      deductCredits(
        requestedBy,
        runCostCents(
          round1QuestionResult.usage?.inputTokens ?? 0,
          round1QuestionResult.usage?.outputTokens ?? 0,
          0,
        ),
        sessionId,
        round1QuestionResult.usage?.inputTokens ?? 0,
        round1QuestionResult.usage?.outputTokens ?? 0,
        0,
        'generate-questions-r1',
        { durationMs: round1QuestionResult.summary?.durationMs },
      ),
    );

    // Step 2: Wait for Round 1 answers
    const round1AnswersEvent = await step.waitForEvent('wait-for-answers-r1', {
      event: 'curation/answers' as CurationAnswersEvent['name'],
      timeout: '15m',
      if: `async.data.sessionId == "${sessionId}" && async.data.round == 1`,
    });

    if (!round1AnswersEvent) {
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

    const round1Answers = round1AnswersEvent.data.answers;
    console.log('[curate-collection] answers-round-1-received', {
      at: nowIso(),
      sessionId,
      answers: round1Answers,
    });

    await step.realtime.publish('answers-round-1-received', ch.progress, {
      step: 'answers-round-1-received',
      message: 'Round 1 answers received. Researching the category...',
    });

    await step.run('persist-research-phase', () =>
      Promise.all([
        patchSession(sessionId, {
          phase: 'researching',
          answers: round1Answers,
          lastProgressMessage:
            'Round 1 answers received. Researching the category...',
        }),
        logProgressEvent(sessionId, {
          step: 'answers-round-1-received',
          message: 'Round 1 answers received. Researching the category...',
          ts: Date.now(),
        }),
      ]),
    );

    // Step 3: Research the category before planning
    const categoryResearchResult = await step.run(
      'category-research',
      async () => {
        const response = await llm.generateWithSearch({
          system: CURATOR_SYSTEM_PROMPT,
          prompt: buildCategoryResearchPrompt(
            topic,
            round1Questions,
            round1Answers,
            queryType,
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
        await logStep(sessionId, 'category-research', 'completed', {
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

    await step.run('deduct-credits-category-research', () =>
      deductCredits(
        requestedBy,
        runCostCents(
          categoryResearchResult.usage?.inputTokens ?? 0,
          categoryResearchResult.usage?.outputTokens ?? 0,
          categoryResearchResult.usage?.webSearchRequests ?? 0,
          'claude-haiku-4-5-20251001',
        ),
        sessionId,
        categoryResearchResult.usage?.inputTokens ?? 0,
        categoryResearchResult.usage?.outputTokens ?? 0,
        categoryResearchResult.usage?.webSearchRequests ?? 0,
        'category-research',
        {
          durationMs: categoryResearchResult.summary?.durationMs,
          codeExecutionCount:
            categoryResearchResult.summary?.codeExecutionCount,
        },
      ),
    );

    const research = categoryResearchResult.research;

    await step.realtime.publish('market-landscape-started', ch.progress, {
      step: 'market-landscape-started',
      message: 'Scouting source lists and recurring products...',
    });

    const marketLandscapeResult = await step.run(
      'market-landscape',
      async () => {
        const response = await llm.generateWithSearch({
          system: CURATOR_SYSTEM_PROMPT,
          prompt: buildMarketLandscapePrompt(
            topic,
            round1Questions,
            round1Answers,
            research,
          ),
          maxTokens: researchTokenLimit(),
        });
        const raw = parseJson<unknown>(response.text);
        const result = MarketLandscapeSchema.safeParse(raw);
        if (!result.success) {
          throw new Error(
            `Failed to parse market landscape: ${JSON.stringify(result.error.issues)} | raw: ${response.text.slice(0, 300)}`,
          );
        }
        await logStep(sessionId, 'market-landscape', 'completed', {
          recurringProductCount: result.data.recurringProducts.length,
          recurringSectionCount: result.data.recurringSections.length,
          tradeoffCount: result.data.tradeoffs.length,
        });
        return {
          landscape: result.data,
          usage: response.usage,
          summary: response.summary,
        };
      },
    );

    totalInputTokens += marketLandscapeResult.usage?.inputTokens ?? 0;
    totalOutputTokens += marketLandscapeResult.usage?.outputTokens ?? 0;
    totalWebSearchRequests +=
      marketLandscapeResult.usage?.webSearchRequests ?? 0;

    await step.run('deduct-credits-market-landscape', () =>
      deductCredits(
        requestedBy,
        runCostCents(
          marketLandscapeResult.usage?.inputTokens ?? 0,
          marketLandscapeResult.usage?.outputTokens ?? 0,
          marketLandscapeResult.usage?.webSearchRequests ?? 0,
          'claude-haiku-4-5-20251001',
        ),
        sessionId,
        marketLandscapeResult.usage?.inputTokens ?? 0,
        marketLandscapeResult.usage?.outputTokens ?? 0,
        marketLandscapeResult.usage?.webSearchRequests ?? 0,
        'market-landscape',
        {
          durationMs: marketLandscapeResult.summary?.durationMs,
          codeExecutionCount: marketLandscapeResult.summary?.codeExecutionCount,
        },
      ),
    );

    const marketLandscape = marketLandscapeResult.landscape;

    await step.run('persist-category-research', () =>
      Promise.all([
        patchSession(sessionId, {
          phase: research.followUpNeeded ? 'interview-round-2' : 'framing',
          researchBriefJson: JSON.stringify(research),
          marketLandscapeJson: JSON.stringify(marketLandscape),
          lastProgressMessage: research.followUpNeeded
            ? 'Category research complete — preparing follow-up questions.'
            : 'Category research complete — building curatorial brief.',
        }),
        logProgressEvent(sessionId, {
          step: 'category-research-complete',
          message: research.followUpNeeded
            ? 'Category research complete. A few follow-up questions will sharpen the direction.'
            : 'Category research complete. Building curatorial brief...',
          detail: research.suggestedLenses.join(', ') || undefined,
          ts: Date.now(),
        }),
      ]),
    );

    await step.realtime.publish('market-landscape-complete', ch.progress, {
      step: 'market-landscape-complete',
      message: `Market landscape ready: ${marketLandscape.recurringProducts.length} recurring products, ${marketLandscape.recurringSections.length} section patterns`,
      detail: marketLandscape.recurringSections.map((s) => s.label).join(', '),
    });

    await step.realtime.publish('category-research-complete', ch.progress, {
      step: 'category-research-complete',
      message: research.followUpNeeded
        ? 'Category research complete. A few follow-up questions will sharpen the direction.'
        : 'Category research complete. Building curatorial brief...',
      detail: research.suggestedLenses.join(', ') || undefined,
    });

    let round2Questions: InterviewQuestion[] = [];
    let round2Answers: Record<string, string> = {};

    if (research.followUpNeeded) {
      const round2QuestionResult = await step.run(
        'generate-questions-r2',
        async () => {
          const response = await llm.generate({
            system:
              'You are a product curation assistant. Return only valid JSON arrays — no markdown, no explanation.',
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

      await step.run('deduct-credits-generate-questions-r2', () =>
        deductCredits(
          requestedBy,
          runCostCents(
            round2QuestionResult.usage?.inputTokens ?? 0,
            round2QuestionResult.usage?.outputTokens ?? 0,
            0,
          ),
          sessionId,
          round2QuestionResult.usage?.inputTokens ?? 0,
          round2QuestionResult.usage?.outputTokens ?? 0,
          0,
          'generate-questions-r2',
          { durationMs: round2QuestionResult.summary?.durationMs },
        ),
      );

      round2Questions = round2QuestionResult.questions;

      await step.run('persist-round-2-questions', () =>
        Promise.all([
          patchSession(sessionId, {
            questions: round2Questions,
            questionRound: 2,
            phase: 'interview-round-2',
            lastProgressMessage:
              'Round 2 questions sent — waiting for your answers.',
          }),
          logProgressEvent(sessionId, {
            step: 'interview-round-2-sent',
            message: 'Round 2 questions sent — waiting for your answers.',
            ts: Date.now(),
          }),
        ]),
      );

      await step.realtime.publish('interview-round-2-questions', ch.interview, {
        round: 2,
        questions: round2Questions,
      });
      await step.realtime.publish('interview-round-2-sent', ch.progress, {
        step: 'interview-round-2-sent',
        message: 'Round 2 questions sent — waiting for your answers.',
      });

      const round2AnswersEvent = await step.waitForEvent(
        'wait-for-answers-r2',
        {
          event: 'curation/answers' as CurationAnswersEvent['name'],
          timeout: '15m',
          if: `async.data.sessionId == "${sessionId}" && async.data.round == 2`,
        },
      );

      if (!round2AnswersEvent) {
        await step.realtime.publish('timed-out-r2', ch.progress, {
          step: 'error',
          message:
            'Timed out waiting for follow-up answers. Start a new session to try again.',
        });
        await step.run('persist-error-phase-r2', () =>
          patchSession(sessionId, { phase: 'error' }),
        );
        return;
      }

      round2Answers = round2AnswersEvent.data.answers;

      await step.realtime.publish('answers-round-2-received', ch.progress, {
        step: 'answers-round-2-received',
        message: 'Round 2 answers received. Building curatorial brief...',
      });

      await step.run('persist-framing-phase', () =>
        Promise.all([
          patchSession(sessionId, {
            phase: 'framing',
            answers: { ...round1Answers, ...round2Answers },
            lastProgressMessage:
              'Round 2 answers received. Building curatorial brief...',
          }),
          logProgressEvent(sessionId, {
            step: 'answers-round-2-received',
            message: 'Round 2 answers received. Building curatorial brief...',
            ts: Date.now(),
          }),
        ]),
      );
    } else {
      await step.run('persist-no-followup-framing-phase', () =>
        patchSession(sessionId, {
          phase: 'framing',
          questionRound: 1,
          answers: round1Answers,
          lastProgressMessage: 'Building curatorial brief...',
        }),
      );
    }

    // Step 4: Build framing brief
    const framingResult = await step.run('build-framing-brief', async () => {
      const response = await llm.generate({
        system: CURATOR_SYSTEM_PROMPT,
        prompt: buildFramingPrompt(
          topic,
          round1Questions,
          round1Answers,
          research,
          round2Questions,
          round2Answers,
          marketLandscape,
          queryType,
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
      await logStep(sessionId, 'build-framing-brief', 'completed', {
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

    await step.run('deduct-credits-build-framing-brief', () =>
      deductCredits(
        requestedBy,
        runCostCents(
          framingResult.usage?.inputTokens ?? 0,
          framingResult.usage?.outputTokens ?? 0,
          0,
        ),
        sessionId,
        framingResult.usage?.inputTokens ?? 0,
        framingResult.usage?.outputTokens ?? 0,
        0,
        'build-framing-brief',
        { durationMs: framingResult.summary?.durationMs },
      ),
    );

    let framingBrief = framingResult.brief;

    // Step 4b: Brief review gate — show user the brief before expensive execution
    await step.realtime.publish('brief-review-ready', ch.progress, {
      step: 'brief-review-ready',
      message: 'Brief ready — please review before we start building.',
      framingBriefJson: JSON.stringify(framingBrief),
    });

    await step.run('persist-brief-review-phase', () =>
      Promise.all([
        patchSession(sessionId, {
          phase: 'brief-review',
          questionRound: round2Questions.length > 0 ? 2 : 1,
          answers: { ...round1Answers, ...round2Answers },
          framingBriefJson: JSON.stringify(framingBrief),
          lastProgressMessage: 'Brief ready — waiting for your approval.',
        }),
        logProgressEvent(sessionId, {
          step: 'brief-review-ready',
          message: 'Brief ready — waiting for your approval.',
          ts: Date.now(),
        }),
      ]),
    );

    const briefApprovalEvent = await step.waitForEvent(
      'wait-for-brief-approval',
      {
        event: 'curation/brief-approved' as CurationBriefApprovedEvent['name'],
        timeout: '20m',
        if: `async.data.sessionId == "${sessionId}"`,
      },
    );

    if (!briefApprovalEvent) {
      await step.realtime.publish('timed-out-brief', ch.progress, {
        step: 'error',
        message:
          'Timed out waiting for brief approval. Start a new session to try again.',
      });
      await step.run('persist-error-phase-brief', () =>
        patchSession(sessionId, { phase: 'error' }),
      );
      return;
    }

    const correction = briefApprovalEvent.data.correction?.trim() ?? '';

    if (correction) {
      // Rebuild framing brief with user correction injected
      const correctedFramingResult = await step.run(
        'build-framing-brief-corrected',
        async () => {
          const response = await llm.generate({
            system: CURATOR_SYSTEM_PROMPT,
            prompt: buildFramingPrompt(
              topic,
              round1Questions,
              round1Answers,
              research,
              round2Questions,
              round2Answers,
              marketLandscape,
              queryType,
              correction,
            ),
            maxTokens: framingTokenLimit(),
          });
          const raw = parseJson<unknown>(response.text);
          const result = FramingBriefSchema.safeParse(raw);
          if (!result.success) {
            throw new Error(
              `Failed to parse corrected framing brief: ${JSON.stringify(result.error.issues)}`,
            );
          }
          return { brief: result.data, usage: response.usage };
        },
      );
      framingBrief = correctedFramingResult.brief;
      totalInputTokens += correctedFramingResult.usage?.inputTokens ?? 0;
      totalOutputTokens += correctedFramingResult.usage?.outputTokens ?? 0;
      await step.run('deduct-credits-build-framing-brief-corrected', () =>
        deductCredits(
          requestedBy,
          runCostCents(
            correctedFramingResult.usage?.inputTokens ?? 0,
            correctedFramingResult.usage?.outputTokens ?? 0,
            0,
          ),
          sessionId,
          correctedFramingResult.usage?.inputTokens ?? 0,
          correctedFramingResult.usage?.outputTokens ?? 0,
          0,
          'build-framing-brief-corrected',
          { durationMs: correctedFramingResult.summary?.durationMs },
        ),
      );
    }

    await step.realtime.publish('framing-complete', ch.progress, {
      step: 'framing-complete',
      message: 'Brief approved. Planning collection...',
      detail: framingBrief.goal,
      framingBriefJson: JSON.stringify(framingBrief),
    });

    await step.run('persist-planning-phase', () =>
      Promise.all([
        patchSession(sessionId, {
          phase: 'planning',
          framingBriefJson: JSON.stringify(framingBrief),
          lastProgressMessage: 'Brief approved. Planning collection...',
        }),
        logProgressEvent(sessionId, {
          step: 'framing-complete',
          message: 'Brief approved. Planning collection...',
          detail: framingBrief.goal,
          ts: Date.now(),
        }),
      ]),
    );

    // Step 5: Plan the collection structure
    const planResult = await step.run('plan-collection', async () => {
      console.log('[curate-collection] plan:start', {
        at: nowIso(),
        sessionId,
      });
      const response = await llm.generate({
        system: CURATOR_SYSTEM_PROMPT,
        prompt: buildPlanPrompt(topic, framingBrief, marketLandscape),
        maxTokens: planTokenLimit(),
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
      return { ...parsed, usage: response.usage, summary: response.summary };
    });
    const plan = planResult;

    totalInputTokens += planResult.usage?.inputTokens ?? 0;
    totalOutputTokens += planResult.usage?.outputTokens ?? 0;

    await step.run('deduct-credits-plan-collection', () =>
      deductCredits(
        requestedBy,
        runCostCents(
          planResult.usage?.inputTokens ?? 0,
          planResult.usage?.outputTokens ?? 0,
          0,
        ),
        sessionId,
        planResult.usage?.inputTokens ?? 0,
        planResult.usage?.outputTokens ?? 0,
        0,
        'plan-collection',
        { durationMs: planResult.summary?.durationMs },
      ),
    );

    await step.realtime.publish('planned', ch.progress, {
      step: 'planned',
      message: `Plan ready: ${plan.sections.length} sections`,
      detail: plan.sections.map((s) => s.title).join(', '),
    });

    await step.run('persist-planned', () =>
      logProgressEvent(sessionId, {
        step: 'planned',
        message: `Plan ready: ${plan.sections.length} sections`,
        detail: plan.sections.map((s) => s.title).join(', '),
        ts: Date.now(),
      }),
    );

    // Step 6: Discover URLs per section via web search (no page reading)
    // All sections run in parallel — each section's chain of steps is internally
    // sequential (find → deduct → validate) but sections don't block each other.
    const urlSectionResults = await Promise.all(
      plan.sections.map(async (section) => {
        const slug = parameterize(section.title);

        await step.realtime.publish(`searching-${slug}`, ch.progress, {
          step: 'searching',
          message: `Searching for "${section.title}"...`,
        });

        const found = await step.run(`find-urls-${slug}`, async () => {
          console.log('[curate-collection] find-urls:start', {
            at: nowIso(),
            sessionId,
            section: section.title,
            slug,
          });
          const response = await llm.batchSearch({
            querySystem: buildUrlQueryGenSystemPrompt(),
            queryPrompt: buildUrlQueryGenPrompt(
              section,
              topic,
              framingBrief,
              marketLandscape,
            ),
            extractionSystem: buildUrlExtractionSystemPrompt(),
            buildExtractionPrompt: (results) =>
              buildUrlExtractionPrompt(
                section,
                results,
                framingBrief,
                marketLandscape,
              ),
            extractionMaxTokens: urlDiscoveryTokenLimit(),
          });
          console.log('[curate-collection] find-urls:response', {
            ...response.summary,
            at: nowIso(),
            sessionId,
            section: section.title,
            slug,
          });

          const parsed = parseJson<UrlDiscoveryPayload>(response.text);
          if (!parsed) {
            console.error('[curate-collection] find-urls:parse-failed', {
              at: nowIso(),
              sessionId,
              section: section.title,
              slug,
              textPreview: response.text.slice(0, 500),
            });
            return {
              urls: [] as string[],
              usage: null,
              summary: response.summary,
              parseFailed: true,
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
            parseFailed: false,
          };
        });

        await step.run(`deduct-credits-urls-${slug}`, () =>
          deductCredits(
            requestedBy,
            runCostCents(
              found.usage?.inputTokens ?? 0,
              found.usage?.outputTokens ?? 0,
              found.usage?.webSearchRequests ?? 0,
              'claude-haiku-4-5-20251001',
            ),
            sessionId,
            found.usage?.inputTokens ?? 0,
            found.usage?.outputTokens ?? 0,
            found.usage?.webSearchRequests ?? 0,
            `find-urls-${slug}`,
            {
              urlCount: found.urls.length,
              codeExecutionCount: found.summary?.codeExecutionCount,
              durationMs: found.summary?.durationMs,
            },
          ),
        );

        // Validate discovered URLs with HEAD requests — filter out hallucinated 404s
        const validatedUrls = found.parseFailed
          ? []
          : await step.run(`validate-urls-${slug}`, async () => {
              const results = await Promise.allSettled(
                found.urls.map((url) =>
                  fetch(url, {
                    method: 'HEAD',
                    signal: AbortSignal.timeout(5000),
                  })
                    .then((r) => ({ url, ok: r.ok || r.status < 400 }))
                    .catch(() => ({ url, ok: false })),
                ),
              );
              const valid = results
                .filter((r) => r.status === 'fulfilled' && r.value.ok)
                .map(
                  (r) =>
                    (r as PromiseFulfilledResult<{ url: string; ok: boolean }>)
                      .value.url,
                );
              const dropped = found.urls.length - valid.length;
              if (dropped > 0) {
                console.log('[curate-collection] validate-urls:dropped', {
                  at: nowIso(),
                  sessionId,
                  section: section.title,
                  dropped,
                  kept: valid.length,
                });
              }
              return valid;
            });

        const finalUrls = found.parseFailed ? [] : validatedUrls;
        const domains = finalUrls
          .map((u) => {
            try {
              return new URL(u).hostname;
            } catch {
              return u;
            }
          })
          .join(', ');

        const droppedCount = found.parseFailed
          ? 0
          : found.urls.length - finalUrls.length;

        await step.realtime.publish(`found-urls-${slug}`, ch.progress, {
          step: found.parseFailed ? 'search-parse-failed' : 'found-urls',
          message: found.parseFailed
            ? `Search returned an unreadable response for "${section.title}"`
            : `Found ${finalUrls.length} URLs for "${section.title}"${droppedCount > 0 ? ` (${droppedCount} invalid dropped)` : ''}`,
          detail: found.parseFailed
            ? 'No URLs could be extracted from the model output. This is likely a parsing or formatting issue.'
            : domains || undefined,
        });

        return {
          urlSection: { title: section.title, slug, urls: finalUrls },
          usage: found.usage,
        };
      }),
    );

    const urlSections: UrlSection[] = [];
    for (const { urlSection, usage } of urlSectionResults) {
      totalInputTokens += usage?.inputTokens ?? 0;
      totalOutputTokens += usage?.outputTokens ?? 0;
      totalWebSearchRequests += usage?.webSearchRequests ?? 0;
      urlSections.push(urlSection);
    }

    // Send all sections in one message so the browser knows the full URL count upfront
    await step.realtime.publish('section-urls', ch['section-urls'], {
      sections: urlSections,
    });

    const totalUrlCount = urlSections.reduce((n, s) => n + s.urls.length, 0);

    // Step 7: Persist URL data for reconnect, then wait for extractions
    await step.run('persist-session-urls', () =>
      Promise.all([
        patchSession(sessionId, {
          phase: 'extracting',
          urlSections,
          lastProgressMessage:
            'URL discovery complete — extracting pages server-side...',
        }),
        logProgressEvent(sessionId, {
          step: 'urls-found',
          message: `${totalUrlCount} URLs found across ${urlSections.length} sections`,
          ts: Date.now(),
        }),
        logProgressEvent(sessionId, {
          step: 'extracting',
          message: 'Extracting pages with extension...',
          ts: Date.now() + 1,
        }),
      ]),
    );

    // Also publish urls topic for reconnect/sync restore in the browser
    await step.realtime.publish('urls-ready', ch.urls, {
      sections: urlSections,
    });
    await step.realtime.publish('urls-found', ch.progress, {
      step: 'urls-found',
      message: `${totalUrlCount} URLs found across ${urlSections.length} sections`,
    });
    // Publish before-extraction messages per section (sequential, gives realtime visibility)
    for (const section of urlSections) {
      await step.realtime.publish(`extracting-${section.slug}`, ch.progress, {
        step: 'extracting',
        message: `Extracting "${section.title}" (${section.urls.length} URLs)...`,
      });
    }

    // Run all sections in parallel — each section uses 2-tier CF+web-search extraction
    const extractionResults = await Promise.all(
      urlSections.map((section) =>
        step.run(`extract-section-${section.slug}`, () =>
          extractSection(section),
        ),
      ),
    );

    const extractedSections: ExtractedSection[] = extractionResults;

    for (const r of extractionResults) {
      const tierDetail = [
        r.cfCount > 0 && `${r.cfCount} via CF`,
        r.webSearchCount > 0 && `${r.webSearchCount} via web search`,
        r.failedCount > 0 && `${r.failedCount} failed`,
      ]
        .filter(Boolean)
        .join(', ');

      await step.realtime.publish(`extracted-${r.slug}`, ch.progress, {
        step: 'extracted',
        message: `"${r.title}": ${r.items.length} products extracted`,
        detail: tierDetail || undefined,
      });
    }

    await step.run('persist-extracted-slugs', () =>
      patchSession(sessionId, {
        extractedSlugs: extractionResults.map((r) => r.slug),
      }),
    );

    for (const r of extractionResults) {
      totalInputTokens += r.usage.inputTokens;
      totalOutputTokens += r.usage.outputTokens;
      totalWebSearchRequests += r.usage.webSearchRequests;

      if (r.usage.inputTokens > 0 || r.cfCount > 0) {
        await step.run(`deduct-credits-extract-${r.slug}`, () =>
          deductCredits(
            requestedBy,
            runCostCents(
              r.usage.inputTokens,
              r.usage.outputTokens,
              0,
              'claude-sonnet-4-6',
              r.usage.webSearchRequests,
            ),
            sessionId,
            r.usage.inputTokens,
            r.usage.outputTokens,
            r.usage.webSearchRequests,
            `extract-section-${r.slug}`,
            {
              urlCount: r.items.length,
              durationMs: r.durationMs,
              cfCount: r.cfCount,
              webSearchCount: r.webSearchCount,
              failedCount: r.failedCount,
            },
          ),
        );
      }
    }

    const totalExtracted = extractedSections.reduce(
      (n: number, s: ExtractedSection) => n + s.items.length,
      0,
    );

    await step.run('log-extraction-complete', () =>
      logProgressEvent(sessionId, {
        step: 'extraction-complete',
        message: `${totalExtracted} products extracted across ${extractedSections.length} sections`,
        ts: Date.now(),
      }),
    );

    await step.realtime.publish('extraction-complete', ch.progress, {
      step: 'extraction-complete',
      message: `${totalExtracted} products extracted — curating collection...`,
    });

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
      detail: `Evaluating ${totalExtracted} candidates across ${extractedSections.length} sections`,
    });

    await step.run('persist-curating-phase', () =>
      Promise.all([
        patchSession(sessionId, {
          phase: 'curating',
          lastProgressMessage: `Extracted ${totalExtracted} items — curating initial collection...`,
        }),
        logProgressEvent(sessionId, {
          step: 'curating',
          message: `Extracted ${totalExtracted} items — curating initial collection...`,
          detail: `Evaluating ${totalExtracted} candidates across ${extractedSections.length} sections`,
          ts: Date.now(),
        }),
      ]),
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
          framingBrief,
        ),
        maxTokens: curateTokenLimit(),
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
    await step.run('deduct-credits-curate', () =>
      deductCredits(
        requestedBy,
        runCostCents(
          result.usage?.inputTokens ?? 0,
          result.usage?.outputTokens ?? 0,
          0,
        ),
        sessionId,
        result.usage?.inputTokens ?? 0,
        result.usage?.outputTokens ?? 0,
        0,
        'curate-and-write',
        {
          candidateCount: result.candidateCount,
          durationMs: result.summary?.durationMs,
        },
      ),
    );

    let currentCollection = parseJson<CollectionOutput>(result.json);
    if (!currentCollection) {
      throw new Error('Failed to restore collection after initial curation.');
    }

    // Step 8: Hospitality pass before refinement
    await step.realtime.publish('hospitality', ch.progress, {
      step: 'hospitality',
      message: 'Polishing the shortlist...',
    });

    await step.run('persist-hospitality-phase', () =>
      Promise.all([
        patchSession(sessionId, {
          phase: 'hospitality',
          lastProgressMessage: 'Polishing the shortlist...',
        }),
        logProgressEvent(sessionId, {
          step: 'hospitality',
          message: 'Polishing the shortlist...',
          ts: Date.now(),
        }),
      ]),
    );

    const hospitalityResult = await step.run('hospitality-pass', async () => {
      const response = await llm.generate({
        system: CURATOR_SYSTEM_PROMPT,
        prompt: buildHospitalityPassPrompt(currentCollection, framingBrief),
        maxTokens: hospitalityTokenLimit(),
      });
      const refined = parseJson<CollectionOutput>(response.text);
      if (refined) {
        await logStep(sessionId, 'hospitality-pass', 'completed', {
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

    await step.run('deduct-credits-hospitality-pass', () =>
      deductCredits(
        requestedBy,
        runCostCents(
          hospitalityResult.usage?.inputTokens ?? 0,
          hospitalityResult.usage?.outputTokens ?? 0,
          0,
        ),
        sessionId,
        hospitalityResult.usage?.inputTokens ?? 0,
        hospitalityResult.usage?.outputTokens ?? 0,
        0,
        'hospitality-pass',
        { durationMs: hospitalityResult.summary?.durationMs },
      ),
    );

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
        Promise.all([
          patchSession(sessionId, {
            phase: 'refining',
            refinementPass: pass,
            lastProgressMessage: `Refinement pass ${pass}: analysing warnings...`,
          }),
          logProgressEvent(sessionId, {
            step: `refining-${pass}`,
            message: `Refinement pass ${pass}: analysing ${currentCollection.warnings.length} warnings...`,
            ts: Date.now(),
          }),
        ]),
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

      await step.run(`deduct-credits-gaps-${pass}`, () =>
        deductCredits(
          requestedBy,
          runCostCents(
            gapsResult.usage?.inputTokens ?? 0,
            gapsResult.usage?.outputTokens ?? 0,
            0,
          ),
          sessionId,
          gapsResult.usage?.inputTokens ?? 0,
          gapsResult.usage?.outputTokens ?? 0,
          0,
          `parse-gaps-${pass}`,
        ),
      );

      const actionableGaps = gapsResult.gaps.filter((g) => g.actionable);
      if (actionableGaps.length === 0) break;

      await step.run(`persist-gaps-${pass}`, () =>
        patchSession(sessionId, { gaps: actionableGaps }),
      );

      // 7b. URL discovery per gap — all gaps run in parallel
      const gapUrlResults = await Promise.all(
        actionableGaps.map(async (gap, gi) => {
          const gapSlug = `gap-${pass}-${gi}`;

          await step.realtime.publish(`searching-${gapSlug}`, ch.progress, {
            step: 'searching',
            message: `Finding URLs for gap: "${gap.description}"`,
          });

          const foundGap = await step.run(`find-urls-${gapSlug}`, async () => {
            const response = await llm.batchSearch({
              querySystem: buildUrlQueryGenSystemPrompt(),
              queryPrompt: buildRefinementQueryGenPrompt(
                gap,
                topic,
                framingBrief,
              ),
              extractionSystem: buildUrlExtractionSystemPrompt(),
              buildExtractionPrompt: (results) =>
                buildRefinementExtractionPrompt(gap, results, framingBrief),
              extractionMaxTokens: urlDiscoveryTokenLimit(),
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

          await step.run(`deduct-credits-${gapSlug}`, () =>
            deductCredits(
              requestedBy,
              runCostCents(
                foundGap.usage?.inputTokens ?? 0,
                foundGap.usage?.outputTokens ?? 0,
                foundGap.usage?.webSearchRequests ?? 0,
                'claude-haiku-4-5-20251001',
              ),
              sessionId,
              foundGap.usage?.inputTokens ?? 0,
              foundGap.usage?.outputTokens ?? 0,
              foundGap.usage?.webSearchRequests ?? 0,
              `find-urls-${gapSlug}`,
              {
                urlCount: foundGap.urls.length,
                codeExecutionCount: foundGap.summary?.codeExecutionCount,
                durationMs: foundGap.summary?.durationMs,
              },
            ),
          );

          await step.realtime.publish(`found-urls-${gapSlug}`, ch.progress, {
            step: foundGap.parseFailed ? 'search-parse-failed' : 'found-urls',
            message: foundGap.parseFailed
              ? `Search returned an unreadable response for gap: "${gap.description}"`
              : `Found ${foundGap.urls.length} URLs for gap: "${gap.description}"`,
            detail: foundGap.parseFailed
              ? 'No URLs could be extracted from the model output. This is likely a parsing or formatting issue.'
              : undefined,
          });

          return {
            urlSection: {
              title: gap.description,
              slug: gapSlug,
              urls: foundGap.urls,
            },
            usage: foundGap.usage,
          };
        }),
      );

      const refinementUrlSections: UrlSection[] = [];
      for (const { urlSection, usage } of gapUrlResults) {
        totalInputTokens += usage?.inputTokens ?? 0;
        totalOutputTokens += usage?.outputTokens ?? 0;
        totalWebSearchRequests += usage?.webSearchRequests ?? 0;
        refinementUrlSections.push(urlSection);
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

      // 7c. Extract gap URLs server-side using 2-tier CF+web-search strategy
      if (refinementUrlSections.length === 0) break;

      for (const section of refinementUrlSections) {
        await step.realtime.publish(`extracting-${section.slug}`, ch.progress, {
          step: 'extracting',
          message: `Extracting gap: "${section.title}" (${section.urls.length} URLs)...`,
        });
      }

      const gapExtractionResults = await Promise.all(
        refinementUrlSections.map((section) =>
          step.run(`extract-section-${section.slug}`, () =>
            extractSection(section),
          ),
        ),
      );

      const refinedSections: ExtractedSection[] = gapExtractionResults;

      for (const r of gapExtractionResults) {
        const tierDetail = [
          r.cfCount > 0 && `${r.cfCount} via CF`,
          r.webSearchCount > 0 && `${r.webSearchCount} via web search`,
          r.failedCount > 0 && `${r.failedCount} failed`,
        ]
          .filter(Boolean)
          .join(', ');

        await step.realtime.publish(`extracted-${r.slug}`, ch.progress, {
          step: 'extracted',
          message: `"${r.title}": ${r.items.length} products extracted`,
          detail: tierDetail || undefined,
        });
      }

      await step.run(`persist-refined-slugs-${pass}`, () =>
        patchSession(sessionId, {
          extractedSlugs: [
            ...extractedSections.map((s) => s.slug),
            ...refinedSections.map((s) => s.slug),
          ],
        }),
      );

      for (const r of gapExtractionResults) {
        totalInputTokens += r.usage.inputTokens;
        totalOutputTokens += r.usage.outputTokens;
        totalWebSearchRequests += r.usage.webSearchRequests;

        if (r.usage.inputTokens > 0 || r.cfCount > 0) {
          await step.run(`deduct-credits-extract-${r.slug}`, () =>
            deductCredits(
              requestedBy,
              runCostCents(
                r.usage.inputTokens,
                r.usage.outputTokens,
                0,
                'claude-sonnet-4-6',
                r.usage.webSearchRequests,
              ),
              sessionId,
              r.usage.inputTokens,
              r.usage.outputTokens,
              r.usage.webSearchRequests,
              `extract-section-${r.slug}`,
              {
                urlCount: r.items.length,
                durationMs: r.durationMs,
                cfCount: r.cfCount,
                webSearchCount: r.webSearchCount,
                failedCount: r.failedCount,
              },
            ),
          );
        }
      }

      const gapTotalExtracted = refinedSections.reduce(
        (n, s) => n + s.items.length,
        0,
      );

      await step.run(`log-gap-extraction-complete-${pass}`, () =>
        logProgressEvent(sessionId, {
          step: `extraction-complete-gap-${pass}`,
          message: `${gapTotalExtracted} products extracted across ${refinedSections.length} gap sections`,
          ts: Date.now(),
        }),
      );

      await step.realtime.publish(
        `extraction-complete-gap-${pass}`,
        ch.progress,
        {
          step: 'extraction-complete',
          message: `${gapTotalExtracted} gap products extracted — refining collection...`,
        },
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

      await step.run(`deduct-credits-refine-${pass}`, () =>
        deductCredits(
          requestedBy,
          runCostCents(
            refineResult.usage?.inputTokens ?? 0,
            refineResult.usage?.outputTokens ?? 0,
            0,
          ),
          sessionId,
          refineResult.usage?.inputTokens ?? 0,
          refineResult.usage?.outputTokens ?? 0,
          0,
          `refine-collection-${pass}`,
          {
            candidateCount: refineResult.candidateCount,
            durationMs: refineResult.summary?.durationMs,
          },
        ),
      );

      if (refineResult.collection) {
        currentCollection = refineResult.collection;
        const refinedJson = JSON.stringify(currentCollection);
        const refinedItemCount = currentCollection.sections.reduce(
          (n, s) => n + s.items.length,
          0,
        );
        // Update persisted result with refined collection (still in-progress)
        await step.run(`persist-refine-result-${pass}`, () =>
          Promise.all([
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
            logProgressEvent(sessionId, {
              step: `refine-complete-${pass}`,
              message: `Refinement pass ${pass} complete — ${refinedItemCount} items across ${currentCollection.sections.length} sections`,
              ts: Date.now(),
            }),
          ]),
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
          model: 'claude-sonnet-4-6',
          phase: 'complete',
          sectionCount: currentCollection.sections.length,
          itemCount: finalItemCount,
        }),
        logProgressEvent(sessionId, {
          step: 'complete',
          message: 'Done.',
          ts: Date.now(),
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
