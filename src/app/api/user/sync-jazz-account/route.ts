import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Sync Jazz account ID to Clerk user metadata
 *
 * Directly syncs the Jazz account ID to Clerk's publicMetadata
 * for server-side lookups.
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

    if (!process.env.CLERK_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing CLERK_SECRET_KEY" },
        { status: 500 }
      );
    }

    console.log("[Sync] Updating Clerk metadata for user:", {
      userId,
      jazzAccountId,
    });

    // Directly update Clerk API
    const response = await fetch(
      `https://api.clerk.com/v1/users/${userId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
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
      console.error("[Sync] Clerk API error:", response.status, error);
      return NextResponse.json(
        { error: "Clerk API error", status: response.status, details: error },
        { status: response.status }
      );
    }

    const user = await response.json();

    console.log("[Sync] Successfully updated Clerk metadata");

    return NextResponse.json(
      {
        success: true,
        message: "Jazz account synced to Clerk",
        userId,
        jazzAccountId,
        publicMetadata: user.public_metadata,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Sync] Error updating Clerk metadata:", error);
    return NextResponse.json(
      { error: "Failed to sync Jazz account", details: String(error) },
      { status: 500 }
    );
  }
}
