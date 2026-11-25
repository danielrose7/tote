'use client';

import { useEffect } from 'react';
import { getModelContext } from '@/lib/webmcp/modelContext';
import { registerTools } from '@/lib/webmcp/register';
import {
  createSharedCollectionTools,
  type SharedCollectionSummary,
} from '@/lib/webmcp/sharedCollection';

/**
 * Registers read-only WebMCP tools for a published collection page. Renders
 * nothing, and does nothing in browsers without the WebMCP API.
 */
export function SharedCollectionTools({
  summary,
}: {
  summary: SharedCollectionSummary;
}) {
  useEffect(() => {
    const modelContext = getModelContext();
    if (!modelContext) return;
    return registerTools(
      modelContext,
      createSharedCollectionTools(summary, {
        // /clone lives in the signed-in app, which has its own layout.
        navigate: (path) => window.location.assign(path),
      }),
    );
  }, [summary]);

  return null;
}
