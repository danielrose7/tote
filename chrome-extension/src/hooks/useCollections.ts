import { useEffect, useState, useCallback } from "react";
import { useAccount } from "jazz-tools/react";
import { JazzAccount, Block, SharedCollectionRef } from "@tote/schema";
import type { co } from "jazz-tools";

type LoadedBlock = co.loaded<typeof Block>;
type LoadedSharedRef = co.loaded<typeof SharedCollectionRef>;

interface UseCollectionsResult {
  collections: LoadedBlock[];
  selectedCollection: string;
  setSelectedCollection: (id: string) => void;
  slots: { id: string; name: string }[];
  selectedCollectionBlock: LoadedBlock | undefined;
  sharedRefsToLoad: LoadedSharedRef[];
  onSharedCollectionLoaded: (collection: LoadedBlock) => void;
  me: co.loaded<typeof JazzAccount> | null;
  root: co.loaded<(typeof JazzAccount)["root"]> | null;
  isLoading: boolean;
}

export function useCollections(): UseCollectionsResult {
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [loadedSharedCollections, setLoadedSharedCollections] = useState<
    Map<string, LoadedBlock>
  >(new Map());

  // Get user's Jazz account with blocks loaded (including children for sharing)
  const me = useAccount(JazzAccount, {
    resolve: {
      root: {
        blocks: {
          $each: {
            children: {
              $each: {
                children: { $each: {} },
              },
            },
          },
        },
        sharedWithMe: { $each: {} },
      },
    },
  });

  const isLoaded = me && "$isLoaded" in me && me.$isLoaded;
  const root = isLoaded ? me.root : null;
  const rootLoaded = root && "$isLoaded" in root && root.$isLoaded;

  // Get writable shared collection refs (writer or admin role)
  const writableSharedRefs: LoadedSharedRef[] = [];
  if (rootLoaded && root.sharedWithMe?.$isLoaded) {
    for (const ref of Array.from(root.sharedWithMe)) {
      if (
        ref &&
        ref.$isLoaded &&
        (ref.role === "writer" || ref.role === "admin")
      ) {
        writableSharedRefs.push(ref);
      }
    }
  }

  // Callback for when a shared collection is loaded
  const onSharedCollectionLoaded = useCallback((collection: LoadedBlock) => {
    setLoadedSharedCollections((prev) => {
      const next = new Map(prev);
      next.set(collection.$jazz.id, collection);
      return next;
    });
  }, []);

  // Get owned collection blocks (top-level collections without parentId)
  const ownedCollections: LoadedBlock[] = [];
  if (rootLoaded && root.blocks?.$isLoaded) {
    for (const b of Array.from(root.blocks)) {
      if (b && b.$isLoaded && b.type === "collection" && !b.parentId && !b.collectionData?.sourceId) {
        ownedCollections.push(b as LoadedBlock);
      }
    }
  }

  // Combine owned + loaded shared collections, deduplicated by ID
  const ownedIds = new Set(ownedCollections.map((c) => c.$jazz.id));
  const collections: LoadedBlock[] = [...ownedCollections];
  for (const c of loadedSharedCollections.values()) {
    if (!ownedIds.has(c.$jazz.id)) {
      collections.push(c);
    }
  }

  // Filter shared refs to skip loading collections we already own
  const sharedRefsToLoad = writableSharedRefs.filter(
    (ref) => !ownedIds.has(ref.collectionId)
  );

  // Find the currently selected collection block
  const selectedCollectionBlock = collections.find(
    (c) => c.$jazz.id === selectedCollection
  );

  // Get slot blocks for the selected collection (from children list)
  const slots: { id: string; name: string }[] = [];
  if (selectedCollectionBlock?.children?.$isLoaded) {
    for (const b of selectedCollectionBlock.children) {
      if (b && b.$isLoaded && b.type === "slot") {
        slots.push({ id: b.$jazz.id, name: b.name || "Unnamed slot" });
      }
    }
  }

  // Set default collection when collections load
  useEffect(() => {
    if (collections.length > 0 && !selectedCollection) {
      const defaultId = root?.defaultBlockId;

      if (defaultId) {
        const defaultCollection = collections.find(
          (c) => c.$jazz.id === defaultId
        );
        if (defaultCollection) {
          setSelectedCollection(defaultCollection.$jazz.id);
          return;
        }
      }

      const firstCollection = collections[0];
      if (firstCollection) {
        setSelectedCollection(firstCollection.$jazz.id);
      }
    }
  }, [collections, selectedCollection, root?.defaultBlockId]);

  return {
    collections,
    selectedCollection,
    setSelectedCollection,
    slots,
    selectedCollectionBlock,
    sharedRefsToLoad,
    onSharedCollectionLoaded,
    me: isLoaded ? me : null,
    root: rootLoaded ? root : null,
    isLoading: !isLoaded || !rootLoaded,
  };
}
