import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  SectionList,
  ScrollView,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  ActionSheetIOS,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { extractorScript } from "../lib/extractorScript";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCoState } from "jazz-tools/expo";
import { Block } from "@tote/schema";
import * as WebBrowser from "expo-web-browser";
import {
  Sortable,
  SortableGrid,
  SortableGridItem,
  SortableItem,
  type SortableGridRenderItemProps,
  type SortableRenderItemProps,
} from "react-native-reanimated-dnd";
import { RootStackParamList } from "../navigation/types";
import { SaveProductSheet } from "../components/SaveProductSheet";
import { ShareCollectionSheet } from "../components/ShareCollectionSheet";
import { useViewMode } from "../hooks/useViewMode";
import { formatPrice } from "../lib/formatPrice";
import {
  applySubsetOrderByIds,
  reorderIdsFromPositions,
} from "../lib/reorderBlocks";

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

type Props = NativeStackScreenProps<RootStackParamList, "CollectionDetail">;
type ProductItem = typeof Block.prototype;

type Section = {
  title: string | null;
  slot: ProductItem | null; // null for ungrouped
  data: ProductItem[];
};

type ReorderSectionTarget = {
  id: string;
  title: string;
  slot: ProductItem | null;
  items: ProductItem[];
};

type ReorderableBlockItem = {
  id: string;
  block: ProductItem;
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!(visible && confirmingDelete)) return;

    const timeout = setTimeout(() => {
      setConfirmingDelete(false);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [visible, confirmingDelete]);

  useEffect(() => {
    if (!visible) {
      setConfirmingDelete(false);
    }
  }, [visible]);

  function handleSave() {
    slot.$jazz.set("name", name.trim() || slot.name);
    slot.$jazz.set("slotData", {
      ...slot.slotData,
      maxSelections: maxSelections ? parseInt(maxSelections, 10) : undefined,
      budget: budget ? Math.round(parseFloat(budget) * 100) : undefined,
    });
    onClose();
  }

  function handleDeletePress() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }

    onDelete();
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
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>Edit Slot</Text>
            <TouchableOpacity
              style={[styles.modalDeletePill, confirmingDelete && styles.modalDeletePillArmed]}
              onPress={handleDeletePress}
            >
              <Text style={[styles.modalDeleteText, confirmingDelete && styles.modalDeleteTextArmed]}>
                {confirmingDelete ? "Tap again to delete" : "Delete Slot"}
              </Text>
            </TouchableOpacity>
          </View>

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
    (sum, p) => {
      const rawPrice = p?.productData?.price;
      const parsedPrice = rawPrice ? parseFloat(rawPrice.replace(/[^0-9.]/g, "")) : NaN;
      const numericPrice = Number.isFinite(parsedPrice)
        ? parsedPrice
        : (p?.productData?.priceValue ?? 0);
      return sum + numericPrice;
    },
    0
  );
  const formattedSelectedTotal = formatPrice(String(selectedTotal)) ?? `$${selectedTotal}`;
  const formattedBudget = budget ? formatPrice(String(budget / 100)) ?? `$${budget / 100}` : null;

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
                  {formattedSelectedTotal} / {formattedBudget}
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

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#06b6d4",
];

