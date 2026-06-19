"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import editStyles from "@/components/EditCollectionDialog/EditCollectionDialog.module.css";
import { useToast } from "@/components/ToastNotification";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
	type CopyCollectionMutation,
	copyCollectionMutation,
} from "@/lib/collections/client";
import {
	collectionMutationKeys,
	collectionQueryKeys,
} from "@/lib/collections/queryKeys";
import type { CollectionDetail } from "@/lib/collections/repository";

export function NeonCopyCollectionDialog({
	detail,
	open,
	onOpenChange,
}: {
	detail: CollectionDetail;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { showToast } = useToast();
	const online = useOnlineStatus();
	const [name, setName] = useState(`Copy of ${detail.collection.name}`);
	const [error, setError] = useState<string | null>(null);
	const copyCollection = useMutation<
		{ id: string; replayed: boolean },
		Error,
		CopyCollectionMutation
	>({
		mutationKey: collectionMutationKeys.copy,
		mutationFn: copyCollectionMutation,
		onSuccess: async ({ id }) => {
			await queryClient.invalidateQueries({
				queryKey: collectionQueryKeys.all,
			});
			showToast({
				title: "Collection copied",
				description: "The new collection is independent from its source.",
				variant: "success",
			});
			onOpenChange(false);
			router.push(`/collections/${id}`);
		},
		onError: (mutationError) => setError(mutationError.message),
	});

	useEffect(() => {
		if (!open) return;
		setName(`Copy of ${detail.collection.name}`.slice(0, 200));
		setError(null);
		copyCollection.reset();
	}, [open, detail.collection.name, copyCollection.reset]);

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!online || copyCollection.isPending) return;
		const trimmedName = name.trim();
		if (!trimmedName) {
			setError("Collection name is required.");
			return;
		}
		copyCollection.mutate({
			collectionId: detail.collection.id,
			mutationId: crypto.randomUUID(),
			name: trimmedName,
		});
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className={editStyles.overlay} />
				<Dialog.Content className={editStyles.content}>
					<Dialog.Title className={editStyles.title}>
						Make an independent copy
					</Dialog.Title>
					<Dialog.Description className={editStyles.description}>
						The copy gets new rows and IDs. Later edits will not sync with the
						source collection.
					</Dialog.Description>

					<form className={editStyles.form} onSubmit={submit}>
						<div className={editStyles.inputGroup}>
							<label htmlFor="neon-copy-name" className={editStyles.label}>
								Collection name
							</label>
							<input
								id="neon-copy-name"
								className={editStyles.input}
								value={name}
								onChange={(event) => setName(event.target.value)}
								maxLength={200}
							/>
							<span className={editStyles.helperText}>
								Members, invites, publication settings, and future changes are
								not copied.
							</span>
						</div>

						{!online && (
							<div className={editStyles.error}>
								Making a copy requires a connection.
							</div>
						)}
						{error && <div className={editStyles.error}>{error}</div>}

						<div className={editStyles.actions}>
							<Dialog.Close asChild>
								<button type="button" className="btn btn-secondary">
									Cancel
								</button>
							</Dialog.Close>
							<button
								type="submit"
								className="btn btn-primary"
								disabled={!online || !name.trim() || copyCollection.isPending}
							>
								{copyCollection.isPending ? "Copying..." : "Make copy"}
							</button>
						</div>
					</form>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
