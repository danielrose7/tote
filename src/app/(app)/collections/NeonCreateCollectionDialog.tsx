"use client";

import { useUser } from "@clerk/nextjs";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import dialogStyles from "../../../components/CreateCollectionDialog/CreateCollectionDialog.module.css";
import { useToast } from "../../../components/ToastNotification";
import type { CreateCollectionMutation } from "../../../lib/collections/client";
import {
	collectionMutationKeys,
	collectionQueryKeys,
} from "../../../lib/collections/queryKeys";
import type { CollectionSummary } from "../../../lib/collections/repository";

const presetColors = [
	"#6366f1",
	"#8b5cf6",
	"#ec4899",
	"#f43f5e",
	"#f97316",
	"#eab308",
	"#22c55e",
	"#14b8a6",
	"#3b82f6",
	"#06b6d4",
];

export function NeonCreateCollectionDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { user } = useUser();
	const { showToast } = useToast();
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [color, setColor] = useState(presetColors[0]);
	const [error, setError] = useState<string | null>(null);
	const createCollection = useMutation<
		{ id: string; replayed: boolean },
		Error,
		CreateCollectionMutation,
		{ previous: CollectionSummary[] | undefined }
	>({
		mutationKey: collectionMutationKeys.create,
		onMutate: async (input) => {
			await queryClient.cancelQueries({ queryKey: collectionQueryKeys.all });
			const previous = queryClient.getQueryData<CollectionSummary[]>(
				collectionQueryKeys.all,
			);
			const optimisticCollection: CollectionSummary = {
				id: input.id,
				ownerUserId: user?.id ?? "",
				name: input.name,
				description: input.description ?? null,
				color: input.color ?? null,
				itemCount: 0,
				legacyJazzId: null,
				positionKey: input.positionKey,
				updatedAt: new Date(),
				role: "owner",
			};
			queryClient.setQueryData<CollectionSummary[]>(
				collectionQueryKeys.all,
				(current = []) => [...current, optimisticCollection],
			);
			return { previous };
		},
		onError: (mutationError, _input, context) => {
			queryClient.setQueryData(collectionQueryKeys.all, context?.previous);
			setError(mutationError.message);
			showToast({
				title: "Collection could not be created",
				description: mutationError.message,
				variant: "error",
			});
		},
	});

	const reset = () => {
		setName("");
		setDescription("");
		setColor(presetColors[0]);
		setError(null);
	};

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			reset();
		}
		onOpenChange(nextOpen);
	};

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmedName = name.trim();
		if (!trimmedName) {
			setError("Collection name is required");
			return;
		}

		const collectionId = crypto.randomUUID();
		createCollection.mutate({
			id: collectionId,
			mutationId: crypto.randomUUID(),
			name: trimmedName,
			description: description.trim() || undefined,
			color,
			positionKey: `${new Date().toISOString()}:${collectionId}`,
		});
		showToast({
			title: "Collection queued",
			description: navigator.onLine
				? `"${trimmedName}" is syncing now.`
				: `"${trimmedName}" will sync when you are back online.`,
			variant: "success",
		});
		handleOpenChange(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={handleOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className={dialogStyles.overlay} />
				<Dialog.Content className={dialogStyles.content}>
					<Dialog.Title className={dialogStyles.title}>
						Create Collection
					</Dialog.Title>
					<Dialog.Description className={dialogStyles.description}>
						Organize links, products, photos, and notes.
					</Dialog.Description>

					<form onSubmit={handleSubmit} className={dialogStyles.form}>
						<div className={dialogStyles.inputGroup}>
							<label
								htmlFor="neon-collection-name"
								className={dialogStyles.label}
							>
								Collection Name *
							</label>
							<input
								id="neon-collection-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								className={dialogStyles.input}
								maxLength={200}
							/>
						</div>

						<div className={dialogStyles.inputGroup}>
							<label
								htmlFor="neon-collection-description"
								className={dialogStyles.label}
							>
								Description (optional)
							</label>
							<textarea
								id="neon-collection-description"
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								className={dialogStyles.textarea}
								rows={3}
								maxLength={2_000}
							/>
						</div>

						<div className={dialogStyles.inputGroup}>
							<span className={dialogStyles.label}>Color</span>
							<div className={dialogStyles.colorPicker}>
								{presetColors.map((preset) => (
									<button
										key={preset}
										type="button"
										className={`${dialogStyles.colorOption} ${
											color === preset ? dialogStyles.colorOptionSelected : ""
										}`}
										style={{ backgroundColor: preset }}
										onClick={() => setColor(preset)}
										aria-label={`Select color ${preset}`}
									/>
								))}
							</div>
						</div>

						{error && <div className={dialogStyles.error}>{error}</div>}

						<div className={dialogStyles.actions}>
							<Dialog.Close asChild>
								<button type="button" className="btn btn-secondary">
									Cancel
								</button>
							</Dialog.Close>
							<button
								type="submit"
								className="btn btn-primary"
								disabled={!name.trim()}
							>
								Create Collection
							</button>
						</div>
					</form>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
