import Anthropic from '@anthropic-ai/sdk';
import { RetryAfterError } from 'inngest';
import { braveSearch, type BraveSearchResult } from '../lib/braveSearch';

export type SearchResultSet = { query: string; results: BraveSearchResult[] };

export type LLMUsage = {
  inputTokens: number;
  outputTokens: number;
  webSearchRequests: number;
};

export type LLMResponseSummary = {
  stopReason: string | null;
  contentBlockTypes: string[];
  textBlockCount: number;
  textChars: number;
  toolUseCount: number;
  toolNames: string[];
  codeExecutionCount: number;
  durationMs: number;
};

export type LLMResponse = {
  text: string;
  usage: LLMUsage | null;
  summary: LLMResponseSummary;
};

export type LLMClient = {
  generate(params: {
    system: string;
    prompt: string;
    maxTokens: number;
    model?: string;
  }): Promise<LLMResponse>;
  generateWithSearch(params: {
    system: string;
    prompt: string;
    maxTokens: number;
    model?: string;
  }): Promise<LLMResponse>;
  /** Generate queries, run them in parallel, extract from all results in one pass. */
  batchSearch(params: {
    querySystem: string;
    queryPrompt: string;
    extractionSystem: string;
    buildExtractionPrompt: (results: SearchResultSet[]) => string;
    queryMaxTokens?: number;
    extractionMaxTokens?: number;
    model?: string;
  }): Promise<LLMResponse>;
};

function fromAnthropicResponse(
  response: Anthropic.Message,
  durationMs: number,
): LLMResponse {
  let textChars = 0;
  let textBlockCount = 0;
  let toolUseCount = 0;
  const toolNames: string[] = [];
  const textParts: string[] = [];

  for (const block of response.content) {
    if (block.type === 'text') {
      textBlockCount += 1;
      textChars += block.text.length;
      textParts.push(block.text);
    } else if (block.type === 'tool_use') {
      toolUseCount += 1;
      toolNames.push(block.name);
    }
  }

  const cacheWrite = response.usage?.cache_creation_input_tokens ?? 0;
  const cacheRead = response.usage?.cache_read_input_tokens ?? 0;
  if (cacheWrite > 0 || cacheRead > 0) {
    console.warn('[llm] call:cache-tokens', { cacheWrite, cacheRead });
  }

  return {
    text: textParts.join('\n').trim(),
    usage: response.usage
      ? {
          inputTokens: response.usage.input_tokens + cacheWrite + cacheRead,
          outputTokens: response.usage.output_tokens,
          webSearchRequests:
            response.usage.server_tool_use?.web_search_requests ?? 0,
        }
      : null,
    summary: {
      stopReason: response.stop_reason ?? null,
      contentBlockTypes: response.content.map((b) => b.type),
      textBlockCount,
      textChars,
      toolUseCount,
      toolNames,
      codeExecutionCount: 0,
      durationMs,
    },
  };
}

