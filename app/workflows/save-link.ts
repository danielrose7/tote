"use workflow";

import { FatalError } from "workflow";
import { ProductLink } from "../../../src/schema";

/**
 * Workflow: Save Link from Extension
 *
 * This workflow handles the durable process of saving a link from the extension
 * to the user's Jazz account. Steps are automatically retried on failure.
 */

export interface SaveLinkInput {
  userId: string;
  jazzAccountId: string;
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  price?: string;
  collectionId: string;
}

export async function saveLinkWorkflow(input: SaveLinkInput) {
  "use workflow";

  console.log("[Workflow] Starting saveLinkWorkflow", {
    userId: input.userId,
    url: input.url,
    collectionId: input.collectionId,
  });

  // Validate the Jazz account can be accessed
  await validateJazzAccount(input.userId, input.jazzAccountId);

  // Save the link to Jazz
  const linkId = await persistLinkToJazz(input);

  // Update token usage (mark last used)
  // TODO: Implement when token tracking is added

  console.log("[Workflow] saveLinkWorkflow completed with linkId:", linkId);
  return linkId;
}

async function validateJazzAccount(userId: string, jazzAccountId: string) {
  "use step";

  try {
    if (!userId || !jazzAccountId) {
      throw new FatalError("Missing userId or jazzAccountId");
    }

    console.log("[Step] Validating Jazz account", { userId, jazzAccountId });

    // TODO: Implement actual Jazz account validation
    // For now, just log that we would validate
    return true;
  } catch (error) {
    if (error instanceof FatalError) {
      throw error;
    }
    console.error("[Step] Error validating Jazz account:", error);
    throw error; // Will be retried
  }
}

async function persistLinkToJazz(input: SaveLinkInput) {
  "use step";

  try {
    if (!input.url || !input.collectionId) {
      throw new FatalError("Missing url or collectionId");
    }

    console.log("[Step] Persisting link to Jazz", {
      url: input.url,
      title: input.title,
      collectionId: input.collectionId,
    });

    // TODO: Get Jazz worker to load the account and save the link
    // For now, use a mock implementation
    // In production, this will:
    // 1. Get the Jazz worker instance
    // 2. Load the user's account using jazzAccountId
    // 3. Find the collection by collectionId
    // 4. Create a ProductLink and add it to the collection
    // 5. Return the link ID

    const linkId = `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log("[Step] Link persisted with ID:", linkId);
    return linkId;
  } catch (error) {
    if (error instanceof FatalError) {
      throw error;
    }
    console.error("[Step] Error persisting link:", error);
    throw error; // Will be retried
  }
}
