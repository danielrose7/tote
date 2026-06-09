"use client";

import { useAuth } from "@clerk/nextjs";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { useToast } from "../../../../components/ToastNotification";
import {
	type CreateCollectionInviteMutation,
	fetchCollectionTeam,
	type RemoveCollectionMemberMutation,
	type RevokeCollectionInviteMutation,
	type TransferCollectionOwnershipMutation,
	type UpdateCollectionMemberMutation,
} from "../../../../lib/collections/client";
import type { CollectionRole } from "../../../../lib/collections/permissions";
import {
	collectionMutationKeys,
	collectionQueryKeys,
} from "../../../../lib/collections/queryKeys";
import type { CollectionTeam } from "../../../../lib/collections/teamRepository";
import styles from "./NeonTeamDialog.module.css";

function useOnline() {
	const [online, setOnline] = useState(true);

	useEffect(() => {
		const update = () => setOnline(navigator.onLine);
		update();
		window.addEventListener("online", update);
		window.addEventListener("offline", update);
		return () => {
			window.removeEventListener("online", update);
			window.removeEventListener("offline", update);
		};
	}, []);

	return online;
}

function formatDate(value: Date | null) {
	return value
		? new Intl.DateTimeFormat(undefined, {
				dateStyle: "medium",
				timeStyle: "short",
			}).format(value)
		: "No expiration";
}

function eventLabel(event: CollectionTeam["events"][number]) {
	return event.action.replaceAll("_", " ");
}

