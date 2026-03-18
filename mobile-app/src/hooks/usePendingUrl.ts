/**
 * Listens for deep links of the form tools.tote.app://?pendingUrl=<encoded-url>
 * sent by the share extension via openHostApp().
 *
 * Maintains a queue so multiple shares without opening the app in between
 * are all presented one after the other.
 */

import { useEffect, useRef, useState } from "react";
import { Linking } from "react-native";

function extractPendingUrl(deepLink: string): string | null {
  try {
    const match = deepLink.match(/[?&]pendingUrl=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export function usePendingUrl() {
  const [queue, setQueue] = useState<string[]>([]);
  const initialized = useRef(false);

  function enqueue(url: string) {
    setQueue((prev) => [...prev, url]);
  }

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Check if the app was opened cold via the deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        const pending = extractPendingUrl(url);
        if (pending) enqueue(pending);
      }
    });

    // Listen for deep links while app is running in background
    const sub = Linking.addEventListener("url", ({ url }) => {
      const pending = extractPendingUrl(url);
      if (pending) enqueue(pending);
    });

    return () => sub.remove();
  }, []);

  // The current URL to show is the first item in the queue
  const pendingUrl = queue[0] ?? null;

  function clearPendingUrl() {
    setQueue((prev) => prev.slice(1));
  }

  return { pendingUrl, clearPendingUrl };
}
