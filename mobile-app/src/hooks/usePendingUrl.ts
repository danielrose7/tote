/**
 * Reads pending URLs from the App Group shared container written by the
 * share extension (ShareExtensionViewController.swift → group.tools.tote.app).
 *
 * Maintains a queue so multiple shares before opening the app are all
 * presented one after the other.
 */

import { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, NativeModules } from "react-native";

const { AppGroupModule } = NativeModules;

async function fetchPendingUrls(): Promise<string[]> {
  try {
    return await AppGroupModule.getPendingUrls();
  } catch {
    return [];
  }
}

export function usePendingUrl() {
  const [queue, setQueue] = useState<string[]>([]);
  const appState = useRef(AppState.currentState);
  const loaded = useRef(false);

  async function check() {
    const urls = await fetchPendingUrls();
    if (urls.length === 0) return;
    // Clear from shared container immediately so they aren't re-read
    AppGroupModule.clearPendingUrls();
    setQueue((prev) => [...prev, ...urls.filter((u) => !prev.includes(u))]);
  }

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    check();

    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (appState.current !== "active" && next === "active") check();
      appState.current = next;
    });

    return () => sub.remove();
  }, []);

  const pendingUrl = queue[0] ?? null;
  const queueLength = queue.length;

  function clearPendingUrl() {
    setQueue((prev) => prev.slice(1));
  }

  return { pendingUrl, clearPendingUrl, queueLength };
}
