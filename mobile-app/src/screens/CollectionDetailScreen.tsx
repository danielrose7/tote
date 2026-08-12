import { useAuth, useUser } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import {
  Sortable,
  SortableGrid,
  SortableGridItem,
  type GridPositions,
  type SortableGridRenderItemProps,
  SortableItem,
  type SortableRenderItemProps,
} from 'react-native-reanimated-dnd';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Button } from '../components/Button';
import { GridImage } from '../components/GridImage';
import { MasonryGrid as MasonryFlatGrid } from '../components/MasonryGrid';
import { SaveProductSheet } from '../components/SaveProductSheet';
import { ShareCollectionSheet } from '../components/ShareCollectionSheet';
import { useCollectionRealtime } from '../hooks/useCollectionRealtime';
import { getImageRatio, useImageRatios } from '../hooks/useImageRatios';
import { useViewMode } from '../hooks/useViewMode';
import { fromNow, useSyncStatus } from '../hooks/useSyncStatus';
import type { Collection, CollectionDetail, CollectionNode } from '../lib/api';
import {
  captureUrl,
  createNode,
  deleteCollection,
  deleteNode,
  reorderNodes,
  updateCollection,
  updateNode,
  fetchCollectionDetail,
  getTokenWithRetry,
} from '../lib/api';
import { extractorScript } from '../lib/extractorScript';
import { formatPrice } from '../lib/formatPrice';
import { useGridLayout, useReadableInset } from '../lib/layout';
import { getCachedNodes, upsertNodes } from '../lib/localDb';
import type { RootStackParamList } from '../navigation/types';

const REORDER_GRID_GAP = 12;

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

type Props = NativeStackScreenProps<RootStackParamList, 'CollectionDetail'>;
type ProductItem = CollectionNode;

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

// The web app stores section picks under `selectedItemIds`. Older data written
// by Jazz (and by earlier builds of this app) used `selectedProductIds`; read
// both so migrated collections keep their picks, but always write the new key.
function getSelectedIds(slot: ProductItem): string[] {
  return (
    slot.properties.selectedItemIds ?? slot.properties.selectedProductIds ?? []
  );
}

// Every mutation also lands as a realtime event, so a refresh routinely races
// the write that triggered it. The server list decides which nodes exist, but a
// node's local copy wins when it is newer than (or still being written to) the
// server's — otherwise a stale read briefly flips a selection back to its old
// value before settling, which reads as a flicker.
function mergeNodes(
  local: CollectionNode[],
  server: CollectionNode[],
  pendingWrites: React.RefObject<Map<string, number>>,
): CollectionNode[] {
  const localById = new Map(local.map((n) => [n.id, n]));
  return server.map((serverNode) => {
    const localNode = localById.get(serverNode.id);
    if (!localNode) return serverNode;
    const hasPendingWrite =
      (pendingWrites.current?.get(serverNode.id) ?? 0) > 0;
    return hasPendingWrite || localNode.version > serverNode.version
      ? localNode
      : serverNode;
  });
}

