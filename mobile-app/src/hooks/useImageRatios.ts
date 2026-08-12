import { useEffect, useState } from 'react';
import { Image } from 'react-native';

// Masonry has to know how tall every card will be *before* it can assign cards
// to columns, so image aspect ratios can't be measured inside the card the way
// they were. They're resolved up front here and cached for the session —
// `Image.getSize` on an image expo-image has already cached is near-instant, so
// after the first look at a collection there's no reflow at all.
const ratioCache = new Map<string, number>();

/** Fallback until an image resolves (and for images that fail). */
const DEFAULT_RATIO = 1;

export function getImageRatio(url: string | undefined): number {
  if (!url) return DEFAULT_RATIO;
  return ratioCache.get(url) ?? DEFAULT_RATIO;
}

/**
 * Resolves width/height for each URL, re-rendering once the batch lands.
 * Returns a counter that changes as ratios arrive — read the values with
 * `getImageRatio`.
 */
export function useImageRatios(urls: (string | undefined)[]): number {
  const [resolvedCount, setResolvedCount] = useState(0);
  // Joined so the effect re-runs on content change, not on a new array identity.
  const key = urls.filter(Boolean).join('|');

  useEffect(() => {
    const pending = key
      .split('|')
      .filter((url) => url.length > 0 && !ratioCache.has(url));
    if (pending.length === 0) return;

    let cancelled = false;
    let settled = 0;
    const settle = () => {
      settled += 1;
      // One re-render for the batch rather than one per image.
      if (!cancelled && settled === pending.length) {
        setResolvedCount((n) => n + 1);
      }
    };

    for (const url of pending) {
      Image.getSize(
        url,
        (w, h) => {
          if (w > 0 && h > 0) ratioCache.set(url, w / h);
          settle();
        },
        () => {
          // Remember the failure too, so we don't retry it every render.
          ratioCache.set(url, DEFAULT_RATIO);
          settle();
        },
      );
    }

    return () => {
      cancelled = true;
    };
  }, [key]);

  return resolvedCount;
}
