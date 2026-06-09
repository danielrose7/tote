"use client";

import { useUser } from "@clerk/nextjs";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { useToast } from "../../../../components/ToastNotification";
import { useOnlineStatus } from "../../../../hooks/useOnlineStatus";
import {
	fetchCollectionPublication,
	type PublishCollectionMutation,
	type UnpublishCollectionMutation,
} from "../../../../lib/collections/client";
import {
	collectionMutationKeys,
	collectionQueryKeys,
} from "../../../../lib/collections/queryKeys";
import type { CollectionDetail } from "../../../../lib/collections/repository";
import { slugify } from "../../../../lib/slugify";
import styles from "./NeonPublicationDialog.module.css";

export function NeonPublicationDialog({
	detail,
	open,
	onOpenChange,
}: {
	detail: CollectionDetail;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { user } = useUser();
	const { showToast } = useToast();
	const online = useOnlineStatus();
	const { collection } = detail;
	const canUseFriendlyUrl =
		user?.id === collection.ownerUserId && Boolean(user.username);
	const { data: publication, isLoading } = useQuery({
		queryKey: collectionQueryKeys.publication(collection.id),
		queryFn: () => fetchCollectionPublication(collection.id),
		enabled: open,
	});
	const [slug, setSlug] = useState(slugify(collection.name));
	const [layout, setLayout] = useState<"minimal" | "feature">(
		collection.publicLayout,
	);
	const [allowCloning, setAllowCloning] = useState(
		collection.copyPolicy === "public",
	);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setSlug(publication?.slug ?? slugify(collection.name));
		setLayout(publication?.layout ?? collection.publicLayout);
		setAllowCloning(publication?.allowCloning ?? true);
		setError(null);
	}, [open, publication, collection.name, collection.publicLayout]);

	const publish = useMutation<
		NonNullable<typeof publication>,
		Error,
		PublishCollectionMutation
	>({
		mutationKey: collectionMutationKeys.publish,
		onSuccess: () => {
			setError(null);
			showToast({
				title: publication
					? "Public snapshot replaced"
					: "Collection published",
				description:
					"Your private collection remains separate from this public snapshot.",
				variant: "success",
			});
		},
		onError: (mutationError) => setError(mutationError.message),
	});
	const unpublish = useMutation<
		{ unpublished: true },
		Error,
		UnpublishCollectionMutation
	>({
		mutationKey: collectionMutationKeys.unpublish,
		onSuccess: () => {
			showToast({
				title: "Collection unpublished",
				description: "The private collection was not changed.",
				variant: "success",
			});
			onOpenChange(false);
		},
		onError: (mutationError) => setError(mutationError.message),
	});

	const publicUrl =
		typeof window !== "undefined" && publication
			? publication.username
				? `${window.location.origin}/s/${publication.username}/${publication.slug}`
				: `${window.location.origin}/view/${publication.id}`
			: null;

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!online) return;
		const normalizedSlug = slugify(slug);
		if (!normalizedSlug) {
			setError("A public URL slug is required.");
			return;
		}
		publish.mutate({
			collectionId: collection.id,
			input: {
				slug: normalizedSlug,
				layout,
				allowCloning,
			},
		});
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className={styles.overlay} />
				<Dialog.Content className={styles.content}>
					<div className={styles.heading}>
						<div>
							<Dialog.Title className={styles.title}>
								Public snapshot
							</Dialog.Title>
							<Dialog.Description className={styles.description}>
								The public copy changes only when you explicitly publish it.
							</Dialog.Description>
						</div>
						<Dialog.Close className={styles.closeButton}>Close</Dialog.Close>
					</div>

					{isLoading ? (
						<p className={styles.muted}>Loading publication...</p>
					) : (
						<form className={styles.form} onSubmit={submit}>
							{publication && (
								<div
									className={`${styles.status} ${
										publication.hasUnpublishedChanges
											? styles.statusChanged
											: styles.statusCurrent
									}`}
								>
									<strong>
										{publication.hasUnpublishedChanges
											? "Unpublished changes"
											: "Public snapshot is current"}
									</strong>
									<span>
										Snapshot version {publication.sourceVersion}; private
										version {collection.version}.
									</span>
								</div>
							)}

							<label>
								Public URL slug
								<div className={styles.slugRow}>
									<span>
										{canUseFriendlyUrl
											? `/s/${user.username}/`
											: "/view/[publication-id]"}
									</span>
									<input
										value={slug}
										onChange={(event) => setSlug(event.target.value)}
										maxLength={120}
									/>
								</div>
							</label>

							<label>
								Layout
								<select
									value={layout}
									onChange={(event) =>
										setLayout(event.target.value as "minimal" | "feature")
									}
								>
									<option value="minimal">Minimal</option>
									<option value="feature">Feature</option>
								</select>
							</label>

							<label className={styles.checkbox}>
								<input
									type="checkbox"
									checked={allowCloning}
									onChange={(event) => setAllowCloning(event.target.checked)}
								/>
								Allow people to make independent copies
							</label>

							{publicUrl && (
								<div className={styles.linkRow}>
									<input readOnly value={publicUrl} aria-label="Public URL" />
									<a href={publicUrl} target="_blank" rel="noreferrer">
										Open
									</a>
									<button
										type="button"
										onClick={() => navigator.clipboard.writeText(publicUrl)}
									>
										Copy
									</button>
								</div>
							)}

							{!online && (
								<p className={styles.notice}>
									Publishing requires a connection.
								</p>
							)}
							{error && <p className={styles.error}>{error}</p>}

							<div className={styles.actions}>
								{publication && (
									<button
										type="button"
										className={styles.dangerButton}
										disabled={!online || unpublish.isPending}
										onClick={() => {
											if (
												window.confirm(
													"Remove the public snapshot? Your private collection will remain unchanged.",
												)
											) {
												unpublish.mutate({ collectionId: collection.id });
											}
										}}
									>
										Unpublish
									</button>
								)}
								<button
									type="submit"
									className={styles.primaryButton}
									disabled={!online || publish.isPending}
								>
									{publish.isPending
										? "Publishing..."
										: publication
											? "Replace public snapshot"
											: "Publish snapshot"}
								</button>
							</div>
						</form>
					)}
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
