/**
 * Learn about schemas here:
 * https://jazz.tools/docs/react/schemas/covalues
 */

import { Group, co, z } from "jazz-tools";

// =============================================================================
// Block-Based Schema (New)
// =============================================================================

/** Type-specific data schemas */
const ProductData = z.object({
  url: z.string(),
  imageUrl: z.string().optional(),
  price: z.string().optional(),
  priceValue: z.number().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

const CollectionData = z.object({
  color: z.string().optional(),
  description: z.string().optional(),
  viewMode: z.enum(["grid", "table"]).optional(),
  budget: z.number().optional(),
  // Sharing fields for collaborator access
  sharingGroupId: z.string().optional(), // Group ID for invite-based sharing
  // Publishing fields for draft/publish workflow
  publishedId: z.string().optional(), // ID of the published clone (on draft)
  sourceId: z.string().optional(), // ID of the source draft (on published clone)
  publishedAt: z.date().optional(), // When last published
  childBlockIds: z.array(z.string()).optional(), // IDs of child blocks (for public view)
});

const SlotData = z.object({
  budget: z.number().optional(),
  maxSelections: z.number().optional(),
  selectedProductIds: z.array(z.string()).optional(),
});

const ProjectData = z.object({
  budget: z.number().optional(),
  targetDate: z.string().optional(),
  description: z.string().optional(),
});

/** Universal block primitive - everything is a Block */
export const Block = co.map({
  type: z.enum(["project", "collection", "slot", "product"]),
  name: z.string(),
  // Type-specific data - use the appropriate schema based on block type
  productData: ProductData.optional(),
  collectionData: CollectionData.optional(),
  slotData: SlotData.optional(),
  projectData: ProjectData.optional(),
  // Flat storage: use parentId instead of nested children
  parentId: z.string().optional(),
  sortOrder: z.number().optional(),
  createdAt: z.date(),
});

/** List of blocks - defined after Block */
export const BlockList = co.list(Block);

// =============================================================================
// Sharing Schema
// =============================================================================

/** Reference to a collection shared with the current user */
export const SharedCollectionRef = co.map({
  collectionId: z.string(),
  role: z.enum(["reader", "writer", "admin"]),
  sharedBy: z.string(), // Account ID of the person who shared
  sharedAt: z.date(),
  name: z.string().optional(), // Cached name for display
});

/** List of collections shared with the current user */
export const SharedWithMeList = co.list(SharedCollectionRef);

/** The account profile is an app-specific per-user public `CoMap`
 *  where you can store top-level objects for that user */
export const JazzProfile = co.profile({
  firstName: z.string(),
});

/** The account root is an app-specific per-user private `CoMap`
 *  where you can store top-level objects for that user */
export const AccountRoot = co.map({
  blocks: BlockList.optional(),
  defaultBlockId: z.string().optional(),
  clerkUserId: z.string().optional(),
  sharedWithMe: SharedWithMeList.optional(), // Collections others have shared with this user
});

export const JazzAccount = co
  .account({
    profile: JazzProfile,
    root: AccountRoot,
  })
  .withMigration(async (account) => {
    /** The account migration is run on account creation and on every log-in.
     *  You can use it to set up the account root and any other initial CoValues you need.
     */
    if (!account.$jazz.has("root")) {
      // Create default "My Links" collection block
      const defaultCollection = Block.create(
        {
          type: "collection",
          name: "My Links",
          collectionData: {
            color: "#6366f1",
            description: "Your personal collection of product links",
            viewMode: "grid",
          },
          createdAt: new Date(),
        },
        account.$jazz,
      );

      // Create the blocks list with the default collection
      const blocksList = BlockList.create([defaultCollection], account);

      account.$jazz.set("root", {
        blocks: blocksList,
        defaultBlockId: defaultCollection.$jazz.id,
      });
    } else {
      // Ensure blocks exists for existing accounts
      const root = account.root;
      if (root && root.$isLoaded) {
        const hasBlocks = root.blocks && root.blocks.$isLoaded && root.blocks.length > 0;
        if (!hasBlocks) {
          // Create default collection block if none exists
          const defaultCollection = Block.create(
            {
              type: "collection",
              name: "My Links",
              collectionData: {
                color: "#6366f1",
                description: "Your personal collection of product links",
                viewMode: "grid",
              },
              createdAt: new Date(),
            },
            account.$jazz,
          );

          const blocksList = BlockList.create([defaultCollection], account);
          root.$jazz.set("blocks", blocksList);
          root.$jazz.set("defaultBlockId", defaultCollection.$jazz.id);
        }
      }
    }

    if (!account.$jazz.has("profile")) {
      const group = Group.create();
      group.addMember("everyone", "reader"); // The profile info is visible to everyone

      account.$jazz.set(
        "profile",
        JazzProfile.create(
          {
            name: "Anonymous user",
            firstName: "",
          },
          group,
        ),
      );
    }
  });