export function NeonTeamDialog({
	collectionId,
	actorRole,
	open,
	onOpenChange,
}: {
	collectionId: string;
	actorRole: CollectionRole;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { userId } = useAuth();
	const { showToast } = useToast();
	const online = useOnline();
	const [recipientHint, setRecipientHint] = useState("");
	const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("viewer");
	const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const { data: team, isLoading } = useQuery({
		queryKey: collectionQueryKeys.team(collectionId),
		queryFn: () => fetchCollectionTeam(collectionId),
		enabled: open,
	});

	const mutationError = (title: string) => (mutation: Error) => {
		setError(mutation.message);
		showToast({
			title,
			description: mutation.message,
			variant: "error",
		});
	};
	const createInvite = useMutation<
		{
			id: string;
			token: string;
			role: "editor" | "viewer";
			expiresAt: string | null;
			maxUses: number | null;
		},
		Error,
		CreateCollectionInviteMutation
	>({
		mutationKey: collectionMutationKeys.createInvite,
		onSuccess: (invite) => {
			const url = `${window.location.origin}/invite/${encodeURIComponent(invite.token)}`;
			setLatestInviteUrl(url);
			setRecipientHint("");
			setError(null);
		},
		onError: mutationError("Invite creation failed"),
	});
	const revokeInvite = useMutation<
		{ revokedAt: string },
		Error,
		RevokeCollectionInviteMutation
	>({
		mutationKey: collectionMutationKeys.revokeInvite,
		onError: mutationError("Invite revocation failed"),
	});
	const updateMember = useMutation<
		{ role: string },
		Error,
		UpdateCollectionMemberMutation
	>({
		mutationKey: collectionMutationKeys.updateMember,
		onError: mutationError("Role update failed"),
	});
	const removeMember = useMutation<
		{ revokedAt: string },
		Error,
		RemoveCollectionMemberMutation
	>({
		mutationKey: collectionMutationKeys.removeMember,
		onError: mutationError("Member removal failed"),
	});
	const transferOwnership = useMutation<
		{ version: number },
		Error,
		TransferCollectionOwnershipMutation
	>({
		mutationKey: collectionMutationKeys.transferOwnership,
		onSuccess: () => onOpenChange(false),
		onError: mutationError("Ownership transfer failed"),
	});
	const busy =
		createInvite.isPending ||
		revokeInvite.isPending ||
		updateMember.isPending ||
		removeMember.isPending ||
		transferOwnership.isPending;

	const submitInvite = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!online) return;
		createInvite.mutate({
			collectionId,
			input: {
				role: inviteRole,
				recipientHint: recipientHint.trim() || undefined,
				maxUses: 1,
			},
		});
	};

	const copyInvite = async () => {
		if (!latestInviteUrl) return;
		await navigator.clipboard.writeText(latestInviteUrl);
		showToast({
			title: "Invite link copied",
			description: "The one-use invite link is ready to share.",
			variant: "success",
		});
	};

	const canManageMember = (member: CollectionTeam["members"][number]) =>
		member.userId !== userId &&
		member.role !== "owner" &&
		(actorRole === "owner" || member.role !== "admin");

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className={styles.overlay} />
				<Dialog.Content className={styles.content}>
					<div className={styles.heading}>
						<div>
							<Dialog.Title className={styles.title}>
								Collection team
							</Dialog.Title>
							<Dialog.Description className={styles.description}>
								Manage collaborators, invitations, and roles.
							</Dialog.Description>
						</div>
						<Dialog.Close className={styles.closeButton}>Close</Dialog.Close>
					</div>

					{!online && (
						<p className={styles.notice}>
							Team changes require a connection and are disabled offline.
						</p>
					)}
					{error && <p className={styles.error}>{error}</p>}

					<section className={styles.section}>
						<h3>Invite someone</h3>
						<form className={styles.inviteForm} onSubmit={submitInvite}>
							<input
								value={recipientHint}
								onChange={(event) => setRecipientHint(event.target.value)}
								placeholder="Name or email (optional)"
								aria-label="Invite recipient"
								maxLength={320}
							/>
							<select
								value={inviteRole}
								onChange={(event) =>
									setInviteRole(event.target.value as "editor" | "viewer")
								}
								aria-label="Invite role"
							>
								<option value="viewer">Viewer</option>
								<option value="editor">Editor</option>
							</select>
							<button type="submit" disabled={!online || busy}>
								Create link
							</button>
						</form>
						{latestInviteUrl && (
							<div className={styles.inviteLink}>
								<input
									readOnly
									value={latestInviteUrl}
									aria-label="Invite link"
								/>
								<button type="button" onClick={copyInvite}>
									Copy
								</button>
							</div>
						)}
						<p className={styles.helper}>
							New links are single-use. The complete link is only shown when it
							is created.
						</p>
					</section>

					{isLoading && <p className={styles.muted}>Loading team...</p>}
					{team && (
						<>
							<section className={styles.section}>
								<h3>Members</h3>
								<div className={styles.list}>
									{team.members.map((member) => {
										const manageable = canManageMember(member);
										return (
											<div className={styles.row} key={member.userId}>
												<div className={styles.identity}>
													<strong>
														{member.userId === userId ? "You" : member.userId}
													</strong>
													<span>Joined {formatDate(member.joinedAt)}</span>
												</div>
												<div className={styles.rowActions}>
													<select
														value={member.role}
														disabled={!online || busy || !manageable}
														onChange={(event) =>
															updateMember.mutate({
																collectionId,
																userId: member.userId,
																role: event.target.value as
																	| "admin"
																	| "editor"
																	| "viewer",
															})
														}
														aria-label={`Role for ${member.userId}`}
													>
														{member.role === "owner" && (
															<option value="owner">Owner</option>
														)}
														{(actorRole === "owner" ||
															member.role === "admin") && (
															<option value="admin">Admin</option>
														)}
														<option value="editor">Editor</option>
														<option value="viewer">Viewer</option>
													</select>
													{manageable && (
														<>
															<button
																type="button"
																disabled={!online || busy}
																onClick={() =>
																	removeMember.mutate({
																		collectionId,
																		userId: member.userId,
																	})
																}
															>
																Remove
															</button>
															{actorRole === "owner" && (
																<button
																	type="button"
																	disabled={!online || busy}
																	onClick={() => {
																		if (
																			window.confirm(
																				`Transfer ownership to ${member.userId}?`,
																			)
																		) {
																			transferOwnership.mutate({
																				collectionId,
																				targetUserId: member.userId,
																			});
																		}
																	}}
																>
																	Make owner
																</button>
															)}
														</>
													)}
												</div>
											</div>
										);
									})}
								</div>
							</section>

							<section className={styles.section}>
								<h3>Invites</h3>
								<div className={styles.list}>
									{team.invites.length === 0 && (
										<p className={styles.muted}>No invites yet.</p>
									)}
									{team.invites.map((invite) => (
										<div className={styles.row} key={invite.id}>
											<div className={styles.identity}>
												<strong>{invite.recipientHint || "Share link"}</strong>
												<span>
													{invite.role} · {invite.useCount} used ·{" "}
													{formatDate(invite.expiresAt)}
												</span>
											</div>
											{invite.revokedAt ? (
												<span className={styles.muted}>Revoked</span>
											) : (
												<button
													type="button"
													disabled={!online || busy}
													onClick={() =>
														revokeInvite.mutate({
															collectionId,
															inviteId: invite.id,
														})
													}
												>
													Revoke
												</button>
											)}
										</div>
									))}
								</div>
							</section>

							<details className={styles.audit}>
								<summary>Activity ({team.events.length})</summary>
								<div className={styles.list}>
									{team.events
										.slice()
										.reverse()
										.map((event) => (
											<div className={styles.auditRow} key={event.id}>
												<span>{eventLabel(event)}</span>
												<time>{formatDate(event.createdAt)}</time>
											</div>
										))}
								</div>
							</details>
						</>
					)}
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
