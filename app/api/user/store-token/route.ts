import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

interface StoreTokenRequest {
  token: string;
  tokenId: string;
  jazzAccountId: string;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: StoreTokenRequest = await request.json();

    if (!process.env.CLERK_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing CLERK_SECRET_KEY" },
        { status: 500 }
      );
    }

    // Store the token mapping in Clerk's private metadata
    // Format: { "tokens": { "token_value": { "id": "...", "jazzAccountId": "..." } } }
    const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
    });

    if (!response.ok) {
      console.error("[Store Token] Clerk API error:", response.status);
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 500 }
      );
    }

    const clerkUser = await response.json();
    const privateMetadata = clerkUser.private_metadata || {};

    // Store token mapping
    if (!privateMetadata.tokens) {
      privateMetadata.tokens = {};
    }
    privateMetadata.tokens[body.token] = {
      id: body.tokenId,
      jazzAccountId: body.jazzAccountId,
      createdAt: new Date().toISOString(),
    };

    // Update Clerk user with new metadata
    const updateResponse = await fetch(
      `https://api.clerk.com/v1/users/${userId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          private_metadata: privateMetadata,
        }),
      }
    );

    if (!updateResponse.ok) {
      console.error("[Store Token] Update failed:", updateResponse.status);
      return NextResponse.json(
        { error: "Failed to store token" },
        { status: 500 }
      );
    }

    console.log("[Store Token] Token stored for user:", userId);

    return NextResponse.json(
      { success: true, message: "Token stored" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Store Token] Error:", error);
    return NextResponse.json(
      { error: "Failed to store token", details: String(error) },
      { status: 500 }
    );
  }
}
