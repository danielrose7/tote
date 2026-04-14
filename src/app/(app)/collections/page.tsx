"use client";

import { useUser } from "@clerk/nextjs";
import type { co } from "jazz-tools";
import { useAccount } from "jazz-tools/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CollectionList } from "../../../components/CollectionList/CollectionList";
import { CreateCollectionDialog } from "../../../components/CreateCollectionDialog/CreateCollectionDialog";
import { EditCollectionDialog } from "../../../components/EditCollectionDialog";
import { Header } from "../../../components/Header";
import { LeaveCollectionDialog } from "../../../components/LeaveCollectionDialog";
import { SaveTabsDialog } from "../../../components/SaveTabsDialog";
import {
	type Block,
	JazzAccount,
	type SharedCollectionRef,
} from "../../../schema";

type LoadedBlock = co.loaded<typeof Block>;
type LoadedSharedRef = co.loaded<typeof SharedCollectionRef>;

export default function CollectionsPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { user } = useUser();
	const enableSaveTabs = user?.publicMetadata?.enableSaveTabs === true;
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
			},
		},
	});

	const [isCreateCollectionDialogOpen, setIsCreateCollectionDialogOpen] =
		useState(false);
	const [isEditCollectionDialogOpen, setIsEditCollectionDialogOpen] =
		useState(false);
	const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
	const [isSaveTabsDialogOpen, setIsSaveTabsDialogOpen] = useState(false);
	const [selectedBlock, setSelectedBlock] = useState<LoadedBlock | null>(null);
	const [selectedSharedRef, setSelectedSharedRef] =
		useState<LoadedSharedRef | null>(null);

	// Auto-open Save Tabs dialog when navigated with ?saveTabs=1
	useEffect(() => {
		if (enableSaveTabs && searchParams.get("saveTabs") === "1") {
			setIsSaveTabsDialogOpen(true);
			// Clean up the URL
			router.replace("/collections", { scroll: false });
		}
	}, [searchParams, router]);

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
			(r) =>
				r && r.$isLoaded && r.collectionId === selectedSharedRef.collectionId,
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
				showSaveTabs={enableSaveTabs}
				onSaveTabsClick={() => setIsSaveTabsDialogOpen(true)}
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
			<SaveTabsDialog
				open={isSaveTabsDialogOpen}
				onOpenChange={setIsSaveTabsDialogOpen}
				account={me}
			/>
		</>
	);
}
