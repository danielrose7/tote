/**
 * Share Extension entry point
 *
 * This renders inside the iOS share sheet when the user taps "Tote"
 * from Safari or any app. It shows a collection picker and saves the URL.
 */

import "./polyfills";

import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { close, useShareExtensionUrl } from "expo-share-extension";
import { Providers } from "./src/providers";
import { useAccount, useIsAuthenticated } from "jazz-tools/expo";
import { JazzAccount, Block, BlockList } from "@tote/schema";
import { Group } from "jazz-tools";

function SaveToCollection() {
  const url = useShareExtensionUrl();
  const { me } = useAccount(JazzAccount, {
    resolve: { root: { blocks: { $each: { children: true } } } },
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const collections =
    me?.root?.blocks?.filter(
      (b: typeof Block.prototype | null) => b?.type === "collection",
    ) ?? [];

  async function handleSave(collection: typeof Block.prototype) {
    if (!url || !me || saving) return;
    setSaving(true);

    try {
      // Determine the group — use the collection's sharing group or owner
      const groupId = collection.collectionData?.sharingGroupId;
      const owner = groupId
        ? (Group.load(groupId as any) as any)
        : me;

      const product = Block.create(
        {
          type: "product",
          name: url, // Will be enriched later with OG title
          productData: { url },
          createdAt: new Date(),
        },
        { owner: owner ?? me },
      );

      if (collection.children) {
        collection.children.push(product);
      } else {
        const children = BlockList.create([product], {
          owner: owner ?? me,
        });
        collection.$jazz.set("children", children);
      }

      setSaved(true);
      // Auto-close after brief feedback
      setTimeout(() => close(), 800);
    } catch {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <View style={styles.centered}>
        <Text style={styles.successText}>Saved!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Save to Tote</Text>
        <TouchableOpacity onPress={() => close()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {url && (
        <Text style={styles.url} numberOfLines={1}>
          {url}
        </Text>
      )}

      <Text style={styles.sectionLabel}>Choose a collection</Text>

      <FlatList
        data={collections}
        keyExtractor={(item) => item?.$jazz?.id ?? ""}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.collectionRow}
            onPress={() => handleSave(item)}
            disabled={saving}
          >
            <View
              style={[
                styles.colorDot,
                {
                  backgroundColor:
                    item?.collectionData?.color ?? "#6366f1",
                },
              ]}
            />
            <Text style={styles.collectionName}>{item?.name}</Text>
            {saving && <ActivityIndicator size="small" />}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No collections found. Open Tote to get started.
          </Text>
        }
      />
    </View>
  );
}

function NotSignedIn() {
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>Tote</Text>
      <Text style={styles.subtitle}>Open Tote to sign in first</Text>
      <TouchableOpacity style={styles.button} onPress={() => close()}>
        <Text style={styles.buttonText}>OK</Text>
      </TouchableOpacity>
    </View>
  );
}

function ShareAuthScreen() {
  const isAuthenticated = useIsAuthenticated();

  if (isAuthenticated) {
    return <SaveToCollection />;
  }

  return <NotSignedIn />;
}

export default function ShareExtension() {
  return (
    <Providers>
      <ShareAuthScreen />
    </Providers>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  centered: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  cancel: {
    color: "#6366f1",
    fontSize: 16,
  },
  url: {
    fontSize: 13,
    color: "#9ca3af",
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  collectionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    marginBottom: 8,
    gap: 10,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  collectionName: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    marginTop: 8,
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  successText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#22c55e",
  },
  empty: {
    textAlign: "center",
    color: "#9ca3af",
    marginTop: 30,
    fontSize: 15,
  },
});
