// How long a dismissed "get the iOS app" banner stays hidden.
export const IOS_APP_PROMPT_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;
const STORAGE_KEY = 'tote:ios-app-prompt-dismissed-at';

// localStorage is a per-viewer convenience only; every access is guarded
// because it can throw (private windows, blocked site data).
export function isIosAppPromptSnoozed(now = Date.now()): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    return (
      Number.isFinite(dismissedAt) &&
      now - dismissedAt < IOS_APP_PROMPT_SNOOZE_MS
    );
  } catch {
    return false;
  }
}

export function snoozeIosAppPrompt(now = Date.now()): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(now));
  } catch {
    // Not remembering the dismissal is harmless; the banner just shows again.
  }
}
