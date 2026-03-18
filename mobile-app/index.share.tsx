/**
 * Share Extension entry point.
 *
 * The URL is passed as initial props by the native Swift code
 * (ShareExtensionViewController.swift getShareData).
 *
 * We use openHostApp() to open the main Tote app with the URL embedded in
 * a deep-link query param, which is the correct cross-process handoff mechanism.
 * Settings (NSUserDefaults) is sandboxed per process so can't cross the boundary.
 */

import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  AppRegistry,
} from "react-native";
import { close, openHostApp } from "expo-share-extension";

type Props = {
  url?: string;
  text?: string;
};

export default function ShareExtension(props: Props) {
  const [ready, setReady] = useState(false);
  const url = props.url || props.text;

  useEffect(() => {
    if (url) {
      setReady(true);
      // Open main app with the URL as a deep-link param, then close the sheet
      setTimeout(() => {
        openHostApp("?pendingUrl=" + encodeURIComponent(url));
        close();
      }, 600);
    }
  }, []);

  if (!url) {
    return (
      <View style={styles.centered}>
        <Text allowFontScaling={false} style={styles.title}>
          No link found
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => close()}>
          <Text allowFontScaling={false} style={styles.buttonText}>
            Close
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.centered}>
      <Text allowFontScaling={false} style={styles.checkmark}>
        ✓
      </Text>
      <Text allowFontScaling={false} style={styles.title}>
        {ready ? "Opening Tote…" : "Saving…"}
      </Text>
      <Text allowFontScaling={false} style={styles.url} numberOfLines={2}>
        {url}
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
  url: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 8,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

AppRegistry.registerComponent("shareExtension", () => ShareExtension);
