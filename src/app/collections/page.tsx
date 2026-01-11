"use client";

import { useState } from "react";
import { useAccount } from "jazz-tools/react";
import { useRouter } from "next/navigation";
import { JazzAccount, type Block } from "../../schema";
import type { co } from "jazz-tools";
import { Header } from "../../components/Header";
import { CollectionList } from "../../components/CollectionList/CollectionList";
import { CreateCollectionDialog } from "../../components/CreateCollectionDialog/CreateCollectionDialog";
import { EditCollectionDialog } from "../../components/EditCollectionDialog";

type LoadedBlock = co.loaded<typeof Block>;

export default function CollectionsPage() {
  const router = useRouter();
  const me = useAccount(JazzAccount, {
    resolve: {
      profile: true,
      root: {
        blocks: { $each: {} },
        sharedWithMe: { $each: {} },
      }
    },
  });

  const [isCreateCollectionDialogOpen, setIsCreateCollectionDialogOpen] = useState(false);
  const [isEditCollectionDialogOpen, setIsEditCollectionDialogOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<LoadedBlock | null>(null);

  const handleEditCollection = (block: LoadedBlock) => {
    setSelectedBlock(block);
    setIsEditCollectionDialogOpen(true);
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
    </>
  );
}
