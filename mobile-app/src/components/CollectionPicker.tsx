import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Block } from "@tote/schema";

type CollectionBlock = typeof Block.prototype;
type SlotBlock = typeof Block.prototype;

export interface Selection {
  collection: CollectionBlock;
  slot?: SlotBlock;
}

interface Props {
  collections: (CollectionBlock | null)[];
  onSelect: (selection: Selection) => void;
  onCreateCollection: (name: string) => void;
  onCreateSlot: (collection: CollectionBlock, slotName: string) => void;
  defaultExpandedId?: string;
}

export function CollectionPicker({ collections, onSelect, onCreateCollection, onCreateSlot, defaultExpandedId }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(defaultExpandedId ?? null);
  const [newSlotForId, setNewSlotForId] = useState<string | null>(null);
  const [newSlotName, setNewSlotName] = useState("");
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");

  const validCollections = collections.filter(
    (c): c is CollectionBlock => c !== null && c.type === "collection"
  );

  function handleCreateSlot(collection: CollectionBlock) {
    const name = newSlotName.trim();
    if (!name) return;
    onCreateSlot(collection, name);
    setNewSlotForId(null);
    setNewSlotName("");
  }

  function handleCreateCollection() {
    const name = newCollectionName.trim();
    if (!name) return;
    onCreateCollection(name);
    setNewCollectionName("");
    setShowNewCollection(false);
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionLabel}>Save to</Text>

      {validCollections.map((collection) => {
        const id = collection.$jazz.id;
        const isExpanded = expandedId === id;
        const isAddingSlot = newSlotForId === id;
        const slots = (collection.children?.filter(
          (c): c is SlotBlock => c !== null && c.type === "slot"
        ) ?? []);

        const isDefault = id === defaultExpandedId;

        return (
          <View key={id}>
            {/* Collection row — always tappable to expand */}
            <TouchableOpacity
              style={[styles.collectionRow, isDefault && styles.collectionRowDefault]}
              onPress={() => setExpandedId(isExpanded ? null : id)}
            >
              <View
                style={[
                  styles.colorDot,
                  { backgroundColor: collection.collectionData?.color ?? "#6366f1" },
                ]}
              />
              <Text style={[styles.collectionName, isDefault && styles.collectionNameDefault]}>
                {collection.name}
              </Text>
              {isDefault && <Ionicons name="checkmark" size={16} color="#6366f1" />}
              <Text style={styles.chevron}>{isExpanded ? "▾" : "›"}</Text>
            </TouchableOpacity>

            {isExpanded && (
              <>
                {/* Existing slots */}
                {slots.map((slot) => (
                  <TouchableOpacity
                    key={slot.$jazz.id}
                    style={styles.slotRow}
                    onPress={() => onSelect({ collection, slot })}
                  >
                    <Text style={styles.slotName}>{slot.name}</Text>
                  </TouchableOpacity>
                ))}

                {/* No slot option */}
                <TouchableOpacity
                  style={styles.slotRow}
                  onPress={() => onSelect({ collection })}
                >
                  <Text style={styles.noSlotText}>No slot</Text>
                </TouchableOpacity>

                {/* New slot */}
                {isAddingSlot ? (
                  <View style={styles.newSlotRow}>
                    <TextInput
                      style={styles.newSlotInput}
                      placeholder="Slot name"
                      placeholderTextColor="#9ca3af"
                      value={newSlotName}
                      onChangeText={setNewSlotName}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={() => handleCreateSlot(collection)}
                    />
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => handleCreateSlot(collection)}
                    >
                      <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.slotRow}
                    onPress={() => {
                      setNewSlotForId(id);
                      setNewSlotName("");
                    }}
                  >
                    <Text style={styles.newSlotButtonText}>+ New slot</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        );
      })}

      {/* New collection */}
      {showNewCollection ? (
        <View style={styles.newSlotRow}>
          <TextInput
            style={styles.newSlotInput}
            placeholder="Collection name"
            placeholderTextColor="#9ca3af"
            value={newCollectionName}
            onChangeText={setNewCollectionName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreateCollection}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleCreateCollection}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.newCollectionButton}
          onPress={() => setShowNewCollection(true)}
        >
          <Text style={styles.newCollectionButtonText}>+ New collection</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  collectionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f3f4f6",
    gap: 10,
  },
  collectionRowDefault: {
    backgroundColor: "rgba(99, 102, 241, 0.07)",
    marginHorizontal: -4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  colorDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  collectionName: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
  },
  collectionNameDefault: {
    color: "#6366f1",
    fontWeight: "600",
  },
  chevron: {
    fontSize: 18,
    color: "#9ca3af",
  },
  slotRow: {
    paddingVertical: 11,
    paddingLeft: 36,
    paddingRight: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f3f4f6",
  },
  slotName: {
    fontSize: 15,
    color: "#374151",
  },
  noSlotText: {
    fontSize: 15,
    color: "#9ca3af",
  },
  newSlotButtonText: {
    fontSize: 15,
    color: "#6366f1",
    fontWeight: "500",
  },
  newSlotRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 36,
    paddingRight: 4,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f3f4f6",
  },
  newSlotInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 15,
    color: "#111827",
  },
  addButton: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  newCollectionButton: {
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  newCollectionButtonText: {
    fontSize: 15,
    color: "#6366f1",
    fontWeight: "500",
  },
});
