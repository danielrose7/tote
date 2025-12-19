import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

interface VerifyTokenRequest {
  token: string;
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
    const body: VerifyTokenRequest = await request.json();

    if (!body.token) {
      return NextResponse.json(
        { error: "Token required" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Get current user from Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - must be logged in to verify tokens" },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    // TODO: Phase 2c - Query Jazz to verify this token belongs to this user
    // For now, accept any token from authenticated users
    // This will be replaced with actual Jazz validation

    console.log("[Token Verify] User verified:", {
      userId,
      tokenLength: body.token.length,
    });

    return NextResponse.json(
      {
        valid: true,
        userId,
        message: "Token verified",
      },
      { status: 200, headers: getCorsHeaders() }
    );
  } catch (error) {
    console.error("[Token Verify] Error:", error);
    return NextResponse.json(
      { error: "Token verification failed" },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
