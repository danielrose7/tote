import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import {
	ActionSheetIOS,
	ActivityIndicator,
	Alert,
	Linking,
	Modal,
	ScrollView,
	Share,
	StyleSheet,
	Switch,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import type {
	Collection,
	CollectionInviteRecord,
	CollectionMember,
	CollectionTeamData,
	PublicationStatus,
} from "../lib/api";
import {
	createInvite,
	fetchCollectionTeam,
	getPublicationStatus,
	publishCollection as apiPublishCollection,
	removeCollectionMember,
	revokeCollectionInvite,
	transferCollectionOwnership,
	unpublishCollection as apiUnpublishCollection,
	updateCollectionMember,
} from "../lib/api";
import { parameterize } from "../lib/shareCollection";

type Tab = "invite" | "public" | "reuse";
type SharingRole = "editor" | "viewer";

interface Props {
	collection: Collection;
	visible: boolean;
	onClose: () => void;
}

export function ShareCollectionSheet({ collection, visible, onClose }: Props) {
	const { getToken } = useAuth();
	const { user } = useUser();

	const [activeTab, setActiveTab] = useState<Tab>("invite");

	// Invite state
	const [selectedRole, setSelectedRole] = useState<SharingRole>("viewer");
	const [inviteLink, setInviteLink] = useState<string | null>(null);
	const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
	const [inviteCopied, setInviteCopied] = useState(false);

	// Public state
	const [publication, setPublication] = useState<PublicationStatus>(null);
	const [loading, setLoading] = useState(false);
	const [copied, setCopied] = useState(false);
	const [editingSlug, setEditingSlug] = useState(false);
	const [slugInput, setSlugInput] = useState("");
	const [isSavingSlug, setIsSavingSlug] = useState(false);

	// Reuse state
	const [isUpdatingCloning, setIsUpdatingCloning] = useState(false);

	// Team state
	const [team, setTeam] = useState<CollectionTeamData | null>(null);
	const [teamLoading, setTeamLoading] = useState(false);
	const [teamBusy, setTeamBusy] = useState(false);

	useEffect(() => {
		if (!visible) return;
		loadPublication();
		loadTeam();
	}, [visible, collection.id]);

	useEffect(() => {
		// Reset invite link when role changes
		setInviteLink(null);
	}, [selectedRole]);

	async function loadTeam() {
		setTeamLoading(true);
		try {
			const token = await getToken();
			if (!token) return;
			const data = await fetchCollectionTeam(token, collection.id);
			setTeam(data);
		} catch {
			// non-fatal
		} finally {
			setTeamLoading(false);
		}
	}

	async function loadPublication() {
		try {
			const token = await getToken();
			if (!token) return;
			const status = await getPublicationStatus(token, collection.id);
			setPublication(status);
			if (status?.slug) {
				setSlugInput(status.slug);
			} else {
				setSlugInput(parameterize(collection.name ?? ""));
			}
		} catch {
			setPublication(null);
		}
	}

	const isPublished = !!publication;
	const shareUrl = publication?.shareUrl ?? null;
	const currentSlug = publication?.slug;
	const defaultSlug = parameterize(collection.name ?? "");
	const normalizedSlugInput = parameterize(slugInput);
	const isDefaultSlug = normalizedSlugInput === defaultSlug;
	const allowCloning = publication?.allowCloning ?? true;
	const currentLayout = publication?.layout ?? "minimal";

	async function handlePublish() {
		setLoading(true);
		try {
			const token = await getToken();
			if (!token) return;
			const slug = slugInput.trim() ? normalizedSlugInput : defaultSlug;
			const status = await apiPublishCollection(token, collection.id, {
				slug,
				layout: "minimal",
				allowCloning: true,
			});
			setPublication(status);
		} catch (e) {
			console.error("Publish error:", e);
		} finally {
			setLoading(false);
		}
	}

	async function handleUnpublish() {
		setLoading(true);
		try {
			const token = await getToken();
			if (!token) return;
			await apiUnpublishCollection(token, collection.id);
			setPublication(null);
		} catch (e) {
			console.error("Unpublish error:", e);
		} finally {
			setLoading(false);
		}
	}

	async function handleSaveSlug() {
		const newSlug = normalizedSlugInput;
		if (!newSlug || newSlug === currentSlug) {
			setEditingSlug(false);
			return;
		}
		setIsSavingSlug(true);
		try {
			const token = await getToken();
			if (!token) return;
			// Republish with new slug
			const status = await apiPublishCollection(token, collection.id, {
				slug: newSlug,
				layout: currentLayout,
				allowCloning,
			});
			setPublication(status);
			setSlugInput(newSlug);
			setEditingSlug(false);
		} catch (e) {
			console.error("Failed to save slug", e);
		} finally {
			setIsSavingSlug(false);
		}
	}

	async function handleLayoutChange(layout: "minimal" | "feature") {
		if (!publication) return;
		try {
			const token = await getToken();
			if (!token) return;
			const status = await apiPublishCollection(token, collection.id, {
				slug: currentSlug ?? defaultSlug,
				layout,
				allowCloning,
			});
			setPublication(status);
		} catch (e) {
			console.error("Layout change error:", e);
		}
	}

	async function handleToggleCloning(value: boolean) {
		if (!publication) return;
		setIsUpdatingCloning(true);
		try {
			const token = await getToken();
			if (!token) return;
			const status = await apiPublishCollection(token, collection.id, {
				slug: currentSlug ?? defaultSlug,
				layout: currentLayout,
				allowCloning: value,
			});
			setPublication(status);
		} catch (e) {
			console.error("Toggle cloning error:", e);
		} finally {
			setIsUpdatingCloning(false);
		}
	}

	async function handleCopy() {
		if (!shareUrl) return;
		await Clipboard.setStringAsync(shareUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	async function handleShare() {
		if (!shareUrl) return;
		await Share.share({ message: shareUrl, url: shareUrl });
	}

	async function handleText() {
		if (!shareUrl) return;
		const name = collection.name ?? "a collection";
		const body = `Check out my ${name} collection on Tote: ${shareUrl}`;
		await Linking.openURL(`sms:?body=${encodeURIComponent(body)}`);
	}

	async function handleGenerateInvite() {
		setIsGeneratingInvite(true);
		setInviteLink(null);
		try {
			const token = await getToken();
			if (!token) return;
			const result = await createInvite(token, collection.id, selectedRole);
			const link = `https://tote.tools/invite/${result.token}`;
			setInviteLink(link);
		} catch (e) {
			console.error("Failed to generate invite:", e);
		} finally {
			setIsGeneratingInvite(false);
		}
	}

	async function handleCopyInvite() {
		if (!inviteLink) return;
		await Clipboard.setStringAsync(inviteLink);
		setInviteCopied(true);
		setTimeout(() => setInviteCopied(false), 2000);
	}

	async function handleRevokeInvite(invite: CollectionInviteRecord) {
		setTeamBusy(true);
		try {
			const token = await getToken();
			if (!token) return;
			await revokeCollectionInvite(token, collection.id, invite.id);
			setTeam((prev) =>
				prev
					? {
							...prev,
							invites: prev.invites.map((i) =>
								i.id === invite.id
									? { ...i, revokedAt: new Date().toISOString() }
									: i,
							),
						}
					: prev,
			);
		} catch (e) {
			Alert.alert("Error", e instanceof Error ? e.message : "Failed to revoke invite");
		} finally {
			setTeamBusy(false);
		}
	}

	function handleChangeMemberRole(member: CollectionMember) {
		const currentUserId = user?.id;
		if (member.userId === currentUserId || member.role === "owner") return;

		const isOwner = collection.role === "owner";
		const options: string[] = ["Editor", "Viewer"];
		if (isOwner) {
			options.push("Admin");
			options.push("Make owner");
		}
		options.push("Cancel");

		ActionSheetIOS.showActionSheetWithOptions(
			{
				title: `Change role for ${member.userId === currentUserId ? "you" : member.userId.slice(0, 12) + "…"}`,
				options,
				cancelButtonIndex: options.length - 1,
				destructiveButtonIndex: isOwner ? options.length - 2 : undefined,
			},
			async (buttonIndex) => {
				const selected = options[buttonIndex];
				if (selected === "Cancel") return;
				if (selected === "Make owner") {
					Alert.alert(
						"Transfer ownership",
						`Transfer ownership to this member? You will become an admin.`,
						[
							{ text: "Cancel", style: "cancel" },
							{
								text: "Transfer",
								style: "destructive",
								onPress: async () => {
									setTeamBusy(true);
									try {
										const token = await getToken();
										if (!token) return;
										await transferCollectionOwnership(token, collection.id, member.userId);
										await loadTeam();
									} catch (e) {
										Alert.alert("Error", e instanceof Error ? e.message : "Failed to transfer ownership");
									} finally {
										setTeamBusy(false);
									}
								},
							},
						],
					);
					return;
				}
				const roleMap: Record<string, "admin" | "editor" | "viewer"> = {
					Admin: "admin",
					Editor: "editor",
					Viewer: "viewer",
				};
				const newRole = roleMap[selected];
				if (!newRole || newRole === member.role) return;
				setTeamBusy(true);
				try {
					const token = await getToken();
					if (!token) return;
					await updateCollectionMember(token, collection.id, member.userId, newRole);
					setTeam((prev) =>
						prev
							? {
									...prev,
									members: prev.members.map((m) =>
										m.userId === member.userId ? { ...m, role: newRole } : m,
									),
								}
							: prev,
					);
				} catch (e) {
					Alert.alert("Error", e instanceof Error ? e.message : "Failed to update role");
				} finally {
					setTeamBusy(false);
				}
			},
		);
	}

	function handleRemoveMember(member: CollectionMember) {
		Alert.alert(
			"Remove member",
			`Remove this member from the collection?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Remove",
					style: "destructive",
					onPress: async () => {
						setTeamBusy(true);
						try {
							const token = await getToken();
							if (!token) return;
							await removeCollectionMember(token, collection.id, member.userId);
							setTeam((prev) =>
								prev
									? { ...prev, members: prev.members.filter((m) => m.userId !== member.userId) }
									: prev,
							);
						} catch (e) {
							Alert.alert("Error", e instanceof Error ? e.message : "Failed to remove member");
						} finally {
							setTeamBusy(false);
						}
					},
				},
			],
		);
	}

	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onClose}
		>
			<TouchableOpacity
				style={styles.backdrop}
				activeOpacity={1}
				onPress={onClose}
			/>
			<View style={styles.overlay}>
				<View style={styles.sheet}>
					<View style={styles.handle} />
					<Text style={styles.title}>Share Collection</Text>

					{/* Tab bar */}
					<View style={styles.tabBar}>
						{(
							[
								{ key: "invite", label: "Invite" },
								{ key: "public", label: "Public Page" },
								{ key: "reuse", label: "Reuse" },
							] as { key: Tab; label: string }[]
						).map(({ key, label }) => (
							<TouchableOpacity
								key={key}
								style={[styles.tab, activeTab === key && styles.tabActive]}
								onPress={() => setActiveTab(key)}
							>
								<Text
									style={[
										styles.tabLabel,
										activeTab === key && styles.tabLabelActive,
									]}
								>
									{label}
								</Text>
							</TouchableOpacity>
						))}
					</View>

					<ScrollView
						style={styles.panelScroll}
						contentContainerStyle={styles.panelContent}
						showsVerticalScrollIndicator={false}
					>
						{/* ── Invite ── */}
						{activeTab === "invite" && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Invite People</Text>
								<Text style={styles.hint}>
									Invite collaborators to view or edit this collection. They'll
									need to sign in.
								</Text>

								<Text style={styles.fieldLabel}>Permission</Text>
								<View style={styles.roleRow}>
									{(
										[
											{ role: "viewer" as SharingRole, label: "Can view" },
											{ role: "editor" as SharingRole, label: "Can edit" },
										]
									).map(({ role, label }) => (
										<TouchableOpacity
											key={role}
											style={[
												styles.roleChip,
												selectedRole === role && styles.roleChipActive,
											]}
											onPress={() => setSelectedRole(role)}
										>
											<Text
												style={[
													styles.roleChipText,
													selectedRole === role && styles.roleChipTextActive,
												]}
											>
												{label}
											</Text>
										</TouchableOpacity>
									))}
								</View>

								{inviteLink ? (
									<View style={styles.linkBox}>
										<Text style={styles.linkUrl} numberOfLines={1}>
											{inviteLink}
										</Text>
										<TouchableOpacity
											style={styles.linkBtn}
											onPress={handleCopyInvite}
										>
											<Ionicons
												name={inviteCopied ? "checkmark" : "copy-outline"}
												size={16}
												color="#6366f1"
											/>
											<Text style={styles.linkBtnText}>
												{inviteCopied ? "Copied!" : "Copy"}
											</Text>
										</TouchableOpacity>
										<TouchableOpacity
											style={styles.linkBtnSecondary}
											onPress={() => setInviteLink(null)}
										>
											<Text style={styles.linkBtnSecondaryText}>New link</Text>
										</TouchableOpacity>
									</View>
								) : (
									<TouchableOpacity
										style={styles.primaryBtn}
										onPress={handleGenerateInvite}
										disabled={isGeneratingInvite}
									>
										{isGeneratingInvite ? (
											<ActivityIndicator color="#fff" />
										) : (
											<Text style={styles.primaryBtnText}>
												Create Invite Link
											</Text>
										)}
									</TouchableOpacity>
								)}

								{/* Members */}
								{teamLoading && <ActivityIndicator size="small" color="#9ca3af" style={{ marginTop: 8 }} />}
								{team && team.members.length > 0 && (
									<View style={styles.teamSection}>
										<Text style={styles.fieldLabel}>Members</Text>
										{team.members.map((member) => {
											const isCurrentUser = member.userId === user?.id;
											const canManage =
												!isCurrentUser &&
												member.role !== "owner" &&
												(collection.role === "owner" || member.role !== "admin");
											return (
												<View style={styles.memberRow} key={member.userId}>
													<View style={styles.memberInfo}>
														<Text style={styles.memberName}>
															{isCurrentUser ? "You" : member.userId.slice(0, 16) + "…"}
														</Text>
														<Text style={styles.memberRole}>{member.role}</Text>
													</View>
													{canManage && (
														<View style={styles.memberActions}>
															<TouchableOpacity
																style={styles.memberActionBtn}
																disabled={teamBusy}
																onPress={() => handleChangeMemberRole(member)}
															>
																<Text style={styles.memberActionText}>Role</Text>
															</TouchableOpacity>
															<TouchableOpacity
																style={[styles.memberActionBtn, styles.memberRemoveBtn]}
																disabled={teamBusy}
																onPress={() => handleRemoveMember(member)}
															>
																<Text style={styles.memberRemoveText}>Remove</Text>
															</TouchableOpacity>
														</View>
													)}
												</View>
											);
										})}
									</View>
								)}

								{/* Pending Invites */}
								{team && team.invites.length > 0 && (
									<View style={styles.teamSection}>
										<Text style={styles.fieldLabel}>Pending Invites</Text>
										{team.invites.map((invite) => (
											<View style={styles.memberRow} key={invite.id}>
												<View style={styles.memberInfo}>
													<Text style={styles.memberName}>
														{invite.recipientHint || "Share link"}
													</Text>
													<Text style={styles.memberRole}>
														{invite.role} · {invite.useCount} used
													</Text>
												</View>
												{invite.revokedAt ? (
													<Text style={styles.revokedText}>Revoked</Text>
												) : (
													<TouchableOpacity
														style={[styles.memberActionBtn, styles.memberRemoveBtn]}
														disabled={teamBusy}
														onPress={() => handleRevokeInvite(invite)}
													>
														<Text style={styles.memberRemoveText}>Revoke</Text>
													</TouchableOpacity>
												)}
											</View>
										))}
									</View>
								)}
							</View>
						)}

						{/* ── Public Page ── */}
						{activeTab === "public" && (
							<View style={styles.section}>
								{!isPublished ? (
									<>
										<Text style={styles.sectionTitle}>Public Link</Text>
										<Text style={styles.hint}>
											Make this collection publicly viewable — anyone with the
											link can browse your picks without signing in.
										</Text>
										<TouchableOpacity
											style={styles.primaryBtn}
											onPress={handlePublish}
											disabled={loading}
										>
											{loading ? (
												<ActivityIndicator color="#fff" />
											) : (
												<>
													<Ionicons
														name="globe-outline"
														size={18}
														color="#fff"
													/>
													<Text style={styles.primaryBtnText}>Make Public</Text>
												</>
											)}
										</TouchableOpacity>
									</>
								) : (
									<>
										<Text style={styles.sectionTitle}>Public Link</Text>

										{/* Link row */}
										<View style={styles.linkHeader}>
											<Text style={styles.fieldLabel}>Public link</Text>
											{!editingSlug ? (
												<View style={styles.headerActions}>
													<TouchableOpacity
														onPress={() => setEditingSlug(true)}
														style={styles.inlineEditBtn}
													>
														<Ionicons
															name="pencil-outline"
															size={15}
															color="#6366f1"
														/>
														<Text style={styles.inlineEditText}>Edit URL</Text>
													</TouchableOpacity>
													<TouchableOpacity
														style={styles.unpublishBtn}
														onPress={handleUnpublish}
														disabled={loading}
													>
														{loading ? (
															<ActivityIndicator color="#ef4444" size="small" />
														) : (
															<Text style={styles.unpublishText}>
																Unpublish
															</Text>
														)}
													</TouchableOpacity>
												</View>
											) : (
												<View style={styles.inlineEditActions}>
													{!isDefaultSlug && (
														<TouchableOpacity
															style={styles.slugResetBtn}
															onPress={() => setSlugInput(defaultSlug)}
														>
															<Text style={styles.slugResetBtnText}>Reset</Text>
														</TouchableOpacity>
													)}
													<TouchableOpacity
														style={[
															styles.slugSaveBtn,
															isSavingSlug && styles.slugSaveBtnDisabled,
														]}
														onPress={handleSaveSlug}
														disabled={isSavingSlug}
													>
														{isSavingSlug ? (
															<ActivityIndicator size="small" color="#fff" />
														) : (
															<Text style={styles.slugSaveBtnText}>Save</Text>
														)}
													</TouchableOpacity>
													<TouchableOpacity
														style={styles.slugCancelBtn}
														onPress={() => {
															setSlugInput(currentSlug ?? defaultSlug);
															setEditingSlug(false);
														}}
													>
														<Ionicons name="close" size={18} color="#6b7280" />
													</TouchableOpacity>
												</View>
											)}
										</View>

										{!editingSlug ? (
											<Text style={styles.linkUrl} numberOfLines={1}>
												{shareUrl}
											</Text>
										) : (
											<View style={styles.slugEditRow}>
												<Text style={styles.slugPrefix}>tote.tools/</Text>
												<Text style={styles.slugPathPrefix}>
													s/{user?.username}/
												</Text>
												<TextInput
													style={styles.slugInput}
													value={slugInput}
													onChangeText={setSlugInput}
													autoFocus
													autoCapitalize="none"
													autoCorrect={false}
													returnKeyType="done"
													onSubmitEditing={handleSaveSlug}
												/>
											</View>
										)}

										<View style={styles.linkActions}>
											<TouchableOpacity
												style={styles.linkBtn}
												onPress={handleCopy}
											>
												<Ionicons
													name={copied ? "checkmark" : "copy-outline"}
													size={16}
													color="#6366f1"
												/>
												<Text style={styles.linkBtnText}>
													{copied ? "Copied!" : "Copy"}
												</Text>
											</TouchableOpacity>
											<TouchableOpacity
												style={styles.linkBtn}
												onPress={handleText}
											>
												<Ionicons
													name="chatbubble-outline"
													size={16}
													color="#6366f1"
												/>
												<Text style={styles.linkBtnText}>Text</Text>
											</TouchableOpacity>
											<TouchableOpacity
												style={styles.linkBtn}
												onPress={handleShare}
											>
												<Ionicons
													name="share-outline"
													size={16}
													color="#6366f1"
												/>
												<Text style={styles.linkBtnText}>More</Text>
											</TouchableOpacity>
										</View>

										{/* Layout picker */}
										<Text style={styles.fieldLabel}>Layout</Text>
										<View style={styles.layoutRow}>
											{(
												[
													{
														key: "minimal",
														label: "Minimal",
														desc: "Restrained, document-like",
													},
													{
														key: "feature",
														label: "Feature",
														desc: "Stronger hero intro",
													},
												] as {
													key: "minimal" | "feature";
													label: string;
													desc: string;
												}[]
											).map(({ key, label, desc }) => (
												<TouchableOpacity
													key={key}
													style={[
														styles.layoutOption,
														currentLayout === key && styles.layoutOptionActive,
													]}
													onPress={() => handleLayoutChange(key)}
												>
													<Text
														style={[
															styles.layoutOptionLabel,
															currentLayout === key &&
																styles.layoutOptionLabelActive,
														]}
													>
														{label}
													</Text>
													<Text style={styles.layoutOptionDesc}>{desc}</Text>
												</TouchableOpacity>
											))}
										</View>
									</>
								)}
							</View>
						)}

						{/* ── Reuse ── */}
						{activeTab === "reuse" && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Reuse</Text>
								<Text style={styles.hint}>
									Decide whether people with access can copy this collection
									into their own Tote.
								</Text>
								<View style={styles.toggleCard}>
									<View style={styles.toggleCopy}>
										<Text style={styles.toggleTitle}>Allow copies</Text>
										<Text style={styles.toggleDesc}>
											Show the "Make a copy" action on public pages and shared
											collections.
										</Text>
									</View>
									<Switch
										value={allowCloning}
										onValueChange={handleToggleCloning}
										disabled={isUpdatingCloning || !isPublished}
										trackColor={{ false: "#e5e7eb", true: "#6366f1" }}
										thumbColor="#fff"
									/>
								</View>
								{!isPublished && (
									<Text style={styles.fieldHint}>
										Publish a public page first to configure reuse settings.
									</Text>
								)}
							</View>
						)}
					</ScrollView>

					<TouchableOpacity style={styles.doneBtn} onPress={onClose}>
						<Text style={styles.doneBtnText}>Done</Text>
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0,0,0,0.4)",
	},
	overlay: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		height: "45%",
	},
	sheet: {
		flex: 1,
		backgroundColor: "#fff",
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		paddingTop: 16,
		paddingHorizontal: 20,
		paddingBottom: 8,
	},
	handle: {
		width: 36,
		height: 4,
		backgroundColor: "#e5e7eb",
		borderRadius: 2,
		alignSelf: "center",
		marginBottom: 16,
	},
	title: { fontSize: 17, fontWeight: "700", marginBottom: 16 },

	// Tab bar
	tabBar: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: "#e5e7eb",
		marginBottom: 20,
	},
	tab: {
		flex: 1,
		paddingBottom: 10,
		alignItems: "center",
	},
	tabActive: {
		borderBottomWidth: 2,
		borderBottomColor: "#6366f1",
	},
	tabLabel: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
	tabLabelActive: { color: "#6366f1", fontWeight: "700" },

	// Panel
	panelScroll: { flex: 1 },
	panelContent: { paddingBottom: 8 },

	section: { gap: 12 },
	sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
	hint: { fontSize: 14, color: "#6b7280", lineHeight: 20 },
	fieldLabel: {
		fontSize: 12,
		fontWeight: "600",
		color: "#6b7280",
		textTransform: "uppercase",
		letterSpacing: 0.4,
	},
	fieldHint: { fontSize: 12, color: "#9ca3af" },

	// Role chips
	roleRow: { flexDirection: "row", gap: 8 },
	roleChip: {
		paddingHorizontal: 14,
		paddingVertical: 8,
		borderRadius: 20,
		backgroundColor: "#f3f4f6",
		borderWidth: 1,
		borderColor: "#e5e7eb",
	},
	roleChipActive: {
		backgroundColor: "#eef2ff",
		borderColor: "#6366f1",
	},
	roleChipText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
	roleChipTextActive: { color: "#6366f1", fontWeight: "600" },

	// Link display
	linkBox: { gap: 8 },
	linkHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
	linkUrl: {
		fontSize: 14,
		color: "#374151",
		backgroundColor: "#f9fafb",
		padding: 10,
		borderRadius: 8,
	},
	linkActions: { flexDirection: "row", gap: 8 },
	linkBtn: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		borderWidth: 1,
		borderColor: "#6366f1",
		borderRadius: 10,
		paddingVertical: 11,
	},
	linkBtnText: { fontSize: 14, color: "#6366f1", fontWeight: "600" },
	linkBtnSecondary: {
		paddingVertical: 11,
		paddingHorizontal: 14,
		borderRadius: 10,
		backgroundColor: "#f3f4f6",
		alignItems: "center",
	},
	linkBtnSecondaryText: { fontSize: 14, color: "#374151", fontWeight: "500" },

	// Buttons
	primaryBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		backgroundColor: "#6366f1",
		borderRadius: 10,
		paddingVertical: 13,
		marginTop: 4,
	},
	primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
	inlineEditBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
		backgroundColor: "#eef2ff",
	},
	inlineEditText: { fontSize: 13, color: "#6366f1", fontWeight: "600" },
	inlineEditActions: { flexDirection: "row", alignItems: "center", gap: 6 },
	unpublishBtn: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
		backgroundColor: "#fff1f2",
	},
	unpublishText: { fontSize: 13, color: "#ef4444", fontWeight: "600" },

	// Slug editor
	slugEditRow: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#f9fafb",
		borderRadius: 8,
		paddingHorizontal: 10,
		paddingVertical: 6,
		gap: 2,
	},
	slugPrefix: { fontSize: 12, color: "#9ca3af" },
	slugPathPrefix: { fontSize: 12, color: "#9ca3af" },
	slugInput: {
		flex: 1,
		fontSize: 13,
		color: "#374151",
		borderBottomWidth: 1,
		borderBottomColor: "#6366f1",
		paddingVertical: 2,
	},
	slugSaveBtn: {
		backgroundColor: "#6366f1",
		borderRadius: 6,
		paddingHorizontal: 10,
		paddingVertical: 5,
	},
	slugSaveBtnDisabled: { opacity: 0.5 },
	slugSaveBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
	slugResetBtn: {
		borderRadius: 6,
		paddingHorizontal: 10,
		paddingVertical: 5,
		backgroundColor: "#f3f4f6",
	},
	slugResetBtnText: { color: "#4b5563", fontSize: 13, fontWeight: "600" },
	slugCancelBtn: { padding: 2 },

	// Layout picker
	layoutRow: { flexDirection: "row", gap: 10 },
	layoutOption: {
		flex: 1,
		padding: 12,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: "#e5e7eb",
		backgroundColor: "#f9fafb",
		gap: 4,
	},
	layoutOptionActive: {
		borderColor: "#6366f1",
		backgroundColor: "#eef2ff",
	},
	layoutOptionLabel: { fontSize: 13, fontWeight: "600", color: "#374151" },
	layoutOptionLabelActive: { color: "#6366f1" },
	layoutOptionDesc: { fontSize: 12, color: "#9ca3af" },

	// Reuse
	toggleCard: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		backgroundColor: "#f9fafb",
		borderRadius: 10,
		padding: 14,
		gap: 12,
	},
	toggleCopy: { flex: 1, gap: 4 },
	toggleTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
	toggleDesc: { fontSize: 13, color: "#6b7280", lineHeight: 18 },

	// Done button
	doneBtn: {
		alignItems: "center",
		paddingVertical: 14,
		marginTop: 8,
		borderTopWidth: 1,
		borderTopColor: "#f3f4f6",
	},
	doneBtnText: { fontSize: 15, fontWeight: "600", color: "#6366f1" },

	// Team management
	teamSection: { gap: 6, marginTop: 4 },
	memberRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 8,
		borderBottomWidth: 1,
		borderBottomColor: "#f3f4f6",
	},
	memberInfo: { flex: 1, gap: 2 },
	memberName: { fontSize: 13, fontWeight: "600", color: "#111827" },
	memberRole: { fontSize: 12, color: "#9ca3af", textTransform: "capitalize" },
	memberActions: { flexDirection: "row", gap: 6 },
	memberActionBtn: {
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 6,
		backgroundColor: "#f3f4f6",
	},
	memberRemoveBtn: { backgroundColor: "#fff1f2" },
	memberActionText: { fontSize: 12, color: "#374151", fontWeight: "600" },
	memberRemoveText: { fontSize: 12, color: "#ef4444", fontWeight: "600" },
	revokedText: { fontSize: 12, color: "#9ca3af" },
});
