import React, { useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  SectionList,
  Animated,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCoState } from "jazz-tools/expo";
import { Block } from "@tote/schema";
import * as WebBrowser from "expo-web-browser";
import { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "CollectionDetail">;

function ProductRow({
  item,
  onOpen,
  onDelete,
}: {
  item: ProductItem;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={(progress) => {
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [80, 0],
          extrapolate: "clamp",
        });
        return (
          <Animated.View style={[styles.deleteAction, { transform: [{ translateX }] }]}>
            <TouchableOpacity
              style={styles.deleteActionInner}
              onPress={onDelete}
            >
              <Text style={styles.deleteActionText}>Remove</Text>
            </TouchableOpacity>
          </Animated.View>
        );
      }}
      rightThreshold={40}
      overshootRight={false}
    >
      <TouchableOpacity
        style={styles.productRow}
        onPress={onOpen}
        activeOpacity={0.7}
      >
        {item.productData?.imageUrl ? (
          <Image
            source={{ uri: item.productData.imageUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name ?? "Untitled"}
          </Text>
          {item.productData?.price ? (
            <Text style={styles.productPrice}>{item.productData.price}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

type ProductItem = typeof Block.prototype;

type Section = {
  title: string | null; // null = ungrouped products
  data: ProductItem[];
};

export function CollectionDetailScreen({ route }: Props) {
  const { collectionId } = route.params;

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

  // Separate direct products from slots
  const directProducts = children.filter(
    (b): b is ProductItem => b?.type === "product"
  );
  const slots = children.filter((b): b is ProductItem => b?.type === "slot");

  const sections: Section[] = [];

  for (const slot of slots) {
    const slotProducts =
      slot.children?.filter(
        (b): b is ProductItem => b?.type === "product"
      ) ?? [];
    if (slotProducts.length > 0) {
      sections.push({ title: slot.name ?? "Untitled", data: slotProducts });
    }
  }

  if (directProducts.length > 0) {
    sections.push({ title: slots.length > 0 ? "Ungrouped" : null, data: directProducts });
  }

  const totalItems =
    directProducts.length +
    slots.reduce((sum, s) => sum + (s.children?.length ?? 0), 0);

  function openProduct(item: ProductItem) {
    const url = item.productData?.url;
    if (url) WebBrowser.openBrowserAsync(url);
  }

  function deleteProduct(item: ProductItem) {
    // Remove from whichever parent contains it
    const parent = slots.find((s) =>
      s.children?.some((c) => c?.$jazz?.id === item.$jazz.id)
    );
    const list = parent ? parent.children : collection.children;
    if (!list) return;
    const idx = list.findIndex((c) => c?.$jazz?.id === item.$jazz.id);
    if (idx !== -1) list.$jazz.splice(idx, 1);
  }

  function renderProduct({ item }: { item: ProductItem }) {
    return (
      <ProductRow
        item={item}
        onOpen={() => openProduct(item)}
        onDelete={() => deleteProduct(item)}
      />
    );
  }

  function renderSectionHeader({ section }: { section: Section }) {
    if (!section.title) return null;
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
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
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
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
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  itemCount: {
    fontSize: 13,
    color: "#9ca3af",
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f3f4f6",
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  thumbnailPlaceholder: {
    backgroundColor: "#f3f4f6",
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#111",
    lineHeight: 20,
  },
  productPrice: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 3,
  },
  empty: {
    textAlign: "center",
    color: "#9ca3af",
    marginTop: 60,
    fontSize: 15,
  },
  deleteAction: {
    width: 80,
    backgroundColor: "#ef4444",
  },
  deleteActionInner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteActionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
