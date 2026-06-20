/**
 * Share Extension entry point.
 *
 * The URL and page title are extracted by ShareExtensionViewController.swift
 * and passed as initial props. We load the user's collections via the Clerk
 * token from the shared Keychain (group.tools.tote.app) and save directly
 * from the extension — no handoff to the main app needed.
 *
 * Important: do NOT import from "expo-share-extension" here.
 * That module triggers a JavaScriptActor thread crash in the extension context.
 * Use NativeModules.ExpoShareExtension directly instead.
 */

import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/expo";
import * as Crypto from "expo-crypto";
import React, { useEffect, useState } from "react";
import {
	ActivityIndicator,
	AppRegistry,
	NativeModules,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { CLERK_PUBLISHABLE_KEY } from "./src/config";
import type { CaptureCollection } from "./src/lib/api";
import { tokenCache } from "./src/tokenCache";

const API_BASE = process.env.EXPO_PUBLIC_APP_URL ?? "https://tote.tools";

function closeExtension() {
	NativeModules.ExpoShareExtension?.close();
}

async function fetchCaptureCollections(token: string): Promise<CaptureCollection[]> {
	const res = await fetch(`${API_BASE}/api/v2/capture`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const data = await res.json();
	return data.collections;
}

async function saveToCollection(
	token: string,
	{
		collectionId,
		sectionId,
		url,
		title,
	}: { collectionId: string; sectionId?: string; url: string; title?: string },
): Promise<void> {
	const res = await fetch(`${API_BASE}/api/v2/capture`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			id: Crypto.randomUUID(),
			mutationId: Crypto.randomUUID(),
			collectionId,
			sectionId: sectionId ?? null,
			title: title?.trim() || "Untitled",
			url,
		}),
	});
	if (!res.ok) {
		const body = await res.json().catch(() => null);
		throw new Error(body?.error || `HTTP ${res.status}`);
	}
}

type Stage = "loading" | "picking" | "saving" | "done" | "error" | "unauthenticated";

function ShareExtensionContent({ url, title }: { url: string; title?: string }) {
	const { getToken, isSignedIn } = useAuth();
	const [stage, setStage] = useState<Stage>("loading");
	const [collections, setCollections] = useState<CaptureCollection[]>([]);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (isSignedIn === false) {
			setStage("unauthenticated");
			return;
		}
		if (isSignedIn) {
			load();
		}
	}, [isSignedIn]);

	async function load() {
		try {
			setStage("loading");
			const token = await getToken();
			if (!token) {
				setStage("unauthenticated");
				return;
			}
			const cols = await fetchCaptureCollections(token);
			setCollections(cols);
			setStage("picking");
		} catch {
			setError("Could not load collections.");
			setStage("error");
		}
	}

	async function handleSave(collectionId: string, sectionId?: string) {
		setStage("saving");
		try {
			const token = await getToken();
			if (!token) {
				setStage("unauthenticated");
				return;
			}
			await saveToCollection(token, { collectionId, sectionId, url, title });
			setStage("done");
			setTimeout(closeExtension, 800);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not save.");
			setStage("error");
		}
	}

	const displayUrl = url.replace(/^https?:\/\//, "").replace(/\/$/, "");

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.appName} allowFontScaling={false}>
					Tote
				</Text>
				<TouchableOpacity
					onPress={closeExtension}
					hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
				>
					<Text style={styles.closeBtn} allowFontScaling={false}>
						✕
					</Text>
				</TouchableOpacity>
			</View>

			<View style={styles.preview}>
				{title ? (
					<Text style={styles.previewTitle} numberOfLines={2} allowFontScaling={false}>
						{title}
					</Text>
				) : null}
				<Text style={styles.previewUrl} numberOfLines={1} allowFontScaling={false}>
					{displayUrl}
				</Text>
			</View>

			{stage === "loading" && (
				<View style={styles.centered}>
					<ActivityIndicator color="#6366f1" />
				</View>
			)}

			{stage === "saving" && (
				<View style={styles.centered}>
					<ActivityIndicator color="#6366f1" />
					<Text style={styles.statusText} allowFontScaling={false}>
						Saving…
					</Text>
				</View>
			)}

			{stage === "done" && (
				<View style={styles.centered}>
					<Text style={styles.doneCheck} allowFontScaling={false}>
						✓
					</Text>
					<Text style={styles.doneText} allowFontScaling={false}>
						Added to Tote
					</Text>
				</View>
			)}

			{stage === "unauthenticated" && (
				<View style={styles.centered}>
					<Text style={styles.statusText} allowFontScaling={false}>
						Open Tote and sign in first.
					</Text>
					<TouchableOpacity style={styles.actionButton} onPress={closeExtension}>
						<Text style={styles.actionButtonText} allowFontScaling={false}>
							Close
						</Text>
					</TouchableOpacity>
				</View>
			)}

			{stage === "error" && (
				<View style={styles.centered}>
					<Text style={styles.errorText} allowFontScaling={false}>
						{error}
					</Text>
					<TouchableOpacity style={styles.actionButton} onPress={load}>
						<Text style={styles.actionButtonText} allowFontScaling={false}>
							Retry
						</Text>
					</TouchableOpacity>
				</View>
			)}

			{stage === "picking" && (
				<ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
					<Text style={styles.listLabel} allowFontScaling={false}>
						Save to
					</Text>
					{collections.map((col) => {
						const isExpanded = expandedId === col.id;
						return (
							<View key={col.id}>
								<TouchableOpacity
									style={styles.collectionRow}
									onPress={() => {
										if (col.sections.length === 0) {
											handleSave(col.id);
										} else {
											setExpandedId(isExpanded ? null : col.id);
										}
									}}
								>
									<View
										style={[
											styles.colorDot,
											{ backgroundColor: col.color ?? "#6366f1" },
										]}
									/>
									<Text style={styles.collectionName} allowFontScaling={false}>
										{col.name}
									</Text>
									{col.sections.length > 0 && (
										<Text style={styles.chevron} allowFontScaling={false}>
											{isExpanded ? "▾" : "›"}
										</Text>
									)}
								</TouchableOpacity>

								{isExpanded && (
									<>
										<TouchableOpacity
											style={styles.sectionRow}
											onPress={() => handleSave(col.id)}
										>
											<Text style={styles.noSectionText} allowFontScaling={false}>
												No section
											</Text>
										</TouchableOpacity>
										{col.sections.map((section) => (
											<TouchableOpacity
												key={section.id}
												style={styles.sectionRow}
												onPress={() => handleSave(col.id, section.id)}
											>
												<Text style={styles.sectionName} allowFontScaling={false}>
													{section.name}
												</Text>
											</TouchableOpacity>
										))}
									</>
								)}
							</View>
						);
					})}
				</ScrollView>
			)}
		</SafeAreaView>
	);
}

