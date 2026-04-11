import Anthropic from '@anthropic-ai/sdk';

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

function fromAnthropicResponse(response: Anthropic.Message): LLMResponse {
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
    } else if (
      block.type === 'server_tool_use' ||
      block.type === 'web_search_tool_result'
    ) {
      toolUseCount += 1;
      if ('name' in block && typeof block.name === 'string') {
        toolNames.push(block.name);
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
    },
  };
}

function createAnthropicClient(): LLMClient {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = 'claude-sonnet-4-6';

  return {
    async generate({ system, prompt, maxTokens }) {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
      });
      return fromAnthropicResponse(response);
    },

    async generateWithSearch({ system, prompt, maxTokens }) {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        tools: [{ type: 'web_search_20250305' as const, name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      });
      return fromAnthropicResponse(response);
    },
  };
}

export function createLLMClient(): LLMClient {
  return createAnthropicClient();
}
