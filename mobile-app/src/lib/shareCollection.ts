import { Group } from "jazz-tools";
import { Block, BlockList } from "@tote/schema";

const BASE_URL = "https://tote.tools";

export function parameterize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\-_\.~\s]/g, "")
    .replace(/[\s]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Publish a collection by creating a group-owned public clone.
 * Returns all created blocks so the caller can add them to me.root.blocks.
 */
export function publishCollection(
  sourceCollection: typeof Block.prototype,
  owner: any
): typeof Block.prototype[] {
  const createdBlocks: typeof Block.prototype[] = [];

  const group = Group.create({ owner });
  group.addMember("everyone", "reader");

  const publishedChildrenList = BlockList.create([], { owner: group });

  const publishedCollection = Block.create(
    {
      type: "collection",
      name: sourceCollection.name,
      collectionData: {
        ...sourceCollection.collectionData,
        sourceId: sourceCollection.$jazz.id,
        publishedId: undefined,
        publishedAt: new Date(),
      },
      children: publishedChildrenList,
      createdAt: sourceCollection.createdAt,
    },
    { owner: group }
  );

  createdBlocks.push(publishedCollection);

  if (sourceCollection.children?.$isLoaded) {
    for (const child of sourceCollection.children) {
      if (!child || !child.$isLoaded) continue;

      if (child.type === "slot") {
        const slotChildrenList = BlockList.create([], { owner: group });
        const clonedSlot = Block.create(
          {
            type: "slot",
            name: child.name,
            slotData: child.slotData,
            children: slotChildrenList,
            sortOrder: child.sortOrder,
            createdAt: child.createdAt,
          },
          { owner: group }
        );
        createdBlocks.push(clonedSlot);
        publishedChildrenList.$jazz.push(clonedSlot);

        if (child.children?.$isLoaded) {
          for (const slotChild of child.children) {
            if (slotChild?.$isLoaded && slotChild.type === "product") {
              const clonedProduct = Block.create(
                {
                  type: "product",
                  name: slotChild.name,
                  productData: slotChild.productData,
                  sortOrder: slotChild.sortOrder,
                  createdAt: slotChild.createdAt,
                },
                { owner: group }
              );
              createdBlocks.push(clonedProduct);
              slotChildrenList.$jazz.push(clonedProduct);
            }
          }
        }
      } else if (child.type === "product") {
        const clonedProduct = Block.create(
          {
            type: "product",
            name: child.name,
            productData: child.productData,
            sortOrder: child.sortOrder,
            createdAt: child.createdAt,
          },
          { owner: group }
        );
        createdBlocks.push(clonedProduct);
        publishedChildrenList.$jazz.push(clonedProduct);
      }
    }
  }

  const slug = sourceCollection.collectionData?.slug || parameterize(sourceCollection.name);

  sourceCollection.$jazz.set("collectionData", {
    ...sourceCollection.collectionData,
    publishedId: publishedCollection.$jazz.id,
    publishedAt: new Date(),
    slug,
  });

  return createdBlocks;
}

/**
 * Unpublish a collection by clearing the publishedId reference.
 */
export function unpublishCollection(sourceCollection: typeof Block.prototype): void {
  const slug = sourceCollection.collectionData?.slug;
  sourceCollection.$jazz.set("collectionData", {
    ...sourceCollection.collectionData,
    publishedId: undefined,
    publishedAt: undefined,
    slug: undefined,
  });
  return slug ? slug : undefined;
}

/**
 * Get the public share URL for a published collection.
 * Prefers the friendly /s/{username}/{slug} format, falls back to /view/{id}.
 */
export function getShareUrl(
  collection: typeof Block.prototype,
  username: string | null | undefined
): string | null {
  const publishedId = collection.collectionData?.publishedId;
  if (!publishedId) return null;
  const slug = collection.collectionData?.slug;
  if (username && slug) {
    return `${BASE_URL}/s/${username}/${slug}`;
  }
  return `${BASE_URL}/view/${publishedId}`;
}

/**
 * Sync published collection slug → ID to Clerk metadata via the web API.
 */
export async function syncPublishedToClerk(
  slug: string,
  publishedId: string,
  name: string,
  token: string
): Promise<void> {
  await fetch(`${BASE_URL}/api/user/sync-published-collections`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ slug, publishedId, name }),
  });
}

/**
 * Remove a published collection slug from Clerk metadata.
 */
export async function removePublishedFromClerk(
  slug: string,
  token: string
): Promise<void> {
  await fetch(`${BASE_URL}/api/user/sync-published-collections`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ slug }),
  });
}
