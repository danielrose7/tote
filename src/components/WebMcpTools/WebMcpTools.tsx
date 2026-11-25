'use client';

import { useAuth } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { getModelContext } from '@/lib/webmcp/modelContext';
import { registerTools } from '@/lib/webmcp/register';

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

    let unregister: (() => void) | undefined;
    let cancelled = false;
    void import('@/lib/webmcp/tools')
      .then(({ createTools }) => {
        if (cancelled) return;
        unregister = registerTools(
          modelContext,
          createTools({
            queryClient,
            userId: () => userIdRef.current ?? '',
            navigate: (path) => routerRef.current.push(path),
          }),
        );
      })
      .catch((error: unknown) => {
        // Agent tools are an enhancement; the page works without them.
        console.error('[Tote] Could not register WebMCP tools', error);
      });

    return () => {
      cancelled = true;
      unregister?.();
    };
  }, [isSignedIn, queryClient]);

  return null;
}
