'use client';

import { useEffect, useRef } from 'react';
import { useCuratorStore } from '../store/curatorStore';

export interface SectionToExtract {
  slug: string;
  title: string;
  urls: string[];
  mock?: boolean;
}

export function useCuratorSession(sessionId: string | null) {
  const { phase, hydrateFromSync, setRealtimeEnabled } = useCuratorStore();

  const extractedSlugsRef = useRef<Set<string>>(new Set());

  async function syncFromKv(sid: string) {
    try {
      const res = await fetch(`/api/curate/sync/${sid}`);
      if (!res.ok) return;
      const snap = await res.json();

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

  async function handleReconnect() {
    if (sessionId) await syncFromKv(sessionId);
    setRealtimeEnabled(false);
    setTimeout(() => setRealtimeEnabled(true), 100);
  }

  const onWakeRef = useRef<() => void>(() => {});
  onWakeRef.current = () => {
    if (phase === 'complete' || phase === 'error') return;
    handleReconnect();
  };
  useEffect(() => {
    if (!sessionId) return;
    const handler = () => onWakeRef.current();
    const visHandler = () => {
      if (document.visibilityState === 'visible') onWakeRef.current();
    };
    window.addEventListener('online', handler);
    document.addEventListener('visibilitychange', visHandler);
    return () => {
      window.removeEventListener('online', handler);
      document.removeEventListener('visibilitychange', visHandler);
    };
  }, [sessionId]);

  function queueSectionForExtraction(_section: SectionToExtract) {
    // no-op: server handles extraction
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset refs when sessionId changes
  useEffect(() => {
    extractedSlugsRef.current = new Set();
    hasSyncedRef.current = false;
  }, [sessionId]);

  return { queueSectionForExtraction, handleReconnect };
}
