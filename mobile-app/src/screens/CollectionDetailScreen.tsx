import React, { useLayoutEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  SectionList,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { extractorScript } from "../lib/extractorScript";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCoState } from "jazz-tools/expo";
import { Block } from "@tote/schema";
import * as WebBrowser from "expo-web-browser";
import { RootStackParamList } from "../navigation/types";
import { SaveProductSheet } from "../components/SaveProductSheet";
import { formatPrice } from "../lib/formatPrice";

type Props = NativeStackScreenProps<RootStackParamList, "CollectionDetail">;
type ProductItem = typeof Block.prototype;

type Section = {
  title: string | null;
  slot: ProductItem | null; // null for ungrouped
  data: ProductItem[];
};

function ProductRefresher({
  item,
  onDone,
}: {
  item: ProductItem;
  onDone: () => void;
}) {
  const webViewRef = useRef<WebView>(null);
  const url = item.productData?.url;

  if (!url) {
    onDone();
    return null;
  }

  function handleLoadEnd() {
    webViewRef.current?.injectJavaScript(extractorScript);
  }

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "METADATA_RESULT") {
        const d = msg.data;
        if (d.title) item.$jazz.set("name", d.title);
        item.$jazz.set("productData", {
          ...item.productData,
          url,
          ...(d.imageUrl ? { imageUrl: d.imageUrl } : {}),
          ...(d.price ? { price: d.price } : {}),
          ...(d.price ? { priceValue: parseFloat(d.price) || item.productData?.priceValue } : {}),
          ...(d.description ? { description: d.description } : {}),
        });
      }
    } catch {}
    onDone();
  }

  return (
    <View style={styles.hidden}>
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
  );
}

function ProductRow({
  item,
  isSelected,
  isRefreshing,
  isQueued,
  onOpen,
  onToggleSelected,
  onDelete,
  onEdit,
  onRefresh,
}: {
  item: ProductItem;
  isSelected: boolean;
  isRefreshing: boolean;
  isQueued: boolean;
  onOpen: () => void;
  onToggleSelected: (() => void) | null;
  onDelete: () => void;
  onEdit: () => void;
  onRefresh: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={(progress) => {
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-160, 0],
          extrapolate: "clamp",
        });
        return (
          <Animated.View style={[styles.leftActions, { transform: [{ translateX }] }]}>
            <TouchableOpacity
              style={styles.editActionInner}
              onPress={() => {
                swipeRef.current?.close();
                onEdit();
              }}
            >
              <Text style={styles.editActionText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.refreshActionInner}
              onPress={() => {
                swipeRef.current?.close();
                onRefresh();
              }}
            >
              <Text style={styles.refreshActionText}>Refresh</Text>
            </TouchableOpacity>
          </Animated.View>
        );
      }}
      renderRightActions={(progress) => {
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [80, 0],
          extrapolate: "clamp",
        });
        return (
          <Animated.View style={[styles.deleteAction, { transform: [{ translateX }] }]}>
            <TouchableOpacity style={styles.deleteActionInner} onPress={onDelete}>
              <Text style={styles.deleteActionText}>Remove</Text>
            </TouchableOpacity>
          </Animated.View>
        );
      }}
      leftThreshold={40}
      rightThreshold={40}
      overshootLeft={false}
      overshootRight={false}
    >
      <TouchableOpacity
        style={[styles.productRow, isQueued && styles.productRowQueued]}
        onPress={onOpen}
        activeOpacity={0.7}
      >
        <View>
          {item.productData?.imageUrl ? (
            <Image
              source={{ uri: item.productData.imageUrl }}
              style={[styles.thumbnail, (isRefreshing || isQueued) && styles.thumbnailRefreshing]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
          )}
          {isRefreshing && (
            <View style={styles.thumbnailSpinner}>
              <ActivityIndicator size="small" color="#6366f1" />
            </View>
          )}
          {isQueued && (
            <View style={styles.thumbnailSpinner}>
              <Ionicons name="time-outline" size={18} color="#6366f1" />
            </View>
          )}
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name ?? "Untitled"}
          </Text>
          {item.productData?.price ? (
            <Text style={styles.productPrice}>{formatPrice(item.productData.price)}</Text>
          ) : null}
        </View>
        {onToggleSelected && (
          <TouchableOpacity
            onPress={onToggleSelected}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Swipeable>
  );
}