function EditCollectionModal({
  collection,
  visible,
  onClose,
}: {
  collection: ProductItem;
  visible: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(collection.name ?? "");
  const [color, setColor] = useState(collection.collectionData?.color ?? PRESET_COLORS[0]);

  function handleSave() {
    collection.$jazz.set("name", name.trim() || collection.name);
    collection.$jazz.set("collectionData", { ...collection.collectionData, color });
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
          <Text style={styles.modalTitle}>Edit Collection</Text>

          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.fieldInput}
            value={name}
            onChangeText={setName}
            placeholder="Collection name"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <Text style={styles.fieldLabel}>Color</Text>
          <View style={styles.swatches}>
            {PRESET_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSelected]}
                onPress={() => setColor(c)}
              >
                {color === c && <Ionicons name="checkmark" size={14} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>

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

function ProductGridCard({
  item,
  columnWidth,
  onPress,
}: {
  item: ProductItem;
  columnWidth: number;
  onPress: () => void;
}) {
  const [imageHeight, setImageHeight] = useState(150);
  const imageUrl = item.productData?.imageUrl;

  useEffect(() => {
    if (!imageUrl) return;
    Image.getSize(
      imageUrl,
      (w, h) => {
        if (w > 0) setImageHeight(Math.round((columnWidth * h) / w));
      },
      () => {}
    );
  }, [imageUrl, columnWidth]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.gridCard}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: "100%", height: imageHeight }}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.gridImagePlaceholder} />
      )}
      <View style={styles.gridCardInfo}>
        <Text style={styles.gridCardName} numberOfLines={3}>
          {item.name ?? "Untitled"}
        </Text>
        {item.productData?.price ? (
          <Text style={styles.gridCardPrice}>{formatPrice(item.productData.price)}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function ReorderProductRow({ item }: { item: ProductItem }) {
  return (
    <SortableItem.Handle style={styles.reorderWholeHandle}>
      <View style={styles.reorderRow}>
        {item.productData?.imageUrl ? (
          <Image
            source={{ uri: item.productData.imageUrl }}
            style={styles.reorderThumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.reorderThumbnail, styles.thumbnailPlaceholder]} />
        )}
        <View style={styles.reorderRowMeta}>
          <Text style={styles.reorderRowTitle} numberOfLines={2}>
            {item.name ?? "Untitled"}
          </Text>
          {item.productData?.price ? (
            <Text style={styles.reorderRowSubtitle}>{formatPrice(item.productData.price)}</Text>
          ) : null}
        </View>
        <View style={styles.reorderHandle}>
          <Ionicons name="reorder-three-outline" size={20} color="#6b7280" />
        </View>
      </View>
    </SortableItem.Handle>
  );
}

function ReorderGridCard({
  item,
  size,
}: {
  item: ProductItem;
  size: number;
}) {
  const imageHeight = Math.round(size * 0.72);
  const cardHeight = imageHeight + 106;

  return (
    <View style={[styles.reorderGridCard, { width: size, minHeight: cardHeight }]}>
      <View style={[styles.reorderGridMedia, { height: imageHeight }]}>
        {item.productData?.imageUrl ? (
          <Image
            source={{ uri: item.productData.imageUrl }}
            style={styles.reorderGridImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.reorderGridImagePlaceholder} />
        )}
      </View>
      <View style={styles.reorderGridInfo}>
        <Text style={styles.reorderGridTitle} numberOfLines={3}>
          {item.name ?? "Untitled"}
        </Text>
        <View style={styles.reorderGridFooter}>
          {item.productData?.price ? (
            <Text style={styles.reorderGridPrice}>{formatPrice(item.productData.price)}</Text>
          ) : <View />}
          <Ionicons name="reorder-three-outline" size={18} color="#6b7280" />
        </View>
      </View>
    </View>
  );
}

function ReorderSlotCard({ slot }: { slot: ProductItem }) {
  const itemCount =
    slot.children?.filter((child) => child?.type === "product").length ?? 0;

  return (
    <SortableItem.Handle style={styles.reorderWholeHandle}>
      <View style={styles.reorderSlotCard}>
        <View>
          <Text style={styles.reorderSlotEyebrow}>Slot</Text>
          <Text style={styles.reorderSlotTitle}>{slot.name ?? "Untitled"}</Text>
          <Text style={styles.reorderSlotSubtitle}>{itemCount} items</Text>
        </View>
        <View style={styles.reorderSlotHandle}>
          <Ionicons name="reorder-three-outline" size={22} color="#4f46e5" />
        </View>
      </View>
    </SortableItem.Handle>
  );
}

function MasonryGrid({
  items,
  onPress,
  header,
  onScroll,
  onRefresh,
  refreshing = false,
}: {
  items: ProductItem[];
  onPress: (item: ProductItem) => void;
  header?: React.ReactNode;
  onScroll?: any;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const screenWidth = Dimensions.get("window").width;
  const columnWidth = Math.floor((screenWidth - 48) / 2); // 20+20 padding + 8 gap

  const leftItems = items.filter((_, i) => i % 2 === 0);
  const rightItems = items.filter((_, i) => i % 2 === 1);

  return (
    <Animated.ScrollView
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={styles.masonryContainer}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        ) : undefined
      }
    >
      {header}
      <View style={styles.masonryColumns}>
        <View style={{ width: columnWidth }}>
          {leftItems.map((item) => (
            <ProductGridCard
              key={item.$jazz.id}
              item={item}
              columnWidth={columnWidth}
              onPress={() => onPress(item)}
            />
          ))}
        </View>
        <View style={{ width: columnWidth }}>
          {rightItems.map((item) => (
            <ProductGridCard
              key={item.$jazz.id}
              item={item}
              columnWidth={columnWidth}
              onPress={() => onPress(item)}
            />
          ))}
        </View>
      </View>
    </Animated.ScrollView>
  );
}

