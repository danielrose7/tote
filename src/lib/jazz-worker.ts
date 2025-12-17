/**
 * Server-side Jazz worker setup
 * Allows API routes to read/write Jazz data
 */

import { startWorker } from "jazz-tools/worker";
import { JazzAccount } from "../schema";
import { apiKey } from "../apiKey";

let workerInstance: any = null;

export async function getJazzWorker() {
  if (workerInstance) {
    return workerInstance;
  }

  if (!process.env.JAZZ_WORKER_ACCOUNT || !process.env.JAZZ_WORKER_SECRET) {
    throw new Error(
      "Missing Jazz worker credentials. Set JAZZ_WORKER_ACCOUNT and JAZZ_WORKER_SECRET in .env.local"
    );
  }

  const { worker } = await startWorker({
    AccountSchema: JazzAccount,
    syncServer: `wss://cloud.jazz.tools/?key=${apiKey}`,
    accountID: process.env.JAZZ_WORKER_ACCOUNT,
    accountSecret: process.env.JAZZ_WORKER_SECRET,
  });

  workerInstance = worker;
  return worker;
}

/**
 * Get a user's account by their Clerk ID
 * Retrieves the Jazz account ID from Clerk's user metadata
 * Then loads the account using the Jazz worker
 *
 * This requires:
 * 1. Clerk API key for looking up user metadata
 * 2. Jazz account ID stored in user's publicMetadata.jazzAccountId
 */
export async function getUserAccountByClerkId(clerkUserId: string) {
  try {
    if (!process.env.CLERK_SECRET_KEY) {
      throw new Error("Missing CLERK_SECRET_KEY environment variable");
    }

    // Look up user in Clerk to get their Jazz account ID from metadata
    const response = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
    });

    if (!response.ok) {
      console.error("[Jazz Worker] Clerk API error:", response.status);
      return null;
    }

    const clerkUser = await response.json();
    const jazzAccountId = clerkUser.public_metadata?.jazzAccountId;

    if (!jazzAccountId) {
      console.log("[Jazz Worker] No Jazz account ID found for Clerk user:", clerkUserId);
      return null;
    }

    console.log("[Jazz Worker] Found Jazz account ID:", jazzAccountId);

    // Load the Jazz account using the worker
    const worker = await getJazzWorker();
    const account = await worker.load(JazzAccount, jazzAccountId);

    if (!account) {
      console.error("[Jazz Worker] Failed to load Jazz account:", jazzAccountId);
      return null;
    }

    return account;
  } catch (error) {
    console.error("[Jazz Worker] Error looking up account:", error);
    return null;
  }
}