function EditProductModal({
  item,
  visible,
  onClose,
}: {
  item: ProductItem;
  visible: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(item.name ?? "");
  const [price, setPrice] = useState(item.productData?.price ?? "");

  function handleSave() {
    item.$jazz.set("name", name.trim() || item.name);
    item.$jazz.set("productData", { ...item.productData, price: price.trim() || undefined });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Edit Product</Text>

          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.fieldInput}
            value={name}
            onChangeText={setName}
            placeholder="Product name"
            autoFocus
          />

          <Text style={styles.fieldLabel}>Price</Text>
          <TextInput
            style={styles.fieldInput}
            value={price}
            onChangeText={setPrice}
            placeholder="e.g. $49.99"
            keyboardType="decimal-pad"
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSave} onPress={handleSave}>
              <Text style={styles.modalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SlotEditModal({
  slot,
  visible,
  onClose,
  onDelete,
}: {
  slot: ProductItem;
  visible: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(slot.name ?? "");
  const [maxSelections, setMaxSelections] = useState(
    slot.slotData?.maxSelections?.toString() ?? ""
  );
  const [budget, setBudget] = useState(
    slot.slotData?.budget ? (slot.slotData.budget / 100).toString() : ""
  );

  function handleSave() {
    slot.$jazz.set("name", name.trim() || slot.name);
    slot.$jazz.set("slotData", {
      ...slot.slotData,
      maxSelections: maxSelections ? parseInt(maxSelections, 10) : undefined,
      budget: budget ? Math.round(parseFloat(budget) * 100) : undefined,
    });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Edit Slot</Text>

          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.fieldInput}
            value={name}
            onChangeText={setName}
            placeholder="Slot name"
            autoFocus
          />

          <Text style={styles.fieldLabel}>Max selections</Text>
          <TextInput
            style={styles.fieldInput}
            value={maxSelections}
            onChangeText={setMaxSelections}
            placeholder="No limit"
            keyboardType="number-pad"
          />

          <Text style={styles.fieldLabel}>Budget ($)</Text>
          <TextInput
            style={styles.fieldInput}
            value={budget}
            onChangeText={setBudget}
            placeholder="No budget"
            keyboardType="decimal-pad"
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSave} onPress={handleSave}>
              <Text style={styles.modalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.modalDelete} onPress={onDelete}>
            <Text style={styles.modalDeleteText}>Delete Slot</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SlotHeader({ slot, title, onDelete }: { slot: ProductItem | null; title: string; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);

  if (!slot) {
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
    );
  }

  const selectedIds = slot.slotData?.selectedProductIds ?? [];
  const maxSelections = slot.slotData?.maxSelections;
  const budget = slot.slotData?.budget;

  const products = slot.children?.filter((b) => b?.type === "product") ?? [];
  const selectedProducts = products.filter(
    (p) => p && selectedIds.includes(p.$jazz.id)
  );
  const selectedTotal = selectedProducts.reduce(
    (sum, p) => sum + (p?.productData?.priceValue ?? 0),
    0
  );

  const hasProgress = maxSelections || budget;

  return (
    <>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionTitle}>{slot.name ?? title}</Text>
          {hasProgress && (
            <View style={styles.slotProgress}>
              {maxSelections ? (
                <Text style={styles.slotProgressText}>
                  {selectedIds.length} / {maxSelections} selected
                </Text>
              ) : null}
              {budget ? (
                <Text style={styles.slotProgressText}>
                  ${(selectedTotal / 100).toFixed(0)} / ${(budget / 100).toFixed(0)}
                </Text>
              ) : null}
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => setEditing(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="settings-outline" size={16} color="#9ca3af" />
        </TouchableOpacity>
      </View>
      <SlotEditModal slot={slot} visible={editing} onClose={() => setEditing(false)} onDelete={() => { setEditing(false); onDelete(); }} />
    </>
  );
}

function AddProductModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
}) {
  const [url, setUrl] = useState("");

  function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setUrl("");
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Add Product</Text>
          <Text style={styles.fieldLabel}>Product URL</Text>
          <TextInput
            style={styles.fieldInput}
            value={url}
            onChangeText={setUrl}
            placeholder="https://..."
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSave} onPress={handleSubmit}>
              <Text style={styles.modalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function CollectionDetailScreen({ route, navigation }: Props) {
  const { collectionId } = route.params;
  const [addingProduct, setAddingProduct] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [refreshQueue, setRefreshQueue] = useState<ProductItem[]>([]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => setAddingProduct(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="add" size={26} color="#6366f1" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const collection = useCoState(Block, collectionId, {
    resolve: { children: { $each: { children: { $each: true } } } },
  });

  if (!collection) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Loading…</Text>
      </View>
    );
  }

  const children = collection.children ?? [];
  const directProducts = children.filter(
    (b): b is ProductItem => b?.type === "product"
  );
  const slots = children.filter((b): b is ProductItem => b?.type === "slot");

  const sections: Section[] = [];

  for (const slot of slots) {
    const slotProducts =
      slot.children?.filter((b): b is ProductItem => b?.type === "product") ?? [];
    if (slotProducts.length > 0) {
      sections.push({ title: slot.name ?? "Untitled", slot, data: slotProducts });
    }
  }

  if (directProducts.length > 0) {
    sections.push({
      title: slots.length > 0 ? "Ungrouped" : null,
      slot: null,
      data: directProducts,
    });
  }

  const totalItems =
    directProducts.length +
    slots.reduce((sum, s) => sum + (s.children?.length ?? 0), 0);

  function openProduct(item: ProductItem) {
    const url = item.productData?.url;
    if (url) WebBrowser.openBrowserAsync(url);
  }

  function toggleSelected(item: ProductItem, slot: ProductItem) {
    const selectedIds = slot.slotData?.selectedProductIds ?? [];
    const id = item.$jazz.id;
    const isSelected = selectedIds.includes(id);
    const maxSelections = slot.slotData?.maxSelections;

    if (!isSelected && maxSelections && selectedIds.length >= maxSelections) return;

    slot.$jazz.set("slotData", {
      ...slot.slotData,
      selectedProductIds: isSelected
        ? selectedIds.filter((sid) => sid !== id)
        : [...selectedIds, id],
    });
  }

  function startBulkRefresh() {
    const allProducts = [
      ...slots.flatMap((s) => s.children?.filter((b): b is ProductItem => b?.type === "product") ?? []),
      ...directProducts,
    ].filter((p) => p.productData?.url);
    if (allProducts.length > 0) setRefreshQueue(allProducts);
  }

  function deleteSlot(slot: ProductItem) {
    const list = collection.children;
    if (!list) return;
    const idx = list.findIndex((c) => c?.$jazz?.id === slot.$jazz.id);
    if (idx !== -1) list.$jazz.splice(idx, 1);
  }

  function deleteProduct(item: ProductItem) {
    const parent = slots.find((s) =>
      s.children?.some((c) => c?.$jazz?.id === item.$jazz.id)
    );
    const list = parent ? parent.children : collection.children;
    if (!list) return;
    const idx = list.findIndex((c) => c?.$jazz?.id === item.$jazz.id);
    if (idx !== -1) list.$jazz.splice(idx, 1);
  }

  function renderProduct({ item, section }: { item: ProductItem; section: Section }) {
    const slot = section.slot;
    const isSelected = slot
      ? (slot.slotData?.selectedProductIds ?? []).includes(item.$jazz.id)
      : false;

    return (
      <ProductRow
        item={item}
        isSelected={isSelected}
        isRefreshing={refreshQueue[0]?.$jazz?.id === item.$jazz.id}
        isQueued={refreshQueue.slice(1).some((q) => q.$jazz?.id === item.$jazz.id)}
        onOpen={() => openProduct(item)}
        onToggleSelected={slot ? () => toggleSelected(item, slot) : null}
        onDelete={() => deleteProduct(item)}
        onEdit={() => setEditingProduct(item)}
        onRefresh={() => setRefreshQueue([item])}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.collectionMeta}>
        <View
          style={[
            styles.colorDot,
            { backgroundColor: collection.collectionData?.color ?? "#6366f1" },
          ]}
        />
        <Text style={styles.itemCount}>{totalItems} items</Text>
      </View>

      {sections.length === 0 ? (
        <Text style={styles.empty}>No items yet</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item?.$jazz?.id ?? Math.random().toString()}
          renderItem={renderProduct}
          renderSectionHeader={({ section }) =>
            section.title ? (
              <SlotHeader
                slot={section.slot}
                title={section.title}
                onDelete={() => section.slot && deleteSlot(section.slot)}
              />
            ) : null
          }
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          onRefresh={startBulkRefresh}
          refreshing={refreshQueue.length > 0}
        />
      )}

      <AddProductModal
        visible={addingProduct}
        onClose={() => setAddingProduct(false)}
        onSubmit={(url) => setPendingUrl(url)}
      />
      {editingProduct && (
        <EditProductModal
          item={editingProduct}
          visible
          onClose={() => setEditingProduct(null)}
        />
      )}
      {refreshQueue.length > 0 && (
        <ProductRefresher
          key={refreshQueue[0].$jazz.id}
          item={refreshQueue[0]}
          onDone={() => setRefreshQueue((q) => q.slice(1))}
        />
      )}
      {pendingUrl && (
        <SaveProductSheet url={pendingUrl} onDismiss={() => setPendingUrl(null)} defaultCollectionId={collectionId} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  collectionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  itemCount: { fontSize: 13, color: "#9ca3af" },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionHeader: {
    paddingTop: 24,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  slotProgress: { flexDirection: "row", gap: 10 },
  slotProgressText: { fontSize: 12, color: "#9ca3af" },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f3f4f6",
    backgroundColor: "#fff",
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  thumbnailPlaceholder: { backgroundColor: "#f3f4f6" },
  productInfo: { flex: 1 },
  productName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#111",
    lineHeight: 20,
  },
  productPrice: { fontSize: 13, color: "#6b7280", marginTop: 3 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  empty: {
    textAlign: "center",
    color: "#9ca3af",
    marginTop: 60,
    fontSize: 15,
  },
  sectionHeaderLeft: { flex: 1 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  modalOverlay: { position: "absolute", bottom: 0, left: 0, right: 0 },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#e5e7eb",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6, marginTop: 16 },
  fieldInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111",
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 24 },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  modalCancelText: { fontSize: 15, color: "#6b7280", fontWeight: "600" },
  modalSave: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#6366f1",
    alignItems: "center",
  },
  modalSaveText: { fontSize: 15, color: "#fff", fontWeight: "600" },
  modalDelete: { marginTop: 12, paddingVertical: 12, alignItems: "center" },
  modalDeleteText: { fontSize: 15, color: "#ef4444", fontWeight: "500" },
  leftActions: { flexDirection: "row", width: 160 },
  editActionInner: { width: 80, backgroundColor: "#6366f1", justifyContent: "center", alignItems: "center" },
  editActionText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  refreshActionInner: { width: 80, backgroundColor: "#8b5cf6", justifyContent: "center", alignItems: "center" },
  refreshActionText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  deleteAction: { width: 80, backgroundColor: "#ef4444" },
  deleteActionInner: { flex: 1, justifyContent: "center", alignItems: "center" },
  deleteActionText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  productRowQueued: { opacity: 0.5 },
  thumbnailRefreshing: { opacity: 0.4 },
  thumbnailSpinner: { position: "absolute", inset: 0, justifyContent: "center", alignItems: "center" },
  hidden: { width: 0, height: 0, overflow: "hidden" },
});
