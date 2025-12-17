/**
 * Sync Clerk user ID with Jazz account
 * Stores Clerk userId in account.root.clerkUserId for server-side lookups
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
    // Only sync if we have both userId and loaded root
    if (userId && me?.root && me.root.$isLoaded && !me.root.clerkUserId) {
      console.log("[Sync] Setting clerkUserId:", userId);
      me.root.clerkUserId = userId;
    }
  }, [userId, me?.root]);
}
