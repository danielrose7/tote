import { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Settings } from "react-native";

const PENDING_URL_KEY = "tote_pending_shared_url";

export function usePendingUrl() {
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const appState = useRef(AppState.currentState);

  function check() {
    const url = Settings.get(PENDING_URL_KEY) as string | undefined;
    if (url) setPendingUrl(url);
  }

  function clearPendingUrl() {
    Settings.set({ [PENDING_URL_KEY]: null });
    setPendingUrl(null);
  }

  useEffect(() => {
    check();

    const sub = AppState.addEventListener(
      "change",
      (next: AppStateStatus) => {
        if (appState.current !== "active" && next === "active") check();
        appState.current = next;
      }
    );

    return () => sub.remove();
  }, []);

  return { pendingUrl, clearPendingUrl };
}
