import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { syncJazzAccountWorkflow } from "../../../workflows/sync-jazz-account";

interface CollectionInfo {
  id: string;
  name: string;
  color?: string;
}

/**
 * Sync Jazz account ID and collections to Clerk user metadata
 *
 * Triggers a workflow to durably sync the Jazz account ID to Clerk's
 * publicMetadata for server-side lookups. Also stores collections in
 * privateMetadata so the extension can fetch them without Jazz access.
 */

export async function POST(request: Request) {
  try {
    const { jazzAccountId, collections } = await request.json();

    if (!jazzAccountId) {
      return NextResponse.json(
        { error: "jazzAccountId is required" },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[API] Triggering syncJazzAccountWorkflow", {
      userId,
      jazzAccountId,
      collectionsCount: collections?.length || 0,
    });

    // Start the workflow - it will handle the sync durably with retries
    await start(syncJazzAccountWorkflow, [userId, jazzAccountId]);

    // Also store collections in private metadata for extension access
    if (collections && Array.isArray(collections)) {
      try {
        const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            private_metadata: {
              collections: collections as CollectionInfo[],
              collectionsUpdatedAt: new Date().toISOString(),
            },
          }),
        });

        if (!response.ok) {
          console.error("[API] Failed to store collections in Clerk:", response.status);
        } else {
          console.log("[API] ✓ Collections stored in Clerk metadata:", collections.length);
        }
      } catch (err) {
        console.error("[API] Error storing collections:", err);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Jazz account sync workflow started",
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("[API] Error starting workflow:", error);
    return NextResponse.json(
      { error: "Failed to start sync workflow", details: String(error) },
      { status: 500 }
    );
  }
}