function createAnthropicClient(): LLMClient {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 5 * 60 * 1000, // 5 min — Inngest handles retries at a higher level
    maxRetries: 0,
  });
  const model = 'claude-sonnet-4-6';

  async function call(
    params: Anthropic.MessageCreateParamsNonStreaming,
  ): Promise<LLMResponse> {
    try {
      const startedAt = Date.now();
      const response = fromAnthropicResponse(
        await client.messages.create(params),
        Date.now() - startedAt,
      );
      if (response.summary.stopReason === 'max_tokens') {
        throw new Error(
          `LLM response truncated at max_tokens limit (${params.max_tokens})`,
        );
      }
      return response;
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 429) {
        const retryAfter = (error as { headers?: Record<string, string> })
          ?.headers?.['retry-after'];
        const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 60_000;
        throw new RetryAfterError(
          'Rate limited',
          new Date(Date.now() + waitMs),
        );
      }
      // 529 = Anthropic overloaded — back off and retry
      if (status === 529) {
        throw new RetryAfterError('Overloaded', new Date(Date.now() + 30_000));
      }
      throw error;
    }
  }

  async function callRaw(
    params: Anthropic.MessageCreateParamsNonStreaming,
  ): Promise<Anthropic.Message> {
    try {
      return await client.messages.create(params);
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 429) {
        const retryAfter = (error as { headers?: Record<string, string> })
          ?.headers?.['retry-after'];
        throw new RetryAfterError(
          'Rate limited',
          new Date(
            Date.now() + (retryAfter ? parseInt(retryAfter) * 1000 : 60_000),
          ),
        );
      }
      if (status === 529)
        throw new RetryAfterError('Overloaded', new Date(Date.now() + 30_000));
      throw error;
    }
  }

  function extractText(msg: Anthropic.Message): string {
    return msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  }

  function sumUsage(
    a: Anthropic.Message,
    b: Anthropic.Message,
  ): { inputTokens: number; outputTokens: number } {
    const aCacheWrite = a.usage?.cache_creation_input_tokens ?? 0;
    const aCacheRead = a.usage?.cache_read_input_tokens ?? 0;
    const bCacheWrite = b.usage?.cache_creation_input_tokens ?? 0;
    const bCacheRead = b.usage?.cache_read_input_tokens ?? 0;
    return {
      inputTokens:
        (a.usage?.input_tokens ?? 0) +
        aCacheWrite +
        aCacheRead +
        (b.usage?.input_tokens ?? 0) +
        bCacheWrite +
        bCacheRead,
      outputTokens:
        (a.usage?.output_tokens ?? 0) + (b.usage?.output_tokens ?? 0),
    };
  }

  return {
    generate({ system, prompt, maxTokens, model: overrideModel }) {
      return call({
        model: overrideModel ?? model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
      });
    },
    async generateWithSearch({
      system,
      prompt,
      maxTokens,
      model: overrideModel,
    }) {
      const searchModel = overrideModel ?? 'claude-haiku-4-5-20251001';
      const MAX_SEARCHES = 7;
      const MAX_TURNS = 12;
      let searchCount = 0;
      let turnCount = 0;

      const webSearchTool: Anthropic.Tool = {
        name: 'web_search',
        description: 'Search the web for current information.',
        input_schema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'The search query' },
            allowed_domains: {
              type: 'array',
              items: { type: 'string' },
              description: 'Only return results from these domains',
            },
            blocked_domains: {
              type: 'array',
              items: { type: 'string' },
              description: 'Never return results from these domains',
            },
          },
          required: ['query'],
        },
      };

      const messages: Anthropic.MessageParam[] = [
        { role: 'user', content: prompt },
      ];

      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalWebSearchRequests = 0;
      let totalDurationMs = 0;
      const allTextParts: string[] = [];

      console.log('[llm] generateWithSearch:start', {
        model: searchModel,
        maxTokens,
        maxSearches: MAX_SEARCHES,
        promptChars: prompt.length,
      });

      while (turnCount++ < MAX_TURNS) {
        const turnStartedAt = Date.now();
        let raw: Anthropic.Message;
        try {
          raw = await client.messages.create({
            model: searchModel,
            max_tokens: maxTokens,
            system,
            tools: [webSearchTool],
            // Once search limit is reached, force text-only output so the model
            // stops requesting more searches and outputs the JSON immediately
            tool_choice:
              searchCount >= MAX_SEARCHES
                ? { type: 'none' as const }
                : { type: 'auto' as const },
            messages,
          });
        } catch (error) {
          const status = (error as { status?: number })?.status;
          if (status === 429) {
            const retryAfter = (error as { headers?: Record<string, string> })
              ?.headers?.['retry-after'];
            const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 60_000;
            console.warn('[llm] generateWithSearch:rate-limited', { waitMs });
            throw new RetryAfterError(
              'Rate limited',
              new Date(Date.now() + waitMs),
            );
          }
          if (status === 529) {
            console.warn('[llm] generateWithSearch:overloaded');
            throw new RetryAfterError(
              'Overloaded',
              new Date(Date.now() + 30_000),
            );
          }
          throw error;
        }
        const turnDurationMs = Date.now() - turnStartedAt;
        totalDurationMs += turnDurationMs;

        if (raw.usage) {
          const cacheWrite = raw.usage.cache_creation_input_tokens ?? 0;
          const cacheRead = raw.usage.cache_read_input_tokens ?? 0;
          totalInputTokens += raw.usage.input_tokens + cacheWrite + cacheRead;
          totalOutputTokens += raw.usage.output_tokens;
          if (cacheWrite > 0 || cacheRead > 0) {
            console.warn('[llm] generateWithSearch:cache-tokens', {
              turn: turnCount,
              cacheWrite,
              cacheRead,
            });
          }
        }

        console.log('[llm] generateWithSearch:turn', {
          turn: turnCount,
          stopReason: raw.stop_reason,
          inputTokens: raw.usage?.input_tokens,
          outputTokens: raw.usage?.output_tokens,
          contentTypes: raw.content.map((b) => b.type),
          searchCount,
          turnDurationMs,
        });

        if (raw.stop_reason === 'max_tokens') {
          throw new Error(
            `LLM response truncated at max_tokens limit (${maxTokens})`,
          );
        }

        // Collect text blocks
        for (const block of raw.content) {
          if (block.type === 'text') allTextParts.push(block.text);
        }

        // If model is done, return
        if (raw.stop_reason === 'end_turn' || raw.stop_reason !== 'tool_use') {
          break;
        }

        // Find tool_use blocks
        const toolUseBlocks = raw.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );
        if (toolUseBlocks.length === 0) break;

        // Push assistant turn
        messages.push({ role: 'assistant', content: raw.content });

        // Execute each tool call and collect results
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const toolUse of toolUseBlocks) {
          if (toolUse.name !== 'web_search' || searchCount >= MAX_SEARCHES) {
            console.warn('[llm] generateWithSearch:search-limit-reached', {
              toolName: toolUse.name,
              searchCount,
            });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify({ error: 'Search limit reached' }),
            });
            continue;
          }

          const input = toolUse.input as {
            query: string;
            allowed_domains?: string[];
            blocked_domains?: string[];
          };

          searchCount += 1;
          totalWebSearchRequests += 1;

          console.log('[llm] generateWithSearch:brave-search', {
            searchCount,
            query: input.query,
            allowedDomains: input.allowed_domains,
            blockedDomains: input.blocked_domains,
          });

          let results;
          try {
            const braveStartedAt = Date.now();
            results = await braveSearch({
              query: input.query,
              allowed_domains: input.allowed_domains,
              blocked_domains: input.blocked_domains,
            });
            console.log('[llm] generateWithSearch:brave-results', {
              searchCount,
              query: input.query,
              resultCount: results.length,
              durationMs: Date.now() - braveStartedAt,
            });
          } catch (err) {
            console.error('[llm] generateWithSearch:brave-error', {
              searchCount,
              query: input.query,
              error: String(err),
            });
            results = [];
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(results),
          });
        }

        const userContent: Array<
          Anthropic.ToolResultBlockParam | Anthropic.TextBlockParam
        > = [...toolResults];
        if (searchCount >= MAX_SEARCHES) {
          userContent.push({
            type: 'text',
            text: 'Search budget exhausted. Output the JSON now with all product page URLs you found in the search results above.',
          });
        }
        messages.push({ role: 'user', content: userContent });
      }

      const finalText = allTextParts.join('\n').trim();
      console.log('[llm] generateWithSearch:done', {
        turns: turnCount,
        totalSearches: totalWebSearchRequests,
        totalInputTokens,
        totalOutputTokens,
        totalDurationMs,
        textChars: finalText.length,
        textPreview: finalText.slice(0, 200),
      });

      return {
        text: finalText,
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          webSearchRequests: totalWebSearchRequests,
        },
        summary: {
          stopReason: 'end_turn',
          contentBlockTypes: ['text'],
          textBlockCount: allTextParts.length,
          textChars: allTextParts.reduce((s, t) => s + t.length, 0),
          toolUseCount: totalWebSearchRequests,
          toolNames: Array(totalWebSearchRequests).fill('web_search'),
          codeExecutionCount: 0,
          durationMs: totalDurationMs,
        },
      };
    },

    async batchSearch({
      querySystem,
      queryPrompt,
      extractionSystem,
      buildExtractionPrompt,
      queryMaxTokens = 300,
      extractionMaxTokens = 4000,
      model: overrideModel,
    }) {
      const searchModel = overrideModel ?? 'claude-haiku-4-5-20251001';
      const totalStartedAt = Date.now();

      // Step 1: Generate all queries in one call
      const queryStartedAt = Date.now();
      const queryRaw = await callRaw({
        model: searchModel,
        max_tokens: queryMaxTokens,
        system: querySystem,
        messages: [{ role: 'user', content: queryPrompt }],
      });
      const queryDurationMs = Date.now() - queryStartedAt;

      const queryText = extractText(queryRaw);
      const queryStripped = queryText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();
      let queries: string[] = [];
      try {
        queries =
          (JSON.parse(queryStripped) as { queries: string[] }).queries ?? [];
      } catch {
        throw new Error(
          `Failed to parse search queries: ${queryText.slice(0, 200)}`,
        );
      }

      console.log('[llm] batchSearch:queries', {
        model: searchModel,
        count: queries.length,
        queries,
      });

      // Step 2: Run all searches in parallel
      const searchStartedAt = Date.now();
      const resultSets: SearchResultSet[] = await Promise.all(
        queries.map(async (query) => {
          try {
            return { query, results: await braveSearch({ query }) };
          } catch (err) {
            console.error('[llm] batchSearch:search-error', {
              query,
              error: String(err),
            });
            return { query, results: [] };
          }
        }),
      );
      const searchDurationMs = Date.now() - searchStartedAt;

      console.log('[llm] batchSearch:searches-complete', {
        searches: queries.length,
        totalResults: resultSets.reduce((n, s) => n + s.results.length, 0),
        searchDurationMs,
      });

      // Step 3: Extract URLs from all results in one call
      const extractionStartedAt = Date.now();
      const extractionRaw = await callRaw({
        model: searchModel,
        max_tokens: extractionMaxTokens,
        system: extractionSystem,
        messages: [
          { role: 'user', content: buildExtractionPrompt(resultSets) },
        ],
      });
      const extractionDurationMs = Date.now() - extractionStartedAt;

      const text = extractText(extractionRaw);
      const usage = sumUsage(queryRaw, extractionRaw);

      console.log('[llm] batchSearch:done', {
        ...usage,
        webSearchRequests: queries.length,
        queryDurationMs,
        searchDurationMs,
        extractionDurationMs,
        totalDurationMs: Date.now() - totalStartedAt,
        textPreview: text.slice(0, 200),
      });

      return {
        text,
        usage: { ...usage, webSearchRequests: queries.length },
        summary: {
          stopReason: extractionRaw.stop_reason ?? null,
          contentBlockTypes: ['text'],
          textBlockCount: 1,
          textChars: text.length,
          toolUseCount: 0,
          toolNames: [],
          codeExecutionCount: 0,
          durationMs: queryDurationMs + searchDurationMs + extractionDurationMs,
        },
      };
    },
  };
}

export function createLLMClient(): LLMClient {
  return createAnthropicClient();
}
