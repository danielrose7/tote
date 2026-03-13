/**
 * Shared Keychain token cache for Clerk
 *
 * Uses expo-secure-store with a shared Keychain access group
 * so both the main app and the Share Extension can read the same auth token.
 */

import * as SecureStore from "expo-secure-store";

const KEYCHAIN_ACCESS_GROUP = "group.tools.tote.app";

export const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key, {
        keychainAccessGroup: KEYCHAIN_ACCESS_GROUP,
      });
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessGroup: KEYCHAIN_ACCESS_GROUP,
      });
    } catch {
      // Silently fail — token will be re-fetched
    }
  },
  async clearToken(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key, {
        keychainAccessGroup: KEYCHAIN_ACCESS_GROUP,
      });
    } catch {
      // Silently fail
    }
  },
};
