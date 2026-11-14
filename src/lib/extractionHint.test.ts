import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EXTRACTION_HINT_SNOOZE_MS,
  isExtractionHintSnoozed,
  needsEnhancedExtraction,
  snoozeExtractionHint,
} from './extractionHint';

describe('needsEnhancedExtraction', () => {
  it('flags blocked and unreachable fetches', () => {
    expect(needsEnhancedExtraction({ fetchStatus: 'blocked' })).toBe(true);
    expect(needsEnhancedExtraction({ fetchStatus: 'unreachable' })).toBe(true);
  });
  it('flags a successful fetch that found no image', () => {
    expect(needsEnhancedExtraction({ fetchStatus: 'ok', title: 'x' })).toBe(
      true,
    );
  });
  it('does not flag a complete result', () => {
    expect(
      needsEnhancedExtraction({ fetchStatus: 'ok', imageUrl: 'https://i/x.jpg' }),
    ).toBe(false);
  });
});

describe('extraction hint snooze', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubStorage() {
    const data = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
      },
    });
  }

  it('hides the tip until the snooze window passes', () => {
    stubStorage();
    expect(isExtractionHintSnoozed(1_000)).toBe(false);
    snoozeExtractionHint(1_000);
    expect(isExtractionHintSnoozed(1_000 + EXTRACTION_HINT_SNOOZE_MS - 1)).toBe(
      true,
    );
    expect(isExtractionHintSnoozed(1_000 + EXTRACTION_HINT_SNOOZE_MS)).toBe(
      false,
    );
  });

  it('falls back to showing the tip when storage throws', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      },
    });
    expect(isExtractionHintSnoozed()).toBe(false);
    expect(() => snoozeExtractionHint()).not.toThrow();
  });
});
