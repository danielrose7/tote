import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { useAccount } from "jazz-tools/expo";
import { Group } from "jazz-tools";
import { JazzAccount, Block, BlockList } from "@tote/schema";
import { extractorScript } from "../lib/extractorScript";
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
}

export function SaveProductSheet({ url, onDismiss, defaultCollectionId }: Props) {
  const [stage, setStage] = useState<Stage>("loading");
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const webViewRef = useRef<WebView>(null);

  const me = useAccount(JazzAccount, {
    resolve: { root: { blocks: { $each: { children: { $each: { children: true } } } } } },
  });

  const collections = me?.root?.blocks?.filter(
    (b) => b !== null && b.type === "collection"
  ) ?? [];

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

  async function handleSave(collection: typeof Block.prototype, slot?: typeof Block.prototype) {
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
      setStage("done");
      setTimeout(onDismiss, 800);
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
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <SafeAreaView style={styles.sheet}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {stage === "loading" ? "Saving…" : stage === "saving" || stage === "done" ? "Saved ✓" : "Save to Tote"}
          </Text>
          <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
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
                    {metadata.currency === "USD" ? "$" : (metadata.currency ? metadata.currency + " " : "")}{metadata.price}
                  </Text>
                )}
              </View>
            </View>

            {/* Collection picker */}
            {stage === "preview" && (
              <CollectionPicker
                collections={collections as any}
                onSelect={({ collection, slot }) => handleSave(collection, slot)}
                onCreateCollection={handleCreateCollection}
                onCreateSlot={handleCreateSlot}
                defaultExpandedId={defaultCollectionId}
              />
            )}

            {/* Saving indicator */}
            {(stage === "saving" || stage === "done") && (
              <View style={styles.savingRow}>
                {stage === "saving"
                  ? <ActivityIndicator color="#6366f1" />
                  : <Text style={styles.savedText}>Added to collection</Text>
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 16,
    color: "#9ca3af",
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
