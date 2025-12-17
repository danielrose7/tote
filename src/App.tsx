import { useState, useEffect } from "react";
import { useAccount } from "jazz-tools/react";
import { JazzAccount, type ProductLink, type Collection } from "./schema.ts";
import type { co } from "jazz-tools";
import { Header } from "./components/Header";
import { AddLinkDialog } from "./components/AddLinkDialog";
import { ProductGrid } from "./components/ProductGrid";
import { EditLinkDialog } from "./components/EditLinkDialog";
import { DeleteConfirmDialog } from "./components/DeleteConfirmDialog";
import { CollectionList } from "./components/CollectionList/CollectionList";
import { CollectionView } from "./components/CollectionView/CollectionView";
import { CreateCollectionDialog } from "./components/CreateCollectionDialog/CreateCollectionDialog";
import { useToast } from "./components/ToastNotification";
import { useSyncClerkUser } from "./hooks/useSyncClerkUser";

function App() {
  // Sync Clerk user ID with Jazz for server-side lookups
  useSyncClerkUser();

  const me = useAccount(JazzAccount, {
    resolve: {
      profile: true,
      root: {
        links: { $each: {} },
        collections: { $each: { links: { $each: {} } } }
      }
    },
  });

  console.log("App rendering, account loaded:", me.$isLoaded);

  const { showToast } = useToast();

  // Parse URL to determine current view
  const getViewFromUrl = (): "links" | "collections" => {
    const path = window.location.pathname;
    if (path.startsWith("/collections")) return "collections";
    return "links";
  };

  const [view, setView] = useState<"links" | "collections">(getViewFromUrl());
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  // Listen to browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setView(getViewFromUrl());
      const path = window.location.pathname;
      const collectionMatch = path.match(/\/collections\/(.+)/);
      setSelectedCollectionId(collectionMatch ? collectionMatch[1] : null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Update URL when view changes
  const handleViewChange = (newView: "links" | "collections") => {
    setView(newView);
    setSelectedCollectionId(null);
    const url = newView === "collections" ? "/collections" : "/";
    window.history.pushState({}, "", url);
  };
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCreateCollectionDialogOpen, setIsCreateCollectionDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
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
    if (!me.root.links.$isLoaded) return;

    const linkIndex = me.root.links.findIndex(
      (link) => link && link.$isLoaded && link.$jazz.id === selectedLink.$jazz.id
    );

    if (linkIndex !== -1) {
      me.root.links.$jazz.splice(linkIndex, 1);
      showToast({
        title: "Link deleted",
        description: `"${selectedLink.title || "Untitled"}" has been removed`,
        variant: "success",
      });
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
        onAddLinkClick={() => setIsAddDialogOpen(true)}
        onCreateCollectionClick={() => setIsCreateCollectionDialogOpen(true)}
        currentView={view}
        onViewChange={handleViewChange}
      />
      <main>
        {view === "links" ? (
          <ProductGrid
            account={me}
            onEditLink={handleEditLink}
            onDeleteLink={handleDeleteLink}
          />
        ) : selectedCollectionId ? (
          <CollectionView
            account={me}
            collectionId={selectedCollectionId}
            onEditLink={handleEditLink}
            onDeleteLink={handleDeleteLink}
            onBackToCollections={() => {
              setSelectedCollectionId(null);
              window.history.pushState({}, "", "/collections");
            }}
          />
        ) : (
          <CollectionList
            account={me}
            onSelectCollection={(collection) => {
              setSelectedCollectionId(collection.$jazz.id);
              const url = `/collections/${collection.$jazz.id}`;
              window.history.pushState({}, "", url);
            }}
          />
        )}
      </main>
      <AddLinkDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        account={me}
      />
      <CreateCollectionDialog
        open={isCreateCollectionDialogOpen}
        onOpenChange={setIsCreateCollectionDialogOpen}
        account={me}
      />
      <EditLinkDialog
        open={isEditDialogOpen}
        onOpenChange={handleEditDialogClose}
        link={selectedLink}
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

export default App;
