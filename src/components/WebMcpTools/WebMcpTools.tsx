'use client';

import { useAuth } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { getModelContext } from '@/lib/webmcp/modelContext';

/**
 * Registers Tote's WebMCP tools for agents in the user's browser.
 *
 * Renders nothing. In browsers without the WebMCP API it does nothing either,
 * and the tool code is never downloaded. Tools are registered once per signed
 * in session and left in place: some agents (ChatGPT's built-in browser)
 * treat re-registered tools as stale.
 */
export function WebMcpTools() {
  const { isSignedIn, userId } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  // Tools read these lazily, so they never need re-registering.
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!isSignedIn) return;
    const modelContext = getModelContext();
    if (!modelContext) return;

    const controller = new AbortController();
    const registered: string[] = [];
    void import('@/lib/webmcp/tools')
      .then(({ createTools }) => {
        if (controller.signal.aborted) return;
        const tools = createTools({
          queryClient,
          userId: () => userIdRef.current ?? '',
          navigate: (path) => routerRef.current.push(path),
        });
        for (const tool of tools) {
          // Some implementations return a promise and some throw; either way
          // one bad tool must not stop the rest from registering.
          void Promise.resolve()
            .then(() =>
              modelContext.registerTool(tool, { signal: controller.signal }),
            )
            .catch((error: unknown) =>
              console.error(`[Tote] WebMCP tool ${tool.name} failed`, error),
            );
          registered.push(tool.name);
        }
      })
      .catch((error: unknown) => {
        // Agent tools are an enhancement; the page works without them.
        console.error('[Tote] Could not register WebMCP tools', error);
      });

    return () => {
      controller.abort();
      // Drafts differ: some unregister through the abort signal above, some
      // through unregisterTool. Either may already have removed the tool.
      for (const name of registered) {
        void Promise.resolve()
          .then(() => modelContext.unregisterTool?.(name))
          .catch((error: unknown) =>
            console.debug(`[Tote] WebMCP tool ${name} already removed`, error),
          );
      }
    };
  }, [isSignedIn, queryClient]);

  return null;
}
