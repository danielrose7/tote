import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import {
  buildUrlDiscoveryPrompt,
  buildUrlDiscoverySystemPrompt,
} from '../src/inngest/prompts';
import type { FramingBrief, SectionPlan } from '../src/inngest/types';
import { braveSearch } from '../src/lib/braveSearch';

type SearchTrace = {
  query: string;
  allowedDomains?: string[];
  blockedDomains?: string[];
  resultCount: number;
  durationMs: number;
};

type TurnTrace = {
  turn: number;
  stopReason: string | null;
  contentTypes: string[];
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
  searches: SearchTrace[];
};

type DebugResult = {
  finalTurnText: string;
  aggregateText: string;
  turns: TurnTrace[];
  totalSearches: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalDurationMs: number;
};

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  const flags = new Set<string>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      flags.add(arg);
      continue;
    }
    args.set(arg, next);
    i += 1;
  }

  return {
    get(name: string, fallback?: string) {
      return args.get(name) ?? fallback;
    },
    has(name: string) {
      return flags.has(name) || args.has(name);
    },
  };
}

function usage() {
  console.log(`Usage:

  pnpm debug:url-search --mode url-discovery \\
    --topic "toys + gear for dog..." \\
    --section-title "Core Fetch Toys for Rocky Terrain" \\
    --section-rationale "Cold-rated fetch balls..." \\
    --target-count 4 \\
    --brief-file tmp/framing-brief.json

  pnpm debug:url-search \\
    --system-file tmp/system.txt \\
    --prompt-file tmp/prompt.txt

Options:
  --mode url-discovery       Build prompts from current Tote URL discovery prompts
  --topic                    Topic for url-discovery mode
  --section-title            Section title for url-discovery mode
  --section-rationale        Section rationale for url-discovery mode
  --target-count             Section targetCount for url-discovery mode
  --brief-file               JSON file containing a FramingBrief
  --brief-json               Inline JSON string for a FramingBrief
  --system-file              Plain text file for direct system prompt mode
  --prompt-file              Plain text file for direct user prompt mode
  --model                    Anthropic model override (default: claude-haiku-4-5-20251001)
  --max-tokens               Max tokens per turn (default: 4000)
  --max-searches             Max searches (default: 7)
  --max-turns                Max turns (default: 12)
  --transcript-file          Write a JSON transcript to this path
`);
}

function parseJson<T>(text: string): T | null {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    const match = stripped.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

async function readText(pathValue: string) {
  const path = isAbsolute(pathValue)
    ? pathValue
    : resolve(process.cwd(), pathValue);
  return readFile(path, 'utf-8');
}

async function buildPrompts(cli: ReturnType<typeof parseArgs>) {
  const mode = cli.get('--mode');

  if (mode === 'url-discovery') {
    const topic = cli.get('--topic');
    const sectionTitle = cli.get('--section-title');
    const sectionRationale = cli.get('--section-rationale');
    if (!topic || !sectionTitle || !sectionRationale) {
      throw new Error(
        'url-discovery mode requires --topic, --section-title, and --section-rationale',
      );
    }

    const briefJson = cli.get('--brief-json');
    const briefFile = cli.get('--brief-file');
    if (!briefJson && !briefFile) {
      throw new Error(
        'url-discovery mode requires --brief-json or --brief-file',
      );
    }

    const briefText = briefJson ?? (await readText(briefFile ?? ''));
    const brief = parseJson<FramingBrief>(briefText);
    if (!brief) throw new Error('Failed to parse FramingBrief JSON');

    const section: SectionPlan = {
      title: sectionTitle,
      slug: 'debug-section',
      targetCount: parsePositiveInt(cli.get('--target-count'), 4),
      rationale: sectionRationale,
    };

    return {
      system: buildUrlDiscoverySystemPrompt(),
      prompt: buildUrlDiscoveryPrompt(section, topic, brief),
    };
  }

  const systemFile = cli.get('--system-file');
  const promptFile = cli.get('--prompt-file');
  if (!systemFile || !promptFile) {
    throw new Error('Direct mode requires --system-file and --prompt-file');
  }

  return {
    system: await readText(systemFile),
    prompt: await readText(promptFile),
  };
}

async function runSearchLoop(params: {
  system: string;
  prompt: string;
  model: string;
  maxTokens: number;
  maxSearches: number;
  maxTurns: number;
}): Promise<DebugResult> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 5 * 60 * 1000,
    maxRetries: 0,
  });

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
    { role: 'user', content: params.prompt },
  ];

  let searchCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalDurationMs = 0;
  let lastTurnText = '';
  const allTextParts: string[] = [];
  const turns: TurnTrace[] = [];

  for (let turn = 1; turn <= params.maxTurns; turn++) {
    const startedAt = Date.now();
    const raw = await client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      tools: [webSearchTool],
      tool_choice:
        searchCount >= params.maxSearches
          ? { type: 'none' as const }
          : { type: 'auto' as const },
      messages,
    });
    const durationMs = Date.now() - startedAt;
    totalDurationMs += durationMs;

    const turnText = raw.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
    lastTurnText = turnText;
    if (turnText) allTextParts.push(turnText);

    const cacheWrite = raw.usage?.cache_creation_input_tokens ?? 0;
    const cacheRead = raw.usage?.cache_read_input_tokens ?? 0;
    totalInputTokens += (raw.usage?.input_tokens ?? 0) + cacheWrite + cacheRead;
    totalOutputTokens += raw.usage?.output_tokens ?? 0;

    const toolUseBlocks = raw.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );
    const searchTraces: SearchTrace[] = [];

    console.log(`\nTurn ${turn}`);
    console.log(`  stopReason: ${raw.stop_reason}`);
    console.log(`  contentTypes: ${raw.content.map((b) => b.type).join(', ')}`);
    console.log(`  textPreview: ${turnText.slice(0, 180) || '(none)'}`);

    if (raw.stop_reason === 'max_tokens') {
      throw new Error(
        `LLM response truncated at max_tokens limit (${params.maxTokens})`,
      );
    }

    if (raw.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
      turns.push({
        turn,
        stopReason: raw.stop_reason ?? null,
        contentTypes: raw.content.map((b) => b.type),
        text: turnText,
        inputTokens: raw.usage?.input_tokens,
        outputTokens: raw.usage?.output_tokens,
        durationMs,
        searches: searchTraces,
      });
      break;
    }

    messages.push({ role: 'assistant', content: raw.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      if (toolUse.name !== 'web_search' || searchCount >= params.maxSearches) {
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
      const braveStartedAt = Date.now();
      const results = await braveSearch({
        query: input.query,
        allowed_domains: input.allowed_domains,
        blocked_domains: input.blocked_domains,
      });
      const searchDurationMs = Date.now() - braveStartedAt;
      searchTraces.push({
        query: input.query,
        allowedDomains: input.allowed_domains,
        blockedDomains: input.blocked_domains,
        resultCount: results.length,
        durationMs: searchDurationMs,
      });

      console.log(`  search ${searchCount}: ${input.query}`);
      console.log(`    resultCount: ${results.length}`);

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(results),
      });
    }

    turns.push({
      turn,
      stopReason: raw.stop_reason ?? null,
      contentTypes: raw.content.map((b) => b.type),
      text: turnText,
      inputTokens: raw.usage?.input_tokens,
      outputTokens: raw.usage?.output_tokens,
      durationMs,
      searches: searchTraces,
    });

    const userContent: Array<
      Anthropic.ToolResultBlockParam | Anthropic.TextBlockParam
    > = [...toolResults];
    if (searchCount >= params.maxSearches) {
      userContent.push({
        type: 'text',
        text: 'Search budget exhausted. Output the JSON now with all product page URLs you found in the search results above.',
      });
    }
    messages.push({ role: 'user', content: userContent });
  }

  return {
    finalTurnText: lastTurnText,
    aggregateText: allTextParts.join('\n').trim(),
    turns,
    totalSearches: searchCount,
    totalInputTokens,
    totalOutputTokens,
    totalDurationMs,
  };
}

