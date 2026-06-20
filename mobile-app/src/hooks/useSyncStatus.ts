import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useCallback, useEffect, useRef, useState } from 'react';

dayjs.extend(relativeTime);

export type SyncState = 'idle' | 'syncing' | 'saved' | 'stable';

export function fromNow(date: Date): string {
  return dayjs(date).fromNow();
}

export function useSyncStatus() {
  const countRef = useRef(0);
  const [state, setState] = useState<SyncState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setTick] = useState(0);

  // Tick every minute so "Saved Xm ago" text stays current
  useEffect(() => {
    if (state !== 'stable' || !lastSavedAt) return;
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, [state, lastSavedAt]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const track = useCallback(async <T>(promise: Promise<T>): Promise<T> => {
    countRef.current += 1;
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
    setState('syncing');
    try {
      const result = await promise;
      countRef.current -= 1;
      if (countRef.current === 0) {
        setLastSavedAt(new Date());
        setState('saved');
        savedTimerRef.current = setTimeout(() => setState('stable'), 3000);
      }
      return result;
    } catch (e) {
      countRef.current -= 1;
      if (countRef.current === 0) setState('idle');
      throw e;
    }
  }, []);

  return { track, syncState: state, lastSavedAt };
}
