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
 * Query a user's account by their ID
 * Used in API routes to access user data
 */
export async function getUserAccount(userId: string) {
  const worker = await getJazzWorker();

  // TODO: Need to implement account lookup by userId
  // This requires understanding how Jazz stores user ID references
  // For now, we'll document the pattern

  console.log("[Jazz Worker] Looking up account for userId:", userId);

  // Placeholder - actual implementation depends on how
  // we link Clerk userIds to Jazz account IDs
  return null;
}
