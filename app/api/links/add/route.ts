import { NextRequest, NextResponse } from "next/server";

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

    // TODO: Validate authToken with Jazz in Phase 2b
    // For now, just accept any token as a placeholder
    const token = body.authToken;
    if (!token) {
      return NextResponse.json(
        { error: "Auth token is required" },
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
    });

    // TODO: Phase 2b - Connect to Jazz and actually save the link
    // For now, return success response
    const linkId = `link_${Date.now()}`;

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
