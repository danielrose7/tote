/**
 * Share Extension entry point.
 *
 * The Swift bridge writes the URL to pendingUrls in the App Group before
 * this JS runs. This component reads the cached collections (written by the
 * main app) and lets the user pick a collection/section without leaving Safari.
 *
 * On pick: calls POST /api/v2/capture directly using the long-lived API key
 *   stored in Keychain by the main app, then closes immediately.
 * On close without pick: the URL stays in pendingUrls and the main app will
 *   present SaveProductSheet as the normal flow.
 *
 * Important: do NOT import from "expo-share-extension" or "@clerk/expo" here.
 * Both trigger JavaScriptActor / ClerkViewFactory crashes in extension context.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppRegistry,
  Dimensions,
  Easing,
  Image,
  NativeModules,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const { AppGroupModule } = NativeModules;

const SCREEN_WIDTH = Dimensions.get('window').width;

/** Show the filter field only once scanning the list stops being trivial. */
const SEARCH_THRESHOLD = 8;

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

type Section = { id: string; name: string };
type CaptureCollection = {
  id: string;
  name: string;
  color: string | null;
  role: 'owner' | 'admin' | 'editor';
  sections: Section[];
  /** Added by the main app when it writes the cache; absent on older caches. */
  itemCount?: number;
  previewImages?: string[];
};

