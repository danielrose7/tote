import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { syncJazzAccountWorkflow } from "../../../workflows/sync-jazz-account";

/**
 * Sync Jazz account ID to Clerk user metadata
 *
 * Triggers a workflow to durably sync the Jazz account ID to Clerk's
 * publicMetadata for server-side lookups. The workflow handles retries automatically.
 */

export async function POST(request: Request) {
  try {
    const { jazzAccountId } = await request.json();

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
    });

    // Start the workflow - it will handle the sync durably with retries
    await start(syncJazzAccountWorkflow, [userId, jazzAccountId]);

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
