import { useAuth } from '@clerk/expo';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { RootStackParamList } from '../navigation/types';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { Collection, CollectionNode } from '../lib/api';
import {
  captureUrl,
  createCollection,
  createNode,
  fetchCollectionDetail,
  fetchCollections,
} from '../lib/api';
import { extractorScript } from '../lib/extractorScript';
import { formatPrice } from '../lib/formatPrice';
import { normalizeUrl } from '../lib/normalizeUrl';
import { CollectionPicker } from './CollectionPicker';

interface Metadata {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  price?: string;
  currency?: string;
  brand?: string;
}

type Stage = 'loading' | 'preview' | 'saving' | 'done';

interface Props {
  url: string;
  onDismiss: () => void;
  defaultCollectionId?: string;
  queueRemaining?: number;
  onApplyCollectionToRemaining?: (collectionId: string | null) => void;
  autoApplyCollectionId?: string;
}

export function SaveProductSheet({
  url,
  onDismiss,
  defaultCollectionId,
  queueRemaining = 0,
  onApplyCollectionToRemaining,
  autoApplyCollectionId,
}: Props) {
  const { getToken } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [stage, setStage] = useState<Stage>('loading');
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [applyToRemaining, setApplyToRemaining] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [sections, setSections] = useState<Record<string, CollectionNode[]>>(
    {},
  );
  const [savedCollection, setSavedCollection] = useState<Collection | null>(
    null,
  );
  const webViewRef = useRef<WebView>(null);
  const hasAutoSavedRef = useRef<string | null>(null);

  const autoApplyCollection = autoApplyCollectionId
    ? (collections.find((item) => item.id === autoApplyCollectionId) ?? null)
    : null;

  useEffect(() => {
    setStage('loading');
    setMetadata(null);
    setApplyToRemaining(!!autoApplyCollectionId && queueRemaining > 0);
    hasAutoSavedRef.current = null;
    loadCollections();
  }, [url]);

  async function loadCollections() {
    try {
      const token = await getToken();
      if (!token) return;
      const cols = await fetchCollections(token);
      setCollections(cols);
      const token2 = await getToken();
      if (!token2) return;
      const sectionMap: Record<string, CollectionNode[]> = {};
      await Promise.all(
        cols.map(async (col) => {
          try {
            const t = await getToken();
            if (!t) return;
            const detail = await fetchCollectionDetail(t, col.id);
            sectionMap[col.id] = detail.nodes.filter(
              (n) => n.type === 'section' && !n.parentId,
            );
          } catch {}
        }),
      );
      setSections(sectionMap);
    } catch (e) {
      console.warn('SaveProductSheet loadCollections error:', e);
    }
  }

  useEffect(() => {
    if (stage !== 'preview' || !metadata || !autoApplyCollectionId) return;
    if (hasAutoSavedRef.current === url) return;
    if (!autoApplyCollection) return;

    hasAutoSavedRef.current = url;
    handleSave(autoApplyCollection);
  }, [autoApplyCollection, autoApplyCollectionId, metadata, stage, url]);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'METADATA_RESULT') {
        setMetadata(msg.data);
        setStage('preview');
      } else {
        setMetadata({ url });
        setStage('preview');
      }
    } catch {
      setMetadata({ url });
      setStage('preview');
    }
  }

  function handleLoadEnd() {
    webViewRef.current?.injectJavaScript(extractorScript);
  }

  async function handleSave(
    collection: Collection,
    slot?: CollectionNode,
    nextApplyCollectionId?: string | null,
  ) {
    if (!metadata) return;
    setStage('saving');

    try {
      const token = await getToken();
      if (!token) {
        setStage('preview');
        return;
      }

      await captureUrl(token, {
        collectionId: collection.id,
        sectionId: slot?.id,
        url: normalizeUrl(metadata.url),
        title: metadata.title,
        imageUrl: metadata.imageUrl,
        price: metadata.price,
        description: metadata.description,
      });

      if (nextApplyCollectionId !== undefined) {
        onApplyCollectionToRemaining?.(nextApplyCollectionId);
      }
      setSavedCollection(collection);
      setStage('done');
      if (queueRemaining > 0) {
        setTimeout(onDismiss, 300);
      }
    } catch (e) {
      console.error('Save error:', e);
      setStage('preview');
    }
  }

  async function handleCreateSlot(collection: Collection, slotName: string) {
    try {
      const token = await getToken();
      if (!token) return;
      // Determine position key based on current section count
      const existingSections = sections[collection.id] ?? [];
      const positionKey = String(existingSections.length + 1).padStart(8, '0');
      const result = await createNode(token, collection.id, {
        type: 'section',
        title: slotName,
        positionKey,
        parentId: null,
      });
      // Update local sections state optimistically
      const newSlot: CollectionNode = {
        id: result.id,
        collectionId: collection.id,
        parentId: null,
        type: 'section',
        title: slotName,
        properties: {},
        positionKey,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSections((prev) => ({
        ...prev,
        [collection.id]: [...(prev[collection.id] ?? []), newSlot],
      }));
      handleSave(collection, newSlot);
    } catch (e) {
      console.error('Create slot error:', e);
      setStage('preview');
    }
  }

  async function handleCreateCollection(name: string) {
    try {
      const token = await getToken();
      if (!token) return;
      const result = await createCollection(token, { name, color: '#6366f1' });
      const newCollection: Collection = {
        id: result.id,
        name,
        color: '#6366f1',
        description: null,
        itemCount: 0,
        positionKey: String(collections.length + 1).padStart(8, '0'),
        role: 'owner',
        ownerUserId: '',
        updatedAt: new Date().toISOString(),
        previewImages: [],
      };
      setCollections((prev) => [...prev, newCollection]);
    } catch (e) {
      console.error('Create collection error:', e);
    }
  }

  return (
    <Modal
      animationType={autoApplyCollection ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <SafeAreaView style={styles.sheet}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>
              {stage === 'loading'
                ? 'Reading page…'
                : stage === 'saving' || stage === 'done'
                  ? 'Saved ✓'
                  : 'Save to Tote'}
            </Text>
            {queueRemaining > 0 && stage === 'preview' && (
              <View style={styles.queueRow}>
                <Text style={styles.queueText}>
                  {queueRemaining} remaining after this
                </Text>
                <View style={styles.queueToggle}>
                  <Text style={styles.queueToggleLabel}>
                    Use selection for remaining
                  </Text>
                  <Switch
                    value={applyToRemaining}
                    onValueChange={(value) => {
                      setApplyToRemaining(value);
                      if (!value) {
                        onApplyCollectionToRemaining?.(null);
                      }
                    }}
                    trackColor={{ false: '#d1d5db', true: '#c7d2fe' }}
                    thumbColor={applyToRemaining ? '#6366f1' : '#f9fafb'}
                  />
                </View>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={onDismiss} style={styles.skipButton}>
            <Text style={styles.skipButtonText}>
              {queueRemaining > 0 ? 'Skip' : 'Close'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* WebView — visible while extracting, hidden once metadata is ready */}
        {stage === 'loading' && (
          <View style={styles.webViewContainer}>
            <View style={styles.urlBar}>
              <Text style={styles.urlBarText} numberOfLines={1}>
                {url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
              </Text>
            </View>
            <WebView
              ref={webViewRef}
              source={{ uri: url }}
              onLoadEnd={handleLoadEnd}
              onMessage={handleMessage}
              javaScriptEnabled
              domStorageEnabled
              userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            />
          </View>
        )}

        {/* Preview + picker */}
        {(stage === 'preview' || stage === 'saving' || stage === 'done') &&
          metadata && (
            <View style={styles.content}>
              {/* Product preview card */}
              <View style={styles.previewCard}>
                {metadata.imageUrl ? (
                  <Image
                    source={{ uri: metadata.imageUrl }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[styles.productImage, styles.imagePlaceholder]}
                  />
                )}
                <View style={styles.productInfo}>
                  <Text style={styles.productTitle} numberOfLines={2}>
                    {metadata.title ?? metadata.url}
                  </Text>
                  {metadata.price && (
                    <Text style={styles.productPrice}>
                      {formatPrice(metadata.price)}
                    </Text>
                  )}
                </View>
              </View>

              {/* Collection picker */}
              {stage === 'preview' && !autoApplyCollection && (
                <CollectionPicker
                  collections={collections}
                  sections={sections}
                  onSelect={({ collection, slot }) =>
                    handleSave(
                      collection,
                      slot,
                      applyToRemaining && queueRemaining > 0
                        ? collection.id
                        : null,
                    )
                  }
                  onCreateCollection={handleCreateCollection}
                  onCreateSlot={handleCreateSlot}
                  defaultExpandedId={defaultCollectionId}
                />
              )}

              {stage === 'preview' && autoApplyCollection && (
                <View style={styles.autoProcessingCard}>
                  <ActivityIndicator color="#6366f1" />
                  <Text style={styles.autoProcessingTitle}>
                    Saving queued item
                  </Text>
                  <Text style={styles.autoProcessingText}>
                    Adding this link to {autoApplyCollection.name}.
                  </Text>
                </View>
              )}

              {/* Saving / done */}
              {stage === 'saving' && (
                <View style={styles.savingRow}>
                  <ActivityIndicator color="#6366f1" />
                </View>
              )}
              {stage === 'done' && (
                <View style={styles.doneRow}>
                  <Text style={styles.savedText}>
                    {queueRemaining > 0
                      ? 'Added. Loading next item…'
                      : 'Added to collection'}
                  </Text>
                  {queueRemaining === 0 && savedCollection && (
                    <TouchableOpacity
                      style={styles.viewCollectionButton}
                      onPress={() => {
                        onDismiss();
                        navigation.navigate('CollectionDetail', {
                          collectionId: savedCollection.id,
                          collectionName: savedCollection.name,
                        });
                      }}
                    >
                      <Text style={styles.viewCollectionText}>
                        View in {savedCollection.name}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  queueText: {
    fontSize: 13,
    color: '#6b7280',
  },
  queueRow: {
    marginTop: 6,
    gap: 8,
  },
  queueToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  queueToggleLabel: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
  },
  autoProcessingCard: {
    marginTop: 8,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    gap: 8,
  },
  autoProcessingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  autoProcessingText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  webViewContainer: {
    height: 260,
    overflow: 'hidden',
  },
  urlBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    alignItems: 'center',
  },
  urlBarText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  previewCard: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  productImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  imagePlaceholder: {
    backgroundColor: '#e5e7eb',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 20,
  },
  productPrice: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  savingRow: {
    paddingTop: 24,
    alignItems: 'center',
  },
  doneRow: {
    paddingTop: 24,
    alignItems: 'center',
    gap: 16,
  },
  savedText: {
    fontSize: 16,
    color: '#22c55e',
    fontWeight: '600',
  },
  viewCollectionButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  viewCollectionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
