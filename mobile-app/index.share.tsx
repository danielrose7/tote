/**
 * Share Extension entry point.
 *
 * The Swift bridge writes the URL to pendingUrls in the App Group before
 * this JS runs. This component reads the cached collections (written by the
 * main app) and lets the user pick a collection/section without leaving Safari.
 *
 * On pick: calls POST /api/v2/capture directly using the long-lived API key
 *   stored in Keychain by the main app, then closes immediately.
 * On close without pick: the URL stays in pendingUrls and the main app will
 *   present SaveProductSheet as the normal flow.
 *
 * Important: do NOT import from "expo-share-extension" or "@clerk/expo" here.
 * Both trigger JavaScriptActor / ClerkViewFactory crashes in extension context.
 */

import React, { useEffect, useState } from 'react';
import {
  AppRegistry,
  NativeModules,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { AppGroupModule } = NativeModules;

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

type Section = { id: string; name: string };
type CaptureCollection = {
  id: string;
  name: string;
  color: string | null;
  role: 'owner' | 'admin' | 'editor';
  sections: Section[];
};

type Props = {
  url?: string;
  text?: string;
  title?: string;
};

function ShareExtension(props: Props) {
  const url = props.url || props.text;
  const title = props.title;

  const [collections, setCollections] = useState<CaptureCollection[] | null>(
    null,
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const json = await AppGroupModule?.getCollectionsCache?.();
        if (json) {
          const parsed = JSON.parse(json) as CaptureCollection[];
          setCollections(parsed);
          if (parsed.length > 0) setExpandedId(parsed[0].id);
        } else {
          setCollections([]);
        }
      } catch {
        setCollections([]);
      }
    }
    load();
  }, []);

  function handleClose() {
    AppGroupModule?.close?.();
  }

  async function handlePick(collectionId: string, sectionId?: string) {
    setSaved(true);
    try {
      const apiKey = await AppGroupModule?.getApiKey?.();
      if (apiKey && url) {
        const appUrl = process.env.EXPO_PUBLIC_APP_URL ?? 'https://tote.tools';
        const id = generateId();
        await fetch(`${appUrl}/api/v2/capture`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            id,
            mutationId: generateId(),
            url,
            title: title || url,
            collectionId,
            sectionId: sectionId ?? null,
          }),
        });
      } else {
        // Fallback: enqueue for main app to process on next open
        const capture = JSON.stringify({ url, title, collectionId, sectionId });
        await AppGroupModule?.enqueuePendingCapture?.(capture);
      }
    } catch {
      // Fallback on any error
      try {
        const capture = JSON.stringify({ url, title, collectionId, sectionId });
        await AppGroupModule?.enqueuePendingCapture?.(capture);
      } catch {}
    }
    setTimeout(() => AppGroupModule?.close?.(), 800);
  }

  if (!url) {
    return (
      <View style={styles.centered}>
        <Text allowFontScaling={false} style={styles.title}>
          No link found
        </Text>
      </View>
    );
  }

  if (saved) {
    return (
      <View style={styles.centered}>
        <Text allowFontScaling={false} style={styles.checkmark}>
          ✓
        </Text>
        <Text allowFontScaling={false} style={styles.title}>
          Added to Tote
        </Text>
      </View>
    );
  }

  // Still loading cache
  if (collections === null) {
    return (
      <View style={styles.centered}>
        <Text allowFontScaling={false} style={styles.loading}>
          Loading…
        </Text>
      </View>
    );
  }

  // No cache — fall back to confirmation (URL is already in pendingUrls)
  if (collections.length === 0) {
    return (
      <View style={styles.centered}>
        <Text allowFontScaling={false} style={styles.checkmark}>
          ✓
        </Text>
        <Text allowFontScaling={false} style={styles.title}>
          Added to Tote
        </Text>
        <Text allowFontScaling={false} style={styles.subtitle}>
          Open Tote to assign to a collection
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.sheet}>
      {/* Header */}
      <View style={styles.header}>
        <Text allowFontScaling={false} style={styles.headerTitle}>
          Add to collection
        </Text>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <Text allowFontScaling={false} style={styles.closeBtnText}>
            Cancel
          </Text>
        </TouchableOpacity>
      </View>

      {/* URL preview */}
      {(title || url) && (
        <View style={styles.urlPreview}>
          <Text
            allowFontScaling={false}
            style={styles.urlTitle}
            numberOfLines={1}
          >
            {title || url}
          </Text>
        </View>
      )}

      {/* Collection + section list */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
      >
        {collections.map((col) => {
          const isExpanded = expandedId === col.id;
          const dot = col.color ?? '#6366f1';
          return (
            <View key={col.id} style={styles.collectionGroup}>
              {/* Collection row */}
              <TouchableOpacity
                style={styles.collectionRow}
                onPress={() => {
                  if (col.sections.length === 0) {
                    handlePick(col.id);
                  } else {
                    setExpandedId(isExpanded ? null : col.id);
                  }
                }}
              >
                <View style={[styles.dot, { backgroundColor: dot }]} />
                <Text allowFontScaling={false} style={styles.collectionName}>
                  {col.name}
                </Text>
                {col.sections.length > 0 && (
                  <Text allowFontScaling={false} style={styles.chevron}>
                    {isExpanded ? '▾' : '›'}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Section rows */}
              {isExpanded &&
                col.sections.map((sec) => (
                  <TouchableOpacity
                    key={sec.id}
                    style={styles.sectionRow}
                    onPress={() => handlePick(col.id, sec.id)}
                  >
                    <Text allowFontScaling={false} style={styles.sectionName}>
                      {sec.name}
                    </Text>
                  </TouchableOpacity>
                ))}

              {/* "No section" option when expanded */}
              {isExpanded && (
                <TouchableOpacity
                  style={styles.sectionRow}
                  onPress={() => handlePick(col.id)}
                >
                  <Text
                    allowFontScaling={false}
                    style={[styles.sectionName, styles.noSection]}
                  >
                    No section
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  checkmark: {
    fontSize: 48,
    color: '#22c55e',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 6,
    textAlign: 'center',
  },
  loading: {
    fontSize: 16,
    color: '#9ca3af',
  },
  sheet: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  urlPreview: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  urlTitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  collectionGroup: {
    marginBottom: 2,
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  collectionName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  chevron: {
    fontSize: 18,
    color: '#9ca3af',
    marginLeft: 8,
  },
  sectionRow: {
    paddingHorizontal: 44,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f3f4f6',
  },
  sectionName: {
    fontSize: 15,
    color: '#374151',
  },
  noSection: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },
});

AppRegistry.registerComponent('shareExtension', () => ShareExtension);
