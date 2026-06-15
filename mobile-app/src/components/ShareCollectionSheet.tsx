import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { type Block, JazzAccount } from "@tote/schema";
import * as Clipboard from "expo-clipboard";
import { useAccount } from "jazz-tools/expo";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
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
import {
	generateCollectionInviteLink,
	getShareUrl,
	parameterize,
	publishCollection,
	removePublishedFromClerk,
	republishCollection,
	type SharingRole,
	syncPublishedToClerk,
	unpublishCollection,
} from "../lib/shareCollection";

type Tab = "invite" | "public" | "reuse";

interface Props {
	collection: typeof Block.prototype;
	visible: boolean;
	onClose: () => void;
}

export function ShareCollectionSheet({ collection, visible, onClose }: Props) {
	const { getToken } = useAuth();
	const { user } = useUser();
	const me = useAccount(JazzAccount, { resolve: { root: { blocks: true } } });

	const [activeTab, setActiveTab] = useState<Tab>("invite");

	// Invite state
	const [selectedRole, setSelectedRole] = useState<SharingRole>("reader");
	const [inviteLink, setInviteLink] = useState<string | null>(null);
	const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
	const [inviteCopied, setInviteCopied] = useState(false);

	// Public state
	const [loading, setLoading] = useState(false);
	const [isRepublishing, setIsRepublishing] = useState(false);
	const [copied, setCopied] = useState(false);
	const [editingSlug, setEditingSlug] = useState(false);
	const [slugInput, setSlugInput] = useState("");
	const [isSavingSlug, setIsSavingSlug] = useState(false);
	const [description, setDescription] = useState("");

	const publishedId = collection.collectionData?.publishedId;
	const isPublished = !!publishedId;
	const shareUrl = getShareUrl(collection, user?.username);
	const currentSlug = collection.collectionData?.slug;
	const defaultSlug = parameterize(collection.name ?? "");
	const normalizedSlugInput = parameterize(slugInput);
	const isDefaultSlug = normalizedSlugInput === defaultSlug;

	useEffect(() => {
		setSlugInput(currentSlug || defaultSlug);
	}, [currentSlug, collection.name]);

	useEffect(() => {
		setDescription(collection.collectionData?.description || "");
	}, [collection.collectionData?.description]);

	// Reset invite link when role changes
	useEffect(() => {
		setInviteLink(null);
	}, [selectedRole]);

	async function handlePublish() {
		if (!me) return;
		setLoading(true);
		try {
			const createdBlocks = publishCollection(collection, me);
			if (me.root?.blocks?.$isLoaded) {
				for (const block of createdBlocks) {
					me.root.blocks.$jazz.push(block);
				}
			}
			const slug = collection.collectionData?.slug;
			const pid = collection.collectionData?.publishedId;
			if (slug && pid) {
				const token = await getToken();
				if (token) {
					await syncPublishedToClerk(slug, pid, collection.name ?? "", token);
				}
			}
		} catch (e) {
			console.error("Publish error:", e);
		} finally {
			setLoading(false);
		}
	}

	async function handleUnpublish() {
		setLoading(true);
		try {
			const slug = collection.collectionData?.slug;
			unpublishCollection(collection);
			if (slug) {
				const token = await getToken();
				if (token) await removePublishedFromClerk(slug, token);
			}
		} catch (e) {
			console.error("Unpublish error:", e);
		} finally {
			setLoading(false);
		}
	}

	async function handleRepublish() {
		if (!me) return;
		setIsRepublishing(true);
		try {
			const allBlocks: (typeof Block.prototype | null)[] = [];
			if (me.root?.blocks?.$isLoaded) {
				for (let i = 0; i < me.root.blocks.length; i++) {
					allBlocks.push(me.root.blocks[i]);
				}
			}
			republishCollection(collection, me, allBlocks);

			const slug = collection.collectionData?.slug;
			const pid = collection.collectionData?.publishedId;
			if (slug && pid) {
				const token = await getToken();
				if (token) {
					await syncPublishedToClerk(slug, pid, collection.name ?? "", token);
				}
			}
		} catch (e) {
			console.error("Republish error:", e);
		} finally {
			setIsRepublishing(false);
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

	async function handleSaveSlug() {
		const newSlug = normalizedSlugInput;
		if (!newSlug || newSlug === currentSlug) {
			setEditingSlug(false);
			return;
		}
		setIsSavingSlug(true);
		try {
			const oldSlug = currentSlug;
			collection.$jazz.set("collectionData", {
				...collection.collectionData,
				slug: newSlug,
			});
			const token = await getToken();
			if (token) {
				if (oldSlug) await removePublishedFromClerk(oldSlug, token);
				const pid = collection.collectionData?.publishedId;
				if (pid) {
					await syncPublishedToClerk(
						newSlug,
						pid,
						collection.name ?? "",
						token,
					);
				}
			}
			setSlugInput(newSlug);
			setEditingSlug(false);
		} catch (e) {
			console.error("Failed to save slug", e);
		} finally {
			setIsSavingSlug(false);
		}
	}

	function handleDescriptionChange(value: string) {
		setDescription(value);
		collection.$jazz.set("collectionData", {
			...collection.collectionData,
			description: value.trim() || undefined,
		});
	}

	function handleLayoutChange(layout: "minimal" | "feature") {
		collection.$jazz.set("collectionData", {
			...collection.collectionData,
			publicLayout: layout,
		});
	}

	function handleToggleCloning(value: boolean) {
		collection.$jazz.set("collectionData", {
			...collection.collectionData,
			allowCloning: value,
		});
	}

	async function handleGenerateInvite() {
		setIsGeneratingInvite(true);
		setInviteLink(null);
		try {
			const link = generateCollectionInviteLink(collection, selectedRole);
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

	const currentLayout = collection.collectionData?.publicLayout ?? "minimal";
	const allowCloning = collection.collectionData?.allowCloning ?? true;

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
											{ role: "reader", label: "Can view" },
											{ role: "writer", label: "Can edit" },
											{ role: "admin", label: "Admin" },
										] as { role: SharingRole; label: string }[]
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

										{/* Description */}
										<Text style={styles.fieldLabel}>Public Intro</Text>
										<TextInput
											style={styles.textarea}
											value={description}
											onChangeText={handleDescriptionChange}
											placeholder="A lightweight setup for everyday training and travel."
											placeholderTextColor="#9ca3af"
											multiline
											numberOfLines={3}
											maxLength={200}
										/>
										<Text style={styles.fieldHint}>
											Shown at the top of the public page.
										</Text>

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

										{/* Update public version */}
										<TouchableOpacity
											style={styles.updateBtn}
											onPress={handleRepublish}
											disabled={isRepublishing}
										>
											{isRepublishing ? (
												<ActivityIndicator color="#6366f1" size="small" />
											) : (
												<Text style={styles.updateBtnText}>
													Update Public Version
												</Text>
											)}
										</TouchableOpacity>
										<Text style={styles.fieldHint}>
											Pushes your latest changes to the public page.
										</Text>
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
										trackColor={{ false: "#e5e7eb", true: "#6366f1" }}
										thumbColor="#fff"
									/>
								</View>
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
	updateBtn: {
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: "#6366f1",
		borderRadius: 10,
		paddingVertical: 11,
		marginTop: 4,
	},
	updateBtnText: { fontSize: 14, color: "#6366f1", fontWeight: "600" },
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

	// Description
	textarea: {
		backgroundColor: "#f9fafb",
		borderRadius: 8,
		padding: 10,
		fontSize: 14,
		color: "#374151",
		minHeight: 72,
		textAlignVertical: "top",
	},

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
});