function hostname(u: string): string {
  const match = /^https?:\/\/([^/?#]+)/i.exec(u);
  return match ? match[1].replace(/^www\./, '') : '';
}

/**
 * Disclosure chevron, drawn as a bordered corner rather than a text glyph so it
 * sits on an exact optical centre at any size and needs no font. It points
 * right and stays there: the row navigates, it does not expand.
 */
function Chevron({ back }: { back?: boolean }) {
  return (
    <View style={styles.chevronBox}>
      <View
        style={[styles.chevron, back ? styles.chevronBack : styles.chevronNext]}
      />
    </View>
  );
}

/**
 * Collection thumbnail — a mosaic of up to three preview images, mirroring the
 * collection cards in the main app. Falls back to a neutral monogram tile.
 */
function CollectionThumb({ images, name }: { images: string[]; name: string }) {
  const [failed, setFailed] = useState<Record<string, true>>({});
  const usable = images.filter((url) => url && !failed[url]).slice(0, 3);
  const markFailed = (url: string) =>
    setFailed((prev) => ({ ...prev, [url]: true }));

  if (usable.length === 0) {
    return (
      <View style={[styles.thumb, styles.thumbFallback]}>
        <Text allowFontScaling={false} style={styles.thumbMonogram}>
          {(name.trim()[0] || '?').toUpperCase()}
        </Text>
      </View>
    );
  }

  if (usable.length === 1) {
    return (
      <View style={styles.thumb}>
        <Image
          source={{ uri: usable[0] }}
          style={styles.thumbFull}
          onError={() => markFailed(usable[0])}
        />
      </View>
    );
  }

  // 2 images: split down the middle. 3: large left, two stacked right.
  return (
    <View style={[styles.thumb, styles.thumbRow]}>
      <Image
        source={{ uri: usable[0] }}
        style={usable.length === 2 ? styles.thumbHalf : styles.thumbLarge}
        onError={() => markFailed(usable[0])}
      />
      <View style={styles.thumbDivider} />
      {usable.length === 2 ? (
        <Image
          source={{ uri: usable[1] }}
          style={styles.thumbHalf}
          onError={() => markFailed(usable[1])}
        />
      ) : (
        <View style={styles.thumbStack}>
          <Image
            source={{ uri: usable[1] }}
            style={styles.thumbSmall}
            onError={() => markFailed(usable[1])}
          />
          <View style={styles.thumbDividerH} />
          <Image
            source={{ uri: usable[2] }}
            style={styles.thumbSmall}
            onError={() => markFailed(usable[2])}
          />
        </View>
      )}
    </View>
  );
}

type PreprocessingResults = {
  title?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  price?: string | null;
  currency?: string | null;
  brand?: string | null;
};

type Props = {
  url?: string;
  text?: string;
  title?: string;
  preprocessingResults?: PreprocessingResults;
};

function ShareExtension(props: Props) {
  const url = props.url || props.text;
  const pre = props.preprocessingResults;
  const title = pre?.title || props.title;

  const [signedIn, setSignedIn] = useState<boolean | null>(null); // null = loading
  const [collections, setCollections] = useState<CaptureCollection[] | null>(
    null,
  );
  const [query, setQuery] = useState('');
  /**
   * The collection whose sections are on screen. Kept set through the back
   * animation so the outgoing pane still has content to draw.
   */
  const [sectionsFor, setSectionsFor] = useState<CaptureCollection | null>(
    null,
  );
  const slide = useRef(new Animated.Value(0)).current; // 0 = list, 1 = sections
  const [saveState, setSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const lastPickArgs = useRef<{
    collectionId: string;
    sectionId?: string;
  } | null>(null);
  const picking = useRef(false);

  useEffect(() => {
    async function load() {
      try {
        const json = await AppGroupModule?.getCollectionsCache?.();
        if (json == null) {
          // Cache absent means the user is signed out (cleared on sign-out)
          setSignedIn(false);
          setCollections([]);
        } else {
          setSignedIn(true);
          setCollections(JSON.parse(json) as CaptureCollection[]);
        }
      } catch {
        setSignedIn(false);
        setCollections([]);
      }
    }
    load();
  }, []);

  function handleClose() {
    AppGroupModule?.close?.();
  }

  /** Opens the main app (e.g. so a signed-out user can sign in) and closes the sheet. */
  function handleOpenHostApp() {
    AppGroupModule?.openHostApp?.('');
  }

  function openSections(col: CaptureCollection) {
    setSectionsFor(col);
    Animated.timing(slide, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function closeSections() {
    Animated.timing(slide, {
      toValue: 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setSectionsFor(null);
    });
  }

  async function handlePick(collectionId: string, sectionId?: string) {
    if (picking.current) return;
    picking.current = true;
    lastPickArgs.current = { collectionId, sectionId };
    setSaveState('saving');

    let didSave = false;
    try {
      // Always enqueue — the main app saves immediately then enriches in the background
      const capture = JSON.stringify({
        url,
        title,
        collectionId,
        sectionId,
        imageUrl: pre?.imageUrl ?? undefined,
        price: pre?.price ?? undefined,
        currency: pre?.currency ?? undefined,
        description: pre?.description ?? undefined,
      });
      await AppGroupModule?.enqueuePendingCapture?.(capture);
      // Clear the legacy URL queue so the main app doesn't also show SaveProductSheet
      AppGroupModule?.clearPendingUrls?.();
      didSave = true;
    } catch {
      didSave = false;
    }

    if (didSave) {
      setSaveState('saved');
      setTimeout(() => AppGroupModule?.close?.(), 800);
    } else {
      picking.current = false;
      setSaveState('error');
    }
  }

  if (!url) {
    return (
      <View style={styles.centered}>
        <Text allowFontScaling={false} style={styles.title}>
          No link found
        </Text>
      </View>
    );
  }

  if (saveState === 'saving') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#111111" />
      </View>
    );
  }

  if (saveState === 'saved') {
    return (
      <View style={styles.centered}>
        <Text allowFontScaling={false} style={styles.checkmark}>
          ✓
        </Text>
        <Text allowFontScaling={false} style={styles.title}>
          Added to Tote
        </Text>
      </View>
    );
  }

  if (saveState === 'error') {
    return (
      <View style={styles.centered}>
        <Text allowFontScaling={false} style={styles.errorTitle}>
          Could not save
        </Text>
        <Text allowFontScaling={false} style={styles.subtitle}>
          Check your connection and try again.
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            if (lastPickArgs.current) {
              handlePick(
                lastPickArgs.current.collectionId,
                lastPickArgs.current.sectionId,
              );
            }
          }}
        >
          <Text allowFontScaling={false} style={styles.retryBtnText}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Still loading cache
  if (collections === null) {
    return (
      <View style={styles.centered}>
        <Text allowFontScaling={false} style={styles.loading}>
          Loading…
        </Text>
      </View>
    );
  }

  // Cache absent — user is signed out
  if (signedIn === false) {
    return (
      <View style={styles.centered}>
        <Text allowFontScaling={false} style={styles.title}>
          Sign in to save
        </Text>
        <Text allowFontScaling={false} style={styles.subtitle}>
          Open Tote and sign in, then try sharing again.
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={handleOpenHostApp}>
          <Text allowFontScaling={false} style={styles.retryBtnText}>
            Open Tote
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Signed in but no collections yet — fall back to confirmation
  if (collections.length === 0) {
    return (
      <View style={styles.centered}>
        <Text allowFontScaling={false} style={styles.checkmark}>
          ✓
        </Text>
        <Text allowFontScaling={false} style={styles.title}>
          Added to Tote
        </Text>
        <Text allowFontScaling={false} style={styles.subtitle}>
          Open Tote to assign to a collection
        </Text>
      </View>
    );
  }

  const filtered =
    query.trim().length > 0
      ? collections.filter((c) =>
          c.name.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : collections;
  const showSearch = collections.length >= SEARCH_THRESHOLD;

  // The list pane slides out to the left with a slight parallax as the section
  // pane comes in from the right — the standard iOS push, so back feels native.
  const listTransform = {
    transform: [
      {
        translateX: slide.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -SCREEN_WIDTH * 0.28],
        }),
      },
    ],
    opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }),
  };
  const sectionTransform = {
    transform: [
      {
        translateX: slide.interpolate({
          inputRange: [0, 1],
          outputRange: [SCREEN_WIDTH, 0],
        }),
      },
    ],
  };

  const itemPreview =
    title || url ? (
      <View style={styles.itemPreview}>
        {pre?.imageUrl ? (
          <Image
            source={{ uri: pre.imageUrl }}
            style={styles.itemImage}
            resizeMode="cover"
          />
        ) : null}
        <View style={styles.itemText}>
          <Text
            allowFontScaling={false}
            style={styles.itemTitle}
            numberOfLines={2}
          >
            {title || url}
          </Text>
          {url ? (
            <Text
              allowFontScaling={false}
              style={styles.itemHost}
              numberOfLines={1}
            >
              {hostname(url)}
            </Text>
          ) : null}
        </View>
      </View>
    ) : null;

  return (
    <View style={styles.sheet}>
      {/* Collection list */}
      <Animated.View
        style={[styles.pane, listTransform]}
        pointerEvents={sectionsFor ? 'none' : 'auto'}
      >
        <View style={styles.header}>
          <Text allowFontScaling={false} style={styles.headerTitle}>
            Save to
          </Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Text allowFontScaling={false} style={styles.closeBtnText}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>

        {itemPreview}

        {showSearch && (
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search collections"
              placeholderTextColor="#a0a0a5"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              returnKeyType="search"
              allowFontScaling={false}
            />
          </View>
        )}

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {filtered.length === 0 && (
            <Text allowFontScaling={false} style={styles.emptyResult}>
              No collections match “{query.trim()}”
            </Text>
          )}
          {filtered.map((col) => {
            const sectionCount = col.sections.length;
            const meta = [
              col.itemCount != null
                ? `${col.itemCount} ${col.itemCount === 1 ? 'item' : 'items'}`
                : null,
              sectionCount > 0
                ? `${sectionCount} ${
                    sectionCount === 1 ? 'section' : 'sections'
                  }`
                : null,
            ]
              .filter(Boolean)
              .join(' · ');

            return (
              <TouchableOpacity
                key={col.id}
                style={styles.collectionRow}
                activeOpacity={0.6}
                onPress={() => {
                  // No sections means there is nothing to choose — save now.
                  if (sectionCount > 0) openSections(col);
                  else handlePick(col.id);
                }}
              >
                <CollectionThumb
                  images={col.previewImages ?? []}
                  name={col.name}
                />
                <View style={styles.collectionText}>
                  <Text
                    allowFontScaling={false}
                    style={styles.collectionName}
                    numberOfLines={1}
                  >
                    {col.name}
                  </Text>
                  {meta ? (
                    <Text
                      allowFontScaling={false}
                      style={styles.collectionMeta}
                    >
                      {meta}
                    </Text>
                  ) : null}
                </View>
                {sectionCount > 0 && <Chevron />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* Section picker for one collection */}
      <Animated.View
        style={[styles.pane, sectionTransform]}
        pointerEvents={sectionsFor ? 'auto' : 'none'}
      >
        {sectionsFor && (
          <>
            <View style={styles.header}>
              <TouchableOpacity
                onPress={closeSections}
                style={styles.backBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Chevron back />
              </TouchableOpacity>
              <Text
                allowFontScaling={false}
                style={styles.navTitle}
                numberOfLines={1}
              >
                {sectionsFor.name}
              </Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Text allowFontScaling={false} style={styles.closeBtnText}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>

            {itemPreview}

            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
            >
              <TouchableOpacity
                style={styles.sectionRow}
                activeOpacity={0.6}
                onPress={() => handlePick(sectionsFor.id)}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.sectionName, styles.noSection]}
                >
                  No section
                </Text>
              </TouchableOpacity>
              {sectionsFor.sections.map((sec) => (
                <TouchableOpacity
                  key={sec.id}
                  style={styles.sectionRow}
                  activeOpacity={0.6}
                  onPress={() => handlePick(sectionsFor.id, sec.id)}
                >
                  <Text
                    allowFontScaling={false}
                    style={styles.sectionName}
                    numberOfLines={1}
                  >
                    {sec.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  checkmark: {
    fontSize: 44,
    color: '#111111',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#8a8a8e',
    marginTop: 6,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 6,
  },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#111111',
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  loading: {
    fontSize: 16,
    color: '#8a8a8e',
  },
  sheet: {
    flex: 1,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  // Both panes are stacked; only their transforms differ.
  pane: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.5,
  },
  backBtn: {
    paddingRight: 6,
    paddingVertical: 6,
  },
  navTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.3,
    marginHorizontal: 4,
  },
  closeBtn: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8a8a8e',
  },
  itemPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#f6f6f7',
  },
  itemImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#ebebed',
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111111',
    lineHeight: 18,
  },
  itemHost: {
    fontSize: 12,
    color: '#8a8a8e',
    marginTop: 2,
  },
  searchWrap: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  searchInput: {
    height: 38,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111111',
    backgroundColor: '#f0f0f2',
  },
  emptyResult: {
    fontSize: 14,
    color: '#8a8a8e',
    textAlign: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 16,
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  collectionText: {
    flex: 1,
    marginLeft: 14,
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.2,
  },
  collectionMeta: {
    fontSize: 13,
    color: '#8a8a8e',
    marginTop: 2,
  },
  chevronBox: {
    width: 22,
    height: 22,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    width: 9,
    height: 9,
    borderTopWidth: 1.75,
    borderRightWidth: 1.75,
    // Nudge so the corner's optical centre sits on the box centre — the stroke
    // mass sits up and to the right of the geometric centre.
    marginLeft: -2,
  },
  chevronNext: {
    borderColor: '#b4b4b8',
    transform: [{ rotate: '45deg' }],
  },
  chevronBack: {
    borderColor: '#111111',
    transform: [{ rotate: '-135deg' }],
    marginLeft: 2,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: '#f0f0f2',
  },
  thumbRow: {
    flexDirection: 'row',
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbMonogram: {
    fontSize: 20,
    fontWeight: '600',
    color: '#b4b4b8',
  },
  thumbFull: {
    width: '100%',
    height: '100%',
  },
  thumbHalf: {
    flex: 1,
    height: '100%',
  },
  thumbLarge: {
    width: 32,
    height: '100%',
  },
  thumbStack: {
    flex: 1,
  },
  thumbSmall: {
    flex: 1,
    width: '100%',
  },
  // Hairline gaps between mosaic tiles, so images never bleed together
  thumbDivider: {
    width: 1,
    backgroundColor: '#fff',
  },
  thumbDividerH: {
    height: 1,
    backgroundColor: '#fff',
  },
  sectionRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececee',
  },
  sectionName: {
    fontSize: 16,
    color: '#111111',
  },
  noSection: {
    color: '#8a8a8e',
  },
});

AppRegistry.registerComponent('shareExtension', () => ShareExtension);
