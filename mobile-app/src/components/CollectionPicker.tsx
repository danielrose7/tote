import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Collection, CollectionNode } from '../lib/api';

export interface Selection {
  collection: Collection;
  slot?: CollectionNode;
}

interface Props {
  collections: Collection[];
  sections: Record<string, CollectionNode[]>;
  onSelect: (selection: Selection) => void;
  onCreateCollection: (name: string) => void;
  onCreateSlot: (collection: Collection, slotName: string) => void;
  defaultExpandedId?: string;
}

export function CollectionPicker({
  collections,
  sections,
  onSelect,
  onCreateCollection,
  onCreateSlot,
  defaultExpandedId,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(
    defaultExpandedId ?? null,
  );
  const [newSlotForId, setNewSlotForId] = useState<string | null>(null);
  const [newSlotName, setNewSlotName] = useState('');
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  function handleCreateSlot(collection: Collection) {
    const name = newSlotName.trim();
    if (!name) return;
    onCreateSlot(collection, name);
    setNewSlotForId(null);
    setNewSlotName('');
  }

  function handleCreateCollection() {
    const name = newCollectionName.trim();
    if (!name) return;
    onCreateCollection(name);
    setNewCollectionName('');
    setShowNewCollection(false);
  }

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const visibleCollections = normalizedSearch
    ? collections.filter((c) =>
        (c.name ?? '').toLocaleLowerCase().includes(normalizedSearch),
      )
    : collections;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.sectionLabel}>Save to</Text>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Filter collections"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {visibleCollections.map((collection) => {
        const id = collection.id;
        const isExpanded = expandedId === id;
        const isAddingSlot = newSlotForId === id;
        const slots = (sections[id] ?? []).filter(
          (n) => n.type === 'section' && !n.parentId,
        );

        const isDefault = id === defaultExpandedId;
        const sectionsReady = id in sections;
        const hasSlots = sectionsReady && slots.length > 0;

        return (
          <View key={id}>
            <TouchableOpacity
              style={[
                styles.collectionRow,
                isDefault && styles.collectionRowDefault,
              ]}
              onPress={() => {
                if (!sectionsReady) return;
                hasSlots ? setExpandedId(id) : onSelect({ collection });
              }}
            >
              <View
                style={[
                  styles.colorDot,
                  {
                    backgroundColor: collection.color ?? '#6366f1',
                  },
                ]}
              />
              <Text
                style={[
                  styles.collectionName,
                  isDefault && styles.collectionNameDefault,
                ]}
              >
                {collection.name}
              </Text>
              {isDefault && (
                <Ionicons name="checkmark" size={16} color="#6366f1" />
              )}
              {hasSlots && (
                <Text style={styles.chevron}>{isExpanded ? '▾' : '›'}</Text>
              )}
            </TouchableOpacity>

            {isExpanded && (
              <>
                {/* Existing slots */}
                {slots.map((slot) => (
                  <TouchableOpacity
                    key={slot.id}
                    style={styles.slotRow}
                    onPress={() => onSelect({ collection, slot })}
                  >
                    <Text style={styles.slotName}>{slot.title}</Text>
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
                      setNewSlotName('');
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

      {visibleCollections.length === 0 && normalizedSearch ? (
        <Text style={styles.emptyText}>No matching collections</Text>
      ) : null}

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
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleCreateCollection}
          >
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
    backgroundColor: '#fff',
  },
  contentContainer: {
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
    gap: 10,
  },
  collectionRowDefault: {
    backgroundColor: 'rgba(99, 102, 241, 0.07)',
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
    color: '#111827',
  },
  collectionNameDefault: {
    color: '#6366f1',
    fontWeight: '600',
  },
  chevron: {
    fontSize: 18,
    color: '#9ca3af',
  },
  slotRow: {
    paddingVertical: 11,
    paddingLeft: 36,
    paddingRight: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  slotName: {
    fontSize: 15,
    color: '#374151',
  },
  noSlotText: {
    fontSize: 15,
    color: '#9ca3af',
  },
  newSlotButtonText: {
    fontSize: 15,
    color: '#6366f1',
    fontWeight: '500',
  },
  newSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 36,
    paddingRight: 4,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  newSlotInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 15,
    color: '#111827',
  },
  addButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  newCollectionButton: {
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  newCollectionButtonText: {
    fontSize: 15,
    color: '#6366f1',
    fontWeight: '500',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
});
