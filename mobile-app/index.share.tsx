/**
 * Share Extension — minimal test to avoid JavaScriptActor crash.
 *
 * The URL is passed as initial props by the native Swift code
 * (ShareExtensionViewController.swift getShareData).
 * We save it to UserDefaults and close via NotificationCenter.
 */

import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Settings,
  NativeModules,
} from "react-native";

const PENDING_URL_KEY = "tote_pending_shared_url";

type Props = {
  url?: string;
  text?: string;
};

function closeExtension() {
  // expo-share-extension uses NotificationCenter to signal close
  const { ExpoShareExtension } = NativeModules;
  if (ExpoShareExtension?.close) {
    ExpoShareExtension.close();
  }
}

export default function ShareExtension(props: Props) {
  const [saved, setSaved] = useState(false);
  const url = props.url || props.text;

  useEffect(() => {
    if (url) {
      Settings.set({ [PENDING_URL_KEY]: url });
      setSaved(true);
      setTimeout(() => closeExtension(), 800);
    }
  }, []);

  if (!url) {
    return (
      <View style={styles.centered}>
        <Text allowFontScaling={false} style={styles.title}>
          No link found
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => closeExtension()}
        >
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
        {saved ? "Saved to Tote" : "Saving..."}
      </Text>
      <Text
        allowFontScaling={false}
        style={styles.url}
        numberOfLines={2}
      >
        {url}
      </Text>
      <Text allowFontScaling={false} style={styles.hint}>
        Open Tote to add to a collection
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
  hint: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 16,
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
