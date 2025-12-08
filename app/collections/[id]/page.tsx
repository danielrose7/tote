"use client";

import { useState } from "react";
import { useAccount } from "jazz-tools/react";
import { useRouter, useParams } from "next/navigation";
import { JazzAccount, type ProductLink } from "../../../src/schema";
import type { co } from "jazz-tools";
import { Header } from "../../../src/components/Header";
import { CollectionView } from "../../../src/components/CollectionView/CollectionView";
import { AddLinkDialog } from "../../../src/components/AddLinkDialog";
import { EditLinkDialog } from "../../../src/components/EditLinkDialog";
import { EditCollectionDialog } from "../../../src/components/EditCollectionDialog";
import { DeleteConfirmDialog } from "../../../src/components/DeleteConfirmDialog";
import { useToast } from "../../../src/components/ToastNotification";

export default function CollectionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const collectionId = params.id as string;

  const me = useAccount(JazzAccount, {
    resolve: {
      profile: true,
      root: {
        links: { $each: {} },
        collections: { $each: { links: { $each: {} } } }
      }
    },
  });

  const { showToast } = useToast();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditCollectionDialogOpen, setIsEditCollectionDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<co.loaded<typeof ProductLink> | null>(null);

  const handleEditLink = (link: co.loaded<typeof ProductLink>) => {
    setSelectedLink(link);
    setIsEditDialogOpen(true);
  };

  const handleDeleteLink = (link: co.loaded<typeof ProductLink>) => {
    setSelectedLink(link);
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
    if (!selectedLink || !me.$isLoaded || !me.root || !me.root.$isLoaded) return;
    if (!me.root.collections.$isLoaded) return;

    const collection = me.root.collections.find(
      (c) => c && c.$isLoaded && c.$jazz.id === collectionId
    );

    if (collection && collection.$isLoaded && collection.links.$isLoaded) {
      const linkIndex = collection.links.findIndex(
        (link) => link && link.$isLoaded && link.$jazz.id === selectedLink.$jazz.id
      );

      if (linkIndex !== -1) {
        collection.links.$jazz.splice(linkIndex, 1);
        showToast({
          title: "Link deleted",
          description: `"${selectedLink.title || "Untitled"}" has been removed`,
          variant: "success",
        });
      }
    }

    setSelectedLink(null);
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
        showAddLink
        onAddLinkClick={() => setIsAddDialogOpen(true)}
      />
      <main>
        <CollectionView
          account={me}
          collectionId={collectionId}
          onEditLink={handleEditLink}
          onDeleteLink={handleDeleteLink}
          onEditCollection={() => setIsEditCollectionDialogOpen(true)}
          onBackToCollections={() => router.push("/collections")}
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
        link={selectedLink}
      />
      <EditCollectionDialog
        open={isEditCollectionDialogOpen}
        onOpenChange={setIsEditCollectionDialogOpen}
        collection={
          me.root?.collections.$isLoaded
            ? me.root.collections.find(
                (c) => c && c.$isLoaded && c.$jazz.id === collectionId
              ) || null
            : null
        }
        account={me}
      />
      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        link={selectedLink}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
