"use client";

import { useState } from "react";
import { useAccount } from "jazz-tools/react";
import { useRouter } from "next/navigation";
import { JazzAccount, type Collection } from "../../src/schema";
import type { co } from "jazz-tools";
import { Header } from "../../src/components/Header";
import { CollectionList } from "../../src/components/CollectionList/CollectionList";
import { CreateCollectionDialog } from "../../src/components/CreateCollectionDialog/CreateCollectionDialog";
import { EditCollectionDialog } from "../../src/components/EditCollectionDialog";

export default function CollectionsPage() {
  const router = useRouter();
  const me = useAccount(JazzAccount, {
    resolve: {
      profile: true,
      root: {
        links: { $each: {} },
        collections: { $each: { links: { $each: {} } } }
      }
    },
  });

  const [isCreateCollectionDialogOpen, setIsCreateCollectionDialogOpen] = useState(false);
  const [isEditCollectionDialogOpen, setIsEditCollectionDialogOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<co.loaded<typeof Collection> | null>(null);

  const handleEditCollection = (collection: co.loaded<typeof Collection>) => {
    setSelectedCollection(collection);
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
        showCreateCollection
        onCreateCollectionClick={() => setIsCreateCollectionDialogOpen(true)}
      />
      <main>
        <CollectionList
          account={me}
          onSelectCollection={(collection) => {
            router.push(`/collections/${collection.$jazz.id}`);
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
        collection={selectedCollection}
        account={me}
      />
    </>
  );
}
