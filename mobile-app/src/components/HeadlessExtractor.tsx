/**
 * Invisible WebView that extracts metadata for a URL-only node and
 * updates it in the background. Fires onDone when complete (success or fail).
 *
 * The updateNode call writes to the Ably outbox, so CollectionDetailScreen
 * refreshes automatically via useCollectionRealtime when data is enriched.
 */

import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { updateNode } from '../lib/api';
import { extractorScript } from '../lib/extractorScript';

export type EnrichJob = {
  nodeId: string;
  version: number;
  collectionId: string;
  url: string;
};

export function HeadlessExtractor({
  job,
  token,
  onDone,
}: {
  job: EnrichJob;
  token: string;
  onDone: () => void;
}) {
  const webViewRef = useRef<WebView>(null);
  const doneRef = useRef(false);

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }

  function handleLoadEnd() {
    webViewRef.current?.injectJavaScript(extractorScript);
  }

  async function handleMessage(event: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'METADATA_RESULT') {
        const data = msg.data as {
          title?: string;
          imageUrl?: string;
          price?: string;
          currency?: string;
          description?: string;
        };
        // Only update if we extracted a real title (not the URL itself)
        if (data.title && data.title !== job.url) {
          await updateNode(token, job.collectionId, job.nodeId, {
            expectedVersion: job.version,
            title: data.title,
            properties: {
              url: job.url,
              imageUrl: data.imageUrl ?? undefined,
              price: data.price ?? undefined,
              description: data.description ?? undefined,
            },
          });
        }
      }
    } catch {
      // Best-effort — if extraction or update fails, the node keeps its current state
    }
    finish();
  }

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: job.url }}
      style={styles.hidden}
      onLoadEnd={handleLoadEnd}
      onMessage={handleMessage}
      onError={finish}
      javaScriptEnabled
    />
  );
}

const styles = StyleSheet.create({
  hidden: { width: 0, height: 0, opacity: 0, position: 'absolute' },
});
