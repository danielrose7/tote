import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
	Block,
	JazzAccount,
	SharedCollectionRef,
	SharedWithMeList,
} from "@tote/schema";
import { useAccount } from "jazz-tools/expo";
import React, { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Modal,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import type { InviteParams } from "../hooks/useInviteLink";
import type { RootStackParamList } from "../navigation/types";

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type Props = {
	invite: InviteParams;
	onClose: () => void;
};

type Status = "accepting" | "success" | "error";

export function AcceptInviteSheet({ invite, onClose }: Props) {
	const navigation = useNavigation<NavProp>();
	const [status, setStatus] = useState<Status>("accepting");
	const [collectionName, setCollectionName] = useState("");
	const [errorMessage, setErrorMessage] = useState("");

	const me = useAccount(JazzAccount, {
		resolve: { root: { sharedWithMe: { $each: {} } } },
	});

	useEffect(() => {
		if (!me?.$isLoaded) return;
		accept();
	}, [me?.$isLoaded]);

	async function accept() {
		try {
			await me.acceptInvite(
				invite.collectionId as `co_z${string}`,
				invite.inviteSecret as `inviteSecret_z${string}`,
				Block,
			);

			const block = await Block.load(
				invite.collectionId as `co_z${string}`,
				{},
			);
			if (!block || block.type !== "collection") {
				throw new Error("Could not load collection");
			}

			const name = block.name ?? "Shared collection";
			setCollectionName(name);

			// Track in sharedWithMe
			if (me.root) {
				if (!me.root.sharedWithMe) {
					const list = SharedWithMeList.create([], me);
					me.root.$jazz.set("sharedWithMe", list);
				}
				const already = me.root.sharedWithMe?.find(
					(r) => r?.$isLoaded && r.collectionId === invite.collectionId,
				);
				if (!already) {
					const ref = SharedCollectionRef.create(
						{
							collectionId: invite.collectionId,
							role: invite.role as "reader" | "writer" | "admin",
							sharedBy: "",
							sharedAt: new Date(),
							name,
						},
						me,
					);
					me.root.sharedWithMe?.$jazz.push(ref);
				}
			}

			setStatus("success");
			setTimeout(() => {
				onClose();
				navigation.navigate("CollectionDetail", {
					collectionId: invite.collectionId,
					collectionName: name,
				});
			}, 1200);
		} catch (e) {
			setErrorMessage(e instanceof Error ? e.message : "Something went wrong");
			setStatus("error");
		}
	}

	return (
		<Modal visible transparent animationType="fade" onRequestClose={onClose}>
			<View style={styles.backdrop}>
				<View style={styles.sheet}>
					<View style={styles.handle} />

					{status === "accepting" && (
						<>
							<ActivityIndicator
								size="large"
								color="#6366f1"
								style={styles.icon}
							/>
							<Text style={styles.title}>Accepting invite…</Text>
						</>
					)}

					{status === "success" && (
						<>
							<View style={[styles.iconCircle, styles.iconCircleSuccess]}>
								<Ionicons name="checkmark" size={28} color="#fff" />
							</View>
							<Text style={styles.title}>Invite accepted</Text>
							<Text style={styles.subtitle}>{collectionName}</Text>
						</>
					)}

					{status === "error" && (
						<>
							<View style={[styles.iconCircle, styles.iconCircleError]}>
								<Ionicons name="close" size={28} color="#fff" />
							</View>
							<Text style={styles.title}>Couldn't accept invite</Text>
							<Text style={styles.subtitle}>{errorMessage}</Text>
							<TouchableOpacity style={styles.button} onPress={onClose}>
								<Text style={styles.buttonText}>Dismiss</Text>
							</TouchableOpacity>
						</>
					)}
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.45)",
		justifyContent: "flex-end",
	},
	sheet: {
		backgroundColor: "#fff",
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		padding: 28,
		paddingBottom: 48,
		alignItems: "center",
		gap: 12,
	},
	handle: {
		width: 36,
		height: 4,
		backgroundColor: "#e5e7eb",
		borderRadius: 2,
		marginBottom: 12,
	},
	icon: { marginVertical: 8 },
	iconCircle: {
		width: 60,
		height: 60,
		borderRadius: 30,
		alignItems: "center",
		justifyContent: "center",
		marginVertical: 8,
	},
	iconCircleSuccess: { backgroundColor: "#22c55e" },
	iconCircleError: { backgroundColor: "#ef4444" },
	title: {
		fontSize: 18,
		fontWeight: "700",
		color: "#111",
		textAlign: "center",
	},
	subtitle: { fontSize: 15, color: "#6b7280", textAlign: "center" },
	button: {
		marginTop: 8,
		backgroundColor: "#6366f1",
		paddingHorizontal: 32,
		paddingVertical: 12,
		borderRadius: 10,
	},
	buttonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