type Props = {
	url?: string;
	text?: string;
	title?: string;
	preprocessingResults?: Record<string, unknown>;
};

export default function ShareExtension(props: Props) {
	const url = props.url || props.text;
	const title =
		(props.preprocessingResults?.title as string | undefined) || props.title;

	if (!url) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.centered}>
					<Text style={styles.statusText} allowFontScaling={false}>
						No link found.
					</Text>
					<TouchableOpacity style={styles.actionButton} onPress={closeExtension}>
						<Text style={styles.actionButtonText} allowFontScaling={false}>
							Close
						</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
			<ClerkLoaded>
				<ShareExtensionContent url={url} title={title} />
			</ClerkLoaded>
		</ClerkProvider>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#fff",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 20,
		paddingVertical: 14,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#e5e7eb",
	},
	appName: {
		fontSize: 17,
		fontWeight: "700",
		color: "#111827",
	},
	closeBtn: {
		fontSize: 16,
		color: "#9ca3af",
		fontWeight: "600",
	},
	preview: {
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#f3f4f6",
	},
	previewTitle: {
		fontSize: 15,
		fontWeight: "600",
		color: "#111827",
		marginBottom: 2,
	},
	previewUrl: {
		fontSize: 13,
		color: "#9ca3af",
	},
	centered: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
		padding: 24,
	},
	statusText: {
		fontSize: 15,
		color: "#6b7280",
		textAlign: "center",
	},
	doneCheck: {
		fontSize: 40,
		color: "#22c55e",
	},
	doneText: {
		fontSize: 17,
		fontWeight: "600",
		color: "#111827",
	},
	errorText: {
		fontSize: 15,
		color: "#ef4444",
		textAlign: "center",
	},
	actionButton: {
		backgroundColor: "#6366f1",
		paddingHorizontal: 20,
		paddingVertical: 10,
		borderRadius: 8,
	},
	actionButtonText: {
		color: "#fff",
		fontWeight: "600",
		fontSize: 14,
	},
	list: {
		flex: 1,
		paddingHorizontal: 20,
	},
	listLabel: {
		fontSize: 13,
		fontWeight: "600",
		color: "#6b7280",
		textTransform: "uppercase",
		letterSpacing: 0.5,
		marginTop: 16,
		marginBottom: 8,
	},
	collectionRow: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 13,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#f3f4f6",
		gap: 10,
	},
	colorDot: {
		width: 11,
		height: 11,
		borderRadius: 6,
	},
	collectionName: {
		flex: 1,
		fontSize: 16,
		color: "#111827",
	},
	chevron: {
		fontSize: 18,
		color: "#9ca3af",
	},
	sectionRow: {
		paddingVertical: 11,
		paddingLeft: 36,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#f3f4f6",
	},
	sectionName: {
		fontSize: 15,
		color: "#374151",
	},
	noSectionText: {
		fontSize: 15,
		color: "#9ca3af",
	},
});

AppRegistry.registerComponent("shareExtension", () => ShareExtension);
