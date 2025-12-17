import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Debug endpoint to check Clerk user metadata
 * Shows what's currently stored for the authenticated user
 */

export async function GET() {
  try {
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

    const response = await fetch(
      `https://api.clerk.com/v1/users/${userId}`,
      {
        headers: {
          "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[Debug] Clerk API error:", response.status, error);
      return NextResponse.json(
        { error: "Clerk API error", status: response.status, details: error },
        { status: response.status }
      );
    }

    const user = await response.json();

    return NextResponse.json(
      {
        userId,
        email: user.email_addresses?.[0]?.email_address,
        publicMetadata: user.public_metadata,
        privateMetadata: user.private_metadata,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
        raw: user,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Debug] Error fetching user metadata:", error);
    return NextResponse.json(
      { error: "Failed to fetch user metadata", details: String(error) },
      { status: 500 }
    );
  }
}
