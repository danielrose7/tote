export const MODELS = {
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5-20251001',
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];
