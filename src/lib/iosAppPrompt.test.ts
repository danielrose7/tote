import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IOS_APP_PROMPT_SNOOZE_MS,
  isIosAppPromptSnoozed,
  snoozeIosAppPrompt,
} from './iosAppPrompt';

describe('iOS app prompt snooze', () => {
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

  it('shows until dismissed, then hides for the snooze window', () => {
    stubStorage();
    const now = 1_000_000;
    expect(isIosAppPromptSnoozed(now)).toBe(false);
    snoozeIosAppPrompt(now);
    expect(isIosAppPromptSnoozed(now + 1)).toBe(true);
    expect(isIosAppPromptSnoozed(now + IOS_APP_PROMPT_SNOOZE_MS + 1)).toBe(
      false,
    );
  });

  it('stays visible when storage is unavailable', () => {
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
    expect(() => snoozeIosAppPrompt()).not.toThrow();
    expect(isIosAppPromptSnoozed()).toBe(false);
  });
});
