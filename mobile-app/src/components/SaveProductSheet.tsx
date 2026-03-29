import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  ActivityIndicator,
  Switch,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { useAccount } from "jazz-tools/expo";
import { Group } from "jazz-tools";
import { JazzAccount, Block, BlockList } from "@tote/schema";
import { extractorScript } from "../lib/extractorScript";
import { formatPrice } from "../lib/formatPrice";
import { ProductSkeleton } from "./ProductSkeleton";
import { CollectionPicker } from "./CollectionPicker";

interface Metadata {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  price?: string;
  currency?: string;
  brand?: string;
}

type Stage = "loading" | "preview" | "saving" | "done";

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
  const [stage, setStage] = useState<Stage>("loading");
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [applyToRemaining, setApplyToRemaining] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const hasAutoSavedRef = useRef<string | null>(null);

  const me = useAccount(JazzAccount, {
    resolve: { root: { blocks: { $each: { children: { $each: { children: true } } } } } },
  });

  const collections = me?.root?.blocks?.filter(
    (b) => b !== null && b.type === "collection"
  ) ?? [];
  const autoApplyCollection = autoApplyCollectionId
    ? collections.find((item) => item?.$jazz.id === autoApplyCollectionId) ?? null
    : null;

  useEffect(() => {
    setStage("loading");
    setMetadata(null);
    setApplyToRemaining(!!autoApplyCollectionId && queueRemaining > 0);
    hasAutoSavedRef.current = null;
  }, [url]);

  useEffect(() => {
    if (stage !== "preview" || !metadata || !autoApplyCollectionId) return;
    if (hasAutoSavedRef.current === url) return;

    if (!autoApplyCollection) return;

    hasAutoSavedRef.current = url;
    handleSave(autoApplyCollection);
  }, [autoApplyCollection, autoApplyCollectionId, metadata, stage, url]);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "METADATA_RESULT") {
        setMetadata(msg.data);
        setStage("preview");
      } else {
        // Error — still move to preview with just the URL
        setMetadata({ url });
        setStage("preview");
      }
    } catch {
      setMetadata({ url });
      setStage("preview");
    }
  }

  function handleLoadEnd() {
    webViewRef.current?.injectJavaScript(extractorScript);
  }

  async function handleSave(
    collection: typeof Block.prototype,
    slot?: typeof Block.prototype,
    nextApplyCollectionId?: string | null
  ) {
    if (!me || !metadata) return;
    setStage("saving");

    try {
      const target = slot ?? collection;

      // Initialise children list if the slot/collection never had one
      if (!target.children) {
        target.$jazz.set("children", BlockList.create([], { owner: me }));
      }

      if (!target.children.$isLoaded) {
        console.warn("children not loaded yet, retrying...");
        setStage("preview");
        return;
      }

      // Use the collection's sharing group as owner so shared members can access the product
      let ownerGroup: Group | null = null;
      const sharingGroupId = collection.collectionData?.sharingGroupId;
      if (sharingGroupId) {
        ownerGroup = await Group.load(sharingGroupId as `co_z${string}`, {});
      }

      const priceValue = metadata.price ? parseFloat(metadata.price) : undefined;

      const product = Block.create(
        {
          type: "product",
          name: metadata.title ?? metadata.url,
          productData: {
            url: metadata.url,
            imageUrl: metadata.imageUrl,
            price: metadata.price,
            priceValue: priceValue != null && !isNaN(priceValue) ? priceValue : undefined,
            description: metadata.description,
          },
          createdAt: new Date(),
        },
        ownerGroup ? { owner: ownerGroup } : { owner: me }
      );

      target.children.$jazz.push(product);
      if (nextApplyCollectionId !== undefined) {
        onApplyCollectionToRemaining?.(nextApplyCollectionId);
      }
      setStage("done");
      setTimeout(onDismiss, queueRemaining > 0 ? 300 : 800);
    } catch (e) {
      console.error("Save error:", e);
      setStage("preview");
    }
  }

  async function handleCreateSlot(collection: typeof Block.prototype, slotName: string) {
    if (!me) return;
    try {
      // Get the collection's sharing group for proper ownership
      let ownerGroup: Group | null = null;
      const sharingGroupId = collection.collectionData?.sharingGroupId;
      if (sharingGroupId) {
        ownerGroup = await Group.load(sharingGroupId as `co_z${string}`, {});
      }
      const owner = ownerGroup ? { owner: ownerGroup } : { owner: me };

      if (!collection.children) {
        collection.$jazz.set("children", BlockList.create([], owner));
      }

      // Create the slot with its children list pre-initialized so
      // handleSave can immediately push a product onto it
      const slotChildren = BlockList.create([], owner);
      const slot = Block.create(
        {
          type: "slot",
          name: slotName,
          children: slotChildren,
          createdAt: new Date(),
        },
        owner
      );

      collection.children.$jazz.push(slot);
      handleSave(collection, slot);
    } catch (e) {
      console.error("Create slot error:", e);
      setStage("preview");
    }
  }

  function handleCreateCollection(name: string) {
    if (!me?.root) return;

    // Create a Group for this collection to enable future sharing
    const ownerGroup = Group.create({ owner: me });
    ownerGroup.addMember(me, "admin");

    const childrenList = BlockList.create([], { owner: ownerGroup });
    const collection = Block.create(
      {
        type: "collection",
        name,
        collectionData: {
          color: "#6366f1",
          viewMode: "grid",
          sharingGroupId: ownerGroup.$jazz.id,
        },
        children: childrenList,
        createdAt: new Date(),
      },
      { owner: ownerGroup }
    );

    me.root.blocks?.$jazz.push(collection);
  }

  return (
    <Modal
      animationType={autoApplyCollection ? "none" : "slide"}
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <SafeAreaView style={styles.sheet}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>
              {stage === "loading" ? "Saving…" : stage === "saving" || stage === "done" ? "Saved ✓" : "Save to Tote"}
            </Text>
            {queueRemaining > 0 && stage === "preview" && (
              <View style={styles.queueRow}>
                <Text style={styles.queueText}>
                  {queueRemaining} remaining after this
                </Text>
                <View style={styles.queueToggle}>
                  <Text style={styles.queueToggleLabel}>Use selection for remaining</Text>
                  <Switch
                    value={applyToRemaining}
                    onValueChange={(value) => {
                      setApplyToRemaining(value);
                      if (!value) {
                        onApplyCollectionToRemaining?.(null);
                      }
                    }}
                    trackColor={{ false: "#d1d5db", true: "#c7d2fe" }}
                    thumbColor={applyToRemaining ? "#6366f1" : "#f9fafb"}
                  />
                </View>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={onDismiss} style={styles.skipButton}>
            <Text style={styles.skipButtonText}>
              {queueRemaining > 0 ? "Skip" : "Close"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hidden WebView — does the extraction */}
        {stage === "loading" && (
          <View style={styles.hidden}>
            <WebView
              ref={webViewRef}
              source={{ uri: url }}
              onLoadEnd={handleLoadEnd}
              onMessage={handleMessage}
              javaScriptEnabled
              domStorageEnabled
              // Identify as a real browser so sites don't block us
              userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            />
          </View>
        )}

        {/* Loading skeleton */}
        {stage === "loading" && <ProductSkeleton />}

        {/* Preview + picker */}
        {(stage === "preview" || stage === "saving" || stage === "done") && metadata && (
          <View style={styles.content}>
            {/* Product preview card */}
            <View style={styles.previewCard}>
              {metadata.imageUrl ? (
                <Image source={{ uri: metadata.imageUrl }} style={styles.productImage} resizeMode="cover" />
              ) : (
                <View style={[styles.productImage, styles.imagePlaceholder]} />
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
            {stage === "preview" && !autoApplyCollection && (
              <CollectionPicker
                collections={collections as any}
                onSelect={({ collection, slot }) =>
                  handleSave(
                    collection,
                    slot,
                    applyToRemaining && queueRemaining > 0 ? collection.$jazz.id : null
                  )
                }
                onCreateCollection={handleCreateCollection}
                onCreateSlot={handleCreateSlot}
                defaultExpandedId={defaultCollectionId}
              />
            )}

            {stage === "preview" && autoApplyCollection && (
              <View style={styles.autoProcessingCard}>
                <ActivityIndicator color="#6366f1" />
                <Text style={styles.autoProcessingTitle}>Saving queued item</Text>
                <Text style={styles.autoProcessingText}>
                  Adding this link to {autoApplyCollection.name}.
                </Text>
              </View>
            )}

            {/* Saving indicator */}
            {(stage === "saving" || stage === "done") && (
              <View style={styles.savingRow}>
                {stage === "saving"
                  ? <ActivityIndicator color="#6366f1" />
                  : <Text style={styles.savedText}>
                      {queueRemaining > 0 ? "Added. Loading next item…" : "Added to collection"}
                    </Text>
                }
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
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },
  queueText: {
    fontSize: 13,
    color: "#6b7280",
  },
  queueRow: {
    marginTop: 6,
    gap: 8,
  },
  queueToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  queueToggleLabel: {
    flex: 1,
    fontSize: 13,
    color: "#6b7280",
  },
  autoProcessingCard: {
    marginTop: 8,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    gap: 8,
  },
  autoProcessingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  autoProcessingText: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  hidden: {
    width: 0,
    height: 0,
    overflow: "hidden",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  previewCard: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  productImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
  },
  imagePlaceholder: {
    backgroundColor: "#e5e7eb",
  },
  productInfo: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  productTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 20,
  },
  productPrice: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  savingRow: {
    paddingTop: 24,
    alignItems: "center",
  },
  savedText: {
    fontSize: 16,
    color: "#22c55e",
    fontWeight: "600",
  },
});
