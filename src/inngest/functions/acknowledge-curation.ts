import { inngest } from '../client';
import { curationChannel } from '../channels';
import type { CurationStartEvent } from '../types';

// Utah pattern: fires immediately on curation/start to give instant UI feedback
// before the slow main function begins
export const acknowledgeCuration = inngest.createFunction(
  {
    id: 'acknowledge-curation',
    retries: 0,
    triggers: [{ event: 'curation/start' as CurationStartEvent['name'] }],
  },
  async ({ event, step }) => {
    const ch = curationChannel({ sessionId: event.data.sessionId });
    await step.realtime.publish('acknowledged', ch.progress, {
      step: 'acknowledged',
      message: 'Starting curation...',
    });
  },
);