function ProductRefresher({
  item,
  collectionId,
  getToken,
  onDone,
}: {
  item: ProductItem;
  collectionId: string;
  getToken: () => Promise<string | null>;
  onDone: (updated?: Partial<CollectionNode>) => void;
}) {
  const webViewRef = useRef<WebView>(null);
  const url = item.properties.url;

  if (!url) {
    onDone();
    return null;
  }

  function handleLoadEnd() {
    webViewRef.current?.injectJavaScript(extractorScript);
  }

  async function handleMessage(event: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'METADATA_RESULT') {
        const d = msg.data;
        const updatedProperties = {
          ...item.properties,
          url,
          ...(d.imageUrl ? { imageUrl: d.imageUrl } : {}),
          ...(d.price ? { price: d.price } : {}),
          ...(d.description ? { description: d.description } : {}),
        };
        const updatedTitle = d.title || item.title;
        try {
          const token = await getTokenWithRetry(getToken);
          if (token) {
            const { version } = await updateNode(token, collectionId, item.id, {
              expectedVersion: item.version,
              title: updatedTitle,
              properties: updatedProperties,
            });
            onDone({
              title: updatedTitle,
              properties: updatedProperties,
              version,
            });
            return;
          }
        } catch {}
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
  refreshKey,
  itemIndex,
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
  refreshKey: number;
  itemIndex: number;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (refreshKey === 0) return;
    opacity.setValue(0);
    translateY.setValue(10);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        delay: itemIndex * 45,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 240,
        delay: itemIndex * 45,
        useNativeDriver: true,
      }),
    ]).start();
  }, [refreshKey]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Swipeable
        ref={swipeRef}
        renderLeftActions={(progress) => {
          const translateX = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [-160, 0],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              style={[styles.leftActions, { transform: [{ translateX }] }]}
            >
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
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              style={[styles.deleteAction, { transform: [{ translateX }] }]}
            >
              <TouchableOpacity
                style={styles.deleteActionInner}
                onPress={onDelete}
              >
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
            {item.properties.imageUrl ? (
              <Image
                source={{ uri: item.properties.imageUrl }}
                style={[
                  styles.thumbnail,
                  (isRefreshing || isQueued) && styles.thumbnailRefreshing,
                ]}
                contentFit="cover"
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
              {item.title ?? 'Untitled'}
            </Text>
            {item.properties.price ? (
              <Text style={styles.productPrice}>
                {formatPrice(item.properties.price)}
              </Text>
            ) : null}
          </View>
          {onToggleSelected && (
            <TouchableOpacity
              onPress={onToggleSelected}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View
                style={[styles.checkbox, isSelected && styles.checkboxSelected]}
              >
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Swipeable>
    </Animated.View>
  );
}

function EditProductModal({
  item,
  sections,
  visible,
  onClose,
  onSave,
}: {
  item: ProductItem;
  sections: ProductItem[];
  visible: boolean;
  onClose: () => void;
  onSave: (
    title: string,
    price: string,
    notes: string,
    parentId: string | null | undefined,
  ) => void;
}) {
  const [name, setName] = useState(item.title ?? '');
  const [price, setPrice] = useState(item.properties.price ?? '');
  const [notes, setNotes] = useState(item.properties.notes ?? '');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(
    item.parentId,
  );
  const [slotPickerOpen, setSlotPickerOpen] = useState(false);

  const selectedSlot = sections.find((s) => s.id === selectedSlotId) ?? null;
  const parentChanged = selectedSlotId !== item.parentId;

  function handleSave() {
    onSave(
      name.trim(),
      price.trim(),
      notes.trim(),
      parentChanged ? selectedSlotId : undefined,
    );
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            style={[styles.fieldInput, styles.fieldTextarea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add your personal notes..."
            multiline
            numberOfLines={3}
          />

          {sections.length > 0 && (
            <>
              <Text style={styles.fieldLabel}>Slot</Text>
              <TouchableOpacity
                style={styles.slotPickerTrigger}
                onPress={() => setSlotPickerOpen((o) => !o)}
              >
                <Text style={styles.slotPickerValue}>
                  {selectedSlot
                    ? (selectedSlot.title ?? 'Untitled')
                    : 'Ungrouped'}
                </Text>
                <Ionicons
                  name={slotPickerOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#6b7280"
                />
              </TouchableOpacity>
              {slotPickerOpen && (
                <View style={styles.slotPickerDropdown}>
                  <TouchableOpacity
                    style={[
                      styles.slotPickerOption,
                      selectedSlotId === null &&
                        styles.slotPickerOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedSlotId(null);
                      setSlotPickerOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.slotPickerOptionText,
                        selectedSlotId === null &&
                          styles.slotPickerOptionTextSelected,
                      ]}
                    >
                      Ungrouped
                    </Text>
                    {selectedSlotId === null && (
                      <Ionicons name="checkmark" size={15} color="#6366f1" />
                    )}
                  </TouchableOpacity>
                  {sections.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.slotPickerOption,
                        selectedSlotId === s.id &&
                          styles.slotPickerOptionSelected,
                      ]}
                      onPress={() => {
                        setSelectedSlotId(s.id);
                        setSlotPickerOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.slotPickerOptionText,
                          selectedSlotId === s.id &&
                            styles.slotPickerOptionTextSelected,
                        ]}
                      >
                        {s.title ?? 'Untitled'}
                      </Text>
                      {selectedSlotId === s.id && (
                        <Ionicons name="checkmark" size={15} color="#6366f1" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          <View style={styles.modalActions}>
            <Button
              label="Cancel"
              variant="ghost"
              onPress={onClose}
              style={styles.modalBtn}
            />
            <Button label="Save" onPress={handleSave} style={styles.modalBtn} />
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
  onSave,
  onDelete,
}: {
  slot: ProductItem;
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, maxSelections: string, budget: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(slot.title ?? '');
  const [maxSelections, setMaxSelections] = useState(
    slot.properties.maxSelections?.toString() ?? '',
  );
  const [budget, setBudget] = useState(
    slot.properties.budget ? (slot.properties.budget / 100).toString() : '',
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
    onSave(name.trim(), maxSelections, budget);
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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>Edit Slot</Text>
            <TouchableOpacity
              style={[
                styles.modalDeletePill,
                confirmingDelete && styles.modalDeletePillArmed,
              ]}
              onPress={handleDeletePress}
            >
              <Text
                style={[
                  styles.modalDeleteText,
                  confirmingDelete && styles.modalDeleteTextArmed,
                ]}
              >
                {confirmingDelete ? 'Tap again to delete' : 'Delete Slot'}
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
            <Button
              label="Cancel"
              variant="ghost"
              onPress={onClose}
              style={styles.modalBtn}
            />
            <Button label="Save" onPress={handleSave} style={styles.modalBtn} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type SwapRequest = {
  slot: ProductItem;
  incoming: ProductItem;
  current: ProductItem[];
  selectedIds: string[];
};

function SelectionSwapSheet({
  request,
  onCancel,
  onConfirm,
}: {
  request: SwapRequest | null;
  onCancel: () => void;
  onConfirm: (removed: ProductItem) => void;
}) {
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);

  useEffect(() => {
    // Preselect when there is only one thing that could be swapped out.
    setPendingRemovalId(
      request?.current.length === 1 ? request.current[0].id : null,
    );
  }, [request]);

  if (!request) return null;

  const { slot, incoming, current } = request;
  const maxSelections = slot.properties.maxSelections;
  const isSingle = current.length === 1;

  function handleConfirm() {
    const removed = current.find((n) => n.id === pendingRemovalId);
    if (removed) onConfirm(removed);
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onCancel}
      />
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Selection limit reached</Text>
          <Text style={styles.swapSubtitle}>
            {slot.title ?? 'This slot'} allows {maxSelections} selection
            {maxSelections === 1 ? '' : 's'}.{' '}
            {isSingle
              ? 'Swap your current pick for this one?'
              : 'Choose one to unselect.'}
          </Text>

          <Text style={[styles.fieldLabel, styles.swapLabelIn]}>Selecting</Text>
          <View style={styles.swapIncomingRow}>
            <SwapThumbnail item={incoming} />
            <View style={styles.swapRowInfo}>
              <Text style={styles.swapRowTitle} numberOfLines={2}>
                {incoming.title ?? 'Untitled'}
              </Text>
              {incoming.properties.price ? (
                <Text style={styles.swapRowPrice}>
                  {formatPrice(incoming.properties.price)}
                </Text>
              ) : null}
            </View>
            <View style={[styles.swapBadge, styles.swapBadgeIn]}>
              <Ionicons name="add" size={16} color="#fff" />
            </View>
          </View>

          <Text style={[styles.fieldLabel, styles.swapLabelOut]}>
            {isSingle ? 'Replacing' : 'Unselect'}
          </Text>
          <ScrollView
            style={current.length > 3 ? styles.swapList : undefined}
            bounces={false}
          >
            {current.map((node) => {
              const isPending = node.id === pendingRemovalId;
              return (
                <TouchableOpacity
                  key={node.id}
                  style={[
                    styles.swapOptionRow,
                    isPending && styles.swapOptionRowActive,
                  ]}
                  onPress={() => setPendingRemovalId(node.id)}
                  activeOpacity={0.7}
                  disabled={isSingle}
                >
                  <SwapThumbnail item={node} dimmed={isPending} />
                  <View style={styles.swapRowInfo}>
                    <Text
                      style={[
                        styles.swapRowTitle,
                        isPending && styles.swapRowTitleRemoved,
                      ]}
                      numberOfLines={2}
                    >
                      {node.title ?? 'Untitled'}
                    </Text>
                    {node.properties.price ? (
                      <Text style={styles.swapRowPrice}>
                        {formatPrice(node.properties.price)}
                      </Text>
                    ) : null}
                  </View>
                  {isSingle ? (
                    <View style={[styles.swapBadge, styles.swapBadgeOut]}>
                      <Ionicons name="remove" size={16} color="#fff" />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.swapRadio,
                        isPending && styles.swapRadioActive,
                      ]}
                    >
                      {isPending && (
                        <Ionicons name="remove" size={14} color="#fff" />
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.modalActions}>
            <Button
              label="Cancel"
              variant="ghost"
              onPress={onCancel}
              style={styles.modalBtn}
            />
            <Button
              label="Swap"
              onPress={handleConfirm}
              disabled={!pendingRemovalId}
              style={styles.modalBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SwapThumbnail({
  item,
  dimmed = false,
}: {
  item: ProductItem;
  dimmed?: boolean;
}) {
  const style = [styles.swapThumbnail, dimmed && styles.swapThumbnailRemoved];
  return item.properties.imageUrl ? (
    <Image
      source={{ uri: item.properties.imageUrl }}
      style={style}
      resizeMode="cover"
    />
  ) : (
    <View style={[...style, styles.thumbnailPlaceholder]} />
  );
}

function SlotHeader({
  slot,
  title,
  itemCount,
  localNodes,
  onSave,
  onDelete,
}: {
  slot: ProductItem | null;
  title: string;
  itemCount: number;
  localNodes: CollectionNode[];
  onSave: (name: string, maxSelections: string, budget: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (!slot) {
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionItemCount}>
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </Text>
      </View>
    );
  }

  const selectedIds = getSelectedIds(slot);
  const maxSelections = slot.properties.maxSelections;
  const budget = slot.properties.budget;

  const products = localNodes.filter(
    (n) => n.parentId === slot.id && n.type !== 'section',
  );
  const selectedProducts = products.filter((p) => selectedIds.includes(p.id));
  const selectedTotal = selectedProducts.reduce((sum, p) => {
    const rawPrice = p.properties.price;
    const parsedPrice = rawPrice
      ? parseFloat(rawPrice.replace(/[^0-9.]/g, ''))
      : NaN;
    const numericPrice = Number.isFinite(parsedPrice) ? parsedPrice : 0;
    return sum + numericPrice;
  }, 0);
  const formattedSelectedTotal =
    formatPrice(String(selectedTotal)) ?? `$${selectedTotal}`;
  const formattedBudget = budget
    ? (formatPrice(String(budget / 100)) ?? `$${budget / 100}`)
    : null;

  const hasProgress = maxSelections || budget;

  return (
    <>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionTitle}>{slot.title ?? title}</Text>
          <View style={styles.slotProgress}>
            {maxSelections ? (
              <Text style={styles.slotProgressText}>
                {selectedIds.length} / {maxSelections} selected
              </Text>
            ) : (
              <Text style={styles.slotProgressText}>
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </Text>
            )}
            {budget ? (
              <Text style={styles.slotProgressText}>
                · {formattedSelectedTotal} / {formattedBudget}
              </Text>
            ) : null}
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setEditing(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="settings-outline" size={16} color="#9ca3af" />
        </TouchableOpacity>
      </View>
      <SlotEditModal
        slot={slot}
        visible={editing}
        onClose={() => setEditing(false)}
        onSave={(name, maxSel, bud) => {
          onSave(name, maxSel, bud);
          setEditing(false);
        }}
        onDelete={() => {
          setEditing(false);
          onDelete();
        }}
      />
    </>
  );
}

const PRESET_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#06b6d4',
];

function EditCollectionModal({
  collection,
  visible,
  onClose,
  onSave,
}: {
  collection: Collection;
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, color: string) => void;
}) {
  const [name, setName] = useState(collection.name ?? '');
  const [color, setColor] = useState(collection.color ?? PRESET_COLORS[0]);

  function handleSave() {
    onSave(name.trim() || collection.name, color);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                style={[
                  styles.swatch,
                  { backgroundColor: c },
                  color === c && styles.swatchSelected,
                ]}
                onPress={() => setColor(c)}
              >
                {color === c && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalActions}>
            <Button
              label="Cancel"
              variant="ghost"
              onPress={onClose}
              style={styles.modalBtn}
            />
            <Button label="Save" onPress={handleSave} style={styles.modalBtn} />
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
  const [url, setUrl] = useState('');

  function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setUrl('');
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
            <Button
              label="Cancel"
              variant="ghost"
              onPress={onClose}
              style={styles.modalBtn}
            />
            <Button
              label="Save"
              onPress={handleSubmit}
              style={styles.modalBtn}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AddSlotModal({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onAdd(trimmed);
      setName('');
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Add Slot</Text>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.fieldInput}
            value={name}
            onChangeText={setName}
            placeholder="Slot name"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
          <View style={styles.modalActions}>
            <Button
              label="Cancel"
              variant="ghost"
              onPress={onClose}
              style={styles.modalBtn}
            />
            <Button
              label="Add"
              onPress={handleAdd}
              isLoading={saving}
              disabled={!name.trim()}
              style={styles.modalBtn}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ProductGridCard({
  item,
  columnWidth,
  isVisible = true,
  onPress,
}: {
  item: ProductItem;
  columnWidth: number;
  isVisible?: boolean;
  onPress: () => void;
}) {
  const imageUrl = item.properties.imageUrl;
  // Measured by the grid before layout — see useImageRatios.
  const imageHeight = Math.round(columnWidth / getImageRatio(imageUrl));

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.gridCard}
    >
      {imageUrl ? (
        <GridImage
          uri={imageUrl}
          style={{ width: '100%', height: imageHeight }}
          isVisible={isVisible}
        />
      ) : (
        <View style={styles.gridImagePlaceholder} />
      )}
      <View style={styles.gridCardInfo}>
        <Text style={styles.gridCardName} numberOfLines={3}>
          {item.title ?? 'Untitled'}
        </Text>
        {item.properties.price ? (
          <Text style={styles.gridCardPrice}>
            {formatPrice(item.properties.price)}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function ReorderProductRow({ item }: { item: ProductItem }) {
  return (
    <SortableItem.Handle style={styles.reorderWholeHandle}>
      <View style={styles.reorderRow}>
        {item.properties.imageUrl ? (
          <GridImage
            uri={item.properties.imageUrl}
            style={styles.reorderThumbnail}
          />
        ) : (
          <View
            style={[styles.reorderThumbnail, styles.thumbnailPlaceholder]}
          />
        )}
        <View style={styles.reorderRowMeta}>
          <Text style={styles.reorderRowTitle} numberOfLines={2}>
            {item.title ?? 'Untitled'}
          </Text>
          {item.properties.price ? (
            <Text style={styles.reorderRowSubtitle}>
              {formatPrice(item.properties.price)}
            </Text>
          ) : null}
        </View>
        <View style={styles.reorderHandle}>
          <Ionicons name="reorder-three-outline" size={20} color="#6b7280" />
        </View>
      </View>
    </SortableItem.Handle>
  );
}

function ReorderGridCard({ item, size }: { item: ProductItem; size: number }) {
  const imageHeight = Math.round(size * 0.72);
  const cardHeight = imageHeight + 106;

  return (
    <View
      style={[styles.reorderGridCard, { width: size, minHeight: cardHeight }]}
    >
      <View style={[styles.reorderGridMedia, { height: imageHeight }]}>
        {item.properties.imageUrl ? (
          <GridImage
            uri={item.properties.imageUrl}
            style={styles.reorderGridImage}
          />
        ) : (
          <View style={styles.reorderGridImagePlaceholder} />
        )}
      </View>
      <View style={styles.reorderGridInfo}>
        <Text style={styles.reorderGridTitle} numberOfLines={3}>
          {item.title ?? 'Untitled'}
        </Text>
        <View style={styles.reorderGridFooter}>
          {item.properties.price ? (
            <Text style={styles.reorderGridPrice}>
              {formatPrice(item.properties.price)}
            </Text>
          ) : (
            <View />
          )}
          <Ionicons name="reorder-three-outline" size={18} color="#6b7280" />
        </View>
      </View>
    </View>
  );
}

function ReorderSlotCard({
  slot,
  localNodes,
}: {
  slot: ProductItem;
  localNodes: CollectionNode[];
}) {
  const itemCount = localNodes.filter(
    (n) => n.parentId === slot.id && n.type !== 'section',
  ).length;

  return (
    <SortableItem.Handle style={styles.reorderWholeHandle}>
      <View style={styles.reorderSlotCard}>
        <View>
          <Text style={styles.reorderSlotEyebrow}>Slot</Text>
          <Text style={styles.reorderSlotTitle}>
            {slot.title ?? 'Untitled'}
          </Text>
          <Text style={styles.reorderSlotSubtitle}>{itemCount} items</Text>
        </View>
        <View style={styles.reorderSlotHandle}>
          <Ionicons name="reorder-three-outline" size={22} color="#4f46e5" />
        </View>
      </View>
    </SortableItem.Handle>
  );
}

// Rough height of a ProductGridCard, for column balancing only. Mirrors the
// gridCard* styles below; being a little off just makes the bottom edge of the
// columns less even.
function estimateProductCardHeight(item: ProductItem, width: number): number {
  const imageHeight = item.properties.imageUrl
    ? width / getImageRatio(item.properties.imageUrl)
    : 130; // gridImagePlaceholder
  const charsPerLine = Math.max(1, width / 7); // ~7pt per char at fontSize 13
  const titleLines = Math.min(
    3, // gridCardName numberOfLines
    Math.max(1, Math.ceil((item.title ?? 'Untitled').length / charsPerLine)),
  );
  const priceHeight = item.properties.price ? 18 : 0;
  return imageHeight + 18 + titleLines * 18 + priceHeight;
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
  const grid = useGridLayout(190);
  // Resolve every image's aspect ratio before laying out, so cards can be
  // assigned to columns by their real heights.
  useImageRatios(items.map((item) => item.properties.imageUrl));

  return (
    <MasonryFlatGrid
      data={items}
      keyExtractor={(item) => item.id}
      columns={grid.columns}
      columnWidth={grid.columnWidth}
      gap={grid.gap}
      estimateHeight={estimateProductCardHeight}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[
        styles.masonryContainer,
        { paddingHorizontal: grid.sideInset },
      ]}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
          />
        ) : undefined
      }
      ListHeaderComponent={header}
      renderItem={(item, { isVisible }) => (
        <ProductGridCard
          item={item}
          columnWidth={grid.columnWidth}
          isVisible={isVisible}
          onPress={() => onPress(item)}
        />
      )}
    />
  );
}

export function CollectionDetailScreen({ route, navigation }: Props) {
  const { collectionId, collectionName } = route.params;
  const { getToken } = useAuth();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const [addingProduct, setAddingProduct] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(
    null,
  );
  const [editingCollection, setEditingCollection] = useState(false);
  const [addingSlot, setAddingSlot] = useState(false);
  const [sharingCollection, setSharingCollection] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [activeReorderTargetId, setActiveReorderTargetId] =
    useState('ungrouped');
  const [isGridReorderReady, setIsGridReorderReady] = useState(false);
  const [refreshQueue, setRefreshQueue] = useState<ProductItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const { viewMode, setViewMode } = useViewMode();
  const reorderGrid = useGridLayout(190);
  const listInset = useReadableInset();
  const { track, syncState, lastSavedAt } = useSyncStatus();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  const [localNodes, setLocalNodes] = useState<CollectionNode[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const refreshSeqRef = useRef(0);
  const pendingWritesRef = useRef<Map<string, number>>(new Map());
  const [swapRequest, setSwapRequest] = useState<SwapRequest | null>(null);

  useEffect(() => {
    // Load cached nodes immediately for fast display
    getCachedNodes(collectionId).then((cached) => {
      if (cached.length > 0) setLocalNodes(cached);
    });
    // Fetch from API
    refresh();
  }, [collectionId]);

  // Refresh when the app comes back to the foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, []);

  useCollectionRealtime({
    collectionId,
    userId: user?.id,
    getToken,
    onUpdate: refresh,
  });

  async function refresh() {
    const seq = ++refreshSeqRef.current;
    try {
      const token = await getTokenWithRetry(getToken);
      if (!token) return;
      const d = await fetchCollectionDetail(token, collectionId);
      // A newer refresh already started; dropping this keeps an older, slower
      // response from overwriting fresher data.
      if (seq !== refreshSeqRef.current) return;
      setDetail(d);
      setLocalNodes((prev) => mergeNodes(prev, d.nodes, pendingWritesRef));
      upsertNodes(d.nodes).catch(() => {}); // background cache update
    } catch (e) {
      console.warn('CollectionDetail refresh error:', e);
    } finally {
      setHasFetched(true);
    }
  }

  // Derived data from localNodes
  const sectionNodes = localNodes
    .filter((n) => n.type === 'section' && !n.parentId)
    .sort((a, b) => a.positionKey.localeCompare(b.positionKey));

  const directItems = localNodes
    .filter((n) => n.type !== 'section' && !n.parentId)
    .sort((a, b) => a.positionKey.localeCompare(b.positionKey));

  const sections: Section[] = [
    ...sectionNodes.map((slot) => ({
      title: slot.title ?? 'Untitled',
      slot,
      data: localNodes
        .filter((n) => n.parentId === slot.id)
        .sort((a, b) => a.positionKey.localeCompare(b.positionKey)),
    })),
    ...(directItems.length > 0
      ? [
          {
            title: sectionNodes.length > 0 ? 'Ungrouped' : null,
            slot: null as ProductItem | null,
            data: directItems,
          },
        ]
      : []),
  ];

  const totalItems = localNodes.filter((n) => n.type !== 'section').length;
  const displayTitle =
    detail?.collection.name ?? collectionName ?? route.params.collectionName;
  const collectionColor = detail?.collection.color ?? '#6366f1';
  const collectionVersion = detail?.collection.version ?? 1;

  // Fallback collection for modals — available even before detail loads
  const collectionForModals: Collection = detail?.collection ?? {
    id: collectionId,
    name: displayTitle,
    color: collectionColor,
    description: null,
    itemCount: totalItems,
    positionKey: '',
    role: 'owner',
    ownerUserId: '',
    updatedAt: new Date().toISOString(),
    previewImages: [],
  };

  const childrenLoading = localNodes.length === 0 && !hasFetched;

  const topBarTop = insets.top + 8;
  const pageHeaderTopPadding = topBarTop + 72;
  const titleFadeStyle = {
    opacity: scrollY.interpolate({
      inputRange: [0, 28, 72],
      outputRange: [1, 0.9, 0.08],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: scrollY.interpolate({
          inputRange: [0, 72],
          outputRange: [0, -22],
          extrapolate: 'clamp',
        }),
      },
    ],
  };
  const metaFadeStyle = {
    opacity: scrollY.interpolate({
      inputRange: [0, 22, 54],
      outputRange: [1, 0.72, 0],
      extrapolate: 'clamp',
    }),
  };
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  );

  const reorderSections: ReorderSectionTarget[] = [
    ...sectionNodes.map((slot) => ({
      id: slot.id,
      title: slot.title ?? 'Untitled',
      slot,
      items: localNodes
        .filter((n) => n.parentId === slot.id)
        .sort((a, b) => a.positionKey.localeCompare(b.positionKey)),
    })),
    ...(directItems.length > 0 || sectionNodes.length === 0
      ? [
          {
            id: 'ungrouped',
            title: sectionNodes.length > 0 ? 'Ungrouped' : 'Items',
            slot: null as ProductItem | null,
            items: directItems,
          },
        ]
      : []),
  ];

  useEffect(() => {
    const validTargets = [
      ...(sectionNodes.length > 1 ? ['slots'] : []),
      ...reorderSections.map((section) => section.id),
    ];
    if (!validTargets.includes(activeReorderTargetId)) {
      setActiveReorderTargetId(validTargets[0] ?? 'ungrouped');
    }
  }, [activeReorderTargetId, reorderSections, sectionNodes.length]);

  // Mutations bump the server-side node version. Without recording it, the next
  // optimistic mutation sends a stale expectedVersion and gets a 409 — which is
  // why a second tap often appeared to do nothing until realtime caught up.
  function applyNodeVersion(nodeId: string, version: number) {
    setLocalNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, version } : n)),
    );
  }

  // While a node has a write in flight its local copy is authoritative — see
  // mergeNodes.
  function markWriteStarted(nodeId: string) {
    const pending = pendingWritesRef.current;
    pending.set(nodeId, (pending.get(nodeId) ?? 0) + 1);
  }

  function markWriteFinished(nodeId: string) {
    const pending = pendingWritesRef.current;
    const next = (pending.get(nodeId) ?? 1) - 1;
    if (next > 0) pending.set(nodeId, next);
    else pending.delete(nodeId);
  }

  // Reorder bumps every affected node's version by one server-side.
  function bumpNodeVersions(nodeIds: string[]) {
    const ids = new Set(nodeIds);
    setLocalNodes((prev) =>
      prev.map((n) => (ids.has(n.id) ? { ...n, version: n.version + 1 } : n)),
    );
  }

  function openProduct(item: ProductItem) {
    const url = item.properties.url;
    if (url) WebBrowser.openBrowserAsync(url);
  }

  function toggleSelected(item: ProductItem, slot: ProductItem) {
    const selectedIds = getSelectedIds(slot);
    const isSelected = selectedIds.includes(item.id);
    const maxSelections = slot.properties.maxSelections;

    if (isSelected) {
      commitSelection(
        slot,
        selectedIds.filter((sid) => sid !== item.id),
      );
      return;
    }

    // maxSelections of 0 (or undefined) means unlimited, matching the web app.
    const atLimit = Boolean(
      maxSelections && selectedIds.length >= maxSelections,
    );
    if (!atLimit) {
      commitSelection(slot, [...selectedIds, item.id]);
      return;
    }

    // At the limit: offer to swap something out rather than silently no-op.
    const currentlySelected = selectedIds
      .map((sid) => localNodes.find((n) => n.id === sid))
      .filter((n): n is ProductItem => Boolean(n));

    if (currentlySelected.length === 0) {
      // Selections point at items that no longer exist (e.g. legacy ids) —
      // replace the whole list rather than leaving the user stuck.
      commitSelection(slot, [item.id]);
      return;
    }

    setSwapRequest({
      slot,
      incoming: item,
      current: currentlySelected,
      selectedIds,
    });
  }

  function confirmSwap(removed: ProductItem) {
    if (!swapRequest) return;
    const { slot, incoming, selectedIds } = swapRequest;
    setSwapRequest(null);
    commitSelection(slot, [
      ...selectedIds.filter((sid) => sid !== removed.id),
      incoming.id,
    ]);
  }

  async function commitSelection(slot: ProductItem, newSelectedIds: string[]) {
    const newProperties = {
      ...slot.properties,
      selectedItemIds: newSelectedIds,
      // Drop the legacy key so the two can't drift apart.
      selectedProductIds: undefined,
    };

    // Optimistic update
    setLocalNodes((prev) =>
      prev.map((n) =>
        n.id === slot.id ? { ...n, properties: newProperties } : n,
      ),
    );

    markWriteStarted(slot.id);
    let error: unknown = null;
    try {
      const token = await getTokenWithRetry(getToken);
      if (!token) return;
      const { version } = await track(
        updateNode(token, collectionId, slot.id, {
          expectedVersion: slot.version,
          properties: newProperties,
        }),
      );
      applyNodeVersion(slot.id, version);
    } catch (e) {
      error = e;
    } finally {
      // Cleared before the recovery refresh below, so that refresh is allowed
      // to replace the optimistic state that failed to save.
      markWriteFinished(slot.id);
    }

    if (error) {
      await refresh();
      Alert.alert(
        "Couldn't save selection",
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }

  function startBulkRefresh() {
    refresh();
    // Queue products in display order: section rank → item rank within section
    const allProducts = sections.flatMap((sec) =>
      sec.data.filter((n) => n.properties.url),
    );
    if (allProducts.length > 0) setRefreshQueue(allProducts);
    setRefreshKey((k) => k + 1);
  }

  async function deleteSlot(slot: ProductItem) {
    // Optimistic: remove slot and its children
    setLocalNodes((prev) =>
      prev.filter((n) => n.id !== slot.id && n.parentId !== slot.id),
    );
    try {
      const token = await getTokenWithRetry(getToken);
      if (!token) return;
      await track(deleteNode(token, collectionId, slot.id, slot.version));
    } catch {
      await refresh();
    }
  }

  async function deleteProduct(item: ProductItem) {
    // Optimistic update
    setLocalNodes((prev) => prev.filter((n) => n.id !== item.id));
    try {
      const token = await getTokenWithRetry(getToken);
      if (!token) return;
      await track(deleteNode(token, collectionId, item.id, item.version));
    } catch {
      await refresh();
    }
  }

  async function handleUpdateProduct(
    item: ProductItem,
    title: string,
    price: string,
    notes: string,
    parentId?: string | null,
  ) {
    const updatedTitle = title || item.title;
    const updatedProperties = {
      ...item.properties,
      price: price || undefined,
      notes: notes || undefined,
    };
    const updatedParentId = parentId !== undefined ? parentId : item.parentId;
    // Optimistic update
    setLocalNodes((prev) =>
      prev.map((n) =>
        n.id === item.id
          ? {
              ...n,
              title: updatedTitle,
              properties: updatedProperties,
              parentId: updatedParentId,
            }
          : n,
      ),
    );
    try {
      const token = await getTokenWithRetry(getToken);
      if (!token) return;
      const { version } = await track(
        updateNode(token, collectionId, item.id, {
          expectedVersion: item.version,
          title: updatedTitle ?? undefined,
          properties: updatedProperties,
          ...(parentId !== undefined ? { parentId } : {}),
        }),
      );
      applyNodeVersion(item.id, version);
    } catch {
      await refresh();
    }
  }

  async function handleUpdateSlot(
    slot: ProductItem,
    name: string,
    maxSelectionsStr: string,
    budgetStr: string,
  ) {
    const updatedTitle = name || slot.title;
    const updatedProperties = {
      ...slot.properties,
      maxSelections: maxSelectionsStr
        ? parseInt(maxSelectionsStr, 10)
        : undefined,
      budget: budgetStr ? Math.round(parseFloat(budgetStr) * 100) : undefined,
    };
    // Optimistic update
    setLocalNodes((prev) =>
      prev.map((n) =>
        n.id === slot.id
          ? { ...n, title: updatedTitle, properties: updatedProperties }
          : n,
      ),
    );
    try {
      const token = await getTokenWithRetry(getToken);
      if (!token) return;
      const { version } = await track(
        updateNode(token, collectionId, slot.id, {
          expectedVersion: slot.version,
          title: updatedTitle ?? undefined,
          properties: updatedProperties,
        }),
      );
      applyNodeVersion(slot.id, version);
    } catch {
      await refresh();
    }
  }

  async function handleUpdateCollection(name: string, color: string) {
    // Optimistic: update detail
    if (detail) {
      setDetail({
        ...detail,
        collection: { ...detail.collection, name, color },
      });
    }
    try {
      const token = await getTokenWithRetry(getToken);
      if (!token) return;
      await track(
        updateCollection(token, collectionId, {
          expectedVersion: collectionVersion,
          name,
          color,
        }),
      );
      await refresh();
    } catch {
      await refresh();
    }
  }

  async function handleAddSlot(name: string) {
    const tempId = `temp-${Date.now()}`;
    const nextPositionKey = `z${Date.now().toString(36)}:${tempId}`;
    const tempNode: CollectionNode = {
      id: tempId,
      collectionId,
      parentId: null,
      type: 'section',
      title: name,
      properties: {},
      positionKey: nextPositionKey,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setLocalNodes((prev) => [...prev, tempNode]);
    try {
      const token = await getTokenWithRetry(getToken);
      if (!token) throw new Error('Not authenticated');
      await track(
        createNode(token, collectionId, {
          type: 'section',
          title: name,
          positionKey: nextPositionKey,
        }),
      );
      await refresh();
    } catch (e) {
      setLocalNodes((prev) => prev.filter((n) => n.id !== tempId));
      const isOffline =
        e instanceof Error &&
        (e.message.includes('offline') ||
          e.message.includes('Network request failed'));
      Alert.alert(
        'Could not add slot',
        isOffline
          ? 'No internet connection. Please try again.'
          : 'Please try again.',
      );
    }
  }

  function confirmDeleteCollection() {
    Alert.alert(
      'Delete collection?',
      `"${displayTitle}" and its contents will be removed from Tote.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getTokenWithRetry(getToken);
              if (!token) throw new Error('Not authenticated');
              await deleteCollection(token, collectionId, collectionVersion);
              navigation.reset({
                index: 0,
                routes: [{ name: 'CollectionList' }],
              });
            } catch (error) {
              Alert.alert(
                'Could not delete collection',
                error instanceof Error ? error.message : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  }

  function openReorderItemTargetPicker() {
    const options = [
      'Cancel',
      ...reorderSections.map((section) => section.title),
    ];

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
      },
    );
  }

  function openCollectionActions() {
    const nextViewModeLabel =
      viewMode === 'list' ? 'Switch to grid' : 'Switch to list';

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [
          'Cancel',
          'Edit collection',
          'Add slot',
          nextViewModeLabel,
          'Reorder items',
          'Delete collection',
        ],
        cancelButtonIndex: 0,
        destructiveButtonIndex: 5,
      },
      (buttonIndex) => {
        if (buttonIndex === 1) {
          setEditingCollection(true);
        } else if (buttonIndex === 2) {
          setAddingSlot(true);
        } else if (buttonIndex === 3) {
          setViewMode((mode) => (mode === 'list' ? 'grid' : 'list'));
        } else if (buttonIndex === 4) {
          setIsReorderMode(true);
        } else if (buttonIndex === 5) {
          confirmDeleteCollection();
        }
      },
    );
  }

  const sortedProductIds = useMemo(() => {
    // Match the visual order: section items by section rank, then item rank within
    // each section, with direct (ungrouped) items appended last
    const ordered: string[] = [];
    for (const sec of sections) {
      for (const item of sec.data) {
        if (item.properties.url) ordered.push(item.id);
      }
    }
    return new Map(ordered.map((id, i) => [id, i]));
  }, [sections]);

  function renderProduct({
    item,
    section,
  }: {
    item: ProductItem;
    section: Section;
  }) {
    const slot = section.slot;
    const selectedIds = slot ? getSelectedIds(slot) : [];
    const isSelected = selectedIds.includes(item.id);

    return (
      <ProductRow
        item={item}
        isSelected={isSelected}
        isRefreshing={refreshQueue[0]?.id === item.id}
        isQueued={refreshQueue.slice(1).some((q) => q.id === item.id)}
        onOpen={() => openProduct(item)}
        onToggleSelected={slot ? () => toggleSelected(item, slot) : null}
        onDelete={() => deleteProduct(item)}
        onEdit={() => setEditingProduct(item)}
        onRefresh={() => setRefreshQueue([item])}
        refreshKey={refreshKey}
        itemIndex={sortedProductIds.get(item.id) ?? 0}
      />
    );
  }

  const activeReorderSection =
    reorderSections.find((section) => section.id === activeReorderTargetId) ??
    reorderSections[0];
  const hasMultipleSlots = sectionNodes.length > 1;
  // The reorder grid is laid out by SortableGrid, which needs explicit pixel
  // dimensions — so it can't reuse MasonryGrid's flex sizing, only its column count.
  const reorderColumns = reorderGrid.columns;
  const gridItemSize = Math.floor(
    (reorderGrid.width - 52 - REORDER_GRID_GAP * (reorderColumns - 1)) /
      reorderColumns,
  );
  const reorderSlotItems: ReorderableBlockItem[] = sectionNodes.map((slot) => ({
    id: slot.id,
    block: slot,
  }));
  const activeReorderItems: ReorderableBlockItem[] =
    activeReorderSection?.items.map((item) => ({
      id: item.id,
      block: item,
    })) ?? [];
  const reorderGridHeight =
    Math.ceil(activeReorderItems.length / reorderColumns) *
      (Math.round(gridItemSize * 0.72) + 106 + REORDER_GRID_GAP) -
    REORDER_GRID_GAP;
  const reorderGridKey = `${activeReorderSection?.id ?? 'none'}:${activeReorderItems
    .map((item) => item.id)
    .join(',')}`;

  useEffect(() => {
    if (
      !(isReorderMode && viewMode === 'grid' && activeReorderItems.length > 0)
    ) {
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

  async function handleSlotDrop(
    _: string,
    __: number,
    positions?: Record<string, number>,
  ) {
    const getPos = (id: string) => positions?.[id] ?? 0;
    const orderedItems = reorderSlotItems
      .slice()
      .sort((a, b) => getPos(a.id) - getPos(b.id));

    const reorderPayload = orderedItems.map((item, i) => ({
      id: item.id,
      positionKey: String(i + 1).padStart(8, '0'),
      expectedVersion: item.block.version,
    }));

    // Optimistic update
    setLocalNodes((prev) => {
      const updated = [...prev];
      reorderPayload.forEach(({ id, positionKey }) => {
        const idx = updated.findIndex((n) => n.id === id);
        if (idx !== -1) updated[idx] = { ...updated[idx], positionKey };
      });
      return updated;
    });

    try {
      const token = await getTokenWithRetry(getToken);
      if (!token) return;
      await track(reorderNodes(token, collectionId, reorderPayload));
      bumpNodeVersions(reorderPayload.map((n) => n.id));
    } catch {
      await refresh();
    }
  }

  async function doActiveSectionReorder(getPos: (id: string) => number) {
    if (!activeReorderSection) return;

    const orderedItems = activeReorderItems
      .slice()
      .sort((a, b) => getPos(a.id) - getPos(b.id));

    const parentId = activeReorderSection.slot?.id ?? null;
    const reorderPayload = orderedItems.map((item, i) => ({
      id: item.id,
      positionKey: String(i + 1).padStart(8, '0'),
      expectedVersion: item.block.version,
    }));

    // Optimistic update
    setLocalNodes((prev) => {
      const updated = [...prev];
      reorderPayload.forEach(({ id, positionKey }) => {
        const idx = updated.findIndex((n) => n.id === id);
        if (idx !== -1) updated[idx] = { ...updated[idx], positionKey };
      });
      return updated;
    });

    try {
      const token = await getTokenWithRetry(getToken);
      if (!token) return;
      await reorderNodes(token, collectionId, reorderPayload);
      bumpNodeVersions(reorderPayload.map((n) => n.id));
    } catch {
      await refresh();
    }
  }

  // List-based drop (SortableItem): positions is Record<string, number>
  async function handleActiveSectionListDrop(
    _: string,
    __: number,
    positions?: Record<string, number>,
  ) {
    await doActiveSectionReorder((id) => positions?.[id] ?? 0);
  }

  // Grid-based drop (SortableGridItem): positions is GridPositions
  async function handleActiveSectionGridDrop(
    _: string,
    __: number,
    positions?: GridPositions,
  ) {
    await doActiveSectionReorder((id) => positions?.[id]?.index ?? 0);
  }

  function renderReorderSlot({
    item,
    id,
    ...rest
  }: SortableRenderItemProps<ReorderableBlockItem>) {
    return (
      <SortableItem
        key={id}
        id={id}
        data={item}
        onDrop={handleSlotDrop}
        {...rest}
      >
        <ReorderSlotCard slot={item.block} localNodes={localNodes} />
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
        onDrop={handleActiveSectionListDrop}
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
        data={item}
        onDrop={handleActiveSectionGridDrop}
        style={{
          width: gridItemSize,
          height: Math.round(gridItemSize * 0.72) + 106,
        }}
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
              {
                backgroundColor: collectionColor,
              },
            ]}
          />
          <Text style={styles.pageMetaText}>{totalItems} items</Text>
          {isReorderMode ? (
            <>
              <Text style={styles.pageMetaDivider}>·</Text>
              <Text style={styles.pageMetaText}>
                {activeReorderTargetId === 'slots' ? 'Slots' : 'Items'}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.pageMetaDivider}>·</Text>
              <Text style={styles.pageMetaText}>{viewMode}</Text>
            </>
          )}
          {syncState !== 'idle' && (
            <>
              <Text style={styles.pageMetaDivider}>·</Text>
              <Text
                style={[
                  styles.pageMetaText,
                  syncState === 'saved' && styles.syncSaved,
                ]}
              >
                {syncState === 'syncing'
                  ? 'Saving...'
                  : syncState === 'saved'
                    ? 'Saved'
                    : lastSavedAt
                      ? `Saved ${fromNow(lastSavedAt)}`
                      : null}
              </Text>
            </>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View
        style={[styles.statusScrim, { height: insets.top + 24 }]}
        pointerEvents="none"
      />
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
                onPress={() => setSharingCollection(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="share-outline" size={18} color="#0f172a" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.floatingCircleButton}
                onPress={openCollectionActions}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={18}
                  color="#0f172a"
                />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {totalItems === 0 && !childrenLoading ? (
        <View style={styles.emptyStateContainer}>
          {pageHeader}
          <Text style={styles.empty}>No items yet</Text>
        </View>
      ) : totalItems === 0 && childrenLoading ? (
        <View style={styles.emptyStateContainer}>
          {pageHeader}
          <ActivityIndicator
            size="large"
            color="#6366f1"
            style={{ marginTop: 40 }}
          />
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
                        activeReorderTargetId === 'slots' &&
                          styles.reorderScopeButtonActive,
                      ]}
                      onPress={() => setActiveReorderTargetId('slots')}
                    >
                      <Text
                        style={[
                          styles.reorderScopeButtonLabel,
                          activeReorderTargetId === 'slots' &&
                            styles.reorderScopeButtonLabelActive,
                        ]}
                      >
                        Slots
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[
                      styles.reorderScopeButton,
                      activeReorderTargetId !== 'slots' &&
                        styles.reorderScopeButtonActive,
                    ]}
                    onPress={() =>
                      setActiveReorderTargetId(
                        activeReorderSection?.id ??
                          reorderSections[0]?.id ??
                          'ungrouped',
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.reorderScopeButtonLabel,
                        activeReorderTargetId !== 'slots' &&
                          styles.reorderScopeButtonLabelActive,
                      ]}
                    >
                      Items
                    </Text>
                  </TouchableOpacity>
                </View>

                {activeReorderTargetId !== 'slots' &&
                reorderSections.length > 1 ? (
                  <TouchableOpacity
                    style={styles.reorderTargetPicker}
                    onPress={openReorderItemTargetPicker}
                  >
                    <Text style={styles.reorderTargetPickerLabel}>Editing</Text>
                    <View style={styles.reorderTargetPickerValueRow}>
                      <Text
                        style={styles.reorderTargetPickerValue}
                        numberOfLines={1}
                      >
                        {activeReorderSection?.title ?? 'Items'}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color="#6b7280" />
                    </View>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {activeReorderTargetId === 'slots' && hasMultipleSlots ? (
              <View style={styles.reorderPanelFlex}>
                <View style={styles.reorderPanelHeader}>
                  <Text style={styles.reorderPanelTitle}>Slots</Text>
                  <Text style={styles.reorderPanelMeta}>
                    {sectionNodes.length} slots
                  </Text>
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
                  <Text style={styles.reorderPanelTitle}>
                    {activeReorderSection.title}
                  </Text>
                  <Text style={styles.reorderPanelMeta}>
                    {activeReorderSection.items.length} items · {viewMode}
                  </Text>
                </View>

                {activeReorderSection.items.length === 0 ? (
                  <View style={styles.reorderEmptyState}>
                    <Text style={styles.reorderEmptyText}>
                      Nothing to reorder here yet.
                    </Text>
                  </View>
                ) : viewMode === 'grid' ? (
                  <View
                    style={[
                      styles.reorderGridFrame,
                      {
                        height: Math.max(
                          reorderGridHeight + gridItemSize,
                          gridItemSize * 2,
                        ),
                      },
                    ]}
                  >
                    {isGridReorderReady ? (
                      <SortableGrid
                        key={reorderGridKey}
                        data={activeReorderItems}
                        renderItem={renderReorderGridItem}
                        itemKeyExtractor={(item) => item.id}
                        dimensions={{
                          columns: reorderColumns,
                          itemWidth: gridItemSize,
                          itemHeight: Math.round(gridItemSize * 0.72) + 106,
                          columnGap: REORDER_GRID_GAP,
                          rowGap: REORDER_GRID_GAP,
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
      ) : viewMode === 'grid' ? (
        <MasonryGrid
          header={pageHeader}
          onScroll={handleScroll}
          onRefresh={startBulkRefresh}
          refreshing={refreshQueue.length > 0}
          items={localNodes
            .filter((n) => n.type !== 'section')
            .sort((a, b) => a.positionKey.localeCompare(b.positionKey))}
          onPress={openProduct}
        />
      ) : (
        <AnimatedSectionList
          sections={sections}
          contentInsetAdjustmentBehavior="never"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyExtractor={(item) => (item as ProductItem).id}
          renderItem={(info) =>
            renderProduct(
              info as unknown as { item: ProductItem; section: Section },
            )
          }
          renderSectionHeader={({ section: rawSection }) => {
            const section = rawSection as unknown as Section;
            return section.title ? (
              <SlotHeader
                slot={section.slot}
                title={section.title}
                itemCount={section.data.length}
                localNodes={localNodes}
                onSave={(name, maxSel, bud) => {
                  if (section.slot)
                    handleUpdateSlot(section.slot, name, maxSel, bud);
                }}
                onDelete={() => {
                  if (section.slot) deleteSlot(section.slot);
                }}
              />
            ) : null;
          }}
          renderSectionFooter={({ section: rawSection }) => {
            const section = rawSection as unknown as Section;
            if (section.data.length === 0 && section.slot !== null) {
              return (
                <View style={styles.slotEmptyState}>
                  <Text style={styles.slotEmptyText}>
                    No items in this slot yet
                  </Text>
                </View>
              );
            }
            return null;
          }}
          ListHeaderComponent={pageHeader}
          contentContainerStyle={[
            styles.list,
            { paddingHorizontal: listInset },
          ]}
          stickySectionHeadersEnabled={false}
          onRefresh={startBulkRefresh}
          refreshing={refreshQueue.length > 0}
        />
      )}

      {sharingCollection && (
        <ShareCollectionSheet
          collection={collectionForModals}
          visible
          onClose={() => setSharingCollection(false)}
        />
      )}
      {editingCollection && (
        <EditCollectionModal
          collection={collectionForModals}
          visible
          onClose={() => setEditingCollection(false)}
          onSave={handleUpdateCollection}
        />
      )}
      <AddSlotModal
        visible={addingSlot}
        onClose={() => setAddingSlot(false)}
        onAdd={handleAddSlot}
      />
      <AddProductModal
        visible={addingProduct}
        onClose={() => setAddingProduct(false)}
        onSubmit={(url) => setPendingUrl(url)}
      />
      {editingProduct && (
        <EditProductModal
          item={editingProduct}
          sections={sectionNodes}
          visible
          onClose={() => setEditingProduct(null)}
          onSave={(title, price, notes, parentId) => {
            if (editingProduct) {
              handleUpdateProduct(
                editingProduct,
                title,
                price,
                notes,
                parentId,
              );
            }
          }}
        />
      )}
      <SelectionSwapSheet
        request={swapRequest}
        onCancel={() => setSwapRequest(null)}
        onConfirm={confirmSwap}
      />
      {refreshQueue.length > 0 && (
        <ProductRefresher
          key={refreshQueue[0].id}
          item={refreshQueue[0]}
          collectionId={collectionId}
          getToken={getToken}
          onDone={(updated) => {
            if (updated && refreshQueue[0]) {
              const itemId = refreshQueue[0].id;
              setLocalNodes((prev) =>
                prev.map((n) => (n.id === itemId ? { ...n, ...updated } : n)),
              );
            }
            setRefreshQueue((q) => q.slice(1));
          }}
        />
      )}
      {pendingUrl && (
        <SaveProductSheet
          key={pendingUrl}
          url={pendingUrl}
          onDismiss={() => {
            setPendingUrl(null);
            refresh();
          }}
          defaultCollectionId={collectionId}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  statusScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 18,
    backgroundColor: '#f8fafc',
  },
  floatingTopBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floatingTopBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  floatingCircleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    shadowColor: '#0f172a',
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  donePillButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
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
    fontWeight: '700',
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  pageTitle: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.8,
  },
  pageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  pageMetaText: { fontSize: 14, color: '#6b7280', textTransform: 'capitalize' },
  pageMetaDivider: { fontSize: 14, color: '#cbd5e1' },
  syncSaved: { color: '#22c55e' },
  list: { paddingHorizontal: 20, paddingBottom: 40, backgroundColor: '#fff' },
  emptyStateContainer: { flex: 1, backgroundColor: '#fff' },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  sectionItemCount: {
    fontSize: 13,
    color: '#6b7280',
  },
  slotProgress: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  slotProgressText: { fontSize: 13, color: '#6b7280' },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
    marginBottom: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#eef2f7',
    backgroundColor: '#f8fafc',
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  thumbnailPlaceholder: { backgroundColor: '#f3f4f6' },
  productInfo: { flex: 1 },
  productName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111',
    lineHeight: 20,
  },
  productPrice: { fontSize: 13, color: '#6b7280', marginTop: 3 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  empty: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 60,
    fontSize: 15,
  },
  sectionHeaderLeft: { flex: 1, flexDirection: 'column', gap: 2 },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  modalSheet: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 16,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
  },
  fieldTextarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  modalBtn: { flex: 1 },

  // Selection swap sheet
  swapSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginTop: 6,
  },
  swapList: { maxHeight: 264 },
  // Green = joining the selection, rose = leaving it. Keeping the two on
  // opposite sides of the colour wheel is what makes the swap readable at a
  // glance; don't collapse them back onto the app's indigo accent.
  swapLabelIn: { color: '#047857' },
  swapLabelOut: { color: '#be123c' },
  swapIncomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
  },
  swapOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  swapOptionRowActive: { borderColor: '#fda4af', backgroundColor: '#fff1f2' },
  swapThumbnail: { width: 44, height: 44, borderRadius: 8 },
  swapThumbnailRemoved: { opacity: 0.5 },
  swapRowInfo: { flex: 1, gap: 2 },
  swapRowTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  swapRowTitleRemoved: {
    color: '#9f1239',
    textDecorationLine: 'line-through',
  },
  swapRowPrice: { fontSize: 13, color: '#6b7280' },
  swapBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapBadgeIn: { backgroundColor: '#059669' },
  swapBadgeOut: { backgroundColor: '#e11d48' },
  swapRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapRadioActive: { backgroundColor: '#e11d48', borderColor: '#e11d48' },

  // Slot picker in EditProductModal
  slotPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
  },
  slotPickerValue: { fontSize: 15, color: '#111827' },
  slotPickerDropdown: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  slotPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  slotPickerOptionSelected: { backgroundColor: '#eef2ff' },
  slotPickerOptionText: { fontSize: 15, color: '#374151' },
  slotPickerOptionTextSelected: { color: '#6366f1', fontWeight: '600' },
  slotEmptyState: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  slotEmptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: { borderWidth: 2.5, borderColor: 'rgba(0,0,0,0.2)' },
  modalDeletePill: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDeletePillArmed: {
    borderColor: '#fca5a5',
    backgroundColor: '#fee2e2',
  },
  modalDeleteText: { fontSize: 14, color: '#dc2626', fontWeight: '600' },
  modalDeleteTextArmed: { color: '#b91c1c' },
  leftActions: { flexDirection: 'row', width: 160 },
  editActionInner: {
    width: 80,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editActionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  refreshActionInner: {
    width: 80,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshActionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  deleteAction: { width: 80, backgroundColor: '#ef4444' },
  deleteActionInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  productRowQueued: { opacity: 0.5 },
  thumbnailRefreshing: { opacity: 0.4 },
  thumbnailSpinner: {
    position: 'absolute',
    inset: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hidden: { width: 0, height: 0, overflow: 'hidden' },
  reorderModeContainer: {
    flex: 1,
    paddingBottom: 16,
    backgroundColor: '#f8fafc',
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
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  reorderScopeButton: {
    minWidth: 76,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderScopeButtonActive: {
    backgroundColor: '#111827',
  },
  reorderScopeButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  reorderScopeButtonLabelActive: {
    color: '#fff',
  },
  reorderTargetPicker: {
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  reorderTargetPickerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  reorderTargetPickerValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reorderTargetPickerValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  reorderPanelFlex: {
    flex: 1,
    minHeight: 0,
    overflow: 'visible',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reorderPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reorderPanelTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  reorderPanelMeta: {
    fontSize: 13,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  reorderSlotsList: { paddingTop: 2, paddingBottom: 14 },
  reorderItemsList: { paddingBottom: 20 },
  reorderSlotCard: {
    height: 88,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reorderSlotEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  reorderSlotTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  reorderSlotSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  reorderSlotHandle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ff',
  },
  reorderWholeHandle: {
    width: '100%',
  },
  reorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 84,
    marginBottom: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reorderThumbnail: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
  },
  reorderRowMeta: { flex: 1 },
  reorderRowTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  reorderRowSubtitle: { marginTop: 4, fontSize: 13, color: '#6b7280' },
  reorderHandle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  reorderEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderEmptyText: { fontSize: 14, color: '#9ca3af' },
  reorderGridFrame: {
    overflow: 'visible',
  },
  reorderGrid: {
    backgroundColor: 'transparent',
  },
  reorderGridContainer: { paddingTop: 4, paddingBottom: 40 },
  reorderGridCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reorderGridMedia: {
    width: '100%',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  reorderGridImage: {
    width: '100%',
    height: '100%',
  },
  reorderGridImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e5e7eb',
    borderRadius: 14,
  },
  reorderGridInfo: { flex: 1, padding: 12, gap: 8 },
  reorderGridTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 18,
  },
  reorderGridFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reorderGridPrice: { fontSize: 13, color: '#6b7280' },
  masonryContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    backgroundColor: '#f8fafc',
  },
  gridCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    overflow: 'hidden',
  },
  gridImagePlaceholder: { height: 130, backgroundColor: '#e5e7eb' },
  gridCardInfo: { padding: 8, paddingBottom: 10 },
  gridCardName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111',
    lineHeight: 18,
  },
  gridCardPrice: { fontSize: 12, color: '#6b7280', marginTop: 3 },
});
