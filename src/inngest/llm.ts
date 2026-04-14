import Anthropic from '@anthropic-ai/sdk';
import { RetryAfterError } from 'inngest';

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
  }): Promise<LLMResponse>;
  generateWithSearch(params: {
    system: string;
    prompt: string;
    maxTokens: number;
  }): Promise<LLMResponse>;
};

function fromAnthropicResponse(
  response: Anthropic.Message,
  durationMs: number,
): LLMResponse {
  let textChars = 0;
  let textBlockCount = 0;
  let toolUseCount = 0;
  let codeExecutionCount = 0;
  const toolNames: string[] = [];
  const textParts: string[] = [];

  for (const block of response.content) {
    if (block.type === 'text') {
      textBlockCount += 1;
      textChars += block.text.length;
      textParts.push(block.text);
    } else if (
      block.type === 'server_tool_use' ||
      block.type === 'web_search_tool_result' ||
      block.type === 'code_execution_tool_use' ||
      block.type === 'code_execution_tool_result'
    ) {
      toolUseCount += 1;
      if ('name' in block && typeof block.name === 'string') {
        toolNames.push(block.name);
        if (block.name === 'code_execution') codeExecutionCount += 1;
      }
    }
  }

  return {
    text: textParts.join('\n').trim(),
    usage: response.usage
      ? {
          inputTokens: response.usage.input_tokens,
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
      codeExecutionCount,
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
    params: Parameters<typeof client.messages.create>[0],
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
      throw error;
    }
  }

  return {
    generate({ system, prompt, maxTokens }) {
      return call({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
      });
    },
    generateWithSearch({ system, prompt, maxTokens }) {
      return call({
        model,
        max_tokens: maxTokens,
        system,
        tools: [
          {
            type: 'web_search_20260209' as const,
            name: 'web_search',
            max_uses: 7,
          },
          { type: 'code_execution_20260120' as const, name: 'code_execution' },
        ],
        messages: [{ role: 'user', content: prompt }],
      });
    },
  };
}

export function createLLMClient(): LLMClient {
  return createAnthropicClient();
}