async function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const path = resolve(process.cwd(), file);
    let text: string;
    try {
      text = await readFile(path, 'utf-8');
    } catch {
      continue;
    }
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

async function main() {
  await loadEnv();
  const cli = parseArgs(process.argv.slice(2));

  if (cli.has('--help')) {
    usage();
    return;
  }

  const { system, prompt } = await buildPrompts(cli);
  const model =
    cli.get('--model', 'claude-haiku-4-5-20251001') ??
    'claude-haiku-4-5-20251001';
  const maxTokens = parsePositiveInt(cli.get('--max-tokens'), 4000);
  const maxSearches = parsePositiveInt(cli.get('--max-searches'), 7);
  const maxTurns = parsePositiveInt(cli.get('--max-turns'), 12);

  const result = await runSearchLoop({
    system,
    prompt,
    model,
    maxTokens,
    maxSearches,
    maxTurns,
  });

  const aggregateParsed = parseJson<{ urls?: string[] }>(result.aggregateText);
  const finalParsed = parseJson<{ urls?: string[] }>(result.finalTurnText);

  console.log('\nSummary');
  console.log(`  model: ${model}`);
  console.log(`  totalSearches: ${result.totalSearches}`);
  console.log(`  totalInputTokens: ${result.totalInputTokens}`);
  console.log(`  totalOutputTokens: ${result.totalOutputTokens}`);
  console.log(`  totalDurationMs: ${result.totalDurationMs}`);
  console.log(`  aggregateParseable: ${Boolean(aggregateParsed)}`);
  console.log(`  finalTurnParseable: ${Boolean(finalParsed)}`);
  console.log(`  aggregateUrlCount: ${aggregateParsed?.urls?.length ?? 'n/a'}`);
  console.log(`  finalTurnUrlCount: ${finalParsed?.urls?.length ?? 'n/a'}`);

  console.log('\nFinal turn text');
  console.log(result.finalTurnText || '(empty)');

  console.log('\nAggregate text');
  console.log(result.aggregateText || '(empty)');

  const transcriptFile = cli.get('--transcript-file');
  if (transcriptFile) {
    const outPath = isAbsolute(transcriptFile)
      ? transcriptFile
      : resolve(process.cwd(), transcriptFile);
    await writeFile(
      outPath,
      JSON.stringify(
        {
          model,
          maxTokens,
          maxSearches,
          maxTurns,
          system,
          prompt,
          result,
          aggregateParseable: Boolean(aggregateParsed),
          finalTurnParseable: Boolean(finalParsed),
          aggregateParsed,
          finalParsed,
        },
        null,
        2,
      ),
      'utf-8',
    );
    console.log(`\nWrote transcript to ${outPath}`);
  }
}

main().catch((error) => {
  console.error('[debug-url-search] failed:', error);
  process.exit(1);
});
