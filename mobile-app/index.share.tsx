/**
 * Share Extension entry point.
 *
 * The URL is written to the App Group shared container by
 * ShareExtensionViewController.swift (Swift side) before this JS runs.
 * JS just shows the confirmation UI and closes via NativeModules.
 *
 * Important: do NOT import from "expo-share-extension" here.
 * That module triggers a JavaScriptActor thread crash in the extension context.
 */

import React from "react";
import { AppRegistry, StyleSheet, Text, View } from "react-native";

type Props = {
	url?: string;
	text?: string;
};

// Closing is handled by Swift (ShareExtensionViewController) after a delay.
// JS only renders the confirmation UI.

export default function ShareExtension(props: Props) {
	const url = props.url || props.text;

	if (!url) {
		return (
			<View style={styles.centered}>
				<Text allowFontScaling={false} style={styles.title}>
					No link found
				</Text>
			</View>
		);
	}

	return (
		<View style={styles.centered}>
			<Text allowFontScaling={false} style={styles.checkmark}>
				✓
			</Text>
			<Text allowFontScaling={false} style={styles.title}>
				Added to Tote
			</Text>
			<Text allowFontScaling={false} style={styles.subtitle}>
				Open Tote to add it to a collection
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	centered: {
		flex: 1,
		backgroundColor: "#fff",
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
	},
	checkmark: {
		fontSize: 48,
		color: "#22c55e",
		marginBottom: 8,
	},
	title: {
		fontSize: 20,
		fontWeight: "700",
		color: "#111",
	},
	subtitle: {
		fontSize: 14,
		color: "#9ca3af",
		marginTop: 6,
		textAlign: "center",
	},
});

AppRegistry.registerComponent("shareExtension", () => ShareExtension);
