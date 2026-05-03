'use client';

import { useAccount } from 'jazz-tools/react';
import { useEffect, useRef } from 'react';
import { JazzAccount } from '../schema';
import { useCuratorStore } from '../store/curatorStore';

export interface SectionToExtract {
  slug: string;
  title: string;
  urls: string[];
  mock?: boolean;
}

export function useCuratorSession(sessionId: string | null) {
  const me = useAccount(JazzAccount, {
    resolve: { root: { curatorSessions: true } },
  });

  const { phase, result, tokenUsage, hydrateFromSync, setRealtimeEnabled } =
    useCuratorStore();

  const extractedSlugsRef = useRef<Set<string>>(new Set());

  // --- Jazz write side effect ---
  // biome-ignore lint/suspicious/noExplicitAny: Jazz session proxy type is not exported.
  const jazzSessionRef = useRef<any>(null);

  // biome-ignore lint/suspicious/noExplicitAny: Jazz session proxy type is not exported.
  function getJazzSession(): any {
    if (jazzSessionRef.current) return jazzSessionRef.current;
    if (!me.$isLoaded || !me.root?.curatorSessions?.$isLoaded || !sessionId)
      return null;
    for (const s of me.root.curatorSessions) {
      const loaded = s as { sessionId?: string } | null;
      if (loaded?.sessionId === sessionId) {
        jazzSessionRef.current = s;
        return s;
      }
    }
    return null;
  }

  // Keep this effect keyed to the persisted fields only; getJazzSession is a local resolver around refs/account state.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Adding getJazzSession would rerun on every render.
  useEffect(() => {
    if (!sessionId || !me.$isLoaded) return;
    const jazzSession = getJazzSession();
    if (!jazzSession) return;
    jazzSession.$jazz.set('phase', phase);
    if (result?.title) jazzSession.$jazz.set('title', result.title);
    if (result?.sectionCount != null)
      jazzSession.$jazz.set('sectionCount', result.sectionCount);
    if (result?.itemCount != null)
      jazzSession.$jazz.set('itemCount', result.itemCount);
    if (tokenUsage) {
      jazzSession.$jazz.set('inputTokens', tokenUsage.inputTokens);
      jazzSession.$jazz.set('outputTokens', tokenUsage.outputTokens);
      jazzSession.$jazz.set('webSearchRequests', tokenUsage.webSearchRequests);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result, tokenUsage, sessionId, me.$isLoaded]);

  // --- KV sync ---
  async function syncFromKv(sid: string) {
    try {
      const res = await fetch(`/api/curate/sync/${sid}`);
      if (!res.ok) return;
      const snap = await res.json();

      // Restore ref-domain data before calling hydrateFromSync
      if (snap.extractedSlugs) {
        for (const slug of snap.extractedSlugs as string[]) {
          extractedSlugsRef.current.add(slug);
        }
      }

      hydrateFromSync(snap);
    } catch {
      // best-effort
    }
  }

  // Mount-time sync guard
  const hasSyncedRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: syncFromKv closes over queue helpers intentionally.
  useEffect(() => {
    if (
      !sessionId ||
      hasSyncedRef.current ||
      phase === 'complete' ||
      phase === 'error'
    )
      return;
    hasSyncedRef.current = true;
    syncFromKv(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, phase]);

  // --- Reconnect ---
  async function handleReconnect() {
    if (sessionId) await syncFromKv(sessionId);
    setRealtimeEnabled(false);
    setTimeout(() => setRealtimeEnabled(true), 100);
  }

  // --- Focus reconnect listener ---
  const onFocusRef = useRef<() => void>(() => {});
  onFocusRef.current = () => {
    if (phase === 'complete' || phase === 'error') return;
    handleReconnect();
  };
  useEffect(() => {
    if (!sessionId) return;
    const handler = () => onFocusRef.current();
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [sessionId]);

  // Server handles extraction via 2-tier CF + web search strategy.
  function queueSectionForExtraction(_section: SectionToExtract) {
    // no-op: server handles extraction
  }

  // Reset refs when sessionId changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: This reset should run only when sessionId changes.
  useEffect(() => {
    extractedSlugsRef.current = new Set();
    jazzSessionRef.current = null;
    hasSyncedRef.current = false;
  }, [sessionId]);

  return { queueSectionForExtraction, handleReconnect };
}