export function CollectionDetailScreen({ route, navigation }: Props) {
  const { collectionId } = route.params;
  const insets = useSafeAreaInsets();
  const [addingProduct, setAddingProduct] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [editingCollection, setEditingCollection] = useState(false);
  const [sharingCollection, setSharingCollection] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [activeReorderTargetId, setActiveReorderTargetId] = useState("ungrouped");
  const [isGridReorderReady, setIsGridReorderReady] = useState(false);
  const [refreshQueue, setRefreshQueue] = useState<ProductItem[]>([]);
  const { viewMode, setViewMode } = useViewMode();
  const scrollY = useRef(new Animated.Value(0)).current;

  const collection = useCoState(Block, collectionId, {
    resolve: { children: { $each: { children: { $each: true } } } },
  });

  function openReorderItemTargetPicker() {
    const options = ["Cancel", ...reorderSections.map((section) => section.title)];

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: 0,
      },
      (buttonIndex) => {
        if (buttonIndex > 0) {
          const target = reorderSections[buttonIndex - 1];
          if (target) {
            setActiveReorderTargetId(target.id);
          }
        }
      }
    );
  }

  function openCollectionActions() {
    const nextViewModeLabel =
      viewMode === "list" ? "Switch to grid" : "Switch to list";

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ["Cancel", "Edit collection", "Share collection", nextViewModeLabel, "Reorder items"],
        cancelButtonIndex: 0,
      },
      (buttonIndex) => {
        if (buttonIndex === 1) {
          setEditingCollection(true);
        } else if (buttonIndex === 2) {
          setSharingCollection(true);
        } else if (buttonIndex === 3) {
          setViewMode((mode) => (mode === "list" ? "grid" : "list"));
        } else if (buttonIndex === 4) {
          setIsReorderMode(true);
        }
      }
    );
  }

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
  const displayTitle = collection.name ?? route.params.collectionName;
  const topBarTop = insets.top + 8;
  const pageHeaderTopPadding = topBarTop + 72;
  const titleFadeStyle = {
    opacity: scrollY.interpolate({
      inputRange: [0, 28, 72],
      outputRange: [1, 0.9, 0.08],
      extrapolate: "clamp",
    }),
    transform: [
      {
        translateY: scrollY.interpolate({
          inputRange: [0, 72],
          outputRange: [0, -22],
          extrapolate: "clamp",
        }),
      },
    ],
  };
  const metaFadeStyle = {
    opacity: scrollY.interpolate({
      inputRange: [0, 22, 54],
      outputRange: [1, 0.72, 0],
      extrapolate: "clamp",
    }),
  };
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

  const reorderSections: ReorderSectionTarget[] = [
    ...slots.map((slot) => ({
      id: slot.$jazz.id,
      title: slot.name ?? "Untitled",
      slot,
      items: slot.children?.filter((b): b is ProductItem => b?.type === "product") ?? [],
    })),
    ...(directProducts.length > 0 || slots.length === 0
      ? [
          {
            id: "ungrouped",
            title: slots.length > 0 ? "Ungrouped" : "Items",
            slot: null,
            items: directProducts,
          },
        ]
      : []),
  ];

  useEffect(() => {
    const validTargets = [
      ...(slots.length > 1 ? ["slots"] : []),
      ...reorderSections.map((section) => section.id),
    ];
    if (!validTargets.includes(activeReorderTargetId)) {
      setActiveReorderTargetId(validTargets[0] ?? "ungrouped");
    }
  }, [activeReorderTargetId, reorderSections, slots.length]);

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

  const activeReorderSection =
    reorderSections.find((section) => section.id === activeReorderTargetId) ?? reorderSections[0];
  const hasMultipleSlots = slots.length > 1;
  const gridItemSize = Math.floor((Dimensions.get("window").width - 64) / 2);
  const reorderSlotItems: ReorderableBlockItem[] = slots.map((slot) => ({
    id: slot.$jazz.id,
    block: slot,
  }));
  const activeReorderItems: ReorderableBlockItem[] =
    activeReorderSection?.items.map((item) => ({
      id: item.$jazz.id,
      block: item,
    })) ?? [];
  const reorderGridHeight =
    Math.ceil(activeReorderItems.length / 2) * (Math.round(gridItemSize * 0.72) + 106 + 12) - 12;
  const reorderGridKey = `${activeReorderSection?.id ?? "none"}:${activeReorderItems
    .map((item) => item.id)
    .join(",")}`;

  useEffect(() => {
    if (!(isReorderMode && viewMode === "grid" && activeReorderItems.length > 0)) {
      setIsGridReorderReady(false);
      return;
    }

    setIsGridReorderReady(false);

    const handle = requestAnimationFrame(() => {
      setIsGridReorderReady(true);
    });

    return () => {
      cancelAnimationFrame(handle);
    };
  }, [isReorderMode, viewMode, reorderGridKey, activeReorderItems.length]);

  function handleSlotDrop(_: string, __: number, positions?: Record<string, number>) {
    if (!collection.children) return;

    const orderedIds = reorderSlotItems
      .slice()
      .sort((a, b) => (positions?.[a.id] ?? 0) - (positions?.[b.id] ?? 0))
      .map((item) => item.id);
    applySubsetOrderByIds(
      collection.children as never,
      orderedIds,
      (item) => item?.type === "slot"
    );
  }

  function handleActiveSectionDrop(_: string, __: number, positions?: Record<string, number>) {
    if (!activeReorderSection) return;

    const orderedIds = activeReorderItems
      .slice()
      .sort((a, b) => (positions?.[a.id] ?? 0) - (positions?.[b.id] ?? 0))
      .map((item) => item.id);

    if (activeReorderSection.slot?.children) {
      applySubsetOrderByIds(
        activeReorderSection.slot.children as never,
        orderedIds,
        (item) => item?.type === "product"
      );
      return;
    }

    if (collection.children) {
      applySubsetOrderByIds(
        collection.children as never,
        orderedIds,
        (item) => item?.type === "product"
      );
    }
  }

  function renderReorderSlot({
    item,
    id,
    ...rest
  }: SortableRenderItemProps<ReorderableBlockItem>) {
    return (
      <SortableItem key={id} id={id} data={item} onDrop={handleSlotDrop} {...rest}>
        <ReorderSlotCard slot={item.block} />
      </SortableItem>
    );
  }

  function renderReorderProduct({
    item,
    id,
    ...rest
  }: SortableRenderItemProps<ReorderableBlockItem>) {
    return (
      <SortableItem
        key={id}
        id={id}
        data={item}
        onDrop={handleActiveSectionDrop}
        {...rest}
      >
        <ReorderProductRow item={item.block} />
      </SortableItem>
    );
  }

  function renderReorderGridItem({
    item,
    ...rest
  }: SortableGridRenderItemProps<ReorderableBlockItem>) {
        return (
      <SortableGridItem
        key={item.id}
        id={item.id}
        data={item}
        onDrop={handleActiveSectionDrop}
        style={{ width: gridItemSize, height: Math.round(gridItemSize * 0.72) + 106 }}
        {...rest}
      >
        <ReorderGridCard item={item.block} size={gridItemSize} />
      </SortableGridItem>
    );
  }

  const pageHeader = (
    <View style={[styles.pageHeader, { paddingTop: pageHeaderTopPadding }]}>
      <Animated.View style={[styles.pageHeaderText, titleFadeStyle]}>
        {isReorderMode ? (
          <Text style={styles.pageEyebrow}>Reorder collection</Text>
        ) : null}
        <Text style={styles.pageTitle}>{displayTitle}</Text>
        <Animated.View style={[styles.pageMetaRow, metaFadeStyle]}>
          <View
            style={[
              styles.colorDot,
              { backgroundColor: collection.collectionData?.color ?? "#6366f1" },
            ]}
          />
          <Text style={styles.pageMetaText}>{totalItems} items</Text>
          {isReorderMode ? (
            <>
              <Text style={styles.pageMetaDivider}>·</Text>
              <Text style={styles.pageMetaText}>
                {activeReorderTargetId === "slots" ? "Slots" : "Items"}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.pageMetaDivider}>·</Text>
              <Text style={styles.pageMetaText}>{viewMode}</Text>
            </>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.statusScrim, { height: insets.top + 24 }]} pointerEvents="none" />
      <View style={[styles.floatingTopBar, { top: topBarTop }]}>
        <TouchableOpacity
          style={styles.floatingCircleButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={18} color="#0f172a" />
        </TouchableOpacity>

        <View style={styles.floatingTopBarRight}>
          {isReorderMode ? (
            <TouchableOpacity
              style={styles.donePillButton}
              onPress={() => setIsReorderMode(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.donePillButtonText}>Done</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.floatingCircleButton}
                onPress={() => setAddingProduct(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="add" size={20} color="#0f172a" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.floatingCircleButton}
                onPress={openCollectionActions}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color="#0f172a" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {totalItems === 0 ? (
        <View style={styles.emptyStateContainer}>
          {pageHeader}
          <Text style={styles.empty}>No items yet</Text>
        </View>
      ) : isReorderMode ? (
        <View style={styles.reorderModeContainer}>
          {pageHeader}
          <View style={styles.reorderModeBody}>
            {hasMultipleSlots || reorderSections.length > 1 ? (
              <View style={styles.reorderControls}>
                <View style={styles.reorderScopeSwitch}>
                  {hasMultipleSlots ? (
                    <TouchableOpacity
                      style={[
                        styles.reorderScopeButton,
                        activeReorderTargetId === "slots" && styles.reorderScopeButtonActive,
                      ]}
                      onPress={() => setActiveReorderTargetId("slots")}
                    >
                      <Text
                        style={[
                          styles.reorderScopeButtonLabel,
                          activeReorderTargetId === "slots" && styles.reorderScopeButtonLabelActive,
                        ]}
                      >
                        Slots
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[
                      styles.reorderScopeButton,
                      activeReorderTargetId !== "slots" && styles.reorderScopeButtonActive,
                    ]}
                    onPress={() => setActiveReorderTargetId(activeReorderSection?.id ?? reorderSections[0]?.id ?? "ungrouped")}
                  >
                    <Text
                      style={[
                        styles.reorderScopeButtonLabel,
                        activeReorderTargetId !== "slots" && styles.reorderScopeButtonLabelActive,
                      ]}
                    >
                      Items
                    </Text>
                  </TouchableOpacity>
                </View>

                {activeReorderTargetId !== "slots" && reorderSections.length > 1 ? (
                  <TouchableOpacity style={styles.reorderTargetPicker} onPress={openReorderItemTargetPicker}>
                    <Text style={styles.reorderTargetPickerLabel}>Editing</Text>
                    <View style={styles.reorderTargetPickerValueRow}>
                      <Text style={styles.reorderTargetPickerValue} numberOfLines={1}>
                        {activeReorderSection?.title ?? "Items"}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color="#6b7280" />
                    </View>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {activeReorderTargetId === "slots" && hasMultipleSlots ? (
              <View style={styles.reorderPanelFlex}>
                <View style={styles.reorderPanelHeader}>
                  <Text style={styles.reorderPanelTitle}>Slots</Text>
                  <Text style={styles.reorderPanelMeta}>{slots.length} slots</Text>
                </View>
                <Sortable
                  data={reorderSlotItems}
                  renderItem={renderReorderSlot}
                  itemHeight={112}
                  gap={12}
                  useFlatList={false}
                  itemKeyExtractor={(item) => item.id}
                  contentContainerStyle={styles.reorderSlotsList}
                />
              </View>
            ) : activeReorderSection ? (
              <View style={styles.reorderPanelFlex}>
                <View style={styles.reorderPanelHeader}>
                  <Text style={styles.reorderPanelTitle}>{activeReorderSection.title}</Text>
                  <Text style={styles.reorderPanelMeta}>
                    {activeReorderSection.items.length} items · {viewMode}
                  </Text>
                </View>

                {activeReorderSection.items.length === 0 ? (
                  <View style={styles.reorderEmptyState}>
                    <Text style={styles.reorderEmptyText}>Nothing to reorder here yet.</Text>
                  </View>
                ) : viewMode === "grid" ? (
                  <View
                    style={[
                      styles.reorderGridFrame,
                      { height: Math.max(reorderGridHeight + gridItemSize, gridItemSize * 2) },
                    ]}
                  >
                    {isGridReorderReady ? (
                      <SortableGrid
                        key={reorderGridKey}
                        data={activeReorderItems}
                        renderItem={renderReorderGridItem}
                        itemKeyExtractor={(item) => item.id}
                        dimensions={{
                          columns: 2,
                          itemWidth: gridItemSize,
                          itemHeight: Math.round(gridItemSize * 0.72) + 106,
                          columnGap: 12,
                          rowGap: 12,
                        }}
                        scrollEnabled={false}
                        style={styles.reorderGrid}
                        contentContainerStyle={styles.reorderGridContainer}
                      />
                    ) : null}
                  </View>
                ) : (
                  <Sortable
                    data={activeReorderItems}
                    renderItem={renderReorderProduct}
                    itemHeight={96}
                    gap={10}
                    itemKeyExtractor={(item) => item.id}
                    contentContainerStyle={styles.reorderItemsList}
                  />
                )}
              </View>
            ) : null}
          </View>
        </View>
      ) : viewMode === "grid" ? (
        <MasonryGrid
          header={pageHeader}
          onScroll={handleScroll}
          onRefresh={startBulkRefresh}
          refreshing={refreshQueue.length > 0}
          items={[
            ...slots.flatMap((s) => s.children?.filter((b): b is ProductItem => b?.type === "product") ?? []),
            ...directProducts,
          ]}
          onPress={openProduct}
        />
      ) : (
        <AnimatedSectionList
          sections={sections}
          contentInsetAdjustmentBehavior="never"
          onScroll={handleScroll}
          scrollEventThrottle={16}
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
          ListHeaderComponent={pageHeader}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          onRefresh={startBulkRefresh}
          refreshing={refreshQueue.length > 0}
        />
      )}

      {sharingCollection && (
        <ShareCollectionSheet
          collection={collection}
          visible
          onClose={() => setSharingCollection(false)}
        />
      )}
      {editingCollection && (
        <EditCollectionModal
          collection={collection}
          visible
          onClose={() => setEditingCollection(false)}
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
        <SaveProductSheet
          key={pendingUrl}
          url={pendingUrl}
          onDismiss={() => setPendingUrl(null)}
          defaultCollectionId={collectionId}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" },
  statusScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 18,
    backgroundColor: "#f8fafc",
  },
  floatingTopBar: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  floatingTopBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  floatingCircleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  donePillButton: {
    minWidth: 68,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  donePillButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  pageHeader: {
    paddingHorizontal: 20,
    paddingTop: 96,
    paddingBottom: 18,
  },
  pageHeaderText: {
    gap: 8,
  },
  pageEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6366f1",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  pageTitle: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.8,
  },
  pageMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  pageMetaText: { fontSize: 14, color: "#6b7280", textTransform: "capitalize" },
  pageMetaDivider: { fontSize: 14, color: "#cbd5e1" },
  list: { paddingHorizontal: 20, paddingBottom: 40, backgroundColor: "#fff" },
  emptyStateContainer: { flex: 1, backgroundColor: "#fff" },
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
    paddingHorizontal: 12,
    gap: 12,
    marginBottom: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eef2f7",
    backgroundColor: "#f8fafc",
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
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: "700" },
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
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  swatch: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  swatchSelected: { borderWidth: 2.5, borderColor: "rgba(0,0,0,0.2)" },
  modalDeletePill: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff5f5",
    alignItems: "center",
    justifyContent: "center",
  },
  modalDeletePillArmed: {
    borderColor: "#fca5a5",
    backgroundColor: "#fee2e2",
  },
  modalDeleteText: { fontSize: 14, color: "#dc2626", fontWeight: "600" },
  modalDeleteTextArmed: { color: "#b91c1c" },
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
  reorderModeContainer: {
    flex: 1,
    paddingBottom: 16,
    backgroundColor: "#f8fafc",
  },
  reorderModeBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  reorderControls: {
    gap: 10,
  },
  reorderScopeSwitch: {
    flexDirection: "row",
    alignSelf: "flex-start",
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  reorderScopeButton: {
    minWidth: 76,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  reorderScopeButtonActive: {
    backgroundColor: "#111827",
  },
  reorderScopeButtonLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
  },
  reorderScopeButtonLabelActive: {
    color: "#fff",
  },
  reorderTargetPicker: {
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  reorderTargetPickerLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  reorderTargetPickerValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  reorderTargetPickerValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  reorderPanelFlex: {
    flex: 1,
    minHeight: 0,
    overflow: "visible",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  reorderPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reorderPanelTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  reorderPanelMeta: { fontSize: 13, color: "#6b7280", textTransform: "capitalize" },
  reorderSlotsList: { paddingTop: 2, paddingBottom: 14 },
  reorderItemsList: { paddingBottom: 20 },
  reorderSlotCard: {
    height: 88,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reorderSlotEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6366f1",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  reorderSlotTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginTop: 4 },
  reorderSlotSubtitle: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  reorderSlotHandle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2ff",
  },
  reorderWholeHandle: {
    width: "100%",
  },
  reorderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 84,
    marginBottom: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  reorderThumbnail: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#e5e7eb",
  },
  reorderRowMeta: { flex: 1 },
  reorderRowTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
  reorderRowSubtitle: { marginTop: 4, fontSize: 13, color: "#6b7280" },
  reorderHandle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  reorderEmptyState: { flex: 1, alignItems: "center", justifyContent: "center" },
  reorderEmptyText: { fontSize: 14, color: "#9ca3af" },
  reorderGridFrame: {
    overflow: "visible",
  },
  reorderGrid: {
    backgroundColor: "transparent",
  },
  reorderGridContainer: { paddingTop: 4, paddingBottom: 40 },
  reorderGridCard: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  reorderGridMedia: {
    width: "100%",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  reorderGridImage: {
    width: "100%",
    height: "100%",
  },
  reorderGridImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#e5e7eb",
    borderRadius: 14,
  },
  reorderGridInfo: { flex: 1, padding: 12, gap: 8 },
  reorderGridTitle: { fontSize: 14, fontWeight: "600", color: "#111827", lineHeight: 18 },
  reorderGridFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reorderGridPrice: { fontSize: 13, color: "#6b7280" },
  masonryContainer: { paddingHorizontal: 20, paddingBottom: 40, backgroundColor: "#f8fafc" },
  masonryColumns: { flexDirection: "row", gap: 8 },
  gridCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 8,
    overflow: "hidden",
  },
  gridImagePlaceholder: { height: 130, backgroundColor: "#e5e7eb" },
  gridCardInfo: { padding: 8, paddingBottom: 10 },
  gridCardName: { fontSize: 13, fontWeight: "500", color: "#111", lineHeight: 18 },
  gridCardPrice: { fontSize: 12, color: "#6b7280", marginTop: 3 },
});
