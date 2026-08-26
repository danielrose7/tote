import { useAuth, useUser } from '@clerk/expo';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Alert,
  NativeModules,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { RootStackParamList } from '../navigation/types';
import { Button } from '../components/Button';
import { getTokenWithRetry, revokeApiKey } from '../lib/api';
import { useReadableInset } from '../lib/layout';
import { clearAllCachedData } from '../lib/localDb';

const API_BASE_URL = 'https://tote.tools';

type Props = NativeStackScreenProps<RootStackParamList, 'AccountSettings'>;

export function AccountSettingsScreen({ navigation }: Props) {
  const { user } = useUser();
  const { signOut, getToken } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inset = useReadableInset(560);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await user.update({
        firstName,
        lastName,
        username: username.trim() || undefined,
      });
      navigation.goBack();
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  /**
   * Drops everything this device holds for the current account: the local
   * cache, the collection list the Share Extension reads, and the long-lived
   * Share Extension credential in the Keychain.
   */
  async function clearDeviceData() {
    await clearAllCachedData();
    NativeModules.AppGroupModule?.clearCollectionsCache?.();
    NativeModules.AppGroupModule?.clearApiKey?.();
  }

  async function handleSignOut() {
    try {
      // Revoke server-side first — this needs a session token, which signOut
      // is about to take away. Best effort: if it fails (offline, say), the
      // credential is still removed from this device below, so signing out is
      // never blocked by it. The orphaned key is logged, not surfaced, because
      // there is no action the user could take about it.
      try {
        const secret = await NativeModules.AppGroupModule?.getApiKey?.();
        if (secret) {
          const token = await getTokenWithRetry(getToken);
          if (token) await revokeApiKey(token, secret);
        }
      } catch (e) {
        console.warn('Failed to revoke Share Extension key:', e);
      }

      await clearDeviceData();
      await signOut();
    } catch (e: any) {
      const message = e?.message ?? '';
      if (!message.includes('No active account')) {
        console.error('Sign out error:', e);
      }
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account, all collections, saved products, and usage history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ],
    );
  }

  async function confirmDeleteAccount() {
    setDeleting(true);
    try {
      const token = await getTokenWithRetry(getToken);
      const res = await fetch(`${API_BASE_URL}/api/user/delete`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        Alert.alert(
          'Error',
          data.error ?? 'Failed to delete account. Please try again.',
        );
        return;
      }
      // No explicit revoke here — deleting the Clerk user takes its API keys
      // with it, so only this device's copy needs clearing.
      await clearDeviceData();
      await signOut();
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingHorizontal: inset }]}
    >
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
      <Text style={styles.hint}>
        Used for public collection links: tote.tools/s/{username || 'username'}
        /...
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <Button
        label="Save"
        onPress={handleSave}
        isLoading={saving}
        style={styles.saveBtn}
      />

      <View style={styles.divider} />

      <Button
        label="Sign Out"
        variant="ghost"
        onPress={handleSignOut}
        style={styles.signOutBtn}
      />

      <Text style={styles.email}>
        {user?.primaryEmailAddress?.emailAddress}
      </Text>

      <View style={styles.dangerDivider} />

      <Button
        label="Delete account"
        variant="danger"
        onPress={handleDeleteAccount}
        isLoading={deleting}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: {
    paddingVertical: 20,
    paddingBottom: 60,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 20,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 6,
  },
  error: {
    fontSize: 13,
    color: '#ef4444',
    marginTop: 12,
  },
  saveBtn: { marginTop: 28 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
    marginVertical: 32,
  },
  signOutBtn: {},
  email: {
    textAlign: 'center',
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 16,
  },
  dangerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#fee2e2',
    marginVertical: 32,
  },
});
