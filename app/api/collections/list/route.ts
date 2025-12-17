import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getUserAccountByClerkId } from "../../../../src/lib/jazz-worker";
import { getUserByToken } from "../../../../src/lib/token-auth";

/**
 * Get user's collections for the extension
 *
 * Returns a list of collections with their IDs and names
 * so the extension can populate the collection selector
 */

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

export async function GET(request: NextRequest) {
  try {
    // Try to get userId from Clerk session or bearer token
    let userId: string | null = null;

    // First try Clerk session (web app)
    const clerkAuth = await auth();
    if (clerkAuth.userId) {
      userId = clerkAuth.userId;
    } else {
      // Try bearer token (extension)
      const authHeader = request.headers.get("authorization");
      const bearerToken = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

      if (bearerToken) {
        const tokenInfo = await getUserByToken(bearerToken);
        if (tokenInfo) {
          userId = tokenInfo.userId;
          console.log("[Collections] Authenticated via token");
        }
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - Clerk session or Bearer token required" },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    console.log("[Collections] Fetching collections for user:", userId);

    // Load user's Jazz account
    const account = await getUserAccountByClerkId(userId);

    if (!account) {
      // User hasn't synced their Jazz account yet
      return NextResponse.json(
        {
          collections: [],
          message: "Jazz account not synced. Please visit /settings to sync.",
        },
        { status: 200, headers: getCorsHeaders() }
      );
    }

    // Get collections from the account root
    const root = account.root;
    if (!root?.$isLoaded) {
      return NextResponse.json(
        {
          collections: [],
          message: "Unable to load collections from account.",
        },
        { status: 200, headers: getCorsHeaders() }
      );
    }

    // Map collections to API format
    const collections = (root.collections || []).map((col) => ({
      id: col.$jazz.id,
      name: col.name,
      color: col.color || "#6366f1",
    }));

    console.log(
      "[Collections] Found",
      collections.length,
      "collections for user:",
      userId
    );

    return NextResponse.json(
      {
        collections,
      },
      { status: 200, headers: getCorsHeaders() }
    );
  } catch (error) {
    console.error("[Collections] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch collections", details: String(error) },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
