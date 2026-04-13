import { realtime } from 'inngest';
import { z } from 'zod';
import { InterviewQuestionsSchema } from './prompts';

export const curationChannel = realtime.channel({
  name: ({ sessionId }: { sessionId: string }) => `curation:${sessionId}`,
  topics: {
    interview: {
      schema: z.object({
        questions: InterviewQuestionsSchema,
      }),
    },
    progress: {
      schema: z.object({
        step: z.string(),
        message: z.string(),
        detail: z.string().optional(),
      }),
    },
    result: {
      schema: z.object({
        filePath: z.string(),
        title: z.string(),
        sectionCount: z.number(),
        itemCount: z.number(),
        json: z.string(),
      }),
    },
    urls: {
      schema: z.object({
        sections: z.array(
          z.object({
            title: z.string(),
            slug: z.string(),
            urls: z.array(z.string()),
          }),
        ),
        mock: z.boolean().optional(),
      }),
    },
    'section-urls': {
      schema: z.object({
        sections: z.array(
          z.object({
            slug: z.string(),
            title: z.string(),
            urls: z.array(z.string()),
          }),
        ),
        mock: z.boolean().optional(),
      }),
    },
  },
});
