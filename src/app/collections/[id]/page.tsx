"use client";

import { useState, useMemo } from "react";
import { useAccount, useCoState } from "jazz-tools/react";
import { useRouter, useParams } from "next/navigation";
import { JazzAccount, Block as BlockSchema, type Block, BlockList } from "../../../schema";
import type { co } from "jazz-tools";
import { Header } from "../../../components/Header";
import { CollectionView } from "../../../components/CollectionView/CollectionView";
import { AddLinkDialog } from "../../../components/AddLinkDialog";
import { EditLinkDialog } from "../../../components/EditLinkDialog";
import { EditCollectionDialog } from "../../../components/EditCollectionDialog";
import { DeleteConfirmDialog } from "../../../components/DeleteConfirmDialog";
import { ShareCollectionDialog } from "../../../components/ShareCollectionDialog";
import { useToast } from "../../../components/ToastNotification";

type LoadedBlock = co.loaded<typeof Block>;

export default function CollectionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const collectionId = params.id as string;

  const me = useAccount(JazzAccount, {
    resolve: {
      profile: true,
      root: {
        blocks: { $each: {} },
        sharedWithMe: { $each: {} },
      }
    },
  });

  // Load the collection directly by ID (works for both owned and shared collections)
  const directCollection = useCoState(BlockSchema, collectionId as `co_z${string}`, {});

  const { showToast } = useToast();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditCollectionDialogOpen, setIsEditCollectionDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<LoadedBlock | null>(null);

  // Get all loaded blocks from owned collections
  const allBlocks = useMemo(() => {
    if (!me.$isLoaded || !me.root?.$isLoaded || !me.root.blocks?.$isLoaded) {
      return [];
    }
    const blocks: LoadedBlock[] = [];
    for (const block of me.root.blocks) {
      if (block && block.$isLoaded) {
        blocks.push(block);
      }
    }
    return blocks;
  }, [me]);

  // Check if this is a shared collection
  const isSharedCollection = useMemo(() => {
    if (!me.$isLoaded || !me.root?.sharedWithMe?.$isLoaded) return false;
    return me.root.sharedWithMe.some(
      (ref) => ref?.$isLoaded && ref.collectionId === collectionId
    );
  }, [me, collectionId]);

  // Find the collection block - check owned blocks first, then use direct load for shared
  const collectionBlock = useMemo(() => {
    // First check owned blocks
    const ownedBlock = allBlocks.find((b) => b.$jazz.id === collectionId);
    if (ownedBlock) return ownedBlock;

    // For shared collections, use the directly loaded collection
    if (directCollection && directCollection.type === "collection") {
      return directCollection as LoadedBlock;
    }

    return null;
  }, [allBlocks, collectionId, directCollection]);

  const handleEditBlock = (block: LoadedBlock) => {
    setSelectedBlock(block);
    setIsEditDialogOpen(true);
  };

  const handleDeleteBlock = (block: LoadedBlock) => {
    setSelectedBlock(block);
    setIsDeleteDialogOpen(true);
  };

  const handleEditDialogClose = (open: boolean) => {
    if (!open && isEditDialogOpen) {
      showToast({
        title: "Link updated",
        description: "Your changes have been saved",
        variant: "success",
      });
    }
    setIsEditDialogOpen(open);
  };

  const handleConfirmDelete = () => {
    if (!selectedBlock || !me.root?.blocks?.$isLoaded) return;

    const blockIndex = me.root.blocks.findIndex(
      (block) => block && block.$isLoaded && block.$jazz.id === selectedBlock.$jazz.id
    );

    if (blockIndex !== -1) {
      me.root.blocks.$jazz.splice(blockIndex, 1);
      showToast({
        title: "Link deleted",
        description: `"${selectedBlock.name || "Untitled"}" has been removed`,
        variant: "success",
      });
    }

    setSelectedBlock(null);
  };

  // Show loading while account or direct collection is loading
  if (!me.$isLoaded || (directCollection === undefined && !collectionBlock)) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          color: "var(--color-text-secondary)",
        }}
      >
        Loading...
      </div>
    );
  }

  // Show not found if we've finished loading and still don't have the collection
  if (!collectionBlock) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          color: "var(--color-text-secondary)",
          gap: "1rem",
        }}
      >
        <p>Collection not found</p>
        <button
          type="button"
          onClick={() => router.push("/collections")}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid var(--color-border)",
            background: "var(--color-background)",
            cursor: "pointer",
          }}
        >
          Back to Collections
        </button>
      </div>
    );
  }

  return (
    <>
      <Header
        showAddLink
        onAddLinkClick={() => setIsAddDialogOpen(true)}
        breadcrumbs={[
          { label: "Collections", href: "/collections" },
          { label: collectionBlock.name || "Untitled" },
        ]}
      />
      <main>
        <CollectionView
          collectionBlock={collectionBlock}
          allBlocks={allBlocks}
          onEditBlock={handleEditBlock}
          onDeleteBlock={handleDeleteBlock}
          onEditCollection={() => setIsEditCollectionDialogOpen(true)}
          onShareCollection={() => setIsShareDialogOpen(true)}
        />
      </main>
      <AddLinkDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        account={me}
        collectionId={collectionId}
      />
      <EditLinkDialog
        open={isEditDialogOpen}
        onOpenChange={handleEditDialogClose}
        block={selectedBlock}
        account={me}
      />
      <EditCollectionDialog
        open={isEditCollectionDialogOpen}
        onOpenChange={setIsEditCollectionDialogOpen}
        block={collectionBlock}
        account={me}
      />
      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        block={selectedBlock}
        onConfirm={handleConfirmDelete}
      />
      <ShareCollectionDialog
        open={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        collection={collectionBlock}
        allBlocks={allBlocks}
        account={me}
      />
    </>
  );
}
