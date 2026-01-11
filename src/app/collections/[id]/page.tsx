"use client";

import { useState, useMemo } from "react";
import { useAccount } from "jazz-tools/react";
import { useRouter, useParams } from "next/navigation";
import { JazzAccount, type Block, BlockList } from "../../../schema";
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
        blocks: { $each: {} }
      }
    },
  });

  const { showToast } = useToast();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditCollectionDialogOpen, setIsEditCollectionDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<LoadedBlock | null>(null);

  // Get all loaded blocks
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

  // Find the collection block by ID
  const collectionBlock = useMemo(() => {
    return allBlocks.find((b) => b.$jazz.id === collectionId) || null;
  }, [allBlocks, collectionId]);

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

  if (!me.$isLoaded) {
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
