/**
 * Sync Clerk user ID with Jazz account
 * - Stores Clerk userId in account.root.clerkUserId
 * - Stores Jazz account ID in Clerk's publicMetadata
 * This enables server-side lookups: Clerk ID → Jazz account ID
 */

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useAccount } from "jazz-tools/react";
import { JazzAccount } from "../schema";

export function useSyncClerkUser() {
  const { userId } = useAuth();
  const me = useAccount(JazzAccount, {
    resolve: { root: true },
  });

  useEffect(() => {
    // Sync when we have both userId and loaded root
    if (userId && me?.root && me.root.$isLoaded) {
      // Set clerkUserId in Jazz if not already set
      if (!me.root.clerkUserId) {
        console.log("[Sync] Setting clerkUserId in Jazz:", userId);
        me.root.clerkUserId = userId;
      }

      // Always sync the Jazz account ID to Clerk metadata
      // This ensures the mapping is up-to-date for server-side lookups
      const jazzAccountId = me.$jazz.id;
      console.log("[Sync] Syncing Jazz account ID to Clerk metadata:", jazzAccountId);
      syncJazzAccountIdToClerk(jazzAccountId);
    }
  }, [userId, me?.root, me?.$jazz?.id]);
}

async function syncJazzAccountIdToClerk(jazzAccountId: string) {
  try {
    console.log("[Sync] Starting Jazz account ID sync to Clerk metadata");

    const response = await fetch("/api/user/sync-jazz-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jazzAccountId }),
    });

    const result = await response.json();

    if (response.ok || response.status === 202) {
      console.log("[Sync] Jazz account sync workflow started", result);
      // Workflow is now running in background to update Clerk metadata
    } else {
      console.error("[Sync] Failed to start sync workflow:", result);
    }
  } catch (error) {
    console.error("[Sync] Error starting sync workflow:", error);
  }
}
