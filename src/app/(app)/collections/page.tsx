"use client";

import { useState } from "react";
import { useAccount } from "jazz-tools/react";
import { useRouter } from "next/navigation";
import { JazzAccount, type Block, type SharedCollectionRef } from "../../../schema";
import type { co } from "jazz-tools";
import { Header } from "../../../components/Header";
import { CollectionList } from "../../../components/CollectionList/CollectionList";
import { CreateCollectionDialog } from "../../../components/CreateCollectionDialog/CreateCollectionDialog";
import { EditCollectionDialog } from "../../../components/EditCollectionDialog";
import { LeaveCollectionDialog } from "../../../components/LeaveCollectionDialog";

type LoadedBlock = co.loaded<typeof Block>;
type LoadedSharedRef = co.loaded<typeof SharedCollectionRef>;

export default function CollectionsPage() {
  const router = useRouter();
  const me = useAccount(JazzAccount, {
    resolve: {
      profile: true,
      root: {
        blocks: {
          $each: {
            children: {
              $each: {
                children: { $each: {} }, // For slots containing products
              },
            },
          },
        },
        sharedWithMe: { $each: {} },
      }
    },
  });

  const [isCreateCollectionDialogOpen, setIsCreateCollectionDialogOpen] = useState(false);
  const [isEditCollectionDialogOpen, setIsEditCollectionDialogOpen] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<LoadedBlock | null>(null);
  const [selectedSharedRef, setSelectedSharedRef] = useState<LoadedSharedRef | null>(null);

  const handleEditCollection = (block: LoadedBlock) => {
    setSelectedBlock(block);
    setIsEditCollectionDialogOpen(true);
  };

  const handleLeaveSharedCollection = (ref: LoadedSharedRef) => {
    setSelectedSharedRef(ref);
    setIsLeaveDialogOpen(true);
  };

  const confirmLeaveSharedCollection = () => {
    if (!me.root?.sharedWithMe?.$isLoaded || !selectedSharedRef) return;

    // Find the index of this shared ref
    const idx = me.root.sharedWithMe.findIndex(
      (r) => r && r.$isLoaded && r.collectionId === selectedSharedRef.collectionId
    );

    if (idx !== -1) {
      me.root.sharedWithMe.$jazz.splice(idx, 1);
    }

    setSelectedSharedRef(null);
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

  return (
    <>
      <Header
        showAddCollection
        onAddCollectionClick={() => setIsCreateCollectionDialogOpen(true)}
      />
      <main>
        <CollectionList
          account={me}
          onSelectCollection={(block) => {
            router.push(`/collections/${block.$jazz.id}`);
          }}
          onEditCollection={handleEditCollection}
          onLeaveSharedCollection={handleLeaveSharedCollection}
        />
      </main>
      <CreateCollectionDialog
        open={isCreateCollectionDialogOpen}
        onOpenChange={setIsCreateCollectionDialogOpen}
        account={me}
      />
      <EditCollectionDialog
        open={isEditCollectionDialogOpen}
        onOpenChange={setIsEditCollectionDialogOpen}
        block={selectedBlock}
        account={me}
      />
      <LeaveCollectionDialog
        open={isLeaveDialogOpen}
        onOpenChange={setIsLeaveDialogOpen}
        sharedRef={selectedSharedRef}
        onConfirm={confirmLeaveSharedCollection}
      />
    </>
  );
}
