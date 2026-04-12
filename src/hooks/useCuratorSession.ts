'use client';

import { useEffect, useRef } from 'react';
import { useAccount } from 'jazz-tools/react';
import { checkExtensionAvailable, refreshViaExtension } from '../lib/extension';
import { MOCK_EXTRACTED_ITEMS } from '../inngest/fixtures/extracted-items';
import { useCuratorStore } from '../store/curatorStore';
import { JazzAccount } from '../schema';
import type { ExtractedItem } from '../inngest/types';

export interface SectionToExtract {
  slug: string;
  title: string;
  urls: string[];
  mock?: boolean;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function toDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function useCuratorSession(sessionId: string | null) {
  const me = useAccount(JazzAccount, {
    resolve: { root: { curatorSessions: true } },
  });

  const {
    phase,
    result,
    tokenUsage,
    setPhase,
    setError,
    setExtractionProgress,
    hydrateFromKv,
    setRealtimeEnabled,
  } = useCuratorStore();

  // --- Drain loop refs ---
  const extractionQueueRef = useRef<SectionToExtract[]>([]);
  const extractionRunningRef = useRef(false);
  const extractedSlugsRef = useRef<Set<string>>(new Set());
  const extensionCheckedRef = useRef(false);

  // --- Jazz write side effect ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jazzSessionRef = useRef<any>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result, tokenUsage, sessionId, me.$isLoaded]);

  // --- KV sync ---
  async function syncFromKv(sid: string) {
    try {
      const res = await fetch(`/api/curate/sync/${sid}`);
      if (!res.ok) return;
      const snap = await res.json();

      // Restore ref-domain data before calling hydrateFromKv
      if (snap.extractedSlugs) {
        for (const slug of snap.extractedSlugs as string[]) {
          extractedSlugsRef.current.add(slug);
        }
      }

      hydrateFromKv(snap);

      // Re-queue any sections not yet extracted (initial + refinement gap sections)
      if (snap.urlSections) {
        for (const section of snap.urlSections as SectionToExtract[]) {
          queueSectionForExtraction(section);
        }
      }
      if (snap.refinementUrlSections) {
        for (const section of snap.refinementUrlSections as SectionToExtract[]) {
          queueSectionForExtraction(section);
        }
      }
    } catch {
      // best-effort
    }
  }

  // Mount-time sync guard
  const hasSyncedRef = useRef(false);
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

  // --- Extraction drain loop ---
  async function extractAndSubmitSection(section: SectionToExtract) {
    const isMock =
      section.mock ?? process.env.NEXT_PUBLIC_CURATOR_MOCK === 'true';
    const items: ExtractedItem[] = [];

    // Add pending entries for this section's URLs
    setExtractionProgress((prev) => {
      const newEntries = section.urls.map((url) => ({
        url,
        domain: toDomain(url),
        status: 'pending' as const,
      }));
      if (!prev)
        return { current: 0, total: section.urls.length, entries: newEntries };
      return {
        current: prev.current,
        total: prev.total + section.urls.length,
        entries: [...prev.entries, ...newEntries],
      };
    });

    for (const url of section.urls) {
      setExtractionProgress((prev) => {
        if (!prev) return prev;
        const idx = prev.entries.findIndex(
          (e) => e.url === url && e.status === 'pending',
        );
        if (idx === -1) return prev;
        const newEntries = [...prev.entries];
        newEntries[idx] = { ...newEntries[idx], status: 'loading' };
        return { ...prev, entries: newEntries };
      });

      let metadata: Awaited<ReturnType<typeof refreshViaExtension>> = null;
      if (isMock) {
        await sleep(350);
        const fixture = MOCK_EXTRACTED_ITEMS[url];
        metadata = fixture ? { ...fixture } : null;
      } else {
        metadata = await refreshViaExtension(url);
      }

      items.push({ sourceUrl: url, ...metadata });

      setExtractionProgress((prev) => {
        if (!prev) return prev;
        const idx = prev.entries.findIndex(
          (e) => e.url === url && e.status === 'loading',
        );
        if (idx === -1) return prev;
        const newEntries = [...prev.entries];
        newEntries[idx] = {
          ...newEntries[idx],
          status: metadata ? 'done' : 'skipped',
          title: metadata?.title,
        };
        return { ...prev, current: prev.current + 1, entries: newEntries };
      });
    }

    const res = await fetch('/api/curate/extractions/section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        slug: section.slug,
        title: section.title,
        items,
      }),
    });

    if (res.ok) {
      extractedSlugsRef.current.add(section.slug);
    } else {
      setError('Failed to submit extraction results.');
      setPhase('error');
    }
  }

  async function drainExtractionQueue() {
    if (extractionRunningRef.current) return;
    extractionRunningRef.current = true;

    try {
      if (!extensionCheckedRef.current) {
        const isMock = process.env.NEXT_PUBLIC_CURATOR_MOCK === 'true';
        if (!isMock) {
          const available = await checkExtensionAvailable();
          if (!available) {
            setError(
              'Tote extension not installed or not responding. Install the extension and try again.',
            );
            setPhase('error');
            extractionQueueRef.current = [];
            return;
          }
        }
        extensionCheckedRef.current = true;
      }

      while (extractionQueueRef.current.length > 0) {
        const section = extractionQueueRef.current.shift()!;
        if (extractedSlugsRef.current.has(section.slug)) continue;
        await extractAndSubmitSection(section);
      }
    } finally {
      extractionRunningRef.current = false;
    }
  }

  function queueSectionForExtraction(section: SectionToExtract) {
    if (extractedSlugsRef.current.has(section.slug)) return;
    if (extractionQueueRef.current.some((s) => s.slug === section.slug)) return;
    extractionQueueRef.current.push(section);
    drainExtractionQueue();
  }

  // Reset drain loop refs when sessionId changes
  useEffect(() => {
    extractionQueueRef.current = [];
    extractionRunningRef.current = false;
    extractedSlugsRef.current = new Set();
    extensionCheckedRef.current = false;
    jazzSessionRef.current = null;
    hasSyncedRef.current = false;
  }, [sessionId]);

  return { queueSectionForExtraction, handleReconnect };
}
