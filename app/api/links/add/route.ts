import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { saveLinkWorkflow, type SaveLinkInput } from "../../../workflows/save-link";

interface AddLinkRequest {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  price?: string;
  currency?: string;
  collectionId: string;
  authToken?: string;
}

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

async function getJazzAccountId(clerkUserId: string) {
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
      console.error("[API] Clerk API error:", response.status);
      return null;
    }

    const clerkUser = await response.json();
    const jazzAccountId = clerkUser.public_metadata?.jazzAccountId;

    if (!jazzAccountId) {
      console.log("[API] No Jazz account ID found for Clerk user:", clerkUserId);
      return null;
    }

    console.log("[API] Found Jazz account ID:", jazzAccountId);
    return jazzAccountId;
  } catch (error) {
    console.error("[API] Error looking up Jazz account:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: AddLinkRequest = await request.json();

    // Validate required fields
    if (!body.url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    if (!body.collectionId) {
      return NextResponse.json(
        { error: "Collection ID is required" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const token = body.authToken;
    if (!token) {
      return NextResponse.json(
        { error: "Auth token is required" },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    // Verify user is authenticated with Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - user must be authenticated" },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    console.log("[API] Processing link save for user:", userId);

    // Get user's Jazz account ID from Clerk metadata
    const jazzAccountId = await getJazzAccountId(userId);
    if (!jazzAccountId) {
      console.error("[API] Failed to look up Jazz account");
      return NextResponse.json(
        { error: "Failed to look up user account" },
        { status: 500, headers: getCorsHeaders() }
      );
    }

    console.log("[API] Triggering saveLinkWorkflow", {
      userId,
      url: body.url,
      collectionId: body.collectionId,
    });

    // Prepare workflow input
    const workflowInput: SaveLinkInput = {
      userId,
      jazzAccountId,
      url: body.url,
      title: body.title,
      description: body.description,
      imageUrl: body.imageUrl,
      price: body.price,
      collectionId: body.collectionId,
    };

    // Start the workflow - it will handle link persistence durably with retries
    await start(saveLinkWorkflow, [workflowInput]);

    return NextResponse.json(
      {
        success: true,
        message: "Link save workflow started",
      },
      { status: 202, headers: getCorsHeaders() }
    );
  } catch (error) {
    console.error("[API] Error starting workflow:", error);
    return NextResponse.json(
      { error: "Failed to start link save workflow", details: String(error) },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
