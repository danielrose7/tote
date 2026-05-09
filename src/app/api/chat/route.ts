import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { auth } from '@clerk/nextjs/server';
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from 'ai';
import { z } from 'zod';
import { braveSearch } from '../../../lib/braveSearch';
import {
  CF_PUPPETEER_COST_CENTS,
  deductCredits,
  runCostCents,
} from '../../../lib/credits';
import { MODELS } from '../../../lib/models';
import { extractUrl } from '../../../inngest/server-extraction';

export const maxDuration = 60;

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

interface CollectionContext {
  title: string;
  items: { title: string; url: string; price?: string }[];
}

// Accumulated extraction costs tracked across tool calls in one request
type ExtractionCosts = {
  cfCount: number;
  geminiInputTokens: number;
  geminiOutputTokens: number;
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
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
  let braveSearchCount = 0;

  const systemPrompt = buildSystemPrompt(collectionContext, seedContext);

  const result = streamText({
    model: google(MODELS.geminiFlash),
    system: systemPrompt,
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(4),
    tools: {
      search_products: tool({
        description:
          'Search the web for products matching a query. Use this to find candidate product URLs.',
        inputSchema: z.object({
          query: z
            .string()
            .describe(
              'Specific product search query — focus on attributes, use case, and price range rather than brand names',
            ),
        }),
        execute: async ({ query }) => {
          braveSearchCount++;
          const results = await braveSearch({ query, count: 10 });
          return results.map((r) => ({
            title: r.title,
            url: r.url,
            description: r.description,
          }));
        },
      }),

      extract_product: tool({
        description:
          'Fetch a product page URL and extract structured metadata (title, price, image, description). Use this on individual product page URLs found via search.',
        inputSchema: z.object({
          url: z
            .string()
            .url()
            .describe('A direct product page URL to extract metadata from'),
        }),
        execute: async ({ url }) => {
          const result = await extractUrl(url);

          if (result.tier === 'cf' || result.tier === 'collection-expanded') {
            extractionCosts.cfCount++;
          } else if (result.tier === 'gemini') {
            extractionCosts.geminiInputTokens += result.usage.inputTokens;
            extractionCosts.geminiOutputTokens += result.usage.outputTokens;
          }

          const item = result.items[0];
          if (!item) return null;

          return {
            title: item.title,
            url: item.sourceUrl,
            imageUrl: item.imageUrl ?? null,
            price: item.price ?? null,
            currency: item.currency ?? null,
            brand: item.brand ?? null,
            description: item.description ?? null,
          };
        },
      }),
    },

    async onFinish({ usage }) {
      try {
        // Chat model (Gemini Flash) tokens
        const chatCents = runCostCents(
          usage.inputTokens,
          usage.outputTokens,
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
          `chat:${collectionId ?? 'search'}`,
          usage.inputTokens,
          usage.outputTokens,
          braveSearchCount,
          'chat',
          {
            cfCount: extractionCosts.cfCount,
            model: MODELS.geminiFlash,
            provider: 'google',
          },
        );
      } catch (err) {
        console.warn('[chat] credit deduction failed', err);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}

function buildSystemPrompt(
  collection: CollectionContext | null,
  seedContext?: string,
): string {
  const parts: string[] = [
    'You are a helpful product search assistant for Tote, a product curation tool.',
    'Your job is to help users find products to add to their collections.',
    '',
    'When searching:',
    '1. Use search_products to find candidate product URLs',
    '2. Use extract_product on 2-4 of the most promising individual product page URLs',
    '3. Return the extracted products — the UI will render them as cards the user can add',
    '',
    'Focus on specific, well-matched products. Prefer direct product pages over category/listing pages.',
    'Do not hallucinate product details — only return what was actually extracted.',
  ];

  if (collection) {
    parts.push('', `Current collection: "${collection.title}"`);
    if (collection.items.length > 0) {
      const itemList = collection.items
        .slice(0, 20)
        .map((i) => `  - ${i.title}${i.price ? ` (${i.price})` : ''}`)
        .join('\n');
      parts.push(`Items already in collection:\n${itemList}`);
      parts.push('Avoid suggesting products already in the collection.');
    }
  }

  if (seedContext) {
    parts.push('', `Context from the curator: ${seedContext}`);
    parts.push(
      'The user wants to find a product to address this gap. Focus your search on this.',
    );
  }

  return parts.join('\n');
}
