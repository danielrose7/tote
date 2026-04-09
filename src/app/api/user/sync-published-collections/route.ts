import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Sync published collection slug → Jazz ID mapping to Clerk publicMetadata.
 *
 * POST: Add/update a slug → publishedId entry
 * DELETE: Remove a slug entry
 */

export async function POST(request: Request) {
  try {
    const { slug, publishedId, name } = await request.json();

    if (!slug || !publishedId) {
      return NextResponse.json(
        { error: "slug and publishedId are required" },
        { status: 400 }
      );
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.CLERK_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing CLERK_SECRET_KEY" },
        { status: 500 }
      );
    }

    // Fetch current metadata to merge
    const userResponse = await fetch(
      `https://api.clerk.com/v1/users/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
      }
    );

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch user" },
        { status: userResponse.status }
      );
    }

    const user = await userResponse.json();
    const currentMetadata = user.public_metadata || {};
    const publishedCollections = currentMetadata.publishedCollections || {};

    publishedCollections[slug] = { id: publishedId, name };

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
            ...currentMetadata,
            publishedCollections,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: "Clerk API error", details: error },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SyncPublished] POST error:", error);
    return NextResponse.json(
      { error: "Failed to sync", details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { slug } = await request.json();

    if (!slug) {
      return NextResponse.json(
        { error: "slug is required" },
        { status: 400 }
      );
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.CLERK_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing CLERK_SECRET_KEY" },
        { status: 500 }
      );
    }

    // Fetch current metadata
    const userResponse = await fetch(
      `https://api.clerk.com/v1/users/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
      }
    );

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch user" },
        { status: userResponse.status }
      );
    }

    const user = await userResponse.json();
    const currentMetadata = user.public_metadata || {};
    const publishedCollections = { ...currentMetadata.publishedCollections };

    // Remove the slug entry
    delete publishedCollections[slug];

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
            ...currentMetadata,
            publishedCollections,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: "Clerk API error", details: error },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SyncPublished] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to remove", details: String(error) },
      { status: 500 }
    );
  }
}
