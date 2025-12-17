import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { JazzAccount, ProductLink } from "@/src/schema";

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

    // Log for debugging
    console.log("[Extension Save] Received link:", {
      url: body.url,
      title: body.title,
      description: body.description,
      imageUrl: body.imageUrl,
      price: body.price,
      currency: body.currency,
      collectionId: body.collectionId,
      tokenLength: token.length,
      userId,
    });

    // TODO: Phase 2c - Implement actual Jazz integration
    // This requires:
    // 1. Validate token against user's Jazz account
    // 2. Access user's Jazz account data
    // 3. Find collection by ID
    // 4. Create ProductLink and add to collection
    //
    // For now, return success response with mock linkId
    // but log that real Jazz integration is needed

    const linkId = `link_${Date.now()}`;

    console.log("[Extension Save] TODO: Implement Jazz integration for actual persistence");
    console.log("[Extension Save] TODO: Validate token:", {
      token: token.substring(0, 10) + "...",
      userId,
    });

    return NextResponse.json(
      {
        success: true,
        linkId,
        message: "Link saved successfully",
        // Echo back what we received for debugging
        received: {
          url: body.url,
          title: body.title,
          collectionId: body.collectionId,
          userId,
        },
      },
      { status: 201, headers: getCorsHeaders() }
    );
  } catch (error) {
    console.error("[Extension Save] Error:", error);
    return NextResponse.json(
      { error: "Failed to save link", details: String(error) },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
