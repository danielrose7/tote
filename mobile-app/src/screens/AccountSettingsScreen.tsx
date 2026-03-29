import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth, useUser } from "@clerk/expo";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "AccountSettings">;

export function AccountSettingsScreen({ navigation }: Props) {
  const { user } = useUser();
  const { signOut } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await user.update({ firstName, lastName, username: username.trim() || undefined });
      navigation.goBack();
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (e: any) {
      const message = e?.message ?? "";
      if (!message.includes("No active account")) {
        console.error("Sign out error:", e);
      }
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.fieldLabel}>First name</Text>
      <TextInput
        style={styles.fieldInput}
        value={firstName}
        onChangeText={setFirstName}
        placeholder="First name"
        autoCorrect={false}
      />

      <Text style={styles.fieldLabel}>Last name</Text>
      <TextInput
        style={styles.fieldInput}
        value={lastName}
        onChangeText={setLastName}
        placeholder="Last name"
        autoCorrect={false}
      />

      <Text style={styles.fieldLabel}>Username</Text>
      <TextInput
        style={styles.fieldInput}
        value={username}
        onChangeText={setUsername}
        placeholder="username"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.hint}>Used for public collection links: tote.tools/s/{username || "username"}/...</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Save</Text>
        )}
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.email}>{user?.primaryEmailAddress?.emailAddress}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20, paddingBottom: 60 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 20,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111",
  },
  hint: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 6,
  },
  error: {
    fontSize: 13,
    color: "#ef4444",
    marginTop: 12,
  },
  saveBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 28,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e5e7eb",
    marginVertical: 32,
  },
  signOutBtn: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  signOutText: { fontSize: 15, color: "#ef4444", fontWeight: "600" },
  email: {
    textAlign: "center",
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 16,
  },
});
