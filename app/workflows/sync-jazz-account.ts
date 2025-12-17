"use workflow";

import { FatalError } from "workflow";

/**
 * Workflow: Sync Jazz Account ID to Clerk
 *
 * This workflow handles the durable task of syncing a user's Jazz account ID
 * to their Clerk public metadata. Steps are automatically retried on failure.
 */

export async function syncJazzAccountWorkflow(
  clerkUserId: string,
  jazzAccountId: string
) {
  "use workflow";

  console.log("[Workflow] Starting syncJazzAccountWorkflow", {
    clerkUserId,
    jazzAccountId,
  });

  // Call the step to update Clerk metadata
  await updateClerkMetadata(clerkUserId, jazzAccountId);

  console.log("[Workflow] syncJazzAccountWorkflow completed");
}

async function updateClerkMetadata(
  clerkUserId: string,
  jazzAccountId: string
) {
  "use step";

  try {
    if (!clerkUserId || !jazzAccountId) {
      throw new FatalError("Missing clerkUserId or jazzAccountId");
    }

    if (!process.env.CLERK_SECRET_KEY) {
      throw new FatalError("Missing CLERK_SECRET_KEY environment variable");
    }

    console.log("[Step] Updating Clerk metadata", {
      clerkUserId,
      jazzAccountId,
    });

    const response = await fetch(
      `https://api.clerk.com/v1/users/${clerkUserId}`,
      {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          public_metadata: {
            jazzAccountId,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[Step] Clerk API error:", response.status, error);
      throw new Error(`Clerk API error: ${response.status} - ${error}`);
    }

    const user = await response.json();
    console.log("[Step] Successfully updated Clerk metadata");
    return user;
  } catch (error) {
    if (error instanceof FatalError) {
      throw error;
    }
    console.error("[Step] Error updating Clerk metadata:", error);
    throw error; // Will be retried
  }
}
